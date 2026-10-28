export type Granularity = 'minute' | 'hour' | 'day';

export interface Summary {
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgTps: number | null;
  avgTtftMs: number | null;
  avgDurationMs: number | null;
  activeDays: number;
  models: number;
  successRate: number | null;
}

export interface ModelBucket {
  model: string;
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tps: number | null;
  ttftMs: number | null;
}

export interface SeriesPoint {
  bucket: string;
  label: string;
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tps: number | null;
  ttftMs: number | null;
  byModel: Record<string, ModelBucket>;
}

export interface ModelSeriesPoint extends ModelBucket {
  bucket: string;
}

export interface ModelAggregate {
  model: string;
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgTps: number | null;
  avgTtftMs: number | null;
  firstTs: number | null;
  lastTs: number | null;
  share: number;
  series: ModelSeriesPoint[];
}

export interface RecentRequest {
  id: number;
  ts: number;
  model: string;
  source: string;
  endpoint: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptMs: number;
  genMs: number;
  totalMs: number;
  tps: number | null;
  ttftMs: number | null;
  stream: boolean;
  status: string;
  error: string | null;
}

export interface ModelOption {
  model: string;
  requests: number;
  tokens: number;
  lastTs: number | null;
}

export interface IngestStatus {
  lastScanAt: number;
  lastInserted: number;
  files: number;
  parseErrors: number;
  totalRecords: number;
  lastError: string | null;
  intervalMs: number;
}

export interface LMStudioStatus {
  online: boolean;
  port?: number;
  ports?: number[];
  models: string[];
  checkedAt: number;
}

export interface DashboardMeta {
  generatedAt: number;
  today: string;
  rangeDays: number;
  bucketCount: number;
  dataStart: number | null;
  dataEnd: number | null;
  totalRecords: number;
  ingest: IngestStatus;
  lmStudio: LMStudioStatus;
  logDirs: string[];
  searchedLogDirs: string[];
  scanIntervalMs: number;
  version: string;
  node: string;
}

export interface DashboardFilter {
  from: string;
  to: string;
  model: string;
  granularity: Granularity;
  requestedGranularity: Granularity | 'auto';
  all: boolean;
}

export interface Dashboard {
  filter: DashboardFilter;
  summary: Summary;
  previous: Summary;
  series: SeriesPoint[];
  models: ModelAggregate[];
  recent: RecentRequest[];
  modelOptions: ModelOption[];
  meta: DashboardMeta;
}
