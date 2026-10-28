import type { ModelOption } from '../types';

/** 通过色盲安全校验的分类色板（深色表面 #13161c，相邻模式）。 */
export const MODEL_COLORS = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

export const OTHER_COLOR = '#8a909c';
export const INPUT_COLOR = '#3987e5';
export const OUTPUT_COLOR = '#d95926';

const STORAGE_KEY = 'token-lens.model-colors.v1';

function readStored(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeStored(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 隐私模式下 localStorage 可能不可用。
  }
}

/**
 * 模型 → 颜色一旦分配就持久化，筛选或排序变化不会重新上色。
 * 超过 8 个模型时，多出来的使用中性灰；图表里会折叠为「其他」。
 */
export function assignModelColors(options: ModelOption[]): Record<string, string> {
  const map = readStored();
  let changed = false;

  for (const option of options) {
    const name = option.model;
    if (name === 'unknown') {
      if (map[name] !== OTHER_COLOR) {
        map[name] = OTHER_COLOR;
        changed = true;
      }
      continue;
    }
    if (map[name]) continue;
    const used = new Set(Object.values(map));
    const next = MODEL_COLORS.find((color) => !used.has(color));
    map[name] = next ?? OTHER_COLOR;
    changed = true;
  }

  if (changed) writeStored(map);
  return { ...map };
}

export function colorFor(colors: Record<string, string>, model: string): string {
  if (model === 'unknown') return OTHER_COLOR;
  return colors[model] || OTHER_COLOR;
}

export function isCategoricalColor(color: string): boolean {
  return (MODEL_COLORS as readonly string[]).includes(color);
}
