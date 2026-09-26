// src/lib/timer.ts — 计时引擎：时间戳差值计时 + 单活动事务
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * 开始计时（核心）。
 * 同一事务内先自动结束上一条进行中的记录，再插入新记录。
 * 开始只写 start_ts，不存累计时长；显示时按 Date.now() - start_ts 实时计算，
 * 因此 App 被杀、锁屏、后台冻结都不会影响计时的准确性。
 * 数据库层另有部分唯一索引兜底（进行中记录最多一条）。
 */
export async function startTimer(db: SQLiteDatabase, activityId: number): Promise<void> {
  const now = Date.now();
  // 注：withExclusiveTransactionAsync 在 Web 端不支持，用普通事务（回调内直接用 db）；
  // 单活动约束由数据库唯一索引兜底，普通事务对单用户本地应用已足够
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE time_records SET end_ts = ?, updated_at = ? WHERE end_ts IS NULL', now, now);
    await db.runAsync(
      "INSERT INTO time_records (activity_id, start_ts, end_ts, note, created_at) VALUES (?, ?, NULL, '', ?)",
      activityId,
      now,
      now,
    );
  });
}

/** 停止当前计时：给进行中的记录写入结束时间 */
export async function stopTimer(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  await db.runAsync('UPDATE time_records SET end_ts = ?, updated_at = ? WHERE end_ts IS NULL', now, now);
}

/**
 * 当前时间钩子：计时中每秒刷新一次；App 回到前台立即刷新，
 * 防止系统休眠期间界面数字滞后（时间戳差值保证值本身准确）。
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active]);

  return now;
}
