// src/lib/time.ts — 时间工具：dayjs 配置（周日为一周起始）、时长/日期格式化
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import updateLocale from 'dayjs/plugin/updateLocale';
import 'dayjs/locale/zh-cn';

dayjs.extend(customParseFormat);
dayjs.extend(updateLocale);
dayjs.locale('zh-cn');
// 用户拍板：周汇总以周日为一周起始（zh-cn 默认周一，需显式覆盖）
dayjs.updateLocale('zh-cn', { weekStart: 0 });

export { dayjs };

const pad = (n: number) => String(n).padStart(2, '0');

/** 毫秒 → H:MM:SS 或 MM:SS（计时卡大数字显示） */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 毫秒 → X.X 分钟（CSV 与统计列表显示） */
export function formatMinutes(ms: number): string {
  return (ms / 60000).toFixed(1);
}

export function formatClock(ts: number): string {
  return dayjs(ts).format('HH:mm');
}

export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm');
}

/** 编辑弹窗文本输入 ↔ 时间戳的转换（Web 端回退用），格式 YYYY-MM-DD HH:mm */
export function parseDateTime(text: string): number | null {
  const d = dayjs(text, 'YYYY-MM-DD HH:mm', true);
  return d.isValid() ? d.valueOf() : null;
}
