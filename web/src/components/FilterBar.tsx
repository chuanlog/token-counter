import type { RangePreset } from '../lib/dates';
import { formatClock } from '../lib/format';
import type { Granularity, ModelOption } from '../types';
import { GranularityPicker, type GranularityChoice } from './GranularityPicker';
import { ModelPicker } from './ModelPicker';
import { RangePicker } from './RangePicker';
import { Toggle } from './Toggle';
import { RefreshIcon } from './Icons';

interface FilterBarProps {
  preset: RangePreset;
  from: string;
  to: string;
  onRangeChange: (preset: RangePreset, from?: string, to?: string) => void;
  model: string;
  modelOptions: ModelOption[];
  colors: Record<string, string>;
  onModelChange: (model: string) => void;
  granularity: GranularityChoice;
  actualGranularity?: Granularity;
  onGranularityChange: (value: GranularityChoice) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function FilterBar({
  preset,
  from,
  to,
  onRangeChange,
  model,
  modelOptions,
  colors,
  onModelChange,
  granularity,
  actualGranularity,
  onGranularityChange,
  autoRefresh,
  onAutoRefreshChange,
  updatedAt,
  refreshing,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-main">
        <RangePicker preset={preset} from={from} to={to} onChange={onRangeChange} />
        <ModelPicker model={model} options={modelOptions} colors={colors} onChange={onModelChange} />
        <GranularityPicker
          value={granularity}
          actual={actualGranularity}
          onChange={onGranularityChange}
        />
      </div>
      <div className="filter-side">
        <Toggle checked={autoRefresh} onChange={onAutoRefreshChange} label="自动刷新" />
        <span className="filter-divider" aria-hidden />
        <span className="freshness" aria-live="polite">
          {refreshing ? '刷新中…' : updatedAt ? `更新于 ${formatClock(updatedAt)}` : '等待数据'}
        </span>
        <button
          type="button"
          className={`icon-button refresh-button${refreshing ? ' is-spinning' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="立即刷新"
          title="立即刷新（重新扫描 LM Studio 日志）"
        >
          <RefreshIcon size={16} />
        </button>
      </div>
    </div>
  );
}
