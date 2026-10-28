const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function minuteKey(ts) {
  const d = new Date(ts);
  return `${dayKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function hourKey(ts) {
  const d = new Date(ts);
  return `${dayKey(d)}T${pad2(d.getHours())}`;
}

export function parseDay(value) {
  if (!value) return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function invalidRange(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * 解析一个范围端点。日期（YYYY-MM-DD）表示整天；带分钟的时间
 * （YYYY-MM-DDTHH:mm）表示精确到该分钟（作为结束点时包含这一分钟）。
 */
function parseRangePoint(value, isEnd) {
  if (!value) return null;

  const dateMatch = DATE_RE.exec(value);
  if (dateMatch) {
    const date = parseDay(value);
    if (!date) throw invalidRange('日期格式应为 YYYY-MM-DD');
    const start = startOfDay(date);
    return {
      ts: start,
      endTs: startOfDay(addDays(date, 1)),
      dateOnly: true,
      value: dayKey(date),
    };
  }

  const datetimeMatch = DATETIME_RE.exec(value);
  if (datetimeMatch) {
    const y = Number(datetimeMatch[1]);
    const m = Number(datetimeMatch[2]);
    const d = Number(datetimeMatch[3]);
    const h = Number(datetimeMatch[4]);
    const min = Number(datetimeMatch[5]);
    if (h > 23 || min > 59) throw invalidRange('时间格式应为 YYYY-MM-DDTHH:mm');
    const date = new Date(y, m - 1, d, h, min, 0, 0);
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== m - 1 ||
      date.getDate() !== d ||
      date.getHours() !== h ||
      date.getMinutes() !== min
    ) {
      throw invalidRange('时间格式应为 YYYY-MM-DDTHH:mm');
    }
    const ts = date.getTime();
    return {
      ts,
      endTs: ts + MINUTE_MS,
      dateOnly: false,
      value: `${dayKey(date)}T${pad2(h)}:${pad2(min)}`,
    };
  }

  throw invalidRange('时间格式应为 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm');
}

export function validateRange(fromValue, toValue) {
  let fromPoint = parseRangePoint(fromValue, false);
  let toPoint = parseRangePoint(toValue, true);
  const now = new Date();

  if (!fromPoint && !toPoint) {
    const fromDate = addDays(now, -6);
    fromPoint = parseRangePoint(dayKey(fromDate), false);
    toPoint = parseRangePoint(dayKey(now), true);
  } else if (!fromPoint) {
    const toDate = toPoint.dateOnly ? parseDay(toPoint.value) : new Date(toPoint.ts);
    const fromDate = addDays(toDate, -6);
    fromPoint = toPoint.dateOnly
      ? parseRangePoint(dayKey(fromDate), false)
      : {
          ts: startOfDay(fromDate),
          endTs: startOfDay(addDays(fromDate, 1)),
          dateOnly: true,
          value: dayKey(fromDate),
        };
  } else if (!toPoint) {
    toPoint = fromPoint.dateOnly
      ? parseRangePoint(dayKey(now), true)
      : {
          ts: now.getTime(),
          endTs: now.getTime() + MINUTE_MS,
          dateOnly: false,
          value: minuteKey(now.getTime()),
        };
  }

  if (fromPoint.ts > toPoint.ts) {
    throw invalidRange('开始时间不能晚于结束时间');
  }

  const start = fromPoint.ts;
  const end = toPoint.endTs;
  const durationMs = end - start;
  const sameDay = dayKey(new Date(start)) === dayKey(new Date(end - 1));

  return {
    from: fromPoint.value,
    to: toPoint.value,
    start,
    end,
    durationMs,
    days: Math.max(1, Math.ceil(durationMs / DAY_MS)),
    sameDay,
    hasTime: !fromPoint.dateOnly || !toPoint.dateOnly,
  };
}

function granularityLabel(key, granularity, withYear, sameDay) {
  const [day, time] = key.split('T');
  const [y, m, d] = day.split('-');

  if (granularity === 'minute') {
    return sameDay ? time : `${Number(m)}/${Number(d)} ${time}`;
  }
  if (granularity === 'hour') {
    return sameDay ? `${time}:00` : `${Number(m)}/${Number(d)} ${time}:00`;
  }
  return withYear ? `${String(y).slice(2)}/${Number(m)}/${Number(d)}` : `${Number(m)}/${Number(d)}`;
}

function chooseGranularity(requested, durationMs) {
  const minutes = durationMs / MINUTE_MS;
  if (requested === 'minute') {
    if (minutes <= 24 * 60 + 1) return 'minute';
    if (minutes <= 90 * 24 * 60) return 'hour';
    return 'day';
  }
  if (requested === 'hour') {
    if (minutes <= 90 * 24 * 60) return 'hour';
    return 'day';
  }
  if (requested === 'day') return 'day';
  if (minutes <= 120) return 'minute';
  if (minutes <= 2 * 24 * 60) return 'hour';
  return 'day';
}

function tpsOf(tokens, ms) {
  return ms > 0 ? tokens / (ms / 1000) : null;
}

function round(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function whereClause({ start, end, model }) {
  const clauses = ['ts >= ?', 'ts < ?'];
  const params = [start, end];
  if (model) {
    clauses.push('model = ?');
    params.push(model);
  }
  return { sql: clauses.join(' AND '), params };
}

function summaryQuery(db, { start, end, model }) {
  const where = whereClause({ start, end, model });
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS requests,
         COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS errors,
         COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
         COALESCE(SUM(total_tokens), 0) AS total_tokens,
         COALESCE(SUM(CASE WHEN gen_ms > 0 THEN completion_tokens ELSE 0 END), 0) AS speed_tokens,
         COALESCE(SUM(CASE WHEN gen_ms > 0 THEN gen_ms ELSE 0 END), 0) AS speed_ms,
         COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN ttft_ms ELSE 0 END), 0) AS ttft_sum,
         COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN 1 ELSE 0 END), 0) AS ttft_count,
         COALESCE(SUM(CASE WHEN total_ms > 0 THEN total_ms ELSE 0 END), 0) AS duration_sum,
         COALESCE(SUM(CASE WHEN total_ms > 0 THEN 1 ELSE 0 END), 0) AS duration_count,
         COUNT(DISTINCT day) AS active_days,
         COUNT(DISTINCT model) AS models
       FROM requests
       WHERE ${where.sql}`,
    )
    .get(...where.params);

  const requests = Number(row?.requests) || 0;
  const speedTokens = Number(row?.speed_tokens) || 0;
  const speedMs = Number(row?.speed_ms) || 0;
  const ttftCount = Number(row?.ttft_count) || 0;
  return {
    requests,
    errors: Number(row?.errors) || 0,
    promptTokens: Number(row?.prompt_tokens) || 0,
    completionTokens: Number(row?.completion_tokens) || 0,
    totalTokens: Number(row?.total_tokens) || 0,
    avgTps: round(tpsOf(speedTokens, speedMs), 2),
    avgTtftMs: ttftCount ? Math.round((Number(row?.ttft_sum) || 0) / ttftCount) : null,
    avgDurationMs: Number(row?.duration_count)
      ? Math.round((Number(row?.duration_sum) || 0) / Number(row.duration_count))
      : null,
    activeDays: Number(row?.active_days) || 0,
    models: Number(row?.models) || 0,
    successRate: requests ? round((1 - (Number(row?.errors) || 0) / requests) * 100, 1) : null,
  };
}

