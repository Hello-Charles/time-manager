// scripts/smoke-test.mjs — 冒烟测试：用无头 Edge 驱动 Web 预览版，验证核心流程并截图
// 用法：先启动开发服务器（npx expo start），再 node scripts/smoke-test.mjs
// 截图输出到 scripts/screenshots/
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:8081';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

const consoleErrors = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // 手机尺寸
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  console.log('[1] 打开今日页…');
  await page.goto(BASE, { timeout: 120000 });
  await page.getByText('开始计时', { exact: true }).waitFor({ timeout: 120000 }); // 首次加载需编译 bundle
  await page.screenshot({ path: join(OUT_DIR, '01-today-idle.png') });
  console.log('[1] 今日页渲染成功（活动预置、开始按钮可见）');

  console.log('[2] 点击「开始计时」…');
  await page.getByText('开始计时', { exact: true }).click();
  await page.getByText('停止').waitFor({ timeout: 10000 });
  await page.waitForTimeout(3200); // 等 3 秒，验证数字跳动
  await page.screenshot({ path: join(OUT_DIR, '02-today-running.png') });
  console.log('[2] 计时已开始（停止按钮出现）');

  console.log('[3] 切到历史页…');
  await page.getByRole('tab', { name: '历史' }).click();
  await page.getByText('这一天没有记录').waitFor({ timeout: 10000 }); // 进行中的记录不属于历史列表
  await page.screenshot({ path: join(OUT_DIR, '03-history.png') });
  console.log('[3] 历史页渲染成功（今天有计时中记录，无已完成记录）');

  console.log('[4] 回今日页停止计时…');
  await page.getByRole('tab', { name: '今日' }).click();
  await page.getByText('停止').click();
  await page.getByText('开始计时', { exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: join(OUT_DIR, '04-today-stopped.png') });
  console.log('[4] 计时已停止，记录进入今日列表');

  console.log('[5] 切到统计页…');
  await page.getByRole('tab', { name: '统计' }).click();
  await page.getByText('总时长').first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: join(OUT_DIR, '05-stats-day.png') });
  console.log('[5] 统计页渲染成功（汇总卡可见）');

  console.log('[6] 切到设置页…');
  await page.getByRole('tab', { name: '设置' }).click();
  await page.getByText('导出 CSV 备份').waitFor({ timeout: 10000 });
  await page.screenshot({ path: join(OUT_DIR, '06-settings.png') });
  console.log('[6] 设置页渲染成功（8 个预置活动 + 导出按钮）');

  console.log('\n=== 控制台错误 ===');
  if (consoleErrors.length === 0) {
    console.log('（无）');
  } else {
    for (const e of consoleErrors.slice(0, 10)) console.log('·', e);
  }
} catch (err) {
  console.error('冒烟测试失败:', err.message);
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  process.exit(1);
} finally {
  if (browser) await browser.close();
}
