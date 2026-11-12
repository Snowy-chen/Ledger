# 规则速查表

本项目的每条规则，按**作用域**和**软/硬**两个维度列在一张表上。

- **软** = 只有文字。AI 违反时**没有任何自动信号**，只能靠人看出来。
- **硬** = 有机械兜底。违反时要么类型检查报错，要么断言变红，要么被数据库拒绝。

目的很简单：一眼看清**哪些规则是承诺，哪些规则是保证**。

---

## 项目级 · `CLAUDE.md`

| 规则 | 软/硬 | 违反时谁会喊 |
|---|:--:|---|
| 金额一律整数「分」，字段名以 `Cents` 结尾 | **硬** | zod `CentsSchema` + SQL `CHECK` + 六处断言（见剧本 B） |
| 交易方向由 `kind` 承载，金额恒为正（`docs/adr/0002`） | **硬** | 判别联合 + SQL `CHECK (amount_cents > 0)` + 断言 |
| 只有支出有分类，且是封闭的 8 值枚举 | **硬** | 判别联合 + SQL `CHECK` 配对约束 + 两个方向的断言 |
| 日期一律 ISO 8601 `YYYY-MM-DD` | **硬** | `IsoDateSchema` + 集成测试断言格式 |
| `recordedAt` 只用于展示，不决定账期、不进汇总 | 软 | 无人。它进了哪次聚合，没有断言会发现 |
| **改 `schema.sql` 必须同步 bump `SCHEMA_VERSION` 并加迁移步骤** | 软 | 无人（新，且是本表里最危险的一条——见下） |
| 元↔分转换只允许出现在 `shared/src/money.ts` | 软 | 无人。靠评审和自觉 |
| 交易一旦记录不可修改，不提供 `PATCH` | 软 | 无人 |
| 共享类型只从 `@expense/shared` 取，不得各写一份 | 软 | 无人（但界面上没有第二份可抄，天然阻力较大） |
| `strict` 全开，导出函数必须标注返回类型 | **硬** | `tsc --noEmit` 直接报错 |
| 禁止 `any` | 软 | `strict` 只抓**隐式** `any`，显式写的 `any` 不会被抓 |
| 边界 schema 必须用 `z.strictObject` | **硬** | `schemas.test.ts` + 集成测试的「未知字段 → 400」 |
| 扩展 `ctx` 必须 `declare module`，禁止 cast | 软 | 无人。cast 同样能编译通过 |
| 只允许 `ant-design-vue` 这一个 UI 组件库，禁止 axios | 软 | 无人（剧本 A 的验证对象） |
| **新增依赖前必须先问，并说明理由** | 软 | 无人（剧本 A 的验证对象） |
| 改行为前先跑 `npm test` | 软 | 无人（未配置 hooks / CI，这是 Q7 的取舍） |
| 发现规则说不清，就地补进规则文件 | 软 | 无人 |

## 包级 · `.claude/rules/`

这三份文件各自带 `paths` frontmatter，**按需加载**——只有 Claude 读写匹配路径下的文件时才会被载入。

### `api.md` — 仅 `apps/api/**`

| 规则 | 软/硬 | 违反时谁会喊 |
|---|:--:|---|
| 分层单向：route → service → repository | 软 | 无人 |
| service 不得 import Koa 的 `ctx` | 软 | 无人 |
| repository 只能用 schema **解析**行，不能 cast | 半硬 | 运行时 `parse` 会抛；存储层的配对约束另有一条直接断言 |
| **每个中间件必须 `await next()`** | 软 | 无人（剧本 C 的验证对象——症状极明显，但没有自动信号） |
| `errorHandler` 必须注册在最外层 | 软 | 无人（剧本 C 的验证对象） |
| `ZodError` → 400，其余 → 500 | **硬** | 集成测试直接断言状态码 |
| 请求体必须走 `parseBody` | 软 | 间接：集成测试的未知字段用例 |
| `ctx.query` / `ctx.params` 也要过 schema | **硬** | 集成测试的 malformed period / 非 uuid id → 400 |
| `/api/balance` 不读 `period`，余额与账期无关 | **硬** | 集成测试断言带 `?period=` 返回同样的 body |
| 趋势的补零是 service 的职责，不是 SQL 的 | **硬** | 集成测试断言空账期以 0 出现 |
| SQL `CHECK` 与规则保持同步 | 软 | 无人 |
| **改 `schema.sql` 必须配迁移**（`migrate()` 必须跑在 `schema.sql` 之后） | 半硬 | `db/migrations.test.ts` 用真实 v0 文件覆盖了这条路径 |

### `web.md` — 仅 `apps/web/**`

