// src/lib/stats.ts — 日/周/月范围边界 + 聚合数据转图表数据
import type { AggregationRow } from '@/db/database';
import { dayjs } from '@/lib/time';

export type RangeType = 'day' | 'week' | 'month';

export interface DateRange {
  /** 起始时间戳（含） */
  start: number;
  /** 结束时间戳（不含，SQL 用 start_ts >= ? AND start_ts < ?） */
  end: number;
  /** 显示标签，如「2026年9月26日」 */
  label: string;
}

export function getRange(type: RangeType, anchor: number): DateRange {
  const d = dayjs(anchor);
  if (type === 'day') {
    return {
      start: d.startOf('day').valueOf(),
      end: d.endOf('day').valueOf() + 1,
      label: d.format('YYYY年M月D日'),
    };
  }
  if (type === 'week') {
    const ws = d.startOf('week'); // weekStart = 0：周日（用户拍板）
    return {
      start: ws.valueOf(),
      end: d.endOf('week').valueOf() + 1,
      label: `${ws.format('M月D日')} - ${d.endOf('week').format('M月D日')}`,
    };
  }
  return {
    start: d.startOf('month').valueOf(),
    end: d.endOf('month').valueOf() + 1,
    label: d.format('YYYY年M月'),
  };
}

/** 图表图例项 */
export interface LegendItem {
  name: string;
  icon: string;
  color: string;
  ms: number;
  /** 占比 0-100 */
  percent: number;
}

export interface PieSlice {
  value: number;
  color: string;
}

export interface BarDatum {
  value: number;
  label: string;
  frontColor: string;
}

/** 聚合行 → 环形图数据：占比 <2% 的碎片合并为「其他」，避免饼图拥挤 */
export function toPieData(rows: AggregationRow[]): { slices: PieSlice[]; legend: LegendItem[] } {
  const total = rows.reduce((s, r) => s + r.totalMs, 0);
  const slices: PieSlice[] = [];
  const legend: LegendItem[] = [];
  let othersMs = 0;
  for (const r of rows) {
    const percent = total > 0 ? (r.totalMs / total) * 100 : 0;
    if (percent < 2) {
      othersMs += r.totalMs;
      continue;
    }
    slices.push({ value: r.totalMs, color: r.color });
    legend.push({ name: r.name, icon: r.icon, color: r.color, ms: r.totalMs, percent });
  }
  if (othersMs > 0) {
    slices.push({ value: othersMs, color: '#9CA3AF' });
    legend.push({
      name: '其他',
      icon: '➕',
      color: '#9CA3AF',
      ms: othersMs,
      percent: (othersMs / total) * 100,
    });
  }
  return { slices, legend };
}

/** 聚合行 → 柱状图数据（降序 Top 8，值换算为分钟） */
export function toBarData(rows: AggregationRow[]): BarDatum[] {
  return rows.slice(0, 8).map((r) => ({
    value: Math.round(r.totalMs / 60000),
    label: r.name,
    frontColor: r.color,
  }));
}
