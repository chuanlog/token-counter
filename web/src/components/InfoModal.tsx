import { useEffect, useRef, useState } from 'react';

import { formatDateTime, formatInt } from '../lib/format';
import type { DashboardMeta } from '../types';
import { CloseIcon, DatabaseIcon, RefreshIcon, TerminalIcon } from './Icons';

interface InfoModalProps {
  open: boolean;
  meta: DashboardMeta | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onShutdown: () => Promise<void>;
}

export function InfoModal({ open, meta, onClose, onRefresh, onShutdown }: InfoModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [refreshState, setRefreshState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [refreshMessage, setRefreshMessage] = useState('');
  const [confirmShutdown, setConfirmShutdown] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setRefreshState('idle');
      setRefreshMessage('');
      setConfirmShutdown(false);
      setStopping(false);
      setStopError('');
    }
  }, [open]);

  if (!open || !meta) return null;

  const handleRefresh = async () => {
    setRefreshState('running');
    setRefreshMessage('');
    try {
      await onRefresh();
      setRefreshState('done');
      setRefreshMessage('扫描完成，数据已更新。');
    } catch (error) {
      setRefreshState('error');
      setRefreshMessage(error instanceof Error ? error.message : '扫描失败');
    }
  };

  const handleShutdown = async () => {
    setStopping(true);
    setStopError('');
    try {
      await onShutdown();
    } catch (error) {
      setStopError(error instanceof Error ? error.message : '停止服务失败');
      setStopping(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="info-title">
        <div className="modal-head">
          <div className="modal-title-wrap">
            <span className="modal-icon"><DatabaseIcon size={18} /></span>
            <div>
              <h2 id="info-title">数据源与说明</h2>
              <p>Token Lens 如何得到这些数字</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            ref={closeRef}
            onClick={onClose}
            aria-label="关闭说明"
          >
            <CloseIcon size={17} />
          </button>
        </div>

        <div className="modal-body">
          <section className="modal-section">
            <h3>工作方式</h3>
            <p>
              LM Studio 的本地服务器会把每次推理的引擎耗时写入 <code>server-logs</code>。Token Lens
              每 2 秒增量读取这些日志，提取模型名、输入 / 输出 token 数、生成速度与首字延迟，存入本机 SQLite，
              再由当前页面聚合展示。整个过程不经过代理，也不需要修改客户端的 API 地址。
            </p>
          </section>

          <section className="modal-section">
            <h3>当前数据源</h3>
            <div className="source-grid">
              <div className="source-row">
                <span>LM Studio 服务</span>
                <strong className={meta.lmStudio.online ? 'text-good' : 'text-muted'}>
                  {meta.lmStudio.online
                    ? `在线${meta.lmStudio.port ? ` · :${meta.lmStudio.port}` : ''}`
                    : '未连接'}
                </strong>
              </div>
              <div className="source-row">
                <span>已导入记录</span>
                <strong>{formatInt(meta.totalRecords)}</strong>
              </div>
              <div className="source-row">
                <span>日志文件</span>
                <strong>{formatInt(meta.ingest.files)}</strong>
              </div>
              <div className="source-row">
                <span>最近扫描</span>
                <strong>{meta.ingest.lastScanAt ? formatDateTime(meta.ingest.lastScanAt) : '—'}</strong>
              </div>
              <div className="source-row">
                <span>解析异常</span>
                <strong className={meta.ingest.parseErrors > 0 ? 'text-warning' : undefined}>
                  {formatInt(meta.ingest.parseErrors)}
                </strong>
              </div>
              <div className="source-row">
                <span>数据时间跨度</span>
                <strong>
                  {meta.dataStart && meta.dataEnd
                    ? `${formatDateTime(meta.dataStart)} – ${formatDateTime(meta.dataEnd)}`
                    : '—'}
                </strong>
              </div>
            </div>
            <div className="source-paths">
              <div className="source-paths-title">
                <TerminalIcon size={14} />
                监听目录
              </div>
              {meta.logDirs.length ? (
                <ul className="path-list">
                  {meta.logDirs.map((dir) => (
                    <li key={dir}><code>{dir}</code></li>
                  ))}
                </ul>
              ) : (
                <p className="text-warning">没有找到日志目录，请在启动时用 --logs 指定。</p>
              )}
            </div>
            {meta.ingest.lastError ? (
              <p className="text-warning">最近一次读取错误：{meta.ingest.lastError}</p>
            ) : null}
          </section>

          <section className="modal-section">
            <h3>统计口径</h3>
            <ul className="detail-list">
              <li><strong>输入 token</strong>：llama.cpp 的 prompt eval tokens，即引擎实际处理的提示词量。</li>
              <li><strong>输出 token</strong>：eval tokens，即模型生成的 token 数。</li>
              <li><strong>生成速度 TPS</strong>：输出 token ÷ 生成耗时（eval time），不包含提示词处理。</li>
              <li><strong>首字延迟</strong>：提示词处理耗时 + 生成第一个 token 的时间。</li>
              <li><strong>时间粒度</strong>：自动模式在 2 小时内按分钟、2 天内按小时；也可以手动选择分钟 / 小时 / 天（分钟最多 24 小时）。</li>
              <li><strong>失败请求</strong>：来自日志中的 ERROR 行；部分失败没有 token 明细，会以 0 token 计入请求数。</li>
            </ul>
            <p className="modal-note">
              若 LM Studio 日志级别不是 Verbose，引擎可能不输出 token 计时行，此时页面会缺少速度或 token 数据。
            </p>
          </section>

          <section className="modal-section">
            <h3>隐私</h3>
            <p>
              只提取统计元数据，<strong>不会保存提示词或模型回复</strong>。SQLite 数据库位于项目的{' '}
              <code>data/token-counter.db</code>，删除该文件即可清空统计；日志源文件不会被修改。
            </p>
          </section>

          <section className="modal-section">
            <h3>没有数据？</h3>
            <ol className="detail-list is-numbered">
              <li>在 LM Studio 中启动本地服务器，或直接使用应用内对话。</li>
              <li>把 LM Studio 日志级别设为 Verbose，确认 <code>server-logs</code> 目录在写入。</li>
              <li>如果日志目录在别处，使用 <code>npm start -- --logs "&lt;目录&gt;"</code> 启动。</li>
            </ol>
          </section>

          <section className="modal-section danger-zone">
            <h3>停止服务</h3>
            <p>
              停止后会释放端口 {window.location.port || '1236'}，页面将不再刷新；已采集的数据仍保存在本机
              SQLite 中。重新启动请双击 <code>start.bat</code> 或运行 <code>npm start</code>。
            </p>
            {!confirmShutdown ? (
              <button type="button" className="danger-button" onClick={() => setConfirmShutdown(true)}>
                停止 Token Lens
              </button>
            ) : (
              <div className="stop-confirm">
                <span>确认停止当前服务？</span>
                <button
                  type="button"
                  className="danger-button is-solid"
                  onClick={handleShutdown}
                  disabled={stopping}
                >
                  {stopping ? '停止中…' : '确认停止'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setConfirmShutdown(false)}
                  disabled={stopping}
                >
                  取消
                </button>
              </div>
            )}
            {stopError ? <p className="text-warning">{stopError}</p> : null}
          </section>
        </div>

        <div className="modal-foot">
          <span className="modal-version">
            v{meta.version} · Node {meta.node}
          </span>
          <div className="modal-actions">
            {refreshMessage ? (
              <span className={`modal-refresh-note ${refreshState === 'error' ? 'is-error' : ''}`}>
                {refreshMessage}
              </span>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={handleRefresh}
              disabled={refreshState === 'running'}
            >
              <RefreshIcon size={15} className={refreshState === 'running' ? 'spin' : undefined} />
              {refreshState === 'running' ? '扫描中…' : '重新扫描'}
            </button>
            <button type="button" className="primary-button" onClick={onClose}>
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
