import { deltaInfo } from '../lib/format';
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from './Icons';

interface DeltaProps {
  current: number | null | undefined;
  previous: number | null | undefined;
  label?: string;
}

export function Delta({ current, previous, label = '较上一周期' }: DeltaProps) {
  const info = deltaInfo(current, previous);
  if (!info) {
    return (
      <span className="delta is-muted" title="上一周期没有可比较的数据" aria-label="上一周期无数据">
        —
      </span>
    );
  }
  const Icon =
    info.direction === 'up' ? ArrowUpRightIcon : info.direction === 'down' ? ArrowDownRightIcon : MinusIcon;
  return (
    <span className={`delta is-${info.direction}`}>
      <Icon size={13} />
      <span className="delta-value">{info.text}</span>
      <span className="delta-label">{label}</span>
    </span>
  );
}
