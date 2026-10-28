import type { Dashboard } from './types';

export interface DashboardQuery {
  from?: string;
  to?: string;
  all?: boolean;
  model?: string;
  granularity?: string;
  signal?: AbortSignal;
}

async function readError(response: Response): Promise<string> {
  try {
    const json = await response.json();
    if (json && typeof json.error === 'string') return json.error;
  } catch {
    // response 不是 JSON。
  }
  return `请求失败（HTTP ${response.status}）`;
}

export async function fetchDashboard(query: DashboardQuery): Promise<Dashboard> {
  const params = new URLSearchParams();
  if (query.all) {
    params.set('all', '1');
  } else {
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
  }
  if (query.model && query.model !== 'all') params.set('model', query.model);
  params.set('granularity', query.granularity || 'auto');

  const response = await fetch(`/api/dashboard?${params.toString()}`, {
    signal: query.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Dashboard;
}

export async function triggerRefresh(): Promise<void> {
  const response = await fetch('/api/refresh', { method: 'POST' });
  if (!response.ok) throw new Error(await readError(response));
}

export async function shutdownServer(): Promise<void> {
  const response = await fetch('/api/shutdown', {
    method: 'POST',
    headers: { 'X-Token-Lens': 'shutdown' },
  });
  if (!response.ok) throw new Error(await readError(response));
}
