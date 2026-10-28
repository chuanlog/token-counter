import path from 'node:path';

const TS_RE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\]/;
const TAG_RE =
  /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\]\[(INFO|WARN|ERROR|DEBUG)\]\[([^\]]+)\]\s?(.*)$/;

const LAUNCH_RE = /\bslot\s+launch_slot_:\s+id\s+\d+\s*\|\s*task\s+(\d+)\s*\|/;
const PROMPT_RE =
  /\bslot\s+print_timing:.*?\|\s*task\s+(\d+)\s*\|\s*prompt eval time\s*=\s*([\d.]+)\s*ms\s*\/\s*(\d+)\s*tokens\s*\(\s*([\d.]+)\s*ms per token,\s*([\d.]+)\s*tokens per second\s*\)/;
const GEN_RE =
  /\bslot\s+print_timing:.*?\|\s*task\s+(\d+)\s*\|\s+eval time\s*=\s*([\d.]+)\s*ms\s*\/\s*(\d+)\s*tokens\s*\(\s*([\d.]+)\s*ms per token,\s*([\d.]+)\s*tokens per second\s*\)/;
const TOTAL_RE = /\bslot\s+print_timing:.*?\|\s*task\s+(\d+)\s*\|\s+total time\s*=\s*([\d.]+)\s*ms\s*\/\s*(\d+)\s*tokens/;
const LOAD_RE = /\bload_model:\s+loading model '([^']+)'/;
const RUNNING_RE = /^Running chat completion on conversation with (\d+) messages?\./;
const STREAMING_RE = /^Streaming response\.\.\./;
const PREDICTION_RE = /^Generated prediction:/;
const ERROR_RE = /^Engine protocol predict request returned (\d+):\s*(.*)$/;

const UNKNOWN_MODEL = 'unknown';
const PENDING_TTL = 30 * 60 * 1000;
const DONE_TTL = 10 * 60 * 1000;

function parseTimestamp(match) {
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
}

