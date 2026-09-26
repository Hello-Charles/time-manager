// src/app/_layout.tsx — 根布局：SQLiteProvider（建库迁移）+ 主题 + 路由栈
import { Suspense } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDb } from '@/db/database';

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* useSuspense：onInit 建库完成前显示加载圈，保证页面挂载时数据库就绪 */}
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        }>
        <SQLiteProvider databaseName="timelog.db" onInit={migrateDb} useSuspense>
          <Stack screenOptions={{ headerShown: false }} />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
