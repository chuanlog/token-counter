import { formatClock } from '../lib/format';
import type { DashboardMeta } from '../types';
import { CpuIcon, InfoIcon, LensMark } from './Icons';

interface TopBarProps {
  meta: DashboardMeta | null;
  onInfo: () => void;
}

export function TopBar({ meta, onInfo }: TopBarProps) {
  const lm = meta?.lmStudio;
  const online = Boolean(lm?.online);
  const statusTitle = lm
    ? online
      ? `LM Studio 服务在线${lm.port ? `（端口 ${lm.port}）` : ''}${lm.models.length ? `，发现 ${lm.models.length} 个模型` : ''}`
      : '未检测到 LM Studio 本地服务；历史日志仍可正常统计'
    : '正在检测 LM Studio 服务';

  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Token Lens 首页">
        <span className="brand-mark">
          <LensMark size={30} />
        </span>
        <span className="brand-text">
          <span className="brand-name">
            Token Lens
            <span className="brand-badge">LOCAL</span>
          </span>
          <span className="brand-sub">LM Studio 用量观测台</span>
        </span>
      </a>

      <div className="topbar-right">
        <div className={`lm-status${online ? ' is-online' : ''}`} title={statusTitle}>
          <span className={`status-dot${online ? ' is-online' : ' is-offline'}`} aria-hidden />
          <span className="lm-status-text">
            {lm ? (online ? 'LM Studio 在线' : 'LM Studio 未连接') : '检测 LM Studio…'}
          </span>
          {online && lm?.port ? <span className="lm-status-port">:{lm.port}</span> : null}
        </div>
        <div className="topbar-sep" aria-hidden />
        <div className="topbar-chip" title="数据保存在本机 SQLite，仅统计元数据">
          <CpuIcon size={14} />
          <span>本地采集</span>
        </div>
        <button type="button" className="icon-button" onClick={onInfo} aria-label="数据源与使用说明" title="数据源与使用说明">
          <InfoIcon size={17} />
        </button>
      </div>
      <span className="sr-only">最近更新 {meta ? formatClock(meta.generatedAt) : '等待数据'}</span>
    </header>
  );
}