function toDay(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHour(ts) {
  const d = new Date(ts);
  return `${toDay(ts)}T${String(d.getHours()).padStart(2, '0')}`;
}

function toMinute(ts) {
  const d = new Date(ts);
  return `${toDay(ts)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function guessModelName(filePath) {
  let base = path.basename(String(filePath || '')).replace(/\.gguf$/i, '');
  base = base
    .replace(/[.\-_](IQ\d(?:_[A-Z0-9]+)+|Q\d(?:_[A-Z0-9]+)+|BF16|FP16|FP32|F16|F32)$/i, '')
    .trim();
  if (!base) return UNKNOWN_MODEL;
  return base.toLowerCase().replace(/\s+/g, '-');
}

function normalizeModelName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.gguf$/, '')
    .replace(/[\s_]+/g, '-');
}

/**
 * 逐行解析 LM Studio 的 server 日志，产出「一次推理」记录。
 *
 * 数据来源：
 * - `[INFO][<model>] Running chat completion...` 标记一次 API 请求；
 * - `launch_slot_` 把任务号与请求关联；
 * - `print_timing ... prompt eval time / eval time` 提供输入/输出 token 数与速度；
 * - `[ERROR][<model>] ...` 提供失败请求。
 *
 * 不保存任何 prompt / 回复正文，只保留统计元数据。
 */
export class LogParser {
  constructor({ emit } = {}) {
    this.emit = emit || (() => {});
    this.file = null;
    this.lastTs = null;
    this.lastKnownModel = UNKNOWN_MODEL;
    this.lastKnownAt = 0;
    this.knownModels = new Set();
    this.pending = [];
    this.tasks = new Map();
    this.done = new Map();
  }

  startFile(file) {
    this.file = file;
    this.lastTs = null;
    this.pending = [];
    this.tasks.clear();
    this.done.clear();
  }

  feed(rawLine, lineNo) {
    if (!rawLine) return;
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line) return;

    const tsMatch = TS_RE.exec(line);
    let ts = this.lastTs;
    if (tsMatch) {
      ts = parseTimestamp(tsMatch);
      this.lastTs = ts;
    }
    if (!ts) return;

    const tagMatch = TAG_RE.exec(line);
    if (tagMatch) {
      const level = tagMatch[7];
      const tag = tagMatch[8];
      const message = tagMatch[9];
      if (tag !== 'LM STUDIO SERVER' && tag !== 'LMSAuthenticator') {
        this._noteModel(tag, ts, true);
        if (level === 'ERROR') {
          this._recordError(tag, message, ts, lineNo);
        } else if (RUNNING_RE.test(message)) {
          const count = Number(RUNNING_RE.exec(message)[1]) || 0;
          const draft = this._newDraft({
            line: lineNo,
            lineNo,
            ts,
            startedAt: ts,
            model: tag,
            source: 'api',
            endpoint: 'chat.completions',
            stream: 0,
            messages: count,
          });
          this.pending.push(draft);
        } else if (STREAMING_RE.test(message)) {
          for (let i = this.pending.length - 1; i >= 0; i -= 1) {
            const draft = this.pending[i];
            if (draft.model === tag) {
              draft.stream = 1;
              break;
            }
          }
        } else if (PREDICTION_RE.test(message)) {
          // 非流式请求结束；token 数已由 timing 行给出。
        }
      }
    }

    const loadMatch = LOAD_RE.exec(line);
    if (loadMatch) {
      const guessed = this._resolveGuess(guessModelName(loadMatch[1]));
      this._noteModel(guessed, ts, false);
    }

    const launchMatch = LAUNCH_RE.exec(line);
    if (launchMatch) {
      const taskId = launchMatch[1];
      let draft = this.pending.shift();
      if (!draft) {
        draft = this._newDraft({
          line: lineNo,
          lineNo,
          ts,
          startedAt: ts,
          model: this._implicitModel(),
          source: 'app',
          endpoint: 'chat',
          stream: 0,
        });
      }
      draft.startedAt = ts;
      draft.launchLine = lineNo;
      this.tasks.set(taskId, draft);
      this.done.delete(taskId);
      this._cleanup(ts);
      return;
    }

    const promptMatch = PROMPT_RE.exec(line);
    if (promptMatch) {
      const draft = this._taskDraft(promptMatch[1], ts, lineNo);
      if (!draft) return;
      draft.promptMs = Number(promptMatch[2]);
      draft.promptTokens = Number(promptMatch[3]);
      draft.promptTps = Number(promptMatch[5]);
      return;
    }

    const genMatch = GEN_RE.exec(line);
    if (genMatch) {
      const draft = this._taskDraft(genMatch[1], ts, lineNo);
      if (!draft) return;
      draft.genMs = Number(genMatch[2]);
      draft.completionTokens = Number(genMatch[3]);
      draft.tps = Number(genMatch[5]);
      this._finishDraft(draft, ts);
      return;
    }

    const totalMatch = TOTAL_RE.exec(line);
    if (totalMatch) {
      const draft = this.tasks.get(totalMatch[1]);
      if (draft && !draft.emitted) {
        draft.totalMs = Number(totalMatch[2]);
      }
      return;
    }

    if (line.includes('Client disconnected. Stopping generation')) {
      // 客户端主动断开：如果随后仍有 timing 行，会按正常完成记录；
      // 没有 timing 行则不额外计入。
    }
  }

  _newDraft({ line, lineNo, ts, startedAt, model, source, endpoint, stream, messages }) {
    return {
      file: this.file,
      line,
      lineNo,
      ts,
      startedAt,
      model: model || UNKNOWN_MODEL,
      source,
      endpoint,
      stream: stream || 0,
      messages: messages || 0,
      promptTokens: 0,
      completionTokens: 0,
      promptMs: 0,
      genMs: 0,
      totalMs: 0,
      promptTps: null,
      tps: null,
      emitted: false,
    };
  }

  _implicitModel() {
    return this.lastKnownModel || UNKNOWN_MODEL;
  }

  _noteModel(model, ts, exact) {
    if (!model || model === UNKNOWN_MODEL) return;
    if (exact) this.knownModels.add(model);
    if (ts >= this.lastKnownAt) {
      this.lastKnownModel = model;
      this.lastKnownAt = ts;
    }
  }

  _resolveGuess(guess) {
    if (!guess || guess === UNKNOWN_MODEL) return guess;
    const g = normalizeModelName(guess);
    for (const model of this.knownModels) {
      if (normalizeModelName(model) === g) return model;
    }
    for (const model of this.knownModels) {
      const m = normalizeModelName(model);
      if (m.startsWith(`${g}-`) || g.startsWith(`${m}-`)) return model;
    }
    return guess;
  }

  _taskDraft(taskId, ts, lineNo) {
    const existing = this.tasks.get(taskId);
    if (existing) return existing;

    const finishedAt = this.done.get(taskId);
    if (finishedAt && ts - finishedAt < DONE_TTL) return null;

    const draft = this._newDraft({
      line: lineNo,
      lineNo,
      ts,
      startedAt: ts,
      model: this._implicitModel(),
      source: 'app',
      endpoint: 'chat',
      stream: 0,
    });
    this.tasks.set(taskId, draft);
    return draft;
  }

  _finishDraft(draft, endTs) {
    if (draft.emitted) return;
    draft.emitted = true;
    const promptMs = Math.max(0, draft.promptMs || 0);
    const genMs = Math.max(0, draft.genMs || 0);
    const totalMs = Math.max(draft.totalMs || 0, promptMs + genMs);
    const promptTokens = Math.max(0, draft.promptTokens || 0);
    const completionTokens = Math.max(0, draft.completionTokens || 0);
    const startedAt = totalMs > 0 ? endTs - totalMs : draft.startedAt || endTs;
    const perTokenMs = completionTokens > 0 && genMs > 0 ? genMs / completionTokens : 0;

    this.emit({
      file: draft.file || this.file,
      line: draft.line,
      ts: endTs,
      startedAt,
      day: toDay(endTs),
      hour: toHour(endTs),
      minute: toMinute(endTs),
      model: draft.model || UNKNOWN_MODEL,
      source: draft.source,
      endpoint: draft.endpoint,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      promptMs,
      genMs,
      totalMs,
      promptTps: draft.promptTps,
      tps: draft.tps,
      ttftMs: promptMs > 0 || perTokenMs > 0 ? promptMs + perTokenMs : null,
      stream: draft.stream ? 1 : 0,
      status: 'ok',
      error: null,
    });

    for (const [taskId, task] of this.tasks) {
      if (task === draft) {
        this.tasks.delete(taskId);
        this.done.set(taskId, endTs);
        break;
      }
    }
  }

  _recordError(model, message, ts, lineNo) {
    const match = ERROR_RE.exec(message);
    let errorText = message;
    let promptTokens = 0;
    if (match) {
      errorText = match[2] || message;
      const tokens = /"n_prompt_tokens"\s*:\s*(\d+)/.exec(message);
      if (tokens) promptTokens = Number(tokens[1]);
      const msg = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(message);
      if (msg) errorText = msg[1].slice(0, 240);
    } else {
      const msg = /^Error:\s*(.+)$/.exec(message);
      if (msg) errorText = msg[1];
    }
    this.emit({
      file: this.file,
      line: lineNo,
      ts,
      startedAt: ts,
      day: toDay(ts),
      hour: toHour(ts),
      minute: toMinute(ts),
      model: model || UNKNOWN_MODEL,
      source: 'api',
      endpoint: 'chat.completions',
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
      promptMs: 0,
      genMs: 0,
      totalMs: 0,
      promptTps: null,
      tps: null,
      ttftMs: null,
      stream: 0,
      status: 'error',
      error: String(errorText).slice(0, 240),
    });
  }

  _cleanup(ts) {
    if (this.pending.length) {
      this.pending = this.pending.filter((draft) => ts - draft.startedAt < PENDING_TTL);
    }
    for (const [taskId, draft] of this.tasks) {
      if (ts - draft.startedAt > PENDING_TTL) this.tasks.delete(taskId);
    }
    for (const [taskId, finishedAt] of this.done) {
      if (ts - finishedAt > DONE_TTL) this.done.delete(taskId);
    }
  }
}
