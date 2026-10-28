import type { Granularity } from '../types';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export type RangePreset = '15m' | '1h' | '6h' | 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';

export const PRESET_LABELS: Record<RangePreset, string> = {
  '15m': '近 15 分钟',
  '1h': '近 1 小时',
  '6h': '近 6 小时',
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  month: '本月',
  all: '全部',
  custom: '自定义',
};

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function minuteKey(date: Date): string {
  return `${dayKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

export function parseLocalDate(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (dayKey(date) !== key) return null;
  return date;
}

export function addDaysKey(key: string, days: number): string {
  const date = parseLocalDate(key);
  if (!date) return key;
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function monthStartKey(now = new Date()): string {
  return dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function rangeForPreset(
  preset: Exclude<RangePreset, 'all' | 'custom'>,
  now = new Date(),
): { from: string; to: string } {
  if (preset === '15m' || preset === '1h' || preset === '6h') {
    const minutes = preset === '15m' ? 15 : preset === '1h' ? 60 : 360;
    return {
      from: minuteKey(new Date(now.getTime() - minutes * 60 * 1000)),
      to: minuteKey(now),
    };
  }
  const to = dayKey(now);
  if (preset === 'today') return { from: to, to };
  if (preset === '7d') return { from: addDaysKey(to, -6), to };
  if (preset === '30d') return { from: addDaysKey(to, -29), to };
  return { from: monthStartKey(now), to };
}

interface RangeTextPoint {
  day: string;
  time?: string;
}

function parseRangeTextPoint(value: string): RangeTextPoint | null {
  const datetime = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
  if (datetime) return { day: datetime[1], time: datetime[2] };
  if (parseLocalDate(value)) return { day: value };
  return null;
}

function shortDay(day: string, includeYear: boolean): string {
  const date = parseLocalDate(day);
  if (!date) return day;
  const month = date.getMonth() + 1;
  const dateOfMonth = date.getDate();
  return includeYear ? `${String(date.getFullYear()).slice(2)}/${month}/${dateOfMonth}` : `${month}/${dateOfMonth}`;
}

export function formatRangeText(from: string, to: string): string {
  if (!from || !to) return '全部数据';
  const a = parseRangeTextPoint(from);
  const b = parseRangeTextPoint(to);
  if (!a || !b) return `${from} – ${to}`;
  const includeYear = a.day.slice(0, 4) !== b.day.slice(0, 4);
  const leftDay = shortDay(a.day, includeYear);
  const rightDay = shortDay(b.day, includeYear);

  if (a.day === b.day) {
    if (a.time || b.time) {
      return `${leftDay} ${a.time ?? '00:00'} – ${b.time ?? '23:59'}`;
    }
    return leftDay;
  }
  if (a.time && b.time) {
    return `${leftDay} ${a.time} – ${rightDay} ${b.time}`;
  }
  if (a.time || b.time) {
    return `${leftDay}${a.time ? ` ${a.time}` : ''} – ${rightDay}${b.time ? ` ${b.time}` : ''}`;
  }
  return `${leftDay} – ${rightDay}`;
}

export function shortDate(key: string): string {
  const date = parseLocalDate(key);
  if (!date) return key;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function longDate(key: string): string {
  const date = parseLocalDate(key);
  if (!date) return key;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

export function rangeDays(from: string, to: string): number {
  const a = parseLocalDate(from.slice(0, 10));
  const b = parseLocalDate(to.slice(0, 10));
  if (!a || !b) return 1;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function bucketTitle(bucket: string, granularity: Granularity): string {
  if (granularity === 'minute' || granularity === 'hour') {
    const [day, time] = bucket.split('T');
    const date = parseLocalDate(day);
    if (!date) return bucket;
    const suffix = granularity === 'minute' ? time : `${time}:00`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]} ${suffix}`;
  }
  return longDate(bucket);
}

export function isValidDayKey(key: string): boolean {
  return parseLocalDate(key) != null;
}

export function isValidRangeValue(value: string): boolean {
  return parseRangeTextPoint(value) != null;
}

export function toDateTimeInput(value: string, isEnd: boolean): string {
  const withT = value.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withT)) return withT;
  if (parseLocalDate(value)) return `${value}T${isEnd ? '23:59' : '00:00'}`;
  return value;
}

export function weekdayShort(key: string): string {
  const date = parseLocalDate(key);
  return date ? WEEKDAYS[date.getDay()] : '';
}

export function granularityLabel(granularity: Granularity): string {
  if (granularity === 'minute') return '分钟';
  if (granularity === 'hour') return '小时';
  return '日';
}
