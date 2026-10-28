import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchDashboard, shutdownServer, triggerRefresh } from './api';
import { FilterBar } from './components/FilterBar';
import { Footer } from './components/Footer';
import { InfoModal } from './components/InfoModal';
import { EmptyState, RangeEmpty } from './components/EmptyState';
import { RecentTable } from './components/RecentTable';
import { ServerStopped } from './components/ServerStopped';
import { SummaryCards } from './components/SummaryCards';
import { TopBar } from './components/TopBar';
import { TokenTrend } from './components/TokenTrend';
import { TpsChart } from './components/TpsChart';
import { ModelSection } from './components/ModelSection';
import { ErrorBanner, LoadingState } from './components/StatusViews';
import { AlertIcon, RefreshIcon } from './components/Icons';
import type { GranularityChoice } from './components/GranularityPicker';
import { assignModelColors } from './lib/colors';
import {
  isValidRangeValue,
  minuteKey,
  rangeForPreset,
  todayKey,
  type RangePreset,
} from './lib/dates';
import type { Dashboard } from './types';

const STORAGE = {
  preset: 'token-lens.preset',
  model: 'token-lens.model',
  autoRefresh: 'token-lens.auto-refresh',
  customFrom: 'token-lens.custom-from',
  customTo: 'token-lens.custom-to',
};

const VALID_PRESETS: RangePreset[] = [
  '15m',
  '1h',
  '6h',
  'today',
  '7d',
  '30d',
  'month',
  'all',
  'custom',
];

