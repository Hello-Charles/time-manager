// src/app/(tabs)/index.tsx — 今日页：计时卡 + 活动选择条 + 今日记录
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Activity, RecordWithActivity } from '@/db/database';
import { getActiveRecord, getActivities, getRecordsInRange } from '@/db/database';
import { startTimer, stopTimer, useNow } from '@/lib/timer';
import { dayjs, formatClock, formatDuration } from '@/lib/time';
import { useAppTheme } from '@/hooks/use-app-theme';
import ActivityChips from '@/components/ActivityChips';
import EditRecordModal from '@/components/EditRecordModal';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [active, setActive] = useState<RecordWithActivity | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [todayRecords, setTodayRecords] = useState<RecordWithActivity[]>([]);
  const [editing, setEditing] = useState<RecordWithActivity | null>(null);
  const now = useNow(active != null);

  const refresh = useCallback(async () => {
    const [acts, act, recs] = await Promise.all([
      getActivities(db),
      getActiveRecord(db),
      getRecordsInRange(db, dayjs().startOf('day').valueOf(), dayjs().endOf('day').valueOf() + 1),
    ]);
    setActivities(acts);
    setActive(act);
    // 默认选中：当前计时活动，否则第一个活动
    setSelectedId((prev) => prev ?? act?.activityId ?? acts[0]?.id ?? null);
    setTodayRecords(recs);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleStart = async () => {
    if (selectedId == null) return;
    // 同一事务内自动结束上一个计时，再开始新活动
    await startTimer(db, selectedId);
    await refresh();
  };

  const handleStop = async () => {
    await stopTimer(db);
    await refresh();
  };

  const canSwitch = active != null && selectedId != null && selectedId !== active.activityId;
  const switchName = activities.find((a) => a.id === selectedId)?.name;

  // 今日总时长 = 已完成记录 + 进行中（若今天开始）
  const todayStart = dayjs().startOf('day').valueOf();
  const finishedMs = todayRecords.reduce((s, r) => s + (r.endTs ?? r.startTs) - r.startTs, 0);
  const runningMs = active != null && active.startTs >= todayStart ? now - active.startTs : 0;
  const totalMs = finishedMs + runningMs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>今日</Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dayjs().format('M月D日 dddd')}</Text>
      </View>

      {/* 计时卡 */}
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        {active != null ? (
          <View style={styles.timerContent}>
            <Text style={[styles.activeName, { color: colors.text }]}>
              {active.activityIcon} {active.activityName}
            </Text>
            <Text style={[styles.elapsed, { color: colors.text }]}>{formatDuration(now - active.startTs)}</Text>
            <Text style={[styles.startHint, { color: colors.textSecondary }]}>
              {formatClock(active.startTs)} 开始
            </Text>
            <Pressable style={[styles.stopButton, { backgroundColor: colors.danger }]} onPress={handleStop}>
              <Text style={styles.stopButtonText}>停止</Text>
            </Pressable>
            {canSwitch && (
              <Pressable
                style={[styles.switchButton, { backgroundColor: colors.backgroundSelected }]}
                onPress={handleStart}>
                <Text style={[styles.switchButtonText, { color: colors.text }]}>
                  切换到「{switchName}」并开始
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.timerContent}>
            <Text style={[styles.idleHint, { color: colors.textSecondary }]}>选择活动，开始计时</Text>
            <Pressable
              style={[styles.startButton, { backgroundColor: colors.tint, opacity: selectedId == null ? 0.4 : 1 }]}
              onPress={handleStart}
              disabled={selectedId == null}>
              <Text style={styles.stopButtonText}>开始计时</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ActivityChips activities={activities} selectedId={selectedId} onSelect={setSelectedId} />

      {/* 今日小结 + 记录列表 */}
      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>
          今日记录{todayRecords.length > 0 ? ` · ${todayRecords.length} 条` : ''}
        </Text>
        <Pressable onPress={() => router.push('/stats')}>
          <Text style={{ color: colors.tint }}>查看统计 →</Text>
        </Pressable>
      </View>
      <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
        今日总时长{' '}
        <Text style={{ color: colors.text, fontWeight: '600' }}>{formatDuration(totalMs)}</Text>
      </Text>

      <FlatList
        data={todayRecords}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.recordRow, { borderBottomColor: colors.border }]}
            onPress={() => setEditing(item)}>
            <View style={[styles.recordDot, { backgroundColor: item.activityColor }]} />
            <View style={styles.recordMain}>
              <Text style={[styles.recordName, { color: colors.text }]}>
                {item.activityIcon} {item.activityName}
              </Text>
              <Text style={[styles.recordTime, { color: colors.textSecondary }]}>
                {formatClock(item.startTs)} - {formatClock(item.endTs ?? 0)}
                {item.note ? ` · ${item.note}` : ''}
              </Text>
            </View>
            <Text style={[styles.recordDuration, { color: colors.text }]}>
              {formatDuration((item.endTs ?? 0) - item.startTs)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            今天还没有记录，选择上方活动开始第一条计时吧
          </Text>
        }
      />

      {editing != null && (
        <EditRecordModal
          visible
          record={editing}
          activities={activities}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  screenTitle: { fontSize: 28, fontWeight: '700' },
  dateText: { fontSize: 14 },
  card: { marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 20 },
  timerContent: { alignItems: 'center', gap: 8 },
  activeName: { fontSize: 18, fontWeight: '600' },
  elapsed: { fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  startHint: { fontSize: 13 },
  idleHint: { fontSize: 15, marginBottom: 6 },
  startButton: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 48 },
  stopButton: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 48 },
  switchButton: { borderRadius: 24, paddingVertical: 10, paddingHorizontal: 24 },
  stopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchButtonText: { fontSize: 14, fontWeight: '500' },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  listTitle: { fontSize: 16, fontWeight: '600' },
  summaryText: { paddingHorizontal: 16, marginTop: 4, fontSize: 13, marginBottom: 4 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  recordMain: { flex: 1 },
  recordName: { fontSize: 15, fontWeight: '500' },
  recordTime: { fontSize: 12, marginTop: 2 },
  recordDuration: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyText: { textAlign: 'center', marginTop: 40, paddingHorizontal: 32, lineHeight: 20 },
});
