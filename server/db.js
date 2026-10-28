import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = '2';

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeText(value, max = 120) {
  return String(value ?? '').slice(0, max);
}

function minuteKey(ts) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export class Store {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
    `);
    this._initSchema();
    this._prepare();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        day TEXT NOT NULL,
        hour TEXT NOT NULL,
        minute TEXT,
        model TEXT NOT NULL,
        source TEXT NOT NULL,
        endpoint TEXT,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        prompt_ms REAL NOT NULL DEFAULT 0,
        gen_ms REAL NOT NULL DEFAULT 0,
        total_ms REAL NOT NULL DEFAULT 0,
        prompt_tps REAL,
        tps REAL,
        ttft_ms REAL,
        stream INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ok',
        error TEXT,
        UNIQUE(file, line)
      );
      CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts);
      CREATE INDEX IF NOT EXISTS idx_requests_day ON requests(day);
      CREATE INDEX IF NOT EXISTS idx_requests_hour ON requests(hour);
      CREATE INDEX IF NOT EXISTS idx_requests_model_ts ON requests(model, ts);

      CREATE TABLE IF NOT EXISTS log_files (
        path TEXT PRIMARY KEY,
        offset INTEGER NOT NULL DEFAULT 0,
        line_no INTEGER NOT NULL DEFAULT 0,
        file_size INTEGER NOT NULL DEFAULT 0,
        mtime INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const columns = this.db
      .prepare('PRAGMA table_info(requests)')
      .all()
      .map((column) => column.name);
    if (!columns.includes('minute')) {
      this.db.exec('ALTER TABLE requests ADD COLUMN minute TEXT;');
    }
    // 旧版本数据库补齐分钟桶；SQLite 的 localtime 与解析器使用的本地时间一致。
    this.db.exec(`
      UPDATE requests
      SET minute = strftime('%Y-%m-%dT%H:%M', ts / 1000, 'unixepoch', 'localtime')
      WHERE minute IS NULL;
      UPDATE requests SET tps = NULL WHERE status = 'error' AND tps = 0;
      UPDATE requests SET ttft_ms = NULL WHERE status = 'error' AND ttft_ms = 0;
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_requests_minute ON requests(minute);');
    this.db
      .prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)')
      .run('schema_version', SCHEMA_VERSION);
  }

  _prepare() {
    this.insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO requests
        (file, line, ts, started_at, day, hour, minute, model, source, endpoint,
         prompt_tokens, completion_tokens, total_tokens,
         prompt_ms, gen_ms, total_ms, prompt_tps, tps, ttft_ms,
         stream, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getLogFileStmt = this.db.prepare('SELECT * FROM log_files WHERE path = ?');
    this.saveLogFileStmt = this.db.prepare(`
      INSERT INTO log_files(path, offset, line_no, file_size, mtime, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        offset = excluded.offset,
        line_no = excluded.line_no,
        file_size = excluded.file_size,
        mtime = excluded.mtime,
        updated_at = excluded.updated_at
    `);
    this.countStmt = this.db.prepare('SELECT COUNT(*) AS n FROM requests');
    this.deleteForFileStmt = this.db.prepare('DELETE FROM requests WHERE file = ?');
  }

  insertRequests(records) {
    if (!records.length) return 0;
    let changes = 0;
    this.db.exec('BEGIN');
    try {
      for (const r of records) {
        const promptTokens = Math.max(0, Math.trunc(Number(r.promptTokens) || 0));
        const completionTokens = Math.max(0, Math.trunc(Number(r.completionTokens) || 0));
        const ts = Math.trunc(Number(r.ts) || 0);
        const result = this.insertStmt.run(
          safeText(r.file, 512),
          Math.trunc(Number(r.line) || 0),
          ts,
          Math.trunc(Number(r.startedAt ?? r.ts) || 0),
          safeText(r.day, 10),
          safeText(r.hour, 13),
          safeText(r.minute || minuteKey(ts), 16),
          safeText(r.model || 'unknown', 120),
          safeText(r.source || 'api', 24),
          safeText(r.endpoint || '', 48) || null,
          promptTokens,
          completionTokens,
          Math.max(0, Math.trunc(Number(r.totalTokens) || promptTokens + completionTokens)),
          Math.max(0, Number(r.promptMs) || 0),
          Math.max(0, Number(r.genMs) || 0),
          Math.max(0, Number(r.totalMs) || 0),
          finiteOrNull(r.promptTps),
          finiteOrNull(r.tps),
          finiteOrNull(r.ttftMs),
          r.stream ? 1 : 0,
          safeText(r.status || 'ok', 16),
          r.error ? safeText(r.error, 240) : null,
        );
        changes += Number(result.changes) || 0;
      }
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // 忽略回滚失败。
      }
      throw error;
    }
    return changes;
  }

  getLogFile(file) {
    return this.getLogFileStmt.get(file);
  }

  saveLogFile(file, offset, lineNo, fileSize, mtime) {
    this.saveLogFileStmt.run(
      file,
      Math.trunc(Number(offset) || 0),
      Math.trunc(Number(lineNo) || 0),
      Math.trunc(Number(fileSize) || 0),
      Math.trunc(Number(mtime) || 0),
      Date.now(),
    );
  }

  deleteRequestsForFile(file) {
    this.deleteForFileStmt.run(file);
  }

  countRequests() {
    return Number(this.countStmt.get().n) || 0;
  }

  getBounds() {
    const row = this.db
      .prepare(
        `SELECT MIN(ts) AS min_ts, MAX(ts) AS max_ts, COUNT(*) AS n FROM requests`,
      )
      .get();
    return {
      minTs: row?.min_ts == null ? null : Number(row.min_ts),
      maxTs: row?.max_ts == null ? null : Number(row.max_ts),
      count: Number(row?.n) || 0,
    };
  }

  getAllModels() {
    return this.db
      .prepare(
        `SELECT model,
                COUNT(*) AS requests,
                COALESCE(SUM(total_tokens), 0) AS tokens,
                MAX(ts) AS last_ts
         FROM requests
         GROUP BY model
         ORDER BY tokens DESC, model ASC`,
      )
      .all()
      .map((row) => ({
        model: row.model,
        requests: Number(row.requests) || 0,
        tokens: Number(row.tokens) || 0,
        lastTs: row.last_ts == null ? null : Number(row.last_ts),
      }));
  }

  resetDerived() {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM requests; DELETE FROM log_files;');
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw error;
    }
  }

  close() {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }
}
