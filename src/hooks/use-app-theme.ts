// src/hooks/use-app-theme.ts — 主题颜色：跟随系统深色模式
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { isDark, colors: Colors[isDark ? 'dark' : 'light'] };
}