function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readPreset(): RangePreset {
  const raw = readString(STORAGE.preset, '7d') as RangePreset;
  return VALID_PRESETS.includes(raw) ? raw : '7d';
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = readString(key, fallback ? '1' : '0');
  return raw === '1';
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface CustomRange {
  from: string;
  to: string;
}

function normalizeCustomRange(range: CustomRange, now = new Date()): CustomRange {
  let from = isValidRangeValue(range.from) ? range.from : minuteKey(now);
  let to = isValidRangeValue(range.to) ? range.to : minuteKey(now);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

function readCustomRange(): CustomRange {
  const fallback = rangeForPreset('1h');
  const from = readString(STORAGE.customFrom, fallback.from);
  const to = readString(STORAGE.customTo, fallback.to);
  return normalizeCustomRange({
    from: isValidRangeValue(from) ? from : fallback.from,
    to: isValidRangeValue(to) ? to : fallback.to,
  });
}

export default function App() {
  const [preset, setPreset] = useState<RangePreset>(readPreset);
  const [customRange, setCustomRange] = useState<CustomRange>(readCustomRange);
  const [model, setModel] = useState(() => readString(STORAGE.model, 'all'));
  const [granularity, setGranularity] = useState<GranularityChoice>('auto');
  const [autoRefresh, setAutoRefresh] = useState(() => readBool(STORAGE.autoRefresh, true));

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [serverStopped, setServerStopped] = useState(false);

  const dataRef = useRef<Dashboard | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const hasData = Boolean(dataRef.current);
      if (!options?.background) {
        if (hasData) setRefreshing(true);
        else setLoading(true);
      }

      const now = new Date();
      let rangeQuery: { all: true } | { from: string; to: string };
      if (preset === 'all') {
        rangeQuery = { all: true };
      } else if (preset === 'custom') {
        rangeQuery = normalizeCustomRange(customRange, now);
      } else {
        rangeQuery = rangeForPreset(preset, now);
      }

      try {
        const next = await fetchDashboard({
          ...rangeQuery,
          model,
          granularity,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        dataRef.current = next;
        setData(next);
        setError(null);
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setError(caught instanceof Error ? caught.message : '无法连接到 Token Lens 服务');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (!options?.background) setRefreshing(false);
        }
      }
    },
    [preset, customRange, model, granularity],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh || serverStopped) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ background: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, serverStopped, load]);

  useEffect(() => {
    const onVisible = () => {
      if (!serverStopped && document.visibilityState === 'visible') void load({ background: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [serverStopped, load]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const displayRange = useMemo(() => {
    if (data) return { from: data.filter.from, to: data.filter.to };
    if (preset === 'custom') return normalizeCustomRange(customRange);
    if (preset === 'all') return { from: todayKey(), to: todayKey() };
    return rangeForPreset(preset);
  }, [data, preset, customRange]);

  const colors = useMemo(
    () => assignModelColors(data?.modelOptions ?? []),
    [data?.modelOptions],
  );

  const handleRangeChange = useCallback((next: RangePreset, from?: string, to?: string) => {
    if (next === 'custom') {
      const now = new Date();
      const safeFrom = from && isValidRangeValue(from) ? from : minuteKey(now);
      const safeTo = to && isValidRangeValue(to) ? to : minuteKey(now);
      const normalized = normalizeCustomRange({ from: safeFrom, to: safeTo }, now);
      setCustomRange(normalized);
      persist(STORAGE.customFrom, normalized.from);
      persist(STORAGE.customTo, normalized.to);
    }
    setPreset(next);
    persist(STORAGE.preset, next);
  }, []);

  const handleModelChange = useCallback((next: string) => {
    setModel(next);
    persist(STORAGE.model, next);
  }, []);

  const handleAutoRefreshChange = useCallback((next: boolean) => {
    setAutoRefresh(next);
    persist(STORAGE.autoRefresh, next ? '1' : '0');
  }, []);

  const refreshNow = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await triggerRefresh();
      await load({ background: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '刷新失败');
      throw caught;
    } finally {
      setManualRefreshing(false);
    }
  }, [load]);

  const showAll = useCallback(() => {
    setPreset('all');
    persist(STORAGE.preset, 'all');
  }, []);

  const clearModel = useCallback(() => {
    setModel('all');
    persist(STORAGE.model, 'all');
  }, []);

  const handleShutdown = useCallback(async () => {
    await shutdownServer();
    abortRef.current?.abort();
    setServerStopped(true);
    setRefreshing(false);
    setManualRefreshing(false);
    setInfoOpen(false);
  }, []);

  const hasNoRecords = data != null && data.meta.totalRecords === 0;
  const rangeEmpty = data != null && data.meta.totalRecords > 0 && data.summary.requests === 0;
  const busy = refreshing || manualRefreshing;

  return (
    <div className="app-shell">
      <TopBar meta={data?.meta ?? null} onInfo={() => setInfoOpen(true)} />

      <main className="page">
        {serverStopped ? (
          <ServerStopped port={window.location.port || '1236'} />
        ) : (
          <>
            <FilterBar
              preset={preset}
              from={displayRange.from}
              to={displayRange.to}
              onRangeChange={handleRangeChange}
              model={model}
              modelOptions={data?.modelOptions ?? []}
              colors={colors}
              onModelChange={handleModelChange}
              granularity={granularity}
              actualGranularity={data?.filter.granularity}
              onGranularityChange={setGranularity}
              autoRefresh={autoRefresh}
              onAutoRefreshChange={handleAutoRefreshChange}
              updatedAt={data?.meta.generatedAt ?? null}
              refreshing={busy}
              onRefresh={() => {
                void refreshNow().catch(() => {});
              }}
            />

            {error && data ? (
              <ErrorBanner
                message={error}
                onRetry={() => {
                  void refreshNow().catch(() => {});
                }}
              />
            ) : null}

            <div className={`page-content${busy && data ? ' is-refreshing' : ''}`}>
              {hasNoRecords ? (
                <EmptyState
                  meta={data.meta}
                  refreshing={busy}
                  onRefresh={() => {
                    void refreshNow().catch(() => {});
                  }}
                />
              ) : rangeEmpty ? (
                <RangeEmpty
                  modelFiltered={model !== 'all'}
                  onShowAll={showAll}
                  onClearModel={clearModel}
                />
              ) : data ? (
                <>
                  <SummaryCards data={data} />
                  <div className="charts-grid">
                    <TokenTrend data={data} colors={colors} onShowAll={showAll} />
                    <TpsChart data={data} colors={colors} onShowAll={showAll} />
                  </div>
                  <ModelSection data={data} colors={colors} />
                  <RecentTable data={data} colors={colors} />
                </>
              ) : loading ? (
                <LoadingState />
              ) : (
                <div className="card fatal-error">
                  <AlertIcon size={22} />
                  <div>
                    <h2>无法读取统计数据</h2>
                    <p>{error || '请确认 Token Lens 服务正在运行，然后重试。'}</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => void load()}>
                    <RefreshIcon size={15} />
                    重试
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <Footer meta={data?.meta ?? null} onInfo={() => setInfoOpen(true)} />
      </main>

      <InfoModal
        open={infoOpen}
        meta={data?.meta ?? null}
        onClose={() => setInfoOpen(false)}
        onRefresh={refreshNow}
        onShutdown={handleShutdown}
      />
    </div>
  );
}
