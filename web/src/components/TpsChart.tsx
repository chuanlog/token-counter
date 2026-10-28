import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { colorFor } from '../lib/colors';
import { bucketTitle, granularityLabel } from '../lib/dates';
import { formatInt, formatSpeedValue, modelLabel } from '../lib/format';
import { chartTheme } from '../lib/theme';
import type { Dashboard } from '../types';
import { ChartIcon, TableIcon } from './Icons';
import { Legend, type LegendItem } from './Legend';
import { TpsTooltip } from './ChartTooltip';

interface TpsChartProps {
  data: Dashboard;
  colors: Record<string, string>;
  onShowAll?: () => void;
}

interface TpsRow {
  label: string;
  __title: string;
  [key: string]: unknown;
}

export function TpsChart({ data, colors, onShowAll }: TpsChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const granularity = data.filter.granularity;

  const defs = useMemo(() => {
    const models = data.models.filter((model) => model.avgTps != null);
    const trimmed = models.length > 8 ? models.slice(0, 8) : models;
    return trimmed.map((model, index) => ({
      key: `t_${index}`,
      model: model.model,
      label: modelLabel(model.model),
      color: colorFor(colors, model.model),
    }));
  }, [data.models, colors]);

  const rows = useMemo<TpsRow[]>(() => {
    return data.series.map((point) => {
      const row: TpsRow = {
        label: point.label,
        __title: bucketTitle(point.bucket, granularity),
      };
      for (const def of defs) {
        row[def.key] = point.byModel[def.model]?.tps ?? null;
      }
      return row;
    });
  }, [data.series, defs, granularity]);

  const hasData = defs.length > 0 && data.series.some((point) => point.tps != null);
  const sparse = new Set(
    defs
      .filter((def) => {
        const count = rows.filter((row) => row[def.key] != null).length;
        return count > 0 && count <= 30;
      })
      .map((def) => def.key),
  );
  const legendItems: LegendItem[] = defs.map((def) => ({
    label: def.label,
    color: def.color,
    type: 'line',
  }));
  const granLabel = granularityLabel(granularity);
  const subtitle =
    defs.length === 1
      ? `仅 ${defs[0].label} · 按${granLabel}汇总的加权平均速度`
      : `按${granLabel}汇总的加权平均生成速度`;

  return (
    <article className="card chart-card tps-card">
      <div className="card-head">
        <div className="card-title-wrap">
          <h2 className="card-title">生成速度</h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
        <div className="card-actions">
          <span className="unit-chip">tok/s</span>
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
            {data.models.length > 8 ? <span className="chart-note">图表显示前 8 个模型，数据表包含全部</span> : null}
          </div>
          <div
            className="chart-box"
            role="img"
            aria-label={`生成速度折线图，平均 ${formatSpeedValue(data.summary.avgTps)} tokens 每秒`}
          >
            <ResponsiveContainer width="100%" height={252}>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: chartTheme.muted, fontSize: 11 }}
                  tickFormatter={(value: number) => formatSpeedValue(value)}
                />
                <Tooltip
                  content={<TpsTooltip />}
                  cursor={{ stroke: chartTheme.cursorLine, strokeWidth: 1 }}
                  wrapperStyle={{ outline: 'none' }}
                />
                {defs.map((def) => (
                  <Line
                    key={def.key}
                    type="monotone"
                    dataKey={def.key}
                    name={def.label}
                    stroke={def.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={
                      sparse.has(def.key)
                        ? { r: 4, fill: def.color, stroke: chartTheme.surface, strokeWidth: 2 }
                        : false
                    }
                    activeDot={{
                      r: 4,
                      fill: def.color,
                      stroke: chartTheme.surface,
                      strokeWidth: 2,
                    }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {!hasData ? (
              <div className="chart-empty">
                <p>该时间范围内没有生成速度记录</p>
                {onShowAll ? (
                  <button type="button" className="text-button" onClick={onShowAll}>
                    查看全部时间
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="chart-foot">
            <span>TPS = 输出 token ÷ 生成耗时；上方的首字延迟包含提示词处理时间。</span>
          </div>
        </>
      ) : (
        <div className="table-scroll chart-table-wrap">
          <table className="data-table">
            <caption className="sr-only">生成速度数据表</caption>
            <thead>
              <tr>
                <th scope="col">时间</th>
                {data.models.map((model) => (
                  <th scope="col" className="num" key={model.model}>
                    {modelLabel(model.model)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.series.map((point) => (
                <tr key={point.bucket}>
                  <th scope="row" className="row-label" title={bucketTitle(point.bucket, granularity)}>
                    {point.label}
                  </th>
                  {data.models.map((model) => (
                    <td className="num" key={model.model}>
                      {formatSpeedValue(point.byModel[model.model]?.tps ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
              {!data.series.length ? (
                <tr>
                  <td colSpan={data.models.length + 1} className="empty-cell">该时间范围内没有记录</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
