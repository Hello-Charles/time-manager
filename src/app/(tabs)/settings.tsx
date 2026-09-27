// src/app/(tabs)/settings.tsx — 设置页：活动管理 + CSV 导出 + 关于
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@/db/database';
import { getActivities } from '@/db/database';
import { exportRecordsCsv } from '@/lib/exportCsv';
import { useAppTheme } from '@/hooks/use-app-theme';
import { alertInfo } from '@/components/confirm';
import ActivityFormModal from '@/components/ActivityFormModal';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  /** undefined = 弹窗关闭；null = 新增；Activity = 编辑 */
  const [formTarget, setFormTarget] = useState<Activity | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    setActivities(await getActivities(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportRecordsCsv(db);
      if (!result.ok) alertInfo('导出失败', result.message);
    } catch {
      alertInfo('导出失败', '生成导出文件时出错，请重试');
    } finally {
      setExporting(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>设置</Text>

      {/* 活动管理 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>活动管理</Text>
        <Pressable onPress={() => setFormTarget(null)}>
          <Text style={{ color: colors.tint }}>＋ 添加活动</Text>
        </Pressable>
      </View>
      <FlatList
        data={activities}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.activityRow, { borderBottomColor: colors.border }]}
            onPress={() => setFormTarget(item)}>
            <View style={[styles.activityDot, { backgroundColor: item.color }]} />
            <Text style={[styles.activityName, { color: colors.text }]}>
              {item.icon} {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>还没有活动</Text>
        }
      />

      {/* 数据导出 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>数据</Text>
      </View>
      <Pressable
        style={[styles.exportButton, { backgroundColor: colors.backgroundElement }]}
        onPress={handleExport}
        disabled={exporting}>
        {exporting ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={[styles.exportText, { color: colors.tint }]}>导出 CSV 备份</Text>
        )}
      </Pressable>
      <Text style={[styles.exportHint, { color: colors.textSecondary }]}>
        导出全部时间记录为 CSV 文件，可通过系统分享保存到文件管理器、网盘或发送到微信
      </Text>

      {/* 关于 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>关于</Text>
      </View>
      <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
        时光鸭 v{version}{'\n'}所有数据仅保存在本机，不会上传到任何服务器
      </Text>

      {formTarget !== undefined && (
        <ActivityFormModal
          visible
          activity={formTarget}
          onClose={() => setFormTarget(undefined)}
          onChanged={refresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 13 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  activityName: { flex: 1, fontSize: 15 },
  emptyText: { textAlign: 'center', marginTop: 24 },
  exportButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exportText: { fontSize: 15, fontWeight: '600' },
  exportHint: { paddingHorizontal: 16, marginTop: 8, fontSize: 12, lineHeight: 18 },
  aboutText: { paddingHorizontal: 16, fontSize: 13, lineHeight: 20 },
});
