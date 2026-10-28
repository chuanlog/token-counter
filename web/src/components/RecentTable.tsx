import { colorFor } from '../lib/colors';
import {
  formatDateTime,
  formatInt,
  formatLatency,
  formatSpeed,
  modelLabel,
} from '../lib/format';
import type { Dashboard } from '../types';

interface RecentTableProps {
  data: Dashboard;
  colors: Record<string, string>;
}

function sourceLabel(source: string): string {
  if (source === 'app') return '应用内';
  if (source === 'api') return 'API';
  return '日志';
}

export function RecentTable({ data, colors }: RecentTableProps) {
  return (
    <article className="card recent-card">
      <div className="card-head">
        <div className="card-title-wrap">
          <h2 className="card-title">最近推理</h2>
          <p className="card-subtitle">最新 60 条记录 · 已应用上方的时间与模型筛选</p>
        </div>
        <span className="unit-chip">{formatInt(data.recent.length)} 条</span>
      </div>

      <div className="table-scroll recent-scroll">
        <table className="data-table recent-table">
          <caption className="sr-only">最近推理记录</caption>
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">模型</th>
              <th scope="col" className="num">输入</th>
              <th scope="col" className="num">输出</th>
              <th scope="col" className="num">速度</th>
              <th scope="col" className="num">首字</th>
              <th scope="col" className="num">耗时</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.length ? (
              data.recent.map((item) => (
                <tr key={item.id} className={item.status === 'error' ? 'is-error-row' : undefined}>
                  <td>
                    <div className="time-cell">
                      <span>{formatDateTime(item.ts)}</span>
                      <span className={`source-tag is-${item.source}`}>{sourceLabel(item.source)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="model-cell">
                      <span
                        className="model-dot"
                        style={{ background: colorFor(colors, item.model) }}
                        aria-hidden
                      />
                      <span className="model-name" title={modelLabel(item.model)}>
                        {modelLabel(item.model)}
                      </span>
                    </div>
                  </td>
                  <td className="num">{formatInt(item.promptTokens)}</td>
                  <td className="num">{formatInt(item.completionTokens)}</td>
                  <td className="num">{formatSpeed(item.tps)}</td>
                  <td className="num">{formatLatency(item.ttftMs)}</td>
                  <td className="num">{formatLatency(item.totalMs)}</td>
                  <td>
                    {item.status === 'error' ? (
                      <span className="status-pill is-error" title={item.error || '请求失败'}>
                        <span className="status-dot is-error" aria-hidden />
                        失败
                      </span>
                    ) : (
                      <span className="status-pill is-ok">
                        <span className="status-dot is-ok" aria-hidden />
                        成功
                      </span>
                    )}
                    {item.status === 'error' && item.error ? (
                      <div className="error-detail" title={item.error}>
                        {item.error}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="empty-cell">当前筛选下没有推理记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="chart-foot">
        <span>应用内 = LM Studio 自带对话；API = 通过本地服务器发起的请求。</span>
        <span>日志每 2 秒自动扫描一次。</span>
      </div>
    </article>
  );
}
