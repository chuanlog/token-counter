import { AlertIcon } from './Icons';

export function LoadingState() {
  return (
    <div className="loading-state" aria-busy="true" aria-label="正在读取 LM Studio 日志">
      <div className="loading-caption">
        <span className="loading-pulse" aria-hidden />
        正在读取 LM Studio 日志…
      </div>
      <div className="kpi-grid skeleton-grid">
        {[0, 1, 2, 3].map((index) => (
          <div className={`card skeleton-card${index === 0 ? ' is-hero' : ''}`} key={index}>
            <span className="skeleton-line is-short" />
            <span className="skeleton-line is-value" />
            <span className="skeleton-line" />
          </div>
        ))}
      </div>
      <div className="chart-skeleton-grid">
        <div className="card skeleton-chart">
          <span className="skeleton-line is-short" />
          <span className="skeleton-block" />
        </div>
        <div className="card skeleton-chart">
          <span className="skeleton-line is-short" />
          <span className="skeleton-block" />
        </div>
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <AlertIcon size={16} />
      <div className="error-banner-text">
        <strong>数据刷新失败</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="text-button" onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
