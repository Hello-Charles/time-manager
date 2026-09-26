// src/components/ActivityChips.tsx — 横向滑动的活动选择条（今日页与编辑弹窗共用）
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Activity } from '@/db/database';
import { useAppTheme } from '@/hooks/use-app-theme';

interface Props {
  activities: Activity[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function ActivityChips({ activities, selectedId, onSelect }: Props) {
  const { colors } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {activities.map((a) => {
        const selected = a.id === selectedId;
        return (
          <Pressable key={a.id} onPress={() => onSelect(a.id)} style={styles.chip}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: selected ? `${a.color}44` : colors.backgroundElement,
                  borderColor: selected ? a.color : 'transparent',
                },
              ]}>
              <Text style={styles.icon}>{a.icon || '📌'}</Text>
            </View>
            <Text style={[styles.name, { color: selected ? colors.text : colors.textSecondary }]}>
              {a.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 4, gap: 14 },
  chip: { alignItems: 'center', width: 64 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  icon: { fontSize: 24 },
  name: { marginTop: 4, fontSize: 12 },
});
