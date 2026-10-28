import { useRef, useState } from 'react';

import { formatRangeText, PRESET_LABELS, toDateTimeInput, type RangePreset } from '../lib/dates';
import { useClickOutside } from '../lib/hooks';
import { CalendarIcon, CheckIcon, ChevronDownIcon } from './Icons';

interface RangePickerProps {
  preset: RangePreset;
  from: string;
  to: string;
  onChange: (preset: RangePreset, from?: string, to?: string) => void;
}

const PRESETS: Exclude<RangePreset, 'custom'>[] = [
  '15m',
  '1h',
  '6h',
  'today',
  '7d',
  '30d',
  'month',
  'all',
];

export function RangePicker({ preset, from, to, onChange }: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(() => toDateTimeInput(from, false));
  const [tempTo, setTempTo] = useState(() => toDateTimeInput(to, true));
  const rootRef = useRef<HTMLDivElement>(null);

  useClickOutside(rootRef, () => setOpen(false), open);

  const toggle = () => {
    if (!open) {
      setTempFrom(toDateTimeInput(from, false));
      setTempTo(toDateTimeInput(to, true));
    }
    setOpen((value) => !value);
  };

  const choose = (value: Exclude<RangePreset, 'custom'>) => {
    onChange(value);
    setOpen(false);
  };

  const customInvalid = !tempFrom || !tempTo || tempFrom > tempTo;

  const applyCustom = () => {
    if (customInvalid) return;
    onChange('custom', tempFrom, tempTo);
    setOpen(false);
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className={`picker-button${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon size={15} />
        <span className="picker-button-text">
          <span className="picker-button-label">{PRESET_LABELS[preset]}</span>
          <span className="picker-button-sub">{formatRangeText(from, to)}</span>
        </span>
        <ChevronDownIcon size={14} className="picker-chevron" />
      </button>

      {open ? (
        <div className="picker-popover range-popover" role="menu" aria-label="时间范围">
          <div className="picker-section-label">时间范围</div>
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preset === value}
              className={`picker-row${preset === value ? ' is-selected' : ''}`}
              onClick={() => choose(value)}
            >
              <span>{PRESET_LABELS[value]}</span>
              {preset === value ? <CheckIcon size={15} className="picker-check" /> : null}
            </button>
          ))}

          <div className="picker-divider" />

          <div className={`picker-section-label${preset === 'custom' ? ' is-accent' : ''}`}>
            自定义范围
            {preset === 'custom' ? <CheckIcon size={13} /> : null}
          </div>
          <div className="date-range">
            <label className="date-field">
              <span>开始 · 精确到分钟</span>
              <input
                type="datetime-local"
                step="60"
                value={tempFrom}
                max={tempTo || undefined}
                onChange={(event) => setTempFrom(event.target.value)}
              />
            </label>
            <span className="date-range-dash">–</span>
            <label className="date-field">
              <span>结束 · 精确到分钟</span>
              <input
                type="datetime-local"
                step="60"
                value={tempTo}
                min={tempFrom || undefined}
                onChange={(event) => setTempTo(event.target.value)}
              />
            </label>
          </div>
          {customInvalid ? <div className="picker-error">开始日期不能晚于结束日期</div> : null}
          <button type="button" className="picker-apply" disabled={customInvalid} onClick={applyCustom}>
            应用自定义范围
          </button>
        </div>
      ) : null}
    </div>
  );
}
