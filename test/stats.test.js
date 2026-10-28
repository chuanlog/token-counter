import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { Store } from '../server/db.js';
import { buildDashboard, dayKey } from '../server/stats.js';

function makeStore(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-lens-test-'));
  const store = new Store(path.join(dir, 'test.db'));
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return store;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function record({
  line,
  model,
  date,
  promptTokens,
  completionTokens,
  promptMs = 0,
  genMs = 0,
  status = 'ok',
}) {
  const ts = date.getTime();
  const day = dayKey(date);
  const hour = `${day}T${pad2(date.getHours())}`;
  return {
    file: 'test.log',
    line,
    ts,
    startedAt: ts - promptMs - genMs,
    day,
    hour,
    minute: `${hour}:${pad2(date.getMinutes())}`,
    model,
    source: 'api',
    endpoint: 'chat.completions',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    promptMs,
    genMs,
    totalMs: promptMs + genMs,
    promptTps: promptMs ? promptTokens / (promptMs / 1000) : null,
    tps: genMs ? completionTokens / (genMs / 1000) : null,
    ttftMs: promptMs ? promptMs + (completionTokens > 0 && genMs > 0 ? genMs / completionTokens : 0) : null,
    stream: 0,
    status,
    error: status === 'error' ? 'boom' : null,
  };
}

function seed(store) {
  store.insertRequests([
    record({
      line: 1,
      model: 'alpha',
      date: new Date(2026, 9, 25, 12, 0, 0),
      promptTokens: 1000,
      completionTokens: 100,
      promptMs: 1000,
      genMs: 1000,
    }),
    record({
      line: 2,
      model: 'beta',
      date: new Date(2026, 9, 26, 12, 0, 0),
      promptTokens: 200,
      completionTokens: 50,
      promptMs: 500,
      genMs: 500,
    }),
    record({
      line: 3,
      model: 'alpha',
      date: new Date(2026, 9, 26, 13, 0, 0),
      promptTokens: 100,
      completionTokens: 0,
      status: 'error',
    }),
  ]);
}

test('汇总、分模型与加权速度', (t) => {
  const store = makeStore(t);
  seed(store);
  const dashboard = buildDashboard(
    store,
    { from: '2026-10-25', to: '2026-10-26', model: 'all', granularity: 'day' },
    {},
  );

  assert.equal(dashboard.filter.granularity, 'day');
  assert.deepEqual(
    {
      requests: dashboard.summary.requests,
      errors: dashboard.summary.errors,
      prompt: dashboard.summary.promptTokens,
      completion: dashboard.summary.completionTokens,
      total: dashboard.summary.totalTokens,
      avgTps: dashboard.summary.avgTps,
      avgTtft: dashboard.summary.avgTtftMs,
      models: dashboard.summary.models,
      activeDays: dashboard.summary.activeDays,
      successRate: dashboard.summary.successRate,
    },
    {
      requests: 3,
      errors: 1,
      prompt: 1300,
      completion: 150,
      total: 1450,
      avgTps: 100,
      avgTtft: 760,
      models: 2,
      activeDays: 2,
      successRate: 66.7,
    },
  );

  assert.equal(dashboard.series.length, 2);
  assert.equal(dashboard.series[0].label, '10/25');
  assert.equal(dashboard.series[0].totalTokens, 1100);
  assert.equal(dashboard.series[1].totalTokens, 350);
  assert.equal(dashboard.series[1].errors, 1);
  assert.equal(dashboard.series[1].tps, 100);

  const alpha = dashboard.models.find((item) => item.model === 'alpha');
  const beta = dashboard.models.find((item) => item.model === 'beta');
  assert.equal(alpha.requests, 2);
  assert.equal(alpha.totalTokens, 1200);
  assert.equal(alpha.errors, 1);
  assert.equal(alpha.avgTps, 100);
  assert.equal(beta.totalTokens, 250);
  assert.equal(beta.share.toFixed(3), '0.172');

  assert.equal(dashboard.previous.requests, 0);
  assert.equal(dashboard.recent.length, 3);
  assert.equal(dashboard.recent[0].status, 'error');
  assert.equal(dashboard.recent[0].tps, null);
});

test('模型筛选与全部时间范围', (t) => {
  const store = makeStore(t);
  seed(store);

  const filtered = buildDashboard(
    store,
    { from: '2026-10-25', to: '2026-10-26', model: 'alpha', granularity: 'day' },
    {},
  );
  assert.equal(filtered.summary.requests, 2);
  assert.equal(filtered.summary.totalTokens, 1200);
  assert.equal(filtered.summary.models, 1);
  assert.equal(filtered.series.length, 2);
  assert.equal(filtered.series[1].totalTokens, 100);

  const all = buildDashboard(store, { all: true, model: 'all', granularity: 'auto' }, {});
  assert.equal(all.filter.all, true);
  assert.equal(all.filter.from, '2026-10-25');
  assert.equal(all.filter.to, '2026-10-26');
  assert.equal(all.summary.requests, 3);
});

test('单日范围自动使用小时粒度', (t) => {
  const store = makeStore(t);
  seed(store);

  const dashboard = buildDashboard(
    store,
    { from: '2026-10-26', to: '2026-10-26', model: 'all', granularity: 'auto' },
    {},
  );
  assert.equal(dashboard.filter.granularity, 'hour');
  assert.equal(dashboard.series.length, 24);
  const noon = dashboard.series.find((point) => point.bucket === '2026-10-26T12');
  const errorHour = dashboard.series.find((point) => point.bucket === '2026-10-26T13');
  assert.equal(noon.totalTokens, 250);
  assert.equal(noon.tps, 100);
  assert.equal(errorHour.totalTokens, 100);
  assert.equal(errorHour.errors, 1);
  assert.equal(errorHour.tps, null);
});

test('非法日期返回 400 错误', (t) => {
  const store = makeStore(t);
  assert.throws(
    () => buildDashboard(store, { from: '2026-13-01', to: '2026-10-26' }, {}),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => buildDashboard(store, { from: '2026-10-26T25:00', to: '2026-10-26T26:00' }, {}),
    (error) => error.statusCode === 400,
  );
});

test('分钟级窗口与分钟粒度', (t) => {
  const store = makeStore(t);
  store.insertRequests([
    record({
      line: 11,
      model: 'alpha',
      date: new Date(2026, 9, 26, 12, 0, 10),
      promptTokens: 10,
      completionTokens: 2,
      promptMs: 100,
      genMs: 100,
    }),
    record({
      line: 12,
      model: 'beta',
      date: new Date(2026, 9, 26, 12, 0, 55),
      promptTokens: 20,
      completionTokens: 3,
      promptMs: 100,
      genMs: 100,
    }),
    record({
      line: 13,
      model: 'alpha',
      date: new Date(2026, 9, 26, 12, 1, 5),
      promptTokens: 30,
      completionTokens: 4,
      promptMs: 100,
      genMs: 100,
    }),
    record({
      line: 14,
      model: 'alpha',
      date: new Date(2026, 9, 26, 12, 2, 0),
      promptTokens: 40,
      completionTokens: 5,
      promptMs: 100,
      genMs: 100,
    }),
  ]);

  const dashboard = buildDashboard(
    store,
    {
      from: '2026-10-26T12:00',
      to: '2026-10-26T12:01',
      model: 'all',
      granularity: 'auto',
    },
    {},
  );
  assert.equal(dashboard.filter.granularity, 'minute');
  assert.equal(dashboard.filter.requestedGranularity, 'auto');
  assert.equal(dashboard.filter.from, '2026-10-26T12:00');
  assert.equal(dashboard.filter.to, '2026-10-26T12:01');
  assert.equal(dashboard.series.length, 2);
  assert.equal(dashboard.series[0].label, '12:00');
  assert.equal(dashboard.series[1].label, '12:01');
  assert.equal(dashboard.series[0].totalTokens, 35);
  assert.equal(dashboard.series[1].totalTokens, 34);
  assert.equal(dashboard.summary.requests, 3);
  assert.equal(dashboard.summary.totalTokens, 69);

  const filtered = buildDashboard(
    store,
    {
      from: '2026-10-26T12:00',
      to: '2026-10-26T12:01',
      model: 'alpha',
      granularity: 'minute',
    },
    {},
  );
  assert.equal(filtered.summary.requests, 2);
  assert.equal(filtered.summary.totalTokens, 46);

  const fallback = buildDashboard(
    store,
    { from: '2026-10-25', to: '2026-10-26', model: 'all', granularity: 'minute' },
    {},
  );
  assert.equal(fallback.filter.requestedGranularity, 'minute');
  assert.equal(fallback.filter.granularity, 'hour');
});

test('跨日分钟窗口使用带日期的标签', (t) => {
  const store = makeStore(t);
  store.insertRequests([
    record({
      line: 21,
      model: 'alpha',
      date: new Date(2026, 9, 26, 23, 59, 30),
      promptTokens: 10,
      completionTokens: 1,
    }),
    record({
      line: 22,
      model: 'alpha',
      date: new Date(2026, 9, 27, 0, 0, 30),
      promptTokens: 20,
      completionTokens: 2,
    }),
  ]);
  const dashboard = buildDashboard(
    store,
    {
      from: '2026-10-26T23:59',
      to: '2026-10-27T00:00',
      model: 'all',
      granularity: 'minute',
    },
    {},
  );
  assert.equal(dashboard.series.length, 2);
  assert.equal(dashboard.series[0].label, '10/26 23:59');
  assert.equal(dashboard.series[1].label, '10/27 00:00');
});
