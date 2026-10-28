const intFormatter = new Intl.NumberFormat('zh-CN');

export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return intFormatter.format(Math.round(value));
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const n = Math.abs(value);
  if (n >= 1e12) return `${trimZero(value / 1e12)}T`;
  if (n >= 1e9) return `${trimZero(value / 1e9)}B`;
  if (n >= 1e6) return `${trimZero(value / 1e6)}M`;
  if (n >= 1e3) return `${trimZero(value / 1e3)}K`;
  return intFormatter.format(Math.round(value));
}

function trimZero(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1;
  return value.toFixed(digits).replace(/\.0$/, '');
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatRatioPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/** KPI 里的大数字：保留完整千分位。 */
export function formatHero(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return intFormatter.format(Math.round(value));
}

export function formatSpeedValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 100) return Math.round(value).toString();
  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatSpeed(value: number | null | undefined): string {
  const text = formatSpeedValue(value);
  return text === '—' ? text : `${text} tok/s`;
}

export interface LatencyParts {
  value: string;
  unit: string;
}

export function formatLatencyParts(ms: number | null | undefined): LatencyParts {
  if (ms == null || !Number.isFinite(ms)) return { value: '—', unit: '' };
  if (ms < 1000) return { value: String(Math.round(ms)), unit: 'ms' };
  if (ms < 60000) {
    const value = ms / 1000;
    return { value: value.toFixed(value < 10 ? 2 : 1), unit: 's' };
  }
  return { value: (ms / 60000).toFixed(1), unit: 'min' };
}

export function formatLatency(ms: number | null | undefined): string {
  const parts = formatLatencyParts(ms);
  return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
}

export function formatDuration(ms: number | null | undefined): string {
  return formatLatency(ms);
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatClockShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(ts: number): string {
  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()} ${formatClockShort(ts)}`;
}

export function formatFullDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export interface DeltaInfo {
  text: string;
  direction: 'up' | 'down' | 'flat';
}

export function deltaInfo(
  current: number | null | undefined,
  previous: number | null | undefined,
): DeltaInfo | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return { text: '0%', direction: 'flat' };
  return {
    text: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
    direction: change > 0 ? 'up' : 'down',
  };
}

export function modelLabel(model: string | null | undefined): string {
  if (!model || model === 'unknown') return '未识别模型';
  return model;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
