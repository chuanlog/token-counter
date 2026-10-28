import { useState } from 'react';

import { RefreshIcon } from './Icons';

interface ServerStoppedProps {
  port: string;
}

export function ServerStopped({ port }: ServerStoppedProps) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const check = async () => {
    setChecking(true);
    setMessage('');
    try {
      const response = await fetch('/healthz', { cache: 'no-store' });
      if (response.ok) {
        window.location.reload();
        return;
      }
      setMessage('服务还没有启动。请先运行 start.bat 或 npm start。');
    } catch {
      setMessage('服务还没有启动。请先运行 start.bat 或 npm start。');
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="card stopped-card" aria-labelledby="stopped-title">
      <div className="stopped-orb" aria-hidden>
        <span className="status-dot is-offline" />
      </div>
      <div className="stopped-copy">
        <div className="eyebrow">端口已释放</div>
        <h2 id="stopped-title">Token Lens 已停止</h2>
        <p>
          端口 {port} 已经释放，已采集的数据仍保存在本机 SQLite 中。重新启动后刷新本页即可继续查看。
        </p>
        <div className="stopped-command">
          重新启动：双击 <code>start.bat</code>，或在项目目录运行 <code>npm start</code>
        </div>
        <div className="stopped-actions">
          <button type="button" className="secondary-button" onClick={check} disabled={checking}>
            <RefreshIcon size={15} className={checking ? 'spin' : undefined} />
            {checking ? '检测中…' : '重新检测服务'}
          </button>
          {message ? <span className="stopped-message">{message}</span> : null}
        </div>
      </div>
    </section>
  );
}
