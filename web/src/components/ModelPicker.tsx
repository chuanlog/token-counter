import { useRef, useState } from 'react';

import { colorFor } from '../lib/colors';
import { formatCompact, modelLabel } from '../lib/format';
import { useClickOutside } from '../lib/hooks';
import type { ModelOption } from '../types';
import { CheckIcon, ChevronDownIcon } from './Icons';

interface ModelPickerProps {
  model: string;
  options: ModelOption[];
  colors: Record<string, string>;
  onChange: (model: string) => void;
}

export function ModelPicker({ model, options, colors, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), open);

  const selected = options.find((option) => option.model === model);
  const selectedColor = model !== 'all' ? colorFor(colors, model) : undefined;

  const choose = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className={`picker-button model-picker-button${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`model-dot${selectedColor ? '' : ' is-all'}`}
          style={selectedColor ? { background: selectedColor } : undefined}
          aria-hidden
        />
        <span className="picker-button-text">
          <span className="picker-button-label">
            {model === 'all' ? '全部模型' : modelLabel(model)}
          </span>
          <span className="picker-button-sub">
            {model === 'all'
              ? options.length
                ? `${options.length} 个模型`
                : '暂无模型'
              : selected
                ? `${formatCompact(selected.tokens)} tokens`
                : '无数据'}
          </span>
        </span>
        <ChevronDownIcon size={14} className="picker-chevron" />
      </button>

      {open ? (
        <div className="picker-popover model-popover" role="listbox" aria-label="模型筛选">
          <div className="picker-section-label">按模型筛选</div>
          <button
            type="button"
            role="option"
            aria-selected={model === 'all'}
            className={`picker-row${model === 'all' ? ' is-selected' : ''}`}
            onClick={() => choose('all')}
          >
            <span className="picker-row-main">
              <span className="model-dot is-all" aria-hidden />
              <span>全部模型</span>
            </span>
            {model === 'all' ? <CheckIcon size={15} className="picker-check" /> : null}
          </button>

          <div className="picker-model-list">
            {options.map((option) => {
              const color = colorFor(colors, option.model);
              return (
                <button
                  key={option.model}
                  type="button"
                  role="option"
                  aria-selected={model === option.model}
                  className={`picker-row${model === option.model ? ' is-selected' : ''}`}
                  onClick={() => choose(option.model)}
                  title={modelLabel(option.model)}
                >
                  <span className="picker-row-main">
                    <span className="model-dot" style={{ background: color }} aria-hidden />
                    <span className="model-option-name">{modelLabel(option.model)}</span>
                    <span className="model-option-tokens">{formatCompact(option.tokens)}</span>
                  </span>
                  {model === option.model ? <CheckIcon size={15} className="picker-check" /> : null}
                </button>
              );
            })}
          </div>
          {!options.length ? <div className="picker-empty">还没有可筛选的模型</div> : null}
        </div>
      ) : null}
    </div>
  );
}
