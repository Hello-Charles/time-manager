// src/components/EditRecordModal.tsx — 记录编辑弹窗：改活动/起止时间/备注，支持删除
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSQLiteContext } from 'expo-sqlite';
import type { Activity, RecordWithActivity } from '@/db/database';
import { deleteRecord, updateRecord } from '@/db/database';
import { formatDateTime, parseDateTime } from '@/lib/time';
import { useAppTheme } from '@/hooks/use-app-theme';
import { alertInfo, confirmAsync } from '@/components/confirm';
import ActivityChips from '@/components/ActivityChips';

interface Props {
  visible: boolean;
  record: RecordWithActivity;
  activities: Activity[];
  onClose: () => void;
  /** 保存或删除成功后回调（刷新列表） */
  onChanged: () => void;
}

export default function EditRecordModal({ visible, record, activities, onClose, onChanged }: Props) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();

  // 弹窗由父组件条件挂载（关闭即卸载），状态用初始化器即可，无需 effect 同步
  const [activityId, setActivityId] = useState(record.activityId);
  const [startTs, setStartTs] = useState(record.startTs);
  const [endTs, setEndTs] = useState(record.endTs ?? record.startTs + 60000);
  const [note, setNote] = useState(record.note);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  // Web 端回退：datetimepicker 不支持 Web，用文本输入
  const [startText, setStartText] = useState(formatDateTime(record.startTs));
  const [endText, setEndText] = useState(formatDateTime(record.endTs ?? record.startTs + 60000));
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    let s = startTs;
    let e = endTs;
    if (Platform.OS === 'web') {
      const ps = parseDateTime(startText);
      const pe = parseDateTime(endText);
      if (ps == null || pe == null) {
        alertInfo('时间格式有误', '请按 YYYY-MM-DD HH:mm 格式填写，例如 2026-09-26 09:30');
        return;
      }
      s = ps;
      e = pe;
    }
    if (e <= s) {
      alertInfo('时间无效', '结束时间必须晚于开始时间');
      return;
    }
    setBusy(true);
    try {
      await updateRecord(db, record.id, { activityId, startTs: s, endTs: e, note: note.trim() });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmAsync('删除记录', '确定删除这条记录吗？删除后无法恢复。');
    if (!ok) return;
    await deleteRecord(db, record.id);
    onChanged();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>编辑记录</Text>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>活动</Text>
          <ActivityChips activities={activities} selectedId={activityId} onSelect={setActivityId} />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>起止时间</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                value={startText}
                onChangeText={setStartText}
                placeholder="开始 YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={[styles.timeInput, { color: colors.text, backgroundColor: colors.backgroundElement }]}
                value={endText}
                onChangeText={setEndText}
                placeholder="结束 YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ) : (
            <View style={styles.timeRow}>
              <Pressable
                style={[styles.timeButton, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setPickerTarget('start')}>
                <Text style={{ color: colors.text }}>{formatDateTime(startTs)}</Text>
              </Pressable>
              <Pressable
                style={[styles.timeButton, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setPickerTarget('end')}>
                <Text style={{ color: colors.text }}>{formatDateTime(endTs)}</Text>
              </Pressable>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>备注（可选）</Text>
          <TextInput
            style={[styles.noteInput, { color: colors.text, backgroundColor: colors.backgroundElement }]}
            value={note}
            onChangeText={setNote}
            placeholder="写点什么…"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, { backgroundColor: colors.danger }]} onPress={handleDelete} disabled={busy}>
              <Text style={styles.buttonText}>删除</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: colors.backgroundElement }]} onPress={onClose} disabled={busy}>
              <Text style={[styles.buttonText, { color: colors.text }]}>取消</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={handleSave} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>保存</Text>}
            </Pressable>
          </View>
        </View>

        {pickerTarget && Platform.OS !== 'web' && (
          <DateTimePicker
            value={new Date(pickerTarget === 'start' ? startTs : endTs)}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setPickerTarget(null);
              if (event.type === 'set' && date) {
                if (pickerTarget === 'start') setStartTs(date.getTime());
                else setEndTs(date.getTime());
              }
              if (event.type === 'dismissed' && Platform.OS === 'ios') setPickerTarget(null);
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 20 },
  card: { borderRadius: 16, padding: 20, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  timeInput: { flex: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, fontSize: 13 },
  noteInput: { borderRadius: 10, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
