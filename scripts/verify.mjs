// scripts/verify.mjs — 核心行为验证（DOM 级）：计时跳动/持久化/单活动切换/饼图渲染
// 用法：先启动开发服务器（npx expo start），再 node scripts/verify.mjs
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:8081';
const errors = [];
const passed = [];
const failed = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed.push(name);
    console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed.push(name);
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const elapsed = () => page.getByText(/^\d{1,2}:\d{2}(:\d{2})?$/).first();

try {
  console.log('▶ 打开今日页');
  await page.goto(BASE, { timeout: 120000 });
  await page.getByText('开始计时', { exact: true }).waitFor({ timeout: 120000 });

  console.log('▶ 预置活动');
  for (const name of ['工作', '学习', '运动', '休息', '通勤', '家务', '娱乐', '睡觉']) {
    check(`预置活动「${name}」`, (await page.getByText(name, { exact: true }).count()) > 0);
  }

  console.log('▶ 开始计时 + 数字跳动');
  await page.getByText('开始计时', { exact: true }).click();
  await page.getByText('停止').waitFor({ timeout: 10000 });
  const t1 = await elapsed().innerText();
  await page.waitForTimeout(2300);
  const t2 = await elapsed().innerText();
  check('计时数字每秒跳动', t1 !== t2, `${t1} → ${t2}`);

  console.log('▶ 刷新页面后计时恢复（时间戳持久化）');
  await page.reload({ waitUntil: 'load' });
  await page.getByText('停止').waitFor({ timeout: 120000 });
  const t3 = await elapsed().innerText();
  check('刷新后计时仍在', t3 !== '0:00', `经过时长 ${t3}`);

  console.log('▶ 单活动约束：切换到「学习」自动停「工作」');
  await page.getByText('学习', { exact: true }).click(); // 选中学习
  await page.getByText('切换到「学习」并开始').waitFor({ timeout: 10000 });
  await page.getByText('切换到「学习」并开始').click();
  await page.getByText('停止').waitFor({ timeout: 10000 });
  await page.getByText('📚 学习').first().waitFor({ timeout: 10000 }); // 等异步刷新完成
  const activeText = await page.locator('body').innerText();
  check('当前计时变为学习', activeText.includes('📚 学习'), '');
  check('工作记录已自动结束进入今日列表', activeText.includes('💼 工作'), '');
  await page.waitForTimeout(6000); // 学习计时 6 秒
  await page.getByText('停止').click();
  await page.getByText('开始计时', { exact: true }).waitFor({ timeout: 10000 });
  const todayText = await page.locator('body').innerText();
  check('今日列表有 2 条记录', todayText.includes('· 2 条'), '');

  console.log('▶ 统计页：环形饼图 + 汇总');
  await page.getByRole('tab', { name: '统计' }).click();
  await page.getByText('总时长').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const svgCount = await page.locator('svg').count();
  check('环形饼图已渲染（SVG）', svgCount > 0, `${svgCount} 个 svg`);
  const statsText = await page.locator('body').innerText();
  // 汇总卡布局为「数值在上、标签在下」，取卡片容器文本验证（exact 避免匹配今日页的「今日总时长」）
  const countCard = await page.getByText('活动数', { exact: true }).first().locator('..').innerText();
  check('汇总卡活动数为 2', countCard.includes('2'), `卡片内容: ${countCard.replace(/\n/g, ' / ')}`);
  const durationCard = await page.getByText('总时长', { exact: true }).first().locator('..').innerText();
  check('汇总卡总时长非零', /^\d+:\d{2}$/m.test(durationCard), `卡片内容: ${durationCard.replace(/\n/g, ' / ')}`);
  check('图例显示工作与学习', statsText.includes('💼 工作') && statsText.includes('📚 学习'), '');

  console.log('▶ 统计页：切周/月视图');
  await page.getByText('周', { exact: true }).click();
  await page.waitForTimeout(1000);
  check('周视图柱状图渲染', (await page.locator('svg').count()) > 0, '');
  await page.getByText('月', { exact: true }).click();
  await page.waitForTimeout(1000);
  check('月视图柱状图渲染', (await page.locator('svg').count()) > 0, '');

  console.log('▶ 历史页：今日 2 条记录可查');
  await page.getByRole('tab', { name: '历史' }).click();
  await page.getByText('（今天）').waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const historyText = await page.locator('body').innerText();
  check('历史列表包含两条记录', historyText.includes('💼 工作') && historyText.includes('📚 学习'), '');

  console.log('▶ 设置页');
  await page.getByRole('tab', { name: '设置' }).click();
  await page.getByText('导出 CSV 备份').waitFor({ timeout: 10000 });
  check('导出按钮存在', true, '');

  console.log('\n=== 结果 ===');
  console.log(`通过 ${passed.length} 项，失败 ${failed.length} 项`);
  console.log('=== 控制台错误 ===');
  if (errors.length === 0) console.log('（无）');
  else errors.slice(0, 10).forEach((e) => console.log('·', e));
  if (failed.length > 0 || errors.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
