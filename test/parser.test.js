import assert from 'node:assert/strict';
import test from 'node:test';

import { LogParser } from '../server/parser.js';

function parse(lines, file = '2026-10-25.1.log') {
  const records = [];
  const parser = new LogParser({ emit: (record) => records.push(record) });
  parser.startFile(file);
  lines.forEach((line, index) => parser.feed(line, index + 1));
  return records;
}

const RUNNING = '[2026-10-25 19:58:03][INFO][qwen3.5-9b] Running chat completion on conversation with 2 messages.';
const STREAMING = '[2026-10-25 19:58:03][INFO][qwen3.5-9b] Streaming response...';
const LAUNCH = '[2026-10-25 19:58:04][DEBUG] 0.08.929.673 I slot launch_slot_: id  0 | task 0 | processing task, is_child = 0';
const PROMPT =
  '[2026-10-25 19:58:16][DEBUG] 0.20.994.748 I slot print_timing: id  0 | task 0 | prompt eval time =    8850.33 ms / 11201 tokens (    0.79 ms per token,  1265.60 tokens per second)';
const GEN =
  '0.20.994.756 I slot print_timing: id  0 | task 0 |        eval time =    3214.70 ms /    62 tokens (   52.70 ms per token,    18.98 tokens per second)';
const TOTAL = '0.20.994.760 I slot print_timing: id  0 | task 0 |       total time =   12065.03 ms / 11263 tokens';
const FINISHED = '[2026-10-25 19:58:16][INFO][qwen3.5-9b] Finished streaming response';

test('解析流式 API 请求的 token、速度与模型', () => {
  const records = parse([RUNNING, STREAMING, LAUNCH, PROMPT, GEN, TOTAL, FINISHED]);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.model, 'qwen3.5-9b');
  assert.equal(record.promptTokens, 11201);
  assert.equal(record.completionTokens, 62);
  assert.equal(record.totalTokens, 11263);
  assert.equal(record.stream, 1);
  assert.equal(record.source, 'api');
  assert.equal(record.status, 'ok');
  assert.equal(record.tps, 18.98);
  assert.equal(record.promptTps, 1265.6);
  assert.equal(record.line, 1);
  assert.equal(record.day, '2026-10-25');
  assert.equal(record.hour, '2026-10-25T19');
  assert.equal(record.minute, '2026-10-25T19:58');
  assert.ok(Math.abs(record.ttftMs - (8850.33 + 3214.7 / 62)) < 0.01);
});

test('应用内对话没有 Running 标记时，从模型加载路径推断模型', () => {
  const records = parse([
    '[2026-10-25 19:40:00][DEBUG] 0.00.104.582 I srv load_model: loading model \'E:\\Development\\LM_Studio\\LLM\\lmstudio-community\\Qwen3.5-9B-GGUF\\Qwen3.5-9B-Q4_K_M.gguf\'',
    LAUNCH,
    PROMPT,
    GEN,
    TOTAL,
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].model, 'qwen3.5-9b');
  assert.equal(records[0].source, 'app');
  assert.equal(records[0].endpoint, 'chat');
});

test('并发请求按 task id 归属，互不串数据', () => {
  const records = parse([
    RUNNING,
    LAUNCH,
    '[2026-10-25 19:58:05][INFO][index-translate-2b] Running chat completion on conversation with 1 messages.',
    '[2026-10-25 19:58:05][DEBUG] 0.08.929.673 I slot launch_slot_: id  1 | task 9 | processing task, is_child = 0',
    '[2026-10-25 19:58:06][DEBUG] 0.20.994.748 I slot print_timing: id  1 | task 9 | prompt eval time =    75.00 ms / 75 tokens (    1.00 ms per token,  1000.00 tokens per second)',
    '0.20.994.756 I slot print_timing: id  1 | task 9 |        eval time =    100.00 ms / 10 tokens (   10.00 ms per token,   100.00 tokens per second)',
    PROMPT,
    GEN,
  ]);
  assert.equal(records.length, 2);
  const index = records.find((item) => item.model === 'index-translate-2b');
  const qwen = records.find((item) => item.model === 'qwen3.5-9b');
  assert.equal(index.promptTokens, 75);
  assert.equal(index.completionTokens, 10);
  assert.equal(index.tps, 100);
  assert.equal(qwen.promptTokens, 11201);
  assert.equal(qwen.completionTokens, 62);
});

test('上下文超限错误记录 prompt token 与错误信息', () => {
  const records = parse([
    '[2026-10-25 19:58:23][ERROR][qwen3.5-9b] Engine protocol predict request returned 400: {"error":{"code":400,"message":"request (17557 tokens) exceeds the available context size (16384 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":17557,"n_ctx":16384}}. Error Data: {',
  ]);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.status, 'error');
  assert.equal(record.promptTokens, 17557);
  assert.equal(record.completionTokens, 0);
  assert.match(record.error, /exceeds the available context size/);
  assert.equal(record.model, 'qwen3.5-9b');
});

test('同一 task 的重复 eval 行不会重复计数', () => {
  const records = parse([RUNNING, LAUNCH, PROMPT, GEN, GEN, GEN]);
  assert.equal(records.length, 1);
});

test('兼容 CRLF 与多段续行', () => {
  const records = parse([
    `${RUNNING}\r`,
    `${LAUNCH}\r`,
    `${PROMPT}\r`,
    `${GEN}\r`,
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].tps, 18.98);
});

test('没有模型信息时标记为 unknown', () => {
  const records = parse([LAUNCH, PROMPT, GEN]);
  assert.equal(records.length, 1);
  assert.equal(records[0].model, 'unknown');
});
