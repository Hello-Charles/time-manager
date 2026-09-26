// src/lib/exportCsv.ts — CSV 生成与分享（导出备份）
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getAllFinishedRecords } from '@/db/database';
import { dayjs } from '@/lib/time';

/** CSV 单元格转义：含逗号/引号/换行时加引号包裹 */
function escapeCell(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/**
 * 导出全部已完成记录为 CSV 并调起系统分享。
 * 文件开头加 UTF-8 BOM，保证 Excel 打开中文不乱码。
 * Web 端（仅开发预览用）回退为浏览器下载。
 */
export async function exportRecordsCsv(db: SQLiteDatabase): Promise<{ ok: boolean; message: string }> {
  const records = await getAllFinishedRecords(db);
  if (records.length === 0) {
    return { ok: false, message: '还没有任何记录可导出' };
  }

  const header = '活动,开始时间,结束时间,时长(分钟),备注';
  const lines = records.map((r) =>
    [
      r.activityName,
      dayjs(r.startTs).format('YYYY-MM-DD HH:mm:ss'),
      r.endTs != null ? dayjs(r.endTs).format('YYYY-MM-DD HH:mm:ss') : '',
      r.endTs != null ? ((r.endTs - r.startTs) / 60000).toFixed(1) : '',
      r.note.replace(/[\r\n]/g, ' '),
    ]
      .map(escapeCell)
      .join(','),
  );
  // BOM + CRLF（Excel 兼容）
  const csv = '﻿' + [header, ...lines].join('\r\n');
  const filename = `time-backup-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;

  if (Platform.OS === 'web') {
    // 浏览器回退：expo-file-system 的 File/分享在 Web 不可用
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, message: '已触发浏览器下载' };
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: '导出时间记录备份' });
    return { ok: true, message: '' };
  }
  return { ok: false, message: '当前设备不支持系统分享' };
}
