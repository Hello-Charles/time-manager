# 时间管理 App — 项目文档

## 0. 项目规则（最重要，整个项目期必须遵守）

1. **决策规则**：用户是非技术背景，无法提供技术细节要求。凡涉及技术方案（技术栈、库选型、架构、工具、流程等），Claude 必须先列出候选选项、解释各自利弊并给出推荐，**由用户拍板决定后才实施**；用户未拍板前不得采用有争议的选型。能够合理默认的小决策，Claude 可直接采用但必须在文档/说明中写明理由，用户可随时推翻。
2. 与用户沟通一律使用中文；代码注释与文档可用中文。
3. **轻量务实原则**：本应用是个人使用的轻量工具，不过度设计——不引入 Redux/Zustand 等状态管理库、不要后端服务、不要推送、不要账号体系、不要云同步。
4. 开发验证流程：日常用手机 Expo Go 扫码真机预览 + 电脑浏览器 Web 预览（`npx expo start` 后按 `w`，或直接开 http://localhost:8081）；最终产物通过 EAS 云端免费构建出正式 APK（本机不安装 Android SDK）。
5. **自动化验证脚本**：开发服务器运行期间可执行 `node scripts/smoke-test.mjs`（核心流程冒烟，生成截图）和 `node scripts/verify.mjs`（21 项 DOM 级行为断言：预置活动、计时跳动、刷新恢复、单活动切换、饼图/柱状图渲染、汇总卡、历史记录等）。改动核心逻辑后应运行 verify 确认全绿。

## 1. 产品定位

- **定位**：一款离线、私密的个人时间记录工具。用户手动控制每段活动的开始/停止，App 忠实记录并汇总展示"时间都去哪儿了"。
- **目标用户**：想了解自己每天时间分配的个人用户（学生、上班族），非团队协作场景。
- **核心价值**：手动启停（尊重用户对自己时间的掌控）、数据完全本地（隐私）、统计直观（饼图/周月汇总）。
- **不做什么**：不做番茄钟、不做自动化追踪、不做云同步（列入未来扩展）。

## 2. 功能清单

**核心功能（已拍板）**
1. 手动计时：用户选择活动，点「开始」计时、点「停止」结束；同一时刻只允许一个活动计时，启动新活动自动停止当前活动。
2. 每日统计：统计当天各活动时长，生成每日环形饼图。

**增强功能（已拍板）**
3. 历史记录浏览与编辑：查看任意日期的记录；修改单条记录的活动/起止时间/备注；删除单条记录。
4. 周/月汇总统计：除每日饼图外，查看本周（周日起始）、本月的时长分布柱状图 + 汇总数字。
5. 数据导出备份：一键导出 CSV 文件，通过系统分享面板保存到文件管理器/网盘/微信，用于备份或换机迁移。

**基础能力**
- 活动管理：预置 8 个常用活动（工作、学习、运动、休息、通勤、家务、娱乐、睡觉，各配默认颜色和 emoji）；用户可添加、重命名、改颜色、删除（有历史记录的活动禁止删除，可改名）。

## 3. 页面结构（底部 4 个 Tab）

**① 今日页（默认主页）**
- 计时卡：当前计时活动名称、经过时长（大字号，秒级跳动）、开始/停止按钮。
- 活动选择条：横向滑动的一排活动图标；计时中切换到另一活动点开始，旧活动自动停止、新活动开始。
- 今日记录列表：今天已完成的计时段，按时间倒序，显示活动名、起止时间、时长；点击可修改/删除。
- 今日小结：今日总时长 + 「查看统计」入口。
- 锁屏、退出 App、杀进程都不影响计时（时间戳差值计时，见技术文档）。

**② 历史页**
- 日期导航：左右箭头切换前一天/后一天 + 点击日期弹日历选择器。
- 记录列表：所选日期的全部记录，按开始时间排序；点击弹出编辑面板（活动/开始时间/结束时间/备注），支持删除（带确认弹窗）。
- 空状态：无记录日期显示友好提示。

**③ 统计页**
- 范围切换：「日 / 周 / 月」分段控件 + 前后箭头切换范围。
- 汇总卡：总时长、参与活动数、时长最多的活动。
- 日视图：环形饼图（各活动占比 + 图例 + 具体时长）。
- 周/月视图：按活动时长柱状图（降序 Top 8）+ 完整数字列表。
- 空状态提示。

**④ 设置页**
- 活动管理：全部活动列表，支持添加、重命名、改颜色、删除（有记录的活动禁删）。
- 数据导出：生成 CSV 并弹出系统分享面板。
- 关于：版本号、数据存储说明（完全本地）。

