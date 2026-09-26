// src/components/ActivityFormModal.tsx — 活动新增/编辑弹窗（名称、颜色、图标；有记录的活动禁删）
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { Activity } from '@/db/database';
import { addActivity, deleteActivity, updateActivity } from '@/db/database';
import { useAppTheme } from '@/hooks/use-app-theme';
import { alertInfo, confirmAsync } from '@/components/confirm';

interface Props {
  visible: boolean;
  /** null = 新增 */
  activity: Activity | null;
  onClose: () => void;
  /** 保存/删除成功后回调（刷新列表） */
  onChanged: () => void;
}

/** 可选颜色盘 */
const COLOR_PALETTE = [
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#64748B',
  '#EC4899',
  '#EF4444',
  '#6366F1',
  '#0EA5E9',
  '#84CC16',
  '#F97316',
  '#14B8A6',
];

export default function ActivityFormModal({ visible, activity, onClose, onChanged }: Props) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  // 弹窗由父组件条件挂载（关闭即卸载），状态用初始化器即可，无需 effect 同步
  const [name, setName] = useState(activity?.name ?? '');
  const [icon, setIcon] = useState(activity?.icon || '📌');
  const [color, setColor] = useState(activity?.color ?? COLOR_PALETTE[0]);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alertInfo('名称不能为空', '请填写活动名称');
      return;
    }
    setBusy(true);
    try {
      if (activity == null) {
        try {
          await addActivity(db, trimmed, color, icon.trim() || '📌');
        } catch {
          alertInfo('名称重复', '已存在同名活动，请换一个名称');
          return;
        }
      } else {
        try {
          await updateActivity(db, activity.id, { name: trimmed, color, icon: icon.trim() || '📌' });
        } catch {
          alertInfo('名称重复', '已存在同名活动，请换一个名称');
          return;
        }
      }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (activity == null) return;
    const ok = await confirmAsync('删除活动', `确定删除「${activity.name}」吗？`);
    if (!ok) return;
    const result = await deleteActivity(db, activity.id);
    if (!result.ok) {
      alertInfo('无法删除', result.message);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {activity == null ? '添加活动' : '编辑活动'}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>名称</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
            value={name}
            onChangeText={setName}
            placeholder="例如：冥想"
            placeholderTextColor={colors.textSecondary}
            maxLength={10}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>图标（emoji）</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
            value={icon}
            onChangeText={setIcon}
            placeholder="📌"
            placeholderTextColor={colors.textSecondary}
            maxLength={4}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>颜色</Text>
          <View style={styles.palette}>
            {COLOR_PALETTE.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  color === c && { borderWidth: 3, borderColor: colors.text },
                ]}
              />
            ))}
          </View>

          <View style={styles.buttonRow}>
            {activity != null && (
              <Pressable
                style={[styles.button, { backgroundColor: colors.danger }]}
                onPress={handleDelete}
                disabled={busy}>
                <Text style={styles.buttonText}>删除</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.button, { backgroundColor: colors.backgroundElement }]}
              onPress={onClose}
              disabled={busy}>
              <Text style={[styles.buttonText, { color: colors.text }]}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={handleSave}
              disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>保存</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 20 },
  card: { borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  input: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, fontSize: 15 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
