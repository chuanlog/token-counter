import {
  formatHero,
  formatInt,
  formatLatencyParts,
  formatPercent,
  formatSpeedValue,
} from '../lib/format';
import { granularityLabel } from '../lib/dates';
import type { Dashboard } from '../types';
import { Delta } from './Delta';
import { ActivityIcon, SparkIcon } from './Icons';
import { Sparkline } from './Sparkline';

interface SummaryCardsProps {
  data: Dashboard;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const summary = data.summary;
  const previous = data.previous;
  const total = summary.totalTokens || 0;
  const inputPct = total > 0 ? (summary.promptTokens / total) * 100 : 0;
  const outputPct = 100 - inputPct;
  const latency = formatLatencyParts(summary.avgTtftMs);
  const sparkValues = data.series.map((point) => point.totalTokens);

  return (
    <section className="kpi-grid" aria-label="用量概览">
      <article className="card kpi kpi-hero">
        <div className="kpi-head">
          <span className="kpi-label">
            <SparkIcon size={14} />
            总 Tokens
          </span>
        </div>
        <div className="kpi-hero-body">
          <div className="kpi-hero-main">
            <div className="kpi-hero-value">{formatHero(summary.totalTokens)}</div>
            <div className="kpi-delta-row">
              <Delta current={summary.totalTokens} previous={previous.totalTokens} />
            </div>
            <div
              className="token-split-bar"
              role="img"
              aria-label={`输入 ${formatInt(summary.promptTokens)} tokens，输出 ${formatInt(summary.completionTokens)} tokens`}
            >
              <span className="split-input" style={{ width: `${inputPct}%` }} />
              <span className="split-output" style={{ width: `${outputPct}%` }} />
            </div>
            <div className="token-split-legend">
              <span>
                <span className="split-key is-input" aria-hidden />
                输入 <strong>{formatInt(summary.promptTokens)}</strong>
              </span>
              <span>
                <span className="split-key is-output" aria-hidden />
                输出 <strong>{formatInt(summary.completionTokens)}</strong>
              </span>
            </div>
          </div>
          <div className="kpi-spark">
            <Sparkline values={sparkValues} color="#3987e5" />
            <span className="kpi-spark-label">按{granularityLabel(data.filter.granularity)}趋势</span>
          </div>
        </div>
      </article>

      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-label">
            <ActivityIcon size={14} />
            推理请求
          </span>
        </div>
        <div className="kpi-value">{formatInt(summary.requests)}</div>
        <div className="kpi-delta-row">
          <Delta current={summary.requests} previous={previous.requests} />
        </div>
        <div className="kpi-foot">
          <span>
            成功 <strong>{formatInt(summary.requests - summary.errors)}</strong>
            {summary.errors > 0 ? (
              <span className="text-critical">
                {' '}· 失败 {formatInt(summary.errors)}
              </span>
            ) : null}
          </span>
          <span className="kpi-foot-muted">
            成功率 {formatPercent(summary.successRate)} · 活跃 {summary.activeDays} 天
          </span>
        </div>
      </article>

      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-label">
            <span className="kpi-glyph" aria-hidden>≈</span>
            平均生成速度
          </span>
        </div>
        <div className="kpi-value">
          {formatSpeedValue(summary.avgTps)}
          <span className="kpi-value-unit">tok/s</span>
        </div>
        <div className="kpi-delta-row">
          <Delta current={summary.avgTps} previous={previous.avgTps} />
        </div>
        <div className="kpi-foot">
          <span>按输出 token ÷ 生成耗时加权</span>
          <span className="kpi-foot-muted">{summary.models} 个模型参与统计</span>
        </div>
      </article>

      <article className="card kpi">
        <div className="kpi-head">
          <span className="kpi-label">
            <span className="kpi-glyph" aria-hidden>⌁</span>
            平均首字延迟
          </span>
        </div>
        <div className="kpi-value">
          {latency.value}
          {latency.unit ? <span className="kpi-value-unit">{latency.unit}</span> : null}
        </div>
        <div className="kpi-delta-row">
          <Delta current={summary.avgTtftMs} previous={previous.avgTtftMs} />
        </div>
        <div className="kpi-foot">
          <span>提示词处理 + 首 token 耗时</span>
          <span className="kpi-foot-muted">
            {summary.avgDurationMs != null ? `平均总耗时 ${formatLatency(summary.avgDurationMs)}` : '—'}
          </span>
        </div>
      </article>
    </section>
  );
}

function formatLatency(ms: number): string {
  const parts = formatLatencyParts(ms);
  return `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`;
}