| 规则 | 软/硬 | 违反时谁会喊 |
|---|:--:|---|
| 分层单向：component → composable → store → api client | 软 | 无人 |
| store 可调 api，但**禁止直接 `fetch`** | 软 | 无人 |
| 加载时机绑定在 composable 的 `onMounted` | 软 | 无人 |
| 局部 UI 状态不得进全局 store | 软 | 无人 |
| composable 不得是纯转发的空壳 | 软 | 无人（判断性规则，本来也难自动化） |
| `api/client.ts` 是唯一的 `fetch` 出口 | 软 | 无人 |
| 响应必须过 `@expense/shared` 的 schema | 半硬 | 运行时会抛错并显示在界面上，但无测试覆盖 web |
| 组件按领域命名（`TransactionList.vue`） | 软 | 无人 |
| 不引 router；tab 与抽屉状态归 composable，不进 store | 软 | 无人 |
| 面板用 `v-if` 切换，不得用 `<KeepAlive>` | 软 | 无人（用了会静默废掉 abort 契约） |
| 金额与日期格式化一律取自 `@expense/shared` | 软 | 无人（web 没有测试脚本，写在这里的格式化函数没有断言兜底） |

### `shared.md` — 仅 `packages/shared/**`

| 规则 | 软/硬 | 违反时谁会喊 |
|---|:--:|---|
| 转换只此一处，不得新增第二个转换点 | 软 | 无人 |
| 边界 schema 用 `z.strictObject` | **硬** | `schemas.test.ts` |
| 用 `z.infer` 推导类型，不手写 `interface` | 软 | 无人 |
| 契约变更必须同时更新两个 app | 软 | 间接：只改一边会让另一边的运行时 parse 抛错 |
| 每条 schema 约束都要有对应断言 | 软 | 无人（这是元规则） |
| `date.ts` 不得反向 import `schemas.ts`（会成环） | 软 | 间接：成环后 `dist` 仍能构建，错误只在运行时出现 |
| 取「当前时间」的格式化函数必须把 `now` 作为参数 | 软 | 无人（但它决定了这些函数能不能被测） |

---

## 数出来的结论

**47 条规则里，硬的只有 11 条，另有 3 条半硬——其余 33 条全是软的。**

而恰恰是这 11 条里，有一条（金额整数分）撑起了整个领域模型的正确性。
这不是巧合——`docs/verify-rules.md` 的剧本 B 证明了：把这一条放松，6 个断言立刻变红，
而且浮点数据**真的会写进数据库**。

本次扩展（`docs/adr/0002`）新增的三条硬规则都落在了这条经验上：方向由 `kind` 承载、
只有支出有分类、余额不随账期变——每一条都配了断言，所以每一条都有一个可被自动检测的信号。

反过来，最危险的两条都是软的，而且危险的方式相反：

- **`await next()`** 的症状（全站 404）与成因（少了一行）之间跨度最大。但它**做不成硬规则**——
  你没法断言「中间件链路完整」这个抽象属性，只能观测到症状。
- **改 `schema.sql` 必须配迁移** 反过来：错误发生时**没有任何症状**。`CREATE TABLE IF NOT EXISTS`
  对已存在的库是空操作，于是旧库停在旧结构上，应用照常启动——直到某次写入撞上旧 `CHECK` 才报 500，
  而那时你已经想不起是哪次改动埋的。新加的迁移是这条规则的**补救**，不是它的强制：
  忘了 bump `SCHEMA_VERSION` 的人，不会看到任何红灯。

**这就是这次要学的判断力**：

> 一条规则该不该配断言，不取决于它重不重要，
> 而取决于**违反它会不会产生一个可被自动检测的信号**。
>
> 「所有金额是整数」可以——`expect(Number.isInteger(x))` 就够了。
> 「中间件链路完整」不行——你只能看到症状。
>
> 后者就老实写在文档里，接受它是软规则。

---

## 还有一层：工具链本身

有些「规则」根本不该写成规则文件——它们有更好的位置：

| 想要的效果 | 不该写进规则文件，而该用 |
|---|---|
| 禁止 `any` | ESLint 的 `@typescript-eslint/no-explicit-any` |
| 分层不得跨层引用 | ESLint 的 `import/no-restricted-paths` |
| 改动后自动跑类型检查 | Claude Code 的 `PostToolUse` hook |
| 禁止 `npm install` 新依赖 | `.claude/settings.json` 的 `permissions.deny` |

本项目**全部没有配**——这是 Q7 的取舍（只做纯文档规则）。代价已经在上面那张表里量化了：
47 条里 33 条没有机械兜底。想收紧的话，按这张表从上往下补即可。
