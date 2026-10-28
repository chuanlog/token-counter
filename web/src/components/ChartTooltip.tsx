import { formatInt, formatSpeedValue } from '../lib/format';

interface TooltipPayloadItem {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface GenericTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function tipTitle(payload: TooltipPayloadItem[] | undefined): string {
  const row = payload?.[0]?.payload;
  const title = row?.__title;
  return typeof title === 'string' ? title : '';
}

export function TokenTooltip({ active, payload }: GenericTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const total = typeof row.__total === 'number' ? row.__total : 0;
  const requests = typeof row.__requests === 'number' ? row.__requests : 0;
  const errors = typeof row.__errors === 'number' ? row.__errors : 0;
  const items = payload
    .map((item) => ({
      key: String(item.dataKey ?? item.name ?? ''),
      label: item.name || String(item.dataKey ?? ''),
      color: item.color || '#8a909c',
      value: Number(item.value) || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{tipTitle(payload)}</div>
      <div className="chart-tip-total">
        <span>合计</span>
        <strong>{formatInt(total)}</strong>
        <span className="chart-tip-unit">tokens</span>
      </div>
      <div className="chart-tip-rows">
        {items.length ? (
          items.map((item) => (
            <div className="chart-tip-row" key={item.key}>
              <span className="tip-key" style={{ background: item.color }} aria-hidden />
              <span className="tip-label">{item.label}</span>
              <span className="tip-value">{formatInt(item.value)}</span>
            </div>
          ))
        ) : (
          <div className="chart-tip-empty">该时段没有 Token 记录</div>
        )}
      </div>
      <div className="chart-tip-foot">
        请求 {formatInt(requests)} 次{errors > 0 ? ` · 失败 ${formatInt(errors)} 次` : ''}
      </div>
    </div>
  );
}

export function TpsTooltip({ active, payload }: GenericTooltipProps) {
  if (!active || !payload?.length) return null;
  const items = payload
    .map((item) => ({
      key: String(item.dataKey ?? item.name ?? ''),
      label: item.name || String(item.dataKey ?? ''),
      color: item.color || '#8a909c',
      value: item.value == null ? null : Number(item.value),
    }))
    .filter((item) => item.value != null && Number.isFinite(item.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{tipTitle(payload)}</div>
      <div className="chart-tip-rows">
        {items.length ? (
          items.map((item) => (
            <div className="chart-tip-row" key={item.key}>
              <span className="tip-key is-line" style={{ background: item.color }} aria-hidden />
              <span className="tip-label">{item.label}</span>
              <span className="tip-value">
                {formatSpeedValue(item.value)}
                <span className="tip-unit">tok/s</span>
              </span>
            </div>
          ))
        ) : (
          <div className="chart-tip-empty">该时段没有生成速度记录</div>
        )}
      </div>
      <div className="chart-tip-foot">按输出 token ÷ 生成耗时加权</div>
    </div>
  );
}

export function MiniTooltip({
  active,
  payload,
  kind,
}: GenericTooltipProps & { kind: 'tokens' | 'requests' }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value) || 0;
  return (
    <div className="chart-tip is-compact">
      <div className="chart-tip-title">{tipTitle(payload)}</div>
      <div className="chart-tip-total">
        <span>{kind === 'tokens' ? 'Tokens' : '请求'}</span>
        <strong>{formatInt(value)}</strong>
        {kind === 'tokens' ? <span className="chart-tip-unit">tokens</span> : <span className="chart-tip-unit">次</span>}
      </div>
    </div>
  );
}
