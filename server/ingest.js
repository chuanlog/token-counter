import fsp from 'node:fs/promises';
import path from 'node:path';

import { LogParser } from './parser.js';

const LOG_FILE_RE = /^\d{4}-\d{2}-\d{2}\.\d+\.log$/;
const MONTH_DIR_RE = /^\d{4}-\d{2}$/;
const CHUNK_SIZE = 1024 * 1024;

function fileSortKey(file) {
  const match = /(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/.exec(file);
  if (!match) return file;
  return `${match[1]}.${match[2].padStart(4, '0')}`;
}

export async function listLogFiles(roots) {
  const files = new Set();
  for (const root of roots) {
    let entries;
    try {
      entries = await fsp.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && LOG_FILE_RE.test(entry.name)) {
        files.add(path.resolve(full));
      } else if (entry.isDirectory() && MONTH_DIR_RE.test(entry.name)) {
        let monthEntries;
        try {
          monthEntries = await fsp.readdir(full, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const monthEntry of monthEntries) {
          if (monthEntry.isFile() && LOG_FILE_RE.test(monthEntry.name)) {
            files.add(path.resolve(path.join(full, monthEntry.name)));
          }
        }
      }
    }
  }
  return [...files].sort((a, b) => fileSortKey(a).localeCompare(fileSortKey(b)));
}

export class Ingestor {
  constructor({ store, logDirs, quiet = false, logger = console }) {
    this.store = store;
    this.logDirs = logDirs;
    this.quiet = quiet;
    this.logger = logger;
    this.parser = new LogParser();
    this.records = [];
    this.parser.emit = (record) => this.records.push(record);
    this.scanPromise = null;
    this.lastError = null;
    this.status = {
      lastScanAt: 0,
      lastInserted: 0,
      files: 0,
      parseErrors: 0,
      totalRecords: 0,
    };
  }

  async scan() {
    if (this.scanPromise) return this.scanPromise;
    this.scanPromise = this._scan().finally(() => {
      this.scanPromise = null;
    });
    return this.scanPromise;
  }

  async _scan() {
    const started = Date.now();
    const files = await listLogFiles(this.logDirs);
    let inserted = 0;
    let parseErrors = 0;

    for (const file of files) {
      try {
        const result = await this._processFile(file);
        inserted += result.inserted;
        parseErrors += result.parseErrors;
      } catch (error) {
        this.lastError = `${path.basename(file)}: ${error.message}`;
        this.logger.error?.('[token-lens] 读取日志失败:', path.basename(file), error.message);
      }
    }

    this.status = {
      lastScanAt: Date.now(),
      lastInserted: inserted,
      files: files.length,
      parseErrors,
      totalRecords: this.store.countRequests(),
    };

    if (!this.quiet && inserted > 0) {
      const tokens = this.store.countRequests();
      this.logger.log?.(
        `[token-lens] 已导入 ${inserted} 条推理记录（共 ${tokens} 条，耗时 ${Date.now() - started}ms）`,
      );
    }
    return { inserted, files: files.length, parseErrors, elapsedMs: Date.now() - started };
  }

  async _processFile(file) {
    let stat;
    try {
      stat = await fsp.stat(file);
    } catch {
      return { inserted: 0, parseErrors: 0 };
    }
    if (!stat.isFile()) return { inserted: 0, parseErrors: 0 };

    const saved = this.store.getLogFile(file);
    let offset = saved?.offset ?? 0;
    let lineNo = saved?.lineNo ?? 0;

    if (stat.size < offset) {
      // 日志被截断或重建：从头导入，并移除该文件旧记录。
      this.store.deleteRequestsForFile(file);
      offset = 0;
      lineNo = 0;
      this.parser.startFile(file);
    }

    if (stat.size === offset) {
      if (this.parser.file !== file) {
        // 没有新内容时不切换解析器状态，避免打断当前活跃文件的关联。
      }
      return { inserted: 0, parseErrors: 0 };
    }

    if (this.parser.file !== file) {
      this.parser.startFile(file);
    }

    const handle = await fsp.open(file, 'r');
    let position = offset;
    let carry = Buffer.alloc(0);
    let parseErrors = 0;
    let inserted = 0;
    const records = [];
    this.records = records;
    this.parser.emit = (record) => records.push(record);

    try {
      const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
      let done = false;
      while (!done) {
        const { bytesRead } = await handle.read(buffer, 0, CHUNK_SIZE, position);
        if (bytesRead === 0) break;
        position += bytesRead;
        let data;
        if (carry.length) {
          data = Buffer.concat([carry, buffer.subarray(0, bytesRead)]);
        } else {
          data = Buffer.from(buffer.subarray(0, bytesRead));
        }

        let start = 0;
        let newline;
        while ((newline = data.indexOf(10, start)) !== -1) {
          const line = data.toString('utf8', start, newline);
          lineNo += 1;
          try {
            this.parser.feed(line, lineNo);
          } catch {
            parseErrors += 1;
          }
          start = newline + 1;
        }
        carry = start < data.length ? Buffer.from(data.subarray(start)) : Buffer.alloc(0);
        if (bytesRead < CHUNK_SIZE) done = true;
      }

      if (records.length) {
        inserted = this.store.insertRequests(records);
      }
      const committed = position - carry.length;
      this.store.saveLogFile(file, committed, lineNo, stat.size, stat.mtimeMs);
      this.parser.emit = (record) => this.records.push(record);
      return { inserted, parseErrors };
    } finally {
      await handle.close();
    }
  }
}
