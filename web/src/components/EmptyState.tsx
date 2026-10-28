import { formatDateTime, formatInt } from '../lib/format';
import type { DashboardMeta } from '../types';
import { ActivityIcon, DatabaseIcon, RefreshIcon, TerminalIcon } from './Icons';

interface EmptyStateProps {
  meta: DashboardMeta;
  refreshing: boolean;
  onRefresh: () => void;
}

export function EmptyState({ meta, refreshing, onRefresh }: EmptyStateProps) {
  const online = meta.lmStudio.online;
  return (
    <section className="card setup-card" aria-labelledby="setup-title">
      <div className="setup-hero">
        <div className="setup-orb" aria-hidden>
          <ActivityIcon size={24} />
        </div>
        <div>
          <div className="eyebrow">等待第一条推理数据</div>
          <h2 id="setup-title">还没有捕获到推理记录</h2>
          <p>
            Token Lens 会直接读取 LM Studio 写入本机的 server 日志，不需要代理，也不需要修改任何客户端配置。
            历史日志会自动导入；新的请求会在 2 秒内出现。
          </p>
        </div>
      </div>

      <div className="setup-status-row">
        <span className={`setup-status ${online ? 'is-online' : 'is-offline'}`}>
          <span className={`status-dot ${online ? 'is-online' : 'is-offline'}`} aria-hidden />
          {online ? `LM Studio 服务在线${meta.lmStudio.port ? ` · 端口 ${meta.lmStudio.port}` : ''}` : '未检测到 LM Studio 本地服务'}
        </span>
        <span className="setup-status">
          <DatabaseIcon size={13} />
          已导入 {formatInt(meta.totalRecords)} 条记录
        </span>
        <span className="setup-status">
          最近扫描 {meta.ingest.lastScanAt ? formatDateTime(meta.ingest.lastScanAt) : '—'}
        </span>
      </div>

      <ol className="setup-steps">
        <li>
          <span className="step-index">1</span>
          <div>
            <h3>启动 LM Studio 的本地服务器</h3>
            <p>在 LM Studio 中打开 Developer 面板并启动本地服务器；或者直接在 LM Studio 的对话页使用本地模型。</p>
          </div>
        </li>
        <li>
          <span className="step-index">2</span>
          <div>
            <h3>确认 LM Studio 正在写详细日志</h3>
            <p>
              Token Lens 依赖引擎输出的 token 与计时行。请在 LM Studio 的 Developer / 开发者设置中把运行时日志级别调到
              Verbose；如果日志里已经出现 <code>print_timing</code> 行，则说明已经满足。
            </p>
          </div>
        </li>
        <li>
          <span className="step-index">3</span>
          <div>
            <h3>发起一次推理</h3>
            <p>无论是通过 OpenAI 兼容接口调用，还是在 LM Studio 应用内对话，记录都会自动归档到本机的 SQLite 数据库。</p>
          </div>
        </li>
      </ol>

      <div className="setup-source">
        <div className="setup-source-head">
          <TerminalIcon size={15} />
          <span>正在监听的日志目录</span>
        </div>
        {meta.logDirs.length ? (
          <ul className="path-list">
            {meta.logDirs.map((dir) => (
              <li key={dir}><code>{dir}</code></li>
            ))}
          </ul>
        ) : (
          <div className="setup-warning">
            <p>没有找到默认的 LM Studio server-logs 目录。请确认应用数据目录，或手动指定：</p>
            <code className="command-code">npm start -- --logs "&lt;你的 .lmstudio 路径&gt;\apps\bionic\server-logs"</code>
          </div>
        )}
        {!meta.logDirs.length && meta.searchedLogDirs.length ? (
          <details className="searched-paths">
            <summary>已尝试查找的路径</summary>
            <ul className="path-list">
              {meta.searchedLogDirs.map((dir) => (
                <li key={dir}><code>{dir}</code></li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="setup-actions">
        <button type="button" className="primary-button" onClick={onRefresh} disabled={refreshing}>
          <RefreshIcon size={15} className={refreshing ? 'spin' : undefined} />
          {refreshing ? '正在扫描…' : '立即重新扫描'}
        </button>
        <span className="setup-hint">数据只在本地读取与存储，不会上传。</span>
      </div>
    </section>
  );
}

interface RangeEmptyProps {
  modelFiltered: boolean;
  onShowAll: () => void;
  onClearModel: () => void;
}

export function RangeEmpty({ modelFiltered, onShowAll, onClearModel }: RangeEmptyProps) {
  return (
    <section className="card range-empty-card">
      <div className="range-empty-icon" aria-hidden>
        <ActivityIcon size={22} />
      </div>
      <div className="range-empty-copy">
        <h2>当前筛选范围没有数据</h2>
        <p>
          {modelFiltered
            ? '所选模型在这个时间范围内没有推理记录。可以扩大时间范围，或清除模型筛选查看全部模型。'
            : '这个时间范围内没有推理记录。试试查看全部时间，或者等待新的请求。'}
        </p>
      </div>
      <div className="range-empty-actions">
        <button type="button" className="secondary-button" onClick={onShowAll}>
          查看全部时间
        </button>
        {modelFiltered ? (
          <button type="button" className="ghost-button" onClick={onClearModel}>
            清除模型筛选
          </button>
        ) : null}
      </div>
    </section>
  );
}
