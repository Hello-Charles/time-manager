// src/app/(tabs)/history.tsx — 历史页：日期导航 + 记录列表 + 编辑/删除
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, RecordWithActivity } from '@/db/database';
import { getActivities, getRecordsInRange } from '@/db/database';
import { dayjs, formatClock, formatDuration } from '@/lib/time';
import { useAppTheme } from '@/hooks/use-app-theme';
import EditRecordModal from '@/components/EditRecordModal';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [anchor, setAnchor] = useState(() => dayjs().startOf('day').valueOf());
  const [records, setRecords] = useState<RecordWithActivity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editing, setEditing] = useState<RecordWithActivity | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const refresh = useCallback(async () => {
    const [acts, recs] = await Promise.all([
      getActivities(db),
      getRecordsInRange(
        db,
        dayjs(anchor).startOf('day').valueOf(),
        dayjs(anchor).endOf('day').valueOf() + 1,
      ),
    ]);
    setActivities(acts);
    setRecords(recs);
  }, [db, anchor]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const isToday = dayjs(anchor).isSame(dayjs(), 'day');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>历史</Text>

      {/* 日期导航：← 日期（点击选日历）→ */}
      <View style={styles.dateNav}>
        <Pressable
          style={styles.arrowButton}
          onPress={() => setAnchor((a) => dayjs(a).subtract(1, 'day').valueOf())}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => Platform.OS !== 'web' && setShowPicker(true)}>
          <Text style={[styles.dateLabel, { color: colors.text }]}>
            {dayjs(anchor).format('YYYY年M月D日 dddd')}
            {isToday ? '（今天）' : ''}
          </Text>
        </Pressable>
        <Pressable
          style={styles.arrowButton}
          onPress={() => setAnchor((a) => dayjs(a).add(1, 'day').valueOf())}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!isToday && (
        <Pressable onPress={() => setAnchor(dayjs().startOf('day').valueOf())}>
          <Text style={[styles.backToday, { color: colors.tint }]}>回到今天</Text>
        </Pressable>
      )}

      <FlatList
        data={records}
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
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>这一天没有记录</Text>
        }
      />

      {showPicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={new Date(anchor)}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowPicker(false);
            if (event.type === 'set' && date) {
              setAnchor(dayjs(date).startOf('day').valueOf());
            }
          }}
        />
      )}

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
  screenTitle: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 8 },
  arrowButton: { padding: 8 },
  dateLabel: { fontSize: 16, fontWeight: '500' },
  backToday: { textAlign: 'center', marginVertical: 4, fontSize: 13 },
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
