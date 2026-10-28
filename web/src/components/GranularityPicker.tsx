import { granularityLabel } from '../lib/dates';
import type { Granularity } from '../types';
import { ChevronDownIcon } from './Icons';

export type GranularityChoice = 'auto' | Granularity;

interface GranularityPickerProps {
  value: GranularityChoice;
  actual?: Granularity;
  onChange: (value: GranularityChoice) => void;
}

const OPTIONS: { value: GranularityChoice; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
];

export function GranularityPicker({ value, actual, onChange }: GranularityPickerProps) {
  const fallback = value !== 'auto' && actual != null && value !== actual;
  const fallbackLabel = fallback && actual ? granularityLabel(actual) : '';
  const valueLabel = value === 'auto' ? '自动' : granularityLabel(value);
  const title = fallback
    ? `该时间范围超过${valueLabel}粒度的上限，已自动使用${fallbackLabel}`
    : '自动：2 小时以内按分钟，2 天以内按小时，其余按天；分钟粒度上限 24 小时，小时粒度上限 90 天。';

  return (
    <label className={`granularity-control${fallback ? ' is-fallback' : ''}`} title={title}>
      <span className="gc-label">粒度{fallback ? ` · 已用${fallbackLabel}` : ''}</span>
      <span className="gc-select-wrap">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as GranularityChoice)}
          aria-label="图表时间粒度"
        >
          {OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={13} className="gc-chevron" />
      </span>
    </label>
  );
}
