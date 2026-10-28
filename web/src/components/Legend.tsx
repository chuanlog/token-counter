import type { CSSProperties } from 'react';

export interface LegendItem {
  label: string;
  color: string;
  type?: 'rect' | 'line';
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <div className="legend" role="list" aria-label="图例">
      {items.map((item) => (
        <span className="legend-item" role="listitem" key={item.label}>
          <span
            className={`legend-mark ${item.type === 'line' ? 'is-line' : 'is-rect'}`}
            style={{ '--legend-color': item.color } as CSSProperties}
            aria-hidden
          />
          <span className="legend-label">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