## 4. 数据模型（业务概念）

- **活动（Activity）**：一个可计时的类别：名称、颜色、emoji 图标、排序。
- **时间记录（TimeRecord）**：一次计时段：活动 ID、开始时间戳、结束时间戳（进行中为 NULL）、备注。
- **规则**：一切统计由时间记录实时聚合而来，不另存汇总表；同一时刻最多一条「进行中」记录；跨午夜的记录归属其开始的那一天；时长 = 结束时间戳 − 开始时间戳（毫秒），显示换算为时分秒。

## 5. 关键交互流程

**开始 → 结束 → 看统计**：今日页选活动 → 点「开始」（同一事务内自动结束上一条进行中记录 + 插入新记录）→ 计时卡大数字走秒 → 点「停止」写入结束时间、记录进今日列表 → 点「查看统计」看当天环形图 → 切「周/月」看分布。
**历史修改**：历史页选日期 → 点记录 → 修改（结束时间必须晚于开始时间）→ 保存后统计页数字自动联动。
**导出备份**：设置页点「导出」→ 生成带 UTF-8 BOM 的 CSV（Excel 打开中文不乱码）→ 系统分享面板 → 用户选择保存位置。

## 6. 技术方案（已拍板）

- **技术栈**：React Native + Expo SDK 57 + TypeScript + expo-router（文件式路由）。
- **本地数据库**：expo-sqlite（原生 SQLite，Web 端 wa-sqlite，双端可用；统计聚合用 SQL 完成）。
- **图表**：react-native-gifted-charts（环形图 `PieChart donut` + 柱状图 `BarChart`）+ react-native-svg。
- **日期处理**：dayjs（周起始日 = 周日，注意配置 `weekStart: 0`）。
- **计时引擎**：时间戳差值法——开始只写 `start_ts`，显示时长每秒算 `Date.now() - start_ts`，不存累计值；App 重启/锁屏/杀进程后按时间戳恢复，计时不丢。单活动约束双保险：业务层事务 + SQLite 部分唯一索引 `UNIQUE INDEX ON time_records ((end_ts IS NULL)) WHERE end_ts IS NULL`。
- **导出**：expo-file-system（File/Paths API）写缓存目录 + expo-sharing 分享；文件名 `time-backup-YYYYMMDD-HHmmss.csv`。
- **不引入**：状态管理库（React state + Context 足够）、后端、推送、账号。

## 6.4 远程仓库

- **GitHub 私有仓库**：https://github.com/Hello-Charles/time-manager（账号 Hello-Charles，默认分支 main）
- **网络注意**：本机网络对 github.com 有 DNS 阻断，git 已配置全局代理 `http://127.0.0.1:10808`（用户代理软件），推送/拉取需代理软件运行；api.github.com 可直连
- **协作者拉取**：私有仓库需在仓库 Settings → Collaborators 邀请对方 GitHub 账号；被邀请人 clone 后运行 `npm install` + `npx expo start` 即可开发预览

## 6.5 构建与发布记录

- **EAS 项目**：@charlesbh/time-manager（项目 ID `7ad6b497-d616-447f-8da6-a70c0df804df`，账号 charlesbh / c669161185@gmail.com）
- **出 APK 命令**：`EXPO_TOKEN=... eas build --platform android --profile preview --non-interactive`（preview = 内部分发 APK，签名密钥由 EAS 托管）
- **首个正式版**：v1.0.0，2026-09-26 构建成功，APK 在项目根目录（已 gitignore），构建详情：https://expo.dev/accounts/charlesbh/projects/time-manager/builds/ed9346ea-0620-4ed7-962e-18cbda6d09d6
- **改代码后出新版**：提交 git → 重跑上述构建命令 → 下载新 APK 覆盖安装即可（版本号在 app.json 的 `expo.version`）

## 7. 未来可扩展方向（不在本期）

CSV 导入恢复、每日目标时长、桌面小组件、通知栏常驻计时、深色模式、云同步（WebDAV）、番茄钟模式、忘记停止提醒。

## 附录：数据库表结构

```sql
PRAGMA journal_mode = WAL;  PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  color       TEXT    NOT NULL DEFAULT '#3B82F6',
  icon        TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_builtin  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS time_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  start_ts    INTEGER NOT NULL,          -- epoch 毫秒
  end_ts      INTEGER,                   -- NULL = 正在计时
  note        TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_records_start    ON time_records(start_ts);
CREATE INDEX IF NOT EXISTS idx_records_activity ON time_records(activity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active
  ON time_records ((end_ts IS NULL)) WHERE end_ts IS NULL;
```
