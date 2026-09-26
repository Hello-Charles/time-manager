// src/db/database.ts — 数据层唯一入口：建表迁移、预置活动、CRUD、聚合查询
import type { SQLiteDatabase } from 'expo-sqlite';

export interface Activity {
  id: number;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  isBuiltin: number;
  createdAt: number;
}

/** 时间记录 + 关联的活动信息（展示用） */
export interface RecordWithActivity {
  id: number;
  activityId: number;
  startTs: number;
  endTs: number | null; // NULL = 正在计时
  note: string;
  createdAt: number;
  updatedAt: number | null;
  activityName: string;
  activityColor: string;
  activityIcon: string;
}

export interface AggregationRow {
  activityId: number;
  name: string;
  color: string;
  icon: string;
  totalMs: number;
}

/** 首次启动预置的 8 个常用活动（用户已拍板） */
export const PRESET_ACTIVITIES = [
  { name: '工作', color: '#3B82F6', icon: '💼' },
  { name: '学习', color: '#8B5CF6', icon: '📚' },
  { name: '运动', color: '#10B981', icon: '🏃' },
  { name: '休息', color: '#F59E0B', icon: '☕' },
  { name: '通勤', color: '#64748B', icon: '🚌' },
  { name: '家务', color: '#EC4899', icon: '🧹' },
  { name: '娱乐', color: '#EF4444', icon: '🎮' },
  { name: '睡觉', color: '#6366F1', icon: '😴' },
] as const;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  color       TEXT    NOT NULL DEFAULT '#3B82F6',
  icon        TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_builtin  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS time_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  start_ts    INTEGER NOT NULL,
  end_ts      INTEGER,
  note        TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_records_start    ON time_records(start_ts);
CREATE INDEX IF NOT EXISTS idx_records_activity ON time_records(activity_id);

-- 单活动计时硬约束：进行中（end_ts IS NULL）的记录最多只能有一条
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active
  ON time_records ((end_ts IS NULL)) WHERE end_ts IS NULL;
`;

/** 建库迁移：PRAGMA user_version 做版本管理，首次运行建表 + 预置活动 */
export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;
  if (version >= 1) return;

  // 注：withExclusiveTransactionAsync 在 Web 端（wa-sqlite）不支持，统一用普通事务；
  // withTransactionAsync 的回调不传事务对象，查询直接用外层 db
  await db.withTransactionAsync(async () => {
    await db.execAsync(SCHEMA);
    const now = Date.now();
    for (const [i, a] of PRESET_ACTIVITIES.entries()) {
      await db.runAsync(
        'INSERT INTO activities (name, color, icon, sort_order, is_builtin, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        a.name,
        a.color,
        a.icon,
        i,
        now,
      );
    }
    await db.execAsync('PRAGMA user_version = 1;');
  });
}

// ---------- 活动 ----------

const ACTIVITY_SELECT =
  'SELECT id, name, color, icon, sort_order AS sortOrder, is_builtin AS isBuiltin, created_at AS createdAt FROM activities';

export async function getActivities(db: SQLiteDatabase): Promise<Activity[]> {
  return db.getAllAsync<Activity>(`${ACTIVITY_SELECT} ORDER BY sort_order, id`);
}

export async function addActivity(
  db: SQLiteDatabase,
  name: string,
  color: string,
  icon: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO activities (name, color, icon, sort_order, is_builtin, created_at)
     VALUES (?, ?, ?, (SELECT IFNULL(MAX(sort_order), 0) + 1 FROM activities), 0, ?)`,
    name.trim(),
    color,
    icon,
    Date.now(),
  );
}

export async function updateActivity(
  db: SQLiteDatabase,
  id: number,
  fields: { name?: string; color?: string; icon?: string },
): Promise<void> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name.trim());
  }
  if (fields.color !== undefined) {
    sets.push('color = ?');
    params.push(fields.color);
  }
  if (fields.icon !== undefined) {
    sets.push('icon = ?');
    params.push(fields.icon);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

/** 删除活动；有历史记录的活动受外键 RESTRICT 保护，返回失败信息 */
export async function deleteActivity(
  db: SQLiteDatabase,
  id: number,
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.runAsync('DELETE FROM activities WHERE id = ?', id);
    return { ok: true, message: '' };
  } catch {
    return { ok: false, message: '该活动已有时间记录，无法删除（可改名保留）' };
  }
}

// ---------- 时间记录 ----------

const RECORD_WITH_ACTIVITY_SELECT = `
  SELECT r.id AS id, r.activity_id AS activityId, r.start_ts AS startTs, r.end_ts AS endTs,
         r.note AS note, r.created_at AS createdAt, r.updated_at AS updatedAt,
         a.name AS activityName, a.color AS activityColor, a.icon AS activityIcon
  FROM time_records r JOIN activities a ON a.id = r.activity_id`;

/** 当前正在计时的记录（end_ts IS NULL 的那一行），没有则 null */
export async function getActiveRecord(db: SQLiteDatabase): Promise<RecordWithActivity | null> {
  return db.getFirstAsync<RecordWithActivity>(
    `${RECORD_WITH_ACTIVITY_SELECT} WHERE r.end_ts IS NULL`,
  );
}

/** 指定范围 [rangeStart, rangeEnd) 内已完成的记录，按开始时间倒序 */
export async function getRecordsInRange(
  db: SQLiteDatabase,
  rangeStart: number,
  rangeEnd: number,
): Promise<RecordWithActivity[]> {
  return db.getAllAsync<RecordWithActivity>(
    `${RECORD_WITH_ACTIVITY_SELECT}
     WHERE r.end_ts IS NOT NULL AND r.start_ts >= ? AND r.start_ts < ?
     ORDER BY r.start_ts DESC`,
    rangeStart,
    rangeEnd,
  );
}

/** 全部已完成的记录（CSV 导出用），按开始时间升序 */
export async function getAllFinishedRecords(db: SQLiteDatabase): Promise<RecordWithActivity[]> {
  return db.getAllAsync<RecordWithActivity>(
    `${RECORD_WITH_ACTIVITY_SELECT} WHERE r.end_ts IS NOT NULL ORDER BY r.start_ts`,
  );
}

/** 日/周/月聚合：范围内各活动总时长，降序（不存汇总表，实时计算） */
export async function getAggregation(
  db: SQLiteDatabase,
  rangeStart: number,
  rangeEnd: number,
): Promise<AggregationRow[]> {
  return db.getAllAsync<AggregationRow>(
    `SELECT a.id AS activityId, a.name AS name, a.color AS color, a.icon AS icon,
            SUM(r.end_ts - r.start_ts) AS totalMs
     FROM time_records r JOIN activities a ON a.id = r.activity_id
     WHERE r.end_ts IS NOT NULL AND r.start_ts >= ? AND r.start_ts < ?
     GROUP BY a.id ORDER BY totalMs DESC`,
    rangeStart,
    rangeEnd,
  );
}

export async function updateRecord(
  db: SQLiteDatabase,
  id: number,
  fields: { activityId: number; startTs: number; endTs: number; note: string },
): Promise<void> {
  await db.runAsync(
    'UPDATE time_records SET activity_id = ?, start_ts = ?, end_ts = ?, note = ?, updated_at = ? WHERE id = ?',
    fields.activityId,
    fields.startTs,
    fields.endTs,
    fields.note,
    Date.now(),
    id,
  );
}

export async function deleteRecord(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM time_records WHERE id = ?', id);
}
