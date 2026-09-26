// src/app/(tabs)/stats.tsx — 统计页：日环形图 / 周月柱状图 + 汇总卡
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import type { AggregationRow } from '@/db/database';
import { getAggregation } from '@/db/database';
import { getRange, toBarData, toPieData, type RangeType } from '@/lib/stats';
import { dayjs, formatDuration, formatMinutes } from '@/lib/time';
import { useAppTheme } from '@/hooks/use-app-theme';

const RANGE_TYPES: { key: RangeType; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
];

export default function StatsScreen() {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [rangeType, setRangeType] = useState<RangeType>('day');
  const [anchor, setAnchor] = useState(() => Date.now());
  const [rows, setRows] = useState<AggregationRow[]>([]);

  const range = getRange(rangeType, anchor);
  const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
  const top = rows[0];

  const refresh = useCallback(async () => {
    const r = getRange(rangeType, anchor);
    setRows(await getAggregation(db, r.start, r.end));
  }, [db, rangeType, anchor]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const shift = (dir: 1 | -1) => {
    const unit: 'day' | 'week' | 'month' =
      rangeType === 'day' ? 'day' : rangeType === 'week' ? 'week' : 'month';
    setAnchor((a) => dayjs(a).add(dir, unit).valueOf());
  };

  const { slices, legend } = toPieData(rows);
  const barData = toBarData(rows);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>统计</Text>

      {/* 范围切换：日/周/月 + 前后箭头 */}
      <View style={styles.rangeNav}>
        <Pressable style={styles.arrowButton} onPress={() => shift(-1)}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.segment, { backgroundColor: colors.backgroundElement }]}>
          {RANGE_TYPES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setRangeType(t.key)}
              style={[
                styles.segmentItem,
                rangeType === t.key && { backgroundColor: colors.backgroundSelected },
              ]}>
              <Text
                style={[
                  styles.segmentText,
                  { color: rangeType === t.key ? colors.text : colors.textSecondary },
                ]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.arrowButton} onPress={() => shift(1)}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>{range.label}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 汇总卡三件套 */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatDuration(totalMs)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>总时长</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{rows.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>活动数</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: 16 }]} numberOfLines={1}>
              {top ? `${top.icon} ${top.name}` : '—'}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>最多活动</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>该范围内暂无记录</Text>
        ) : (
          <>
            {/* 日：环形饼图；周/月：柱状图 Top 8 */}
            {rangeType === 'day' ? (
              <View style={styles.chartWrap}>
                <PieChart
                  data={slices}
                  donut
                  radius={110}
                  innerRadius={72}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>总时长</Text>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
                        {formatDuration(totalMs)}
                      </Text>
                    </View>
                  )}
                />
              </View>
            ) : (
              <View style={styles.chartWrap}>
                <BarChart
                  data={barData}
                  horizontal
                  barWidth={18}
                  spacing={16}
                  yAxisLabelWidth={56}
                  noOfSections={4}
                  isAnimated
                  xAxisColor={colors.border}
                  yAxisColor={colors.border}
                  yAxisTextStyle={{ color: colors.textSecondary }}
                  xAxisLabelTextStyle={{ color: colors.text }}
                  showFractionalValues={false}
                />
              </View>
            )}

            {/* 图例/完整列表 */}
            {rangeType === 'day' ? (
              legend.map((item) => (
                <View key={item.name} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendName, { color: colors.text }]}>
                    {item.icon} {item.name}
                  </Text>
                  <Text style={[styles.legendPct, { color: colors.textSecondary }]}>
                    {item.percent.toFixed(1)}%
                  </Text>
                  <Text style={[styles.legendDuration, { color: colors.text }]}>
                    {formatDuration(item.ms)}
                  </Text>
                </View>
              ))
            ) : (
              rows.map((r) => (
                <View key={r.activityId} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.legendName, { color: colors.text }]}>
                    {r.icon} {r.name}
                  </Text>
                  <Text style={[styles.legendPct, { color: colors.textSecondary }]}>
                    {totalMs > 0 ? ((r.totalMs / totalMs) * 100).toFixed(1) : '0.0'}%
                  </Text>
                  <Text style={[styles.legendDuration, { color: colors.text }]}>
                    {formatMinutes(r.totalMs)} 分钟
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  rangeNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 8 },
  arrowButton: { padding: 8 },
  segment: { flexDirection: 'row', borderRadius: 20, padding: 3 },
  segmentItem: { borderRadius: 17, paddingVertical: 6, paddingHorizontal: 22 },
  segmentText: { fontSize: 14, fontWeight: '500' },
  rangeLabel: { textAlign: 'center', marginTop: 4, fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 12 },
  chartWrap: { alignItems: 'center', marginVertical: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { flex: 1, fontSize: 14 },
  legendPct: { fontSize: 13, marginRight: 16, fontVariant: ['tabular-nums'] },
  legendDuration: { fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  emptyText: { textAlign: 'center', marginTop: 60, fontSize: 14 },
});
