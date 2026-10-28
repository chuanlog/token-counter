import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

import { colorFor } from '../lib/colors';
import { bucketTitle, granularityLabel } from '../lib/dates';
import {
  formatDateTime,
  formatInt,
  formatLatency,
  formatPercent,
  formatRatioPercent,
  formatSpeedValue,
  modelLabel,
} from '../lib/format';
import { chartTheme } from '../lib/theme';
import type { Dashboard, Granularity, ModelAggregate } from '../types';
import { AlertIcon, ChartIcon, TableIcon } from './Icons';
import { MiniTooltip } from './ChartTooltip';

interface ModelSectionProps {
  data: Dashboard;
  colors: Record<string, string>;
}

interface MiniPoint {
  bucket: string;
  label: string;
  __title: string;
  requests: number;
  totalTokens: number;
}

export function ModelSection({ data, colors }: ModelSectionProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const granularity = data.filter.granularity;
  const labelMap = useMemo(() => {
    const map = new Map<string, { label: string; title: string }>();
    for (const point of data.series) {
      map.set(point.bucket, {
        label: point.label,
        title: bucketTitle(point.bucket, granularity),
      });
    }
    return map;
  }, [data.series, granularity]);

  return (
    <section className="model-section" aria-label="模型分布">
      <div className="section-head">
        <div className="card-title-wrap">
          <h2 className="section-title">模型分布</h2>
          <p className="card-subtitle">按 Token 总量排序 · 每个模型的请求与用量趋势</p>
        </div>
        <button
          type="button"
          className={`icon-button subtle${view === 'table' ? ' is-active' : ''}`}
          onClick={() => setView(view === 'cards' ? 'table' : 'cards')}
          aria-label={view === 'cards' ? '切换为模型数据表' : '切换为模型卡片'}
          title={view === 'cards' ? '查看模型数据表' : '返回模型卡片'}
        >
          {view === 'cards' ? <TableIcon size={16} /> : <ChartIcon size={16} />}
        </button>
      </div>

      {!data.models.length ? (
        <div className="card empty-card">
          <p>该时间范围内没有模型数据</p>
        </div>
      ) : view === 'table' ? (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="data-table model-table">
              <caption className="sr-only">模型统计表</caption>
              <thead>
                <tr>
                  <th scope="col">模型</th>
                  <th scope="col" className="num">请求</th>
                  <th scope="col" className="num">输入</th>
                  <th scope="col" className="num">输出</th>
                  <th scope="col" className="num">合计</th>
                  <th scope="col" className="num">占比</th>
                  <th scope="col" className="num">平均 TPS</th>
                  <th scope="col" className="num">平均首字</th>
                  <th scope="col">最近使用</th>
                </tr>
              </thead>
              <tbody>
                {data.models.map((model) => (
                  <tr key={model.model}>
                    <th scope="row" className="row-label model-cell">
                      <span
                        className="model-dot"
                        style={{ background: colorFor(colors, model.model) }}
                        aria-hidden
                      />
                      <span className="model-name" title={modelLabel(model.model)}>
                        {modelLabel(model.model)}
                      </span>
                      {model.errors > 0 ? (
                        <span className="error-badge" title={`${model.errors} 次失败请求`}>
                          <AlertIcon size={11} />
                          失败 {formatInt(model.errors)}
                        </span>
                      ) : null}
                    </th>
                    <td className="num">{formatInt(model.requests)}</td>
                    <td className="num">{formatInt(model.promptTokens)}</td>
                    <td className="num">{formatInt(model.completionTokens)}</td>
                    <td className="num strong">{formatInt(model.totalTokens)}</td>
                    <td className="num">{formatRatioPercent(model.share)}</td>
                    <td className="num">{formatSpeedValue(model.avgTps)}</td>
                    <td className="num">{formatLatency(model.avgTtftMs)}</td>
                    <td className="muted-cell">{model.lastTs ? formatDateTime(model.lastTs) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="model-grid">
          {data.models.map((model) => (
            <ModelCard
              key={model.model}
              model={model}
              color={colorFor(colors, model.model)}
              labelMap={labelMap}
              granularity={granularity}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface ModelCardProps {
  model: ModelAggregate;
  color: string;
  labelMap: Map<string, { label: string; title: string }>;
  granularity: Granularity;
}

function ModelCard({ model, color, labelMap, granularity }: ModelCardProps) {
  const gradientId = `mini-fill-${useId().replace(/:/g, '')}`;
  const points = useMemo<MiniPoint[]>(
    () =>
      model.series.map((point) => {
        const info = labelMap.get(point.bucket);
        return {
          bucket: point.bucket,
          label: info?.label ?? point.bucket,
          __title: info?.title ?? point.bucket,
          requests: point.requests,
          totalTokens: point.totalTokens,
        };
      }),
    [model.series, labelMap],
  );
  const nonZeroPoints = points.filter((point) => point.totalTokens > 0).length;
  const showTokenDots = nonZeroPoints > 0 && nonZeroPoints <= 30;

  return (
    <article className="card model-card" style={{ '--model-color': color } as CSSProperties}>
      <div className="model-head">
        <div className="model-title">
          <span className="model-dot is-large" style={{ background: color }} aria-hidden />
          <h3 title={modelLabel(model.model)}>{modelLabel(model.model)}</h3>
          {model.errors > 0 ? (
            <span className="error-badge" title={`${model.errors} 次失败请求`}>
              <AlertIcon size={11} />
              失败 {formatInt(model.errors)}
            </span>
          ) : null}
        </div>
        <div className="model-head-meta">
          <span className="model-share">{formatRatioPercent(model.share)} 占比</span>
          <span className="model-last">{model.lastTs ? `最近 ${formatDateTime(model.lastTs)}` : '—'}</span>
        </div>
      </div>

      <div className="model-stats">
        <div className="model-stat">
          <span className="model-stat-label">请求</span>
          <span className="model-stat-value">{formatInt(model.requests)}</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-label">Tokens</span>
          <span className="model-stat-value">{formatInt(model.totalTokens)}</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-label">平均速度</span>
          <span className="model-stat-value">
            {formatSpeedValue(model.avgTps)}
            {model.avgTps != null ? <span className="model-stat-unit">tok/s</span> : null}
          </span>
        </div>
        <div className="model-stat">
          <span className="model-stat-label">平均首字</span>
          <span className="model-stat-value">{formatLatency(model.avgTtftMs)}</span>
        </div>
      </div>

      <div className="model-charts">
        <div className="mini-chart">
          <div className="mini-chart-head">
            <span>请求次数</span>
            <span className="mini-chart-hint">按{granularityLabel(granularity)}</span>
          </div>
          <div className="mini-chart-box" role="img" aria-label={`${modelLabel(model.model)} 请求次数趋势`}>
            <ResponsiveContainer width="100%" height={116}>
              <BarChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 0 }} barCategoryGap="32%">
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chartTheme.muted, fontSize: 9.5 }}
                  tickMargin={7}
                  minTickGap={18}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  content={<MiniTooltip kind="requests" />}
                  cursor={{ fill: chartTheme.cursor }}
                  wrapperStyle={{ outline: 'none' }}
                />
                <Bar
                  dataKey="requests"
                  fill={color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mini-chart">
          <div className="mini-chart-head">
            <span>Tokens</span>
            <span className="mini-chart-hint">{formatPercent(model.share * 100)} 总占比</span>
          </div>
          <div className="mini-chart-box" role="img" aria-label={`${modelLabel(model.model)} Token 趋势`}>
            <ResponsiveContainer width="100%" height={116}>
              <AreaChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="0" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chartTheme.muted, fontSize: 9.5 }}
                  tickMargin={7}
                  minTickGap={18}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  content={<MiniTooltip kind="tokens" />}
                  cursor={{ stroke: chartTheme.cursorLine, strokeWidth: 1 }}
                  wrapperStyle={{ outline: 'none' }}
                />
                <Area
                  type="linear"
                  dataKey="totalTokens"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={
                    showTokenDots
                      ? (dotProps: any) => {
                          const value = Number(dotProps.payload?.totalTokens) || 0;
                          if (!value) return <g />;
                          return (
                            <circle
                              cx={dotProps.cx}
                              cy={dotProps.cy}
                              r={4}
                              fill={color}
                              stroke={chartTheme.surface}
                              strokeWidth={2}
                            />
                          );
                        }
                      : false
                  }
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </article>
  );
}
