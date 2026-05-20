# WebChat 前端迭代规划

> 日期: 2026-05-20 | 版本: v1

---

## 问题分析

### 问题一：聊天前端无法配置 API Key，导致鉴权失败

**根因**：`lib/config.ts` 中 `apiKey` 通过构建时环境变量 `HOTPLEX_WEBCHAT_API_KEY` 注入，默认值 `"dev"`，编译后写死在 JS bundle 中。非 dev 模式部署时，后端要求合法 API Key，前端永远传 `"dev"`，所有请求（WebSocket `init`、REST `/api/sessions`）均返回 401。

**影响范围**：
- `lib/config.ts` — `apiKey` 常量，构建时固化
- `lib/api/sessions.ts` — `X-API-Key` 头部，取 `apiKey`
- `lib/ai-sdk-transport/client/browser-client.ts` — WebSocket `init` 信封 `auth.token`，取 `apiKey`
- `lib/adapters/hotplex-runtime-adapter.ts` — 创建 `BrowserHotPlexClient` 时传入 `apiKey`

### 问题二：Admin 管理端默认端口错误

**根因**：`lib/config.ts` 中 `adminUrl` 默认 `http://localhost:9090`，实际 Admin API 在端口 **9999**。

**影响范围**：
- `lib/config.ts` — `adminUrl` 常量默认值

### 问题三：Admin 管理端功能不完整

现有 Admin 页面已有 Bot 管理、会话管理、Cron 管理、设置页面的骨架，但需要验证与后端 API 的实际对接情况，并补充缺失功能。

---

## 迭代规划

### 迭代一：聊天前端 API Key 运行时配置 [P0]

**目标**：用户可在前端页面配置 API Key，无需重新构建。

**任务清单**：

| # | 任务 | 文件 | 说明 |
|---|---|---|---|
| 1.1 | 新增 `useChatConfig` hook | `hooks/use-chat-config.ts` | 管理 API Key 的读写，持久化到 localStorage（key: `hotplex_chat_api_key`），启动时优先读 localStorage，无则 fallback 到构建时默认值 |
| 1.2 | 修改 `lib/config.ts` | `lib/config.ts` | `apiKey` 从硬编码常量改为函数 `getApiKey()`，运行时读取 localStorage → 构建时默认值 |
| 1.3 | 新增设置入口（齿轮图标） | `app/components/chat/ChatContainer.assistant-ui.tsx` | 在聊天界面 Header 右侧添加设置按钮，点击弹出设置弹窗 |
| 1.4 | 新增设置弹窗组件 | `app/components/chat/SettingsModal.tsx` | 包含：API Key 输入框（密码类型）、WebSocket 地址输入框、保存/重置按钮、连接状态提示 |
| 1.5 | 修改 `BrowserHotPlexClient` | `lib/ai-sdk-transport/client/browser-client.ts` | `apiKey` 支持动态获取（接受函数类型 `() => string`），每次建立连接时实时读取 |
| 1.6 | 修改 `useHotPlexRuntime` | `lib/adapters/hotplex-runtime-adapter.ts` | 传入动态 `apiKey` 获取函数 |

**验收标准**：
- 打开页面 → 无 API Key 时提示配置 → 输入 API Key 后保存 → 刷新页面仍生效
- 修改 API Key 后重建连接，使用新 Key 鉴权成功
- 后端 401 时前端给出明确提示"API Key 无效，请检查设置"

---

### 迭代二：Admin 管理端完善 [P1]

**目标**：Admin 管理端完整对接后端 API，修复端口问题，补全缺失功能。

**任务清单**：

| # | 任务 | 文件 | 说明 |
|---|---|---|---|
| 2.1 | 修复默认端口 | `lib/config.ts` | `adminUrl` 默认值改为 `http://localhost:9999` |
| 2.2 | Admin 登录页增加配置引导 | `app/admin/login/page.tsx` | 默认填充 `localhost:9999`，增加占位提示和连接测试反馈，区分"网络不通"和"Token 错误" |
| 2.3 | 验证并修复仪表板数据对接 | `app/admin/page.tsx` | 确保 `/admin/stats` 返回数据正确渲染到 MetricCard；无数据/加载中/错误三种状态处理 |
| 2.4 | 验证并修复 Bot 列表 | `app/admin/bots/page.tsx` | 对接 `GET /admin/bots`，处理空列表、加载中、错误状态；BotCard 正确显示平台/状态/Agent 配置来源 |
| 2.5 | 验证并修复 Bot 详情编辑 | `app/admin/bots/detail/` | 对接 `GET/PUT /admin/bots/{name}/config/{file}`，确保 bot-config-editor 正确读写 5 个 Agent 配置文件（SOUL.md / AGENTS.md / SKILLS.md / USER.md / MEMORY.md），保存后反馈成功/失败 |
| 2.6 | 验证并修复会话管理 | `app/admin/sessions/page.tsx` | 对接 `GET /admin/sessions`、`POST terminate`、`DELETE`，表格支持排序/筛选，批量终止，二次确认弹窗 |
| 2.7 | 验证并修复 Cron 管理 | `app/admin/cron/page.tsx` | 对接 `GET/POST/PATCH/DELETE /api/cron/jobs`、触发、运行历史；Cron 表达式校验提示 |
| 2.8 | 全局错误处理 | `lib/api/admin-client.ts` | 统一处理 401（跳转登录）、5xx（Toast 提示）、网络错误（重试按钮），增加请求超时（10s） |
| 2.9 | 全局加载/空状态 | 多个页面 | 列表/表格增加 Loading Skeleton、Empty 占位图、Error 重试卡片 |

**验收标准**：
- Admin 登录后能看到真实的 Bot 列表、会话列表、Cron 任务
- Bot 配置文件可编辑保存，保存后后端确实更新
- 会话可终止/删除，操作有二次确认
- Cron 任务可创建/编辑/触发，运行历史可查
- 所有接口异常有友好提示，不白屏

---

### 迭代三：统一设置入口与体验优化 [P2]

**目标**：聊天设置和 Admin 设置统一入口，减少用户困惑。

**任务清单**：

| # | 任务 | 说明 |
|---|---|---|
| 3.1 | 聊天页设置弹窗增加"管理后台"跳转链接 | SettingsModal 底部添加"前往管理后台 →"链接 |
| 3.2 | Admin 设置页同步显示聊天 API Key 配置 | `/admin/settings` 增加"聊天 API Key"配置项，与聊天页设置共享同一 localStorage key |
| 3.3 | 设置变更后自动重连 | API Key 或地址变更后，自动断开当前 WebSocket 并用新配置重连 |
| 3.4 | 移动端适配 | 设置弹窗、Admin 侧边栏在移动端的响应式布局 |

---

## 进度

| 迭代 | 状态 | 开始 | 完成 |
|---|---|---|---|
| 迭代一：聊天 API Key 运行时配置 | ✅ 已完成 | 2026-05-20 | 2026-05-20 |
| 迭代二：Admin 管理端完善 | 🔲 待开始 | - | - |
| 迭代三：统一设置与体验优化 | 🔲 待开始 | - | - |

## 备注

- 迭代一为 **P0 阻塞项**，非 dev 模式部署必须完成
- 迭代二为 **P1 核心功能**，Admin 管理是生产运维必需
- 迭代三为 **P2 体验优化**，可后续迭代
- 构建时环境变量 `HOTPLEX_WEBCHAT_*` 保留作为初始默认值，不删除
