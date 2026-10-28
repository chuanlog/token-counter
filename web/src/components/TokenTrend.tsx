import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { INPUT_COLOR, OTHER_COLOR, OUTPUT_COLOR, colorFor } from '../lib/colors';
import { bucketTitle, granularityLabel } from '../lib/dates';
import { formatCompact, formatInt, formatSpeedValue, modelLabel } from '../lib/format';
import { chartTheme } from '../lib/theme';
import type { Dashboard } from '../types';
import { ChartIcon, TableIcon } from './Icons';
import { Legend, type LegendItem } from './Legend';
import { Segmented } from './Segmented';
import { TokenTooltip } from './ChartTooltip';

interface TokenTrendProps {
  data: Dashboard;
  colors: Record<string, string>;
  onShowAll?: () => void;
}

type ViewMode = 'chart' | 'table';
type SplitMode = 'model' | 'io';

interface SeriesDef {
  key: string;
  label: string;
  color: string;
  model?: string;
}

interface ChartRow {
  label: string;
  __title: string;
  __total: number;
  __requests: number;
  __errors: number;
  __bottom: string | null;
  __top: string | null;
  [key: string]: unknown;
}

export function TokenTrend({ data, colors, onShowAll }: TokenTrendProps) {
  const [mode, setMode] = useState<SplitMode>('model');
  const [view, setView] = useState<ViewMode>('chart');
  const granularity = data.filter.granularity;

  const { defs, otherModels } = useMemo(() => {
    if (mode === 'io') {
      return {
        defs: [
          { key: 's_input', label: '输入 Tokens', color: INPUT_COLOR },
          { key: 's_output', label: '输出 Tokens', color: OUTPUT_COLOR },
        ] as SeriesDef[],
        otherModels: [] as string[],
      };
    }
    const names = data.models.map((model) => model.model);
    const regular = names.length > 8 ? names.slice(0, 7) : names;
    const other = names.length > 8 ? names.slice(7) : [];
    const list: SeriesDef[] = regular.map((model, index) => ({
      key: `m_${index}`,
      label: modelLabel(model),
      color: colorFor(colors, model),
      model,
    }));
    if (other.length) {
      list.push({
        key: 'm_other',
        label: `其他 (${other.length})`,
        color: OTHER_COLOR,
      });
    }
    return { defs: list, otherModels: other };
  }, [mode, data.models, colors]);

  const rows = useMemo<ChartRow[]>(() => {
    return data.series.map((point) => {
      const row: ChartRow = {
        label: point.label,
        __title: bucketTitle(point.bucket, granularity),
        __total: point.totalTokens,
        __requests: point.requests,
        __errors: point.errors,
        __bottom: null,
        __top: null,
      };
      if (mode === 'io') {
        row.s_input = point.promptTokens;
        row.s_output = point.completionTokens;
      } else {
        for (const def of defs) {
          if (def.model) {
            row[def.key] = point.byModel[def.model]?.totalTokens ?? 0;
          } else {
            row[def.key] = otherModels.reduce(
              (sum, model) => sum + (point.byModel[model]?.totalTokens ?? 0),
              0,
            );
          }
        }
      }
      const nonZero = defs.filter((def) => Number(row[def.key] || 0) > 0);
      row.__bottom = nonZero[0]?.key ?? null;
      row.__top = nonZero[nonZero.length - 1]?.key ?? null;
      return row;
    });
  }, [data.series, defs, granularity, mode, otherModels]);

  const legendItems: LegendItem[] = defs.map((def) => ({
    label: def.label,
    color: def.color,
    type: 'rect',
  }));
  const granLabel = granularityLabel(granularity);
  const subtitle =
    mode === 'io'
      ? `按${granLabel}拆分输入与输出 token`
      : defs.length === 1
        ? `仅 ${defs[0].label} · 按${granLabel}汇总`
        : `按${granLabel}汇总，堆叠显示各模型 token`;
  const empty = data.summary.requests === 0;

  return (
    <article className="card chart-card token-trend-card">
      <div className="card-head">
        <div className="card-title-wrap">
          <h2 className="card-title">Token 趋势</h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        <div className="card-actions">
          <Segmented
            ariaLabel="Token 拆分方式"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'model', label: '按模型' },
              { value: 'io', label: '输入 / 输出' },
            ]}
          />
          <button
            type="button"
            className={`icon-button subtle${view === 'table' ? ' is-active' : ''}`}
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            aria-label={view === 'chart' ? '切换为数据表' : '切换为图表'}
            title={view === 'chart' ? '查看数据表' : '返回图表'}
          >
            {view === 'chart' ? <TableIcon size={16} /> : <ChartIcon size={16} />}
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <div className="chart-meta">
            <Legend items={legendItems} />
            <span className="chart-note">
              {formatInt(data.summary.totalTokens)} tokens · {formatInt(data.summary.requests)} 次请求
            </span>
          </div>
          <div
            className="chart-box"
            role="img"
            aria-label={`Token 趋势图，共 ${formatInt(data.summary.totalTokens)} 个 token`}
          >
            <ResponsiveContainer width="100%" height={296}>
              <BarChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="0" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chartTheme.muted, fontSize: 11 }}
                  tickMargin={10}
                  minTickGap={16}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={46}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chartTheme.muted, fontSize: 11 }}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <Tooltip
                  content={<TokenTooltip />}
                  cursor={{ fill: chartTheme.cursor }}
                  wrapperStyle={{ outline: 'none' }}
                />
                {defs.map((def) => (
                  <Bar
                    key={def.key}
                    dataKey={def.key}
                    name={def.label}
                    stackId="tokens"
                    fill={def.color}
                    maxBarSize={22}
                    isAnimationActive={false}
                    shape={(props: any) => (
                      <StackBar {...(props as StackBarProps)} barKey={def.key} color={def.color} />
                    )}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            {empty ? (
              <div className="chart-empty">
                <p>该时间范围内没有 Token 记录</p>
                {onShowAll ? (
                  <button type="button" className="text-button" onClick={onShowAll}>
                    查看全部时间
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="chart-foot">
            <span>输入 = 引擎实际处理的提示词 token；输出 = 生成内容 token。</span>
          </div>
        </>
      ) : (
        <div className="table-scroll chart-table-wrap">
          <table className="data-table">
            <caption className="sr-only">Token 趋势数据表</caption>
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col" className="num">输入</th>
                <th scope="col" className="num">输出</th>
                <th scope="col" className="num">合计</th>
                <th scope="col" className="num">请求</th>
                <th scope="col" className="num">平均 TPS</th>
              </tr>
            </thead>
            <tbody>
              {data.series.length ? (
                data.series.map((point) => (
                  <tr key={point.bucket}>
                    <th scope="row" className="row-label" title={bucketTitle(point.bucket, granularity)}>
                      {point.label}
                    </th>
                    <td className="num">{formatInt(point.promptTokens)}</td>
                    <td className="num">{formatInt(point.completionTokens)}</td>
                    <td className="num strong">{formatInt(point.totalTokens)}</td>
                    <td className="num">{formatInt(point.requests)}</td>
                    <td className="num">{formatSpeedValue(point.tps)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-cell">该时间范围内没有记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

interface StackBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ChartRow;
}

function StackBar({ x = 0, y = 0, width = 0, height = 0, fill, payload, barKey, color }: StackBarProps & { barKey: string; color: string }) {
  if (!payload || !height || height <= 0 || width <= 0) return null;
  const isBottom = payload.__bottom === barKey;
  const isTop = payload.__top === barKey;
  const gap = 2;
  const drawHeight = Math.max(0, height - (isBottom ? 0 : gap));
  if (drawHeight <= 0.2) return null;
  const radius = isTop ? Math.min(4, width / 2, drawHeight / 2) : 0;
  const right = x + width;
  const bottom = y + drawHeight;
  const d = radius
    ? `M${x},${bottom} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${right - radius},${y} Q${right},${y} ${right},${y + radius} L${right},${bottom} Z`
    : `M${x},${y} h${width} v${drawHeight} h${-width} Z`;
  return <path d={d} fill={fill || color} />;
}
