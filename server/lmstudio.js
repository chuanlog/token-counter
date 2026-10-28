import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CONFIG_FILES = [
  ['.lmstudio', 'apps', 'bionic', '.internal', 'http-server.json'],
  ['.lmstudio', 'apps', 'bionic', '.internal', 'http-server-config.json'],
  ['.lmstudio', '.internal', 'http-server.json'],
  ['.lmstudio', '.internal', 'http-server-config.json'],
];

async function readConfiguredPorts(home) {
  const ports = new Set();
  for (const parts of CONFIG_FILES) {
    try {
      const raw = await fsp.readFile(path.join(home, ...parts), 'utf8');
      const json = JSON.parse(raw);
      const port = Number(json.port);
      if (Number.isInteger(port) && port > 0 && port < 65536) ports.add(port);
    } catch {
      // 配置文件不存在或不可读。
    }
  }
  return [...ports];
}

async function probePort(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      signal: AbortSignal.timeout(700),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const models = Array.isArray(json?.data)
      ? json.data.map((item) => item?.id).filter((id) => typeof id === 'string')
      : [];
    return { online: true, port, models };
  } catch {
    return null;
  }
}

export class LMStudioProbe {
  constructor({ home = os.homedir() } = {}) {
    this.home = home;
    this.cache = null;
    this.cachedAt = 0;
  }

  async check() {
    if (this.cache && Date.now() - this.cachedAt < 5000) return this.cache;

    const configured = await readConfiguredPorts(this.home);
    const ports = [...new Set([...configured, 1235, 1234])];
    const results = await Promise.all(ports.map((port) => probePort(port)));
    const online = results.filter(Boolean);
    // 优先采用 LM Studio 配置中的端口，其次 1235，再其次 1234。
    online.sort((a, b) => {
      const ai = ports.indexOf(a.port);
      const bi = ports.indexOf(b.port);
      return ai - bi;
    });

    const result = online.length
      ? {
          online: true,
          port: online[0].port,
          models: online[0].models,
          checkedAt: Date.now(),
        }
      : { online: false, ports, models: [], checkedAt: Date.now() };

    this.cache = result;
    this.cachedAt = Date.now();
    return result;
  }
}