export function buildDashboard(store, { from, to, model, granularity, all }, meta = {}) {
  const db = store.db;
  let rangeFrom = from;
  let rangeTo = to;
  if (all) {
    const bounds = store.getBounds();
    if (bounds.minTs != null && bounds.maxTs != null) {
      rangeFrom = dayKey(new Date(bounds.minTs));
      rangeTo = dayKey(new Date(bounds.maxTs));
    } else {
      rangeFrom = undefined;
      rangeTo = undefined;
    }
  }
  const range = validateRange(rangeFrom, rangeTo);

  const modelFilter = model && model !== 'all' ? String(model) : null;
  const requestedGranularity = ['minute', 'hour', 'day', 'auto'].includes(granularity)
    ? granularity
    : 'auto';
  const actualGranularity = chooseGranularity(requestedGranularity, range.durationMs);

  const summary = summaryQuery(db, { start: range.start, end: range.end, model: modelFilter });
  const span = range.end - range.start;
  const previous = summaryQuery(db, {
    start: range.start - span,
    end: range.start,
    model: modelFilter,
  });

  const where = whereClause({ start: range.start, end: range.end, model: modelFilter });
  const bucketCol =
    actualGranularity === 'minute' ? 'minute' : actualGranularity === 'hour' ? 'hour' : 'day';
  const rows = db
    .prepare(
      `SELECT ${bucketCol} AS bucket,
              model,
              COUNT(*) AS requests,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS errors,
              COALESCE(SUM(CASE WHEN gen_ms > 0 THEN completion_tokens ELSE 0 END), 0) AS speed_tokens,
              COALESCE(SUM(CASE WHEN gen_ms > 0 THEN gen_ms ELSE 0 END), 0) AS speed_ms,
              COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN ttft_ms ELSE 0 END), 0) AS ttft_sum,
              COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN 1 ELSE 0 END), 0) AS ttft_count
       FROM requests
       WHERE ${where.sql}
       GROUP BY ${bucketCol}, model
       ORDER BY bucket ASC`,
    )
    .all(...where.params);

  const modelRows = db
    .prepare(
      `SELECT model,
              COUNT(*) AS requests,
              COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS errors,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(CASE WHEN gen_ms > 0 THEN completion_tokens ELSE 0 END), 0) AS speed_tokens,
              COALESCE(SUM(CASE WHEN gen_ms > 0 THEN gen_ms ELSE 0 END), 0) AS speed_ms,
              COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN ttft_ms ELSE 0 END), 0) AS ttft_sum,
              COALESCE(SUM(CASE WHEN ttft_ms IS NOT NULL THEN 1 ELSE 0 END), 0) AS ttft_count,
              MIN(ts) AS first_ts,
              MAX(ts) AS last_ts
       FROM requests
       WHERE ${where.sql}
       GROUP BY model
       ORDER BY total_tokens DESC, model ASC`,
    )
    .all(...where.params);

  const bucketKeys = [];
  if (actualGranularity === 'minute') {
    for (let ts = range.start; ts < range.end; ts += MINUTE_MS) {
      bucketKeys.push(minuteKey(ts));
    }
  } else if (actualGranularity === 'hour') {
    for (let ts = range.start; ts < range.end; ts += HOUR_MS) {
      bucketKeys.push(hourKey(ts));
    }
  } else {
    const startDate = new Date(range.start);
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    while (cursor.getTime() < range.end) {
      bucketKeys.push(dayKey(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  if (!bucketKeys.length) {
    bucketKeys.push(
      actualGranularity === 'minute'
        ? minuteKey(range.start)
        : actualGranularity === 'hour'
          ? hourKey(range.start)
          : dayKey(new Date(range.start)),
    );
  }

  const withYear =
    new Date(range.start).getFullYear() !== new Date(range.end - 1).getFullYear();
  const byBucket = new Map();
  for (const row of rows) {
    const key = String(row.bucket);
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key).push(row);
  }

  const modelNames = modelRows.map((row) => row.model);
  const series = [];
  const modelSeries = new Map();
  for (const name of modelNames) modelSeries.set(name, []);

  for (const key of bucketKeys) {
    const bucketRows = byBucket.get(key) || [];
    let requests = 0;
    let errors = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let speedTokens = 0;
    let speedMs = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    const byModel = {};

    for (const row of bucketRows) {
      const item = {
        model: row.model,
        requests: Number(row.requests) || 0,
        errors: Number(row.errors) || 0,
        promptTokens: Number(row.prompt_tokens) || 0,
        completionTokens: Number(row.completion_tokens) || 0,
        totalTokens: Number(row.total_tokens) || 0,
        tps: round(tpsOf(Number(row.speed_tokens) || 0, Number(row.speed_ms) || 0), 2),
        ttftMs: Number(row.ttft_count)
          ? Math.round((Number(row.ttft_sum) || 0) / Number(row.ttft_count))
          : null,
      };
      byModel[row.model] = item;
      if (modelSeries.has(row.model)) modelSeries.get(row.model).push({ bucket: key, ...item });
      requests += item.requests;
      errors += item.errors;
      promptTokens += item.promptTokens;
      completionTokens += item.completionTokens;
      totalTokens += item.totalTokens;
      speedTokens += Number(row.speed_tokens) || 0;
      speedMs += Number(row.speed_ms) || 0;
      ttftSum += Number(row.ttft_sum) || 0;
      ttftCount += Number(row.ttft_count) || 0;
    }

    series.push({
      bucket: key,
      label: granularityLabel(key, actualGranularity, withYear, range.sameDay),
      requests,
      errors,
      promptTokens,
      completionTokens,
      totalTokens,
      tps: round(tpsOf(speedTokens, speedMs), 2),
      ttftMs: ttftCount ? Math.round(ttftSum / ttftCount) : null,
      byModel,
    });
  }

  for (const name of modelNames) {
    const existing = new Map(modelSeries.get(name).map((item) => [item.bucket, item]));
    modelSeries.set(
      name,
      bucketKeys.map((key) => {
        const item = existing.get(key);
        return (
          item || {
            bucket: key,
            model: name,
            requests: 0,
            errors: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            tps: null,
            ttftMs: null,
          }
        );
      }),
    );
  }

  const totalForShare = summary.totalTokens || 0;
  const models = modelRows.map((row) => {
    const totalTokens = Number(row.total_tokens) || 0;
    return {
      model: row.model,
      requests: Number(row.requests) || 0,
      errors: Number(row.errors) || 0,
      promptTokens: Number(row.prompt_tokens) || 0,
      completionTokens: Number(row.completion_tokens) || 0,
      totalTokens,
      avgTps: round(tpsOf(Number(row.speed_tokens) || 0, Number(row.speed_ms) || 0), 2),
      avgTtftMs: Number(row.ttft_count)
        ? Math.round((Number(row.ttft_sum) || 0) / Number(row.ttft_count))
        : null,
      firstTs: row.first_ts == null ? null : Number(row.first_ts),
      lastTs: row.last_ts == null ? null : Number(row.last_ts),
      share: totalForShare ? round(totalTokens / totalForShare, 4) : 0,
      series: modelSeries.get(row.model) || [],
    };
  });

  const recentRows = db
    .prepare(
      `SELECT id, ts, model, source, endpoint, prompt_tokens, completion_tokens,
              total_tokens, prompt_ms, gen_ms, total_ms, tps, ttft_ms, stream,
              status, error
       FROM requests
       WHERE ${where.sql}
       ORDER BY ts DESC, id DESC
       LIMIT 60`,
    )
    .all(...where.params);

  const recent = recentRows.map((row) => ({
    id: Number(row.id),
    ts: Number(row.ts),
    model: row.model,
    source: row.source,
    endpoint: row.endpoint,
    promptTokens: Number(row.prompt_tokens) || 0,
    completionTokens: Number(row.completion_tokens) || 0,
    totalTokens: Number(row.total_tokens) || 0,
    promptMs: Number(row.prompt_ms) || 0,
    genMs: Number(row.gen_ms) || 0,
    totalMs: Number(row.total_ms) || 0,
    tps: row.tps == null ? null : Number(row.tps),
    ttftMs: row.ttft_ms == null ? null : Number(row.ttft_ms),
    stream: Boolean(row.stream),
    status: row.status,
    error: row.error,
  }));

  const bounds = store.getBounds();
  const allModels = store.getAllModels();
  const today = dayKey(new Date());

  return {
    filter: {
      from: range.from,
      to: range.to,
      model: modelFilter || 'all',
      granularity: actualGranularity,
      requestedGranularity,
      all: Boolean(all),
    },
    summary,
    previous,
    series,
    models,
    recent,
    modelOptions: allModels,
    meta: {
      generatedAt: Date.now(),
      today,
      rangeDays: range.days,
      rangeMinutes: Math.round(range.durationMs / MINUTE_MS),
      bucketCount: bucketKeys.length,
      dataStart: bounds.minTs,
      dataEnd: bounds.maxTs,
      totalRecords: bounds.count,
      ...meta,
    },
  };
}
