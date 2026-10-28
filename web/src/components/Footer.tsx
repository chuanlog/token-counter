import { formatClock, formatInt } from '../lib/format';
import type { DashboardMeta } from '../types';
import { InfoIcon, LensMark } from './Icons';

interface FooterProps {
  meta: DashboardMeta | null;
  onInfo: () => void;
}

export function Footer({ meta, onInfo }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-left">
        <span className="footer-brand">
          <LensMark size={18} />
          Token Lens
        </span>
        <span className="footer-version">v{meta?.version ?? '1.0.0'}</span>
        <span className="footer-sep" aria-hidden />
        <span>数据源：LM Studio server logs</span>
        {meta ? (
          <>
            <span className="footer-sep" aria-hidden />
            <span>{formatInt(meta.totalRecords)} 条记录</span>
            <span className="footer-sep" aria-hidden />
            <span>扫描于 {meta.ingest.lastScanAt ? formatClock(meta.ingest.lastScanAt) : '—'}</span>
          </>
        ) : null}
      </div>
      <div className="footer-right">
        <span>仅统计元数据，不保存提示词与回复</span>
        <button type="button" className="footer-link" onClick={onInfo}>
          <InfoIcon size={13} />
          数据源说明
        </button>
      </div>
    </footer>
  );
}
