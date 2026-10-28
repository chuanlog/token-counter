import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function takeArg(argv, index, name) {
  const arg = argv[index];
  if (arg === name) return argv[index + 1];
  if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  return undefined;
}

function parseArgs(argv) {
  const opts = {
    port: Number(process.env.TOKEN_COUNTER_PORT || 1236),
    host: process.env.TOKEN_COUNTER_HOST || '127.0.0.1',
    db: process.env.TOKEN_COUNTER_DB || path.join(ROOT, 'data', 'token-counter.db'),
    logs: [],
    open: process.env.TOKEN_COUNTER_NO_OPEN === '1' ? false : true,
    dev: false,
    scanOnly: false,
    rebuild: false,
    quiet: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--no-open') {
      opts.open = false;
    } else if (arg === '--dev') {
      opts.dev = true;
      opts.open = false;
    } else if (arg === '--scan-only') {
      opts.scanOnly = true;
      opts.open = false;
    } else if (arg === '--rebuild') {
      opts.rebuild = true;
    } else if (arg === '--quiet') {
      opts.quiet = true;
    } else if (arg === '--port' || arg.startsWith('--port=')) {
      const value = takeArg(argv, i, '--port');
      if (arg === '--port') i += 1;
      opts.port = Number(value);
    } else if (arg === '--host' || arg.startsWith('--host=')) {
      const value = takeArg(argv, i, '--host');
      if (arg === '--host') i += 1;
      opts.host = value;
    } else if (arg === '--db' || arg.startsWith('--db=')) {
      const value = takeArg(argv, i, '--db');
      if (arg === '--db') i += 1;
      opts.db = value;
    } else if (arg === '--logs' || arg.startsWith('--logs=')) {
      const value = takeArg(argv, i, '--logs');
      if (arg === '--logs') i += 1;
      for (const item of String(value || '').split(/[;,]/)) {
        if (item.trim()) opts.logs.push(item.trim());
      }
    } else if (arg === '--open') {
      opts.open = true;
    }
  }

  if (!Number.isFinite(opts.port) || opts.port <= 0 || opts.port > 65535) {
    opts.port = 1236;
  }
  opts.db = path.resolve(opts.db);
  opts.logs = opts.logs.map((p) => path.resolve(p));
  return opts;
}

export function candidateLogDirs(home = os.homedir()) {
  const lmstudio = path.join(home, '.lmstudio');
  const dirs = [path.join(lmstudio, 'apps', 'bionic', 'server-logs'), path.join(lmstudio, 'server-logs')];

  // 未来 LM Studio 若把应用目录改名，也尝试 apps/<name>/server-logs。
  try {
    for (const entry of fs.readdirSync(path.join(lmstudio, 'apps'), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'bionic') continue;
      dirs.push(path.join(lmstudio, 'apps', entry.name, 'server-logs'));
    }
  } catch {
    // 目录不存在时忽略。
  }
  return dirs;
}

export function resolveLogDirs(explicitDirs, home = os.homedir()) {
  const searched = candidateLogDirs(home);
  const candidates = explicitDirs.length ? [...explicitDirs, ...searched] : searched;
  const seen = new Set();
  const existing = [];
  for (const dir of candidates) {
    const abs = path.resolve(dir);
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      if (fs.statSync(abs).isDirectory()) existing.push(abs);
    } catch {
      // 不存在则跳过。
    }
  }
  return { logDirs: existing, searched: [...seen] };
}

export function loadConfig(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const { logDirs, searched } = resolveLogDirs(opts.logs);
  return { ...opts, logDirs, searchedLogDirs: searched, webDist: path.join(ROOT, 'web', 'dist') };
}

export function printHelp() {
  console.log(`
Token Lens · LM Studio Token 用量观测台

用法:
  npm start -- [选项]
  start.bat [选项]          （Windows 双击时无需参数）

选项:
  --port <端口>       Web 端口，默认 1236
  --host <地址>       监听地址，默认 127.0.0.1
  --logs <目录>       LM Studio server-logs 目录，可重复或逗号分隔
  --db <文件>         SQLite 数据库路径，默认 data/token-counter.db
  --no-open           启动后不自动打开浏览器
  --dev               开发模式（配合 Vite）
  --scan-only         只导入日志并打印统计，不启动 Web 服务
  --rebuild           清空数据库后重新导入全部日志
  --quiet             不输出扫描日志
  -h, --help          显示帮助

环境变量:
  TOKEN_COUNTER_PORT / TOKEN_COUNTER_HOST / TOKEN_COUNTER_DB / TOKEN_COUNTER_NO_OPEN
`);
}
