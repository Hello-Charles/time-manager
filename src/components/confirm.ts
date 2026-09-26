// src/components/confirm.ts — 跨平台确认/提示弹窗（原生 Alert，Web 回退 window.confirm/alert）
import { Alert, Platform } from 'react-native';

export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确定', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function alertInfo(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
