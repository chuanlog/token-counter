import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { loadConfig, printHelp } from './config.js';
import { Store } from './db.js';
import { Ingestor } from './ingest.js';
import { LMStudioProbe } from './lmstudio.js';
import { buildDashboard } from './stats.js';

const SCAN_INTERVAL_MS = 2000;
const VERSION = '1.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function formatNumber(n) {
  return new Intl.NumberFormat('zh-CN').format(Math.round(Number(n) || 0));
}

function openBrowser(url) {
  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.unref();
  } catch {
    // 打不开浏览器不影响服务。
  }
}

async function serveFallbackPage(res) {
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Lens</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0c0f;color:#f2f3f5;
       font:15px/1.7 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  main{max-width:560px;padding:40px}
  h1{font-size:24px;margin:0 0 12px}
  code{background:#1a1e25;border:1px solid #262c36;border-radius:6px;padding:2px 7px;font-family:ui-monospace,Consolas,monospace}
  p{color:#a8adb7}
</style></head>
<body><main>
  <h1>前端资源尚未构建</h1>
  <p>在项目目录运行下面两条命令，然后刷新此页面：</p>
  <p><code>npm install</code><br><code>npm run build</code></p>
  <p>如果你只想启动采集服务，接口仍然可用：<code>/api/dashboard</code></p>
</main></body></html>`;
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

async function serveStatic(req, res, pathname, webDist) {
  if (!fs.existsSync(path.join(webDist, 'index.html'))) {
    await serveFallbackPage(res);
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }
  if (decoded.includes('\0')) {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(webDist, relative);
  const rootWithSep = `${path.resolve(webDist)}${path.sep}`;
  if (target !== path.resolve(webDist, 'index.html') && !target.startsWith(rootWithSep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let filePath = target;
  let stat = null;
  try {
    stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fsp.stat(filePath);
    }
  } catch {
    if (!path.extname(decoded)) {
      filePath = path.join(webDist, 'index.html');
      try {
        stat = await fsp.stat(filePath);
      } catch {
        await serveFallbackPage(res);
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const immutable = relative.startsWith('assets/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    'Content-Length': stat.size,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
}

function getQuery(url) {
  return new URL(url, 'http://localhost').searchParams;
}

async function main() {
  const config = loadConfig();
  if (config.help) {
    printHelp();
    return;
  }

  const store = new Store(config.db);
  if (config.rebuild) {
    store.resetDerived();
    if (!config.quiet) console.log('[token-lens] 已清空数据库，准备重新导入全部日志。');
  }

  const ingestor = new Ingestor({
    store,
    logDirs: config.logDirs,
    quiet: config.quiet,
    logger: console,
  });
  const probe = new LMStudioProbe();

  await ingestor.scan();

  if (config.scanOnly) {
    const bounds = store.getBounds();
    const models = store.getAllModels();
    const totalTokens = models.reduce((sum, item) => sum + item.tokens, 0);
    const totalRequests = models.reduce((sum, item) => sum + item.requests, 0);
    console.log('');
    console.log(`Token Lens 扫描完成`);
    console.log(`  日志目录: ${config.logDirs.length ? config.logDirs.join(', ') : '未找到'}`);
    console.log(`  日志文件: ${ingestor.status.files}`);
    console.log(`  推理记录: ${formatNumber(totalRequests)}`);
    console.log(`  模型数量: ${models.length}`);
    console.log(`  总 Tokens: ${formatNumber(totalTokens)}`);
    if (bounds.minTs && bounds.maxTs) {
      console.log(
        `  时间范围: ${new Date(bounds.minTs).toLocaleString('zh-CN')} ~ ${new Date(bounds.maxTs).toLocaleString('zh-CN')}`,
      );
    }
    if (models.length) {
      console.log('  模型明细:');
      for (const item of models) {
        console.log(`    - ${item.model}: ${formatNumber(item.requests)} 次 / ${formatNumber(item.tokens)} tokens`);
      }
    }
    store.close();
    return;
  }

  if (!config.quiet) {
    console.log('');
    console.log('  Token Lens · LM Studio Token 用量观测台');
    console.log(`  数据库: ${config.db}`);
    if (config.logDirs.length) {
      console.log('  监听日志:');
      for (const dir of config.logDirs) console.log(`    - ${dir}`);
    } else {
      console.log('  监听日志: 未找到 LM Studio server-logs 目录');
      console.log('           请确认 LM Studio 已开启本地服务器，或用 --logs 指定日志目录。');
    }
    if (ingestor.status.totalRecords === 0) {
      console.log('  提示: 暂无推理记录。LM Studio 产生请求后会自动导入，无需重启本程序。');
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = url.pathname;

      if (pathname === '/api/dashboard') {
        if (req.method !== 'GET') {
          json(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        const q = getQuery(req.url || '/');
        const lmStudio = await probe.check();
        const payload = buildDashboard(
          store,
          {
            from: q.get('from') || undefined,
            to: q.get('to') || undefined,
            model: q.get('model') || undefined,
            granularity: q.get('granularity') || 'auto',
            all: q.get('all') === '1',
          },
          {
            ingest: {
              ...ingestor.status,
              lastError: ingestor.lastError,
              intervalMs: SCAN_INTERVAL_MS,
            },
            lmStudio,
            logDirs: config.logDirs,
            searchedLogDirs: config.searchedLogDirs,
            scanIntervalMs: SCAN_INTERVAL_MS,
            version: VERSION,
            node: process.version,
          },
        );
        json(res, 200, payload);
        return;
      }

      if (pathname === '/api/refresh') {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        const result = await ingestor.scan();
        const lmStudio = await probe.check();
        json(res, 200, {
          ok: true,
          ...result,
          totalRecords: ingestor.status.totalRecords,
          lmStudio,
        });
        return;
      }

      if (pathname === '/api/status') {
        const lmStudio = await probe.check();
        json(res, 200, {
          ok: true,
          ingest: { ...ingestor.status, lastError: ingestor.lastError },
          lmStudio,
          logDirs: config.logDirs,
          searchedLogDirs: config.searchedLogDirs,
          bounds: store.getBounds(),
          models: store.getAllModels(),
        });
        return;
      }

      if (pathname === '/healthz') {
        json(res, 200, { ok: true });
        return;
      }

      if (pathname.startsWith('/api/')) {
        json(res, 404, { error: 'Not Found' });
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      await serveStatic(req, res, pathname, config.webDist);
    } catch (error) {
      if (!res.headersSent) {
        json(res, error.statusCode || 500, { error: error.message || 'Internal Server Error' });
      } else {
        res.end();
      }
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[token-lens] 端口 ${config.port} 已被占用，请用 --port 指定其它端口。`);
    } else {
      console.error('[token-lens] 服务启动失败:', error.message);
    }
    store.close();
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    const displayHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
    const address = `http://${displayHost}:${config.port}`;
    if (!config.quiet) {
      console.log('');
      console.log(`  Web 界面: ${address}`);
      if (config.dev) console.log('  开发模式: Vite 前端在 http://127.0.0.1:5179');
      console.log('  按 Ctrl+C 停止。');
      console.log('');
    }
    if (config.open) openBrowser(address);
  });

  const timer = setInterval(() => {
    ingestor.scan().catch((error) => {
      ingestor.lastError = error.message;
    });
  }, SCAN_INTERVAL_MS);
  timer.unref?.();

  const shutdown = () => {
    clearInterval(timer);
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => {
      store.close();
      process.exit(0);
    }, 1000).unref?.();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[token-lens] 启动失败:', error);
  process.exitCode = 1;
});
