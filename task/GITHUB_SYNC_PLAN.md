# GitHub 同步方案（方案 A：私有仓库 + 薄后端 API）

## 先看这个：谁来做

### 你需要做的

- 创建并维护 GitHub 私有数据仓库：`Jo-Nan/day-data`
- 在数据仓库里创建 `data/plans.json`，初始内容写成 `[]`
- 创建并保管 GitHub fine-grained token
- 在 Vercel 项目里配置环境变量
- 把 `day` 项目部署到 Vercel
- 部署后亲自验证线上同步是否正常

### 我可以直接帮你做的

- 在 `day` 项目里新增和修改代码
- 创建 `api/load-plans.js`、`api/save-plans.js`
- 修改前端同步逻辑，让它走 GitHub API
- 删除旧的本地绝对路径同步逻辑
- 更新 UI 文案和同步说明
- 帮你做本地构建检查和代码自测

### 需要你配好后，我才能继续做的

- `GITHUB_TOKEN`
- `GITHUB_OWNER=Jo-Nan`
- `GITHUB_REPO=day-data`
- `GITHUB_BRANCH=main`
- `GITHUB_PLANS_PATH=data/plans.json`

说明：
- 我不会接收你的 token
- 你只需要自己把它配置到 Vercel 或本地环境变量中
- 代码里我会只读取 `process.env.*`

---

## 目标

把当前基于本地文件路径的导入/导出逻辑，改成基于 GitHub 私有仓库的统一同步方案。

最终效果：
- 任意设备都通过同一套接口同步计划数据
- 前端不再依赖本地固定路径
- GitHub Token 不暴露到浏览器
- 数据保存在私有仓库中，并具备提交历史，可回滚

---

## 最终架构

```text
浏览器前端
  -> GET /api/load-plans
  -> POST /api/save-plans

Vercel Functions / Serverless API
  -> GitHub REST API
  -> 读写私有仓库中的 plans.json

GitHub 私有仓库
  -> data/plans.json
```

推荐部署方式：
- 前端：继续使用当前 `day` 项目
- 后端：直接放在同一个项目的 `api/` 目录中，部署到 Vercel
- 数据仓库：使用你已创建的私有仓库 `Jo-Nan/day-data`

这样前端和 API 在同一个域名下，浏览器无需额外处理跨域。

---

## 为什么选这个方案

相比“本地绝对路径 + 文件同步”，这个方案的优点更明显：

- 跨设备稳定：Mac、Windows、另一台电脑都走同一套同步路径
- 部署简单：Vercel 原生支持 Vite 项目根目录下的 `api/` 路由
- 安全性更好：GitHub Token 只保存在服务端环境变量中
- 可追溯：每次保存都会生成 Git 提交，出问题可以回滚
- 便于扩展：以后可继续增加 `settings.json`、`archive.json` 等数据文件

---

## 第 1 步：新建 GitHub 私有数据仓库

**负责人：你**

这一步你已经完成了。

当前仓库：
- 仓库地址：`https://github.com/Jo-Nan/day-data`
- 推荐分支：`main`

你现在只需要确认下面这件事：
- 仓库中已经存在 `data/plans.json`
- 文件初始内容为：

```json
[]
```

说明：
- 这里用 `data/plans.json`，而不是把数据放在仓库根目录，后面扩展多文件更整洁
- 当前前端里 `plans` 默认是数组，因此初始值直接用 `[]` 最稳妥

---

## 第 2 步：创建 GitHub 访问凭证

**负责人：你**

推荐使用 **Fine-grained Personal Access Token**，不要把 Token 发给我，也不要把 Token 放到前端。

### 推荐权限

为这个私有仓库单独创建一个 fine-grained token，并将仓库范围限制到 `day-data`。

最小权限建议：
- Repository access：`Only select repositories`
- Repository permissions：`Contents: Read and write`

### 命名建议

可以命名为：
- `day-sync-vercel`

### 过期时间建议

- 开发阶段：30 天或 90 天
- 稳定后：再根据你习惯调整

说明：
- GitHub 官方建议优先使用 fine-grained token，并尽量只给最小权限
- 仓库文件更新接口在更新已有文件时，需要带上目标文件当前的 `sha`

---

## 第 3 步：把 Token 配到部署平台

**负责人：你**

推荐把这个项目部署到 Vercel，然后把凭证放进项目环境变量。

建议配置以下环境变量：

```bash
GITHUB_TOKEN=你的 fine-grained token
GITHUB_OWNER=Jo-Nan
GITHUB_REPO=day-data
GITHUB_BRANCH=main
GITHUB_PLANS_PATH=data/plans.json
```

### 在 Vercel 中配置

进入项目设置：
- `Settings`
- `Environment Variables`

把上面的变量分别加到：
- `Production`
- `Preview`
- `Development`

建议：
- `GITHUB_TOKEN` 标记为敏感变量
- 修改环境变量后重新部署一次

### 本地开发

本地推荐使用：

```bash
vercel dev
```

而不是只跑：

```bash
npm run dev
```

原因：
- 当前方案依赖根目录 `api/` 下的服务端路由
- `vercel dev` 会在本地模拟 Vercel Functions
- 如果只跑纯 Vite，本地不会自动提供这些 API 路由

---

## 第 4 步：在当前项目中新增服务端 API

**负责人：我**

这一步我已经开始做，并且接口文件已经建好了：
- `api/load-plans.js`
- `api/save-plans.js`

### `GET /api/load-plans`

职责：
- 从 GitHub 私有仓库读取 `data/plans.json`
- 返回解析后的 JSON 数组

处理逻辑：
1. 读取环境变量
2. 调 GitHub Contents API 获取文件内容
3. 取回 Base64 编码内容并解码
4. 解析 JSON
5. 返回给前端

### `POST /api/save-plans`

职责：
- 把前端传来的计划数组写回 `data/plans.json`

处理逻辑：
1. 接收前端 JSON 数据
2. 先请求 GitHub 获取当前文件信息
3. 取出当前 `sha`
4. 把新的 JSON 内容转成 Base64
5. 调 GitHub “Create or update file contents” 接口更新文件
6. 返回最新提交信息

### 一定要注意的点

- 更新已有文件时必须带上当前文件的 `sha`
- 不要并行发多个写请求；保存应串行执行
- 服务端要校验请求体，避免把非法 JSON 写进仓库
- GitHub API 失败时返回明确错误信息，不要只返回 `500`

---

## 第 5 步：前端改造点

**负责人：我**

当前项目里，主要改这几处：

### 1. `vite.config.js`

当前文件里有本地文件同步中间件：
- `localSyncPlugin`
- `/api/load-plans`
- `/api/save-plans`
- 本地路径判断逻辑

我会改为：
- 删除本地文件读写逻辑
- 保留普通 Vite 配置即可
- 不再依赖本地 `fs` 和 `path` 写计划数据

### 2. `src/App.jsx`

这里已经有：
- `handleSync()`
- `handleExport()`

我会调整为：

#### `handleSync()`
- 只请求 `/api/load-plans`
- 成功后取 `response.data`
- 再执行现有 `mergePlans(local, remote)`

#### `handleExport()`
- 建议改名为 `handleSaveToCloud()` 或继续沿用原名
- 只请求 `/api/save-plans`
- 不再 fallback 到浏览器下载文件

如果你仍想保留“手动备份到本地”的能力，可以额外加一个按钮：
- `导出备份`
- 只做浏览器下载，不参与同步主流程

这个按钮如果你想保留，我也可以一并帮你做。

### 3. `src/components/SyncModal.jsx`

我会把说明文案改成：
- 数据保存到 GitHub 私有仓库
- 同步和保存都会经过服务端 API
- 当前设备不再需要固定路径

### 4. `src/utils/translations.js`

我会把这类文案替换掉：
- `public/data/plans.json`
- 本地文件目录
- 导出到默认本地数据文件

改成：
- 同步到 GitHub
- 从 GitHub 同步
- 保存到云端
- 云端同步成功

---

## 第 6 步：建议的 API 契约

**负责人：我**

为了后续可维护，我建议前后端统一返回结构。

### 加载接口

`GET /api/load-plans`

成功：

```json
{
  "status": "success",
  "source": "github",
  "updatedAt": "2026-03-13T00:00:00.000Z",
  "data": [
    {
      "id": "...",
      "event": "..."
    }
  ]
}
```

失败：

```json
{
  "status": "error",
  "message": "Failed to load plans from GitHub"
}
```

### 保存接口

`POST /api/save-plans`

请求体：

```json
[
  {
    "id": "...",
    "event": "..."
  }
]
```

成功：

```json
{
  "status": "success",
  "source": "github",
  "commitSha": "abc123"
}
```

失败：

```json
{
  "status": "error",
  "message": "Failed to save plans to GitHub"
}
```

---

## 第 7 步：推荐的实现顺序

**负责人：协作**

建议按下面顺序做，风险最低：

### 阶段 1：你先准备外部条件
- 你确认私有仓库中已有 `data/plans.json`
- 你配好 Vercel 环境变量
- 你确认 `day` 项目已部署到 Vercel 或准备本地 `vercel dev`

### 阶段 2：我改项目代码
- 我完善 `GET /api/load-plans`
- 我完善 `POST /api/save-plans`
- 我把前端“同步 / 导出”切到 GitHub 方案

### 阶段 3：你做真实环境验证
- 你点击一次同步
- 你修改一条计划并保存
- 你去 `Jo-Nan/day-data` 查看 `data/plans.json` 是否已更新

### 阶段 4：我继续收尾
- 我删除旧的本地路径同步代码
- 我清理旧文案
- 我补充说明文档和必要的构建检查

---

## 第 8 步：异常场景处理

**负责人：我处理代码，你负责真实验证**

建议在实现时一起处理这些情况：

### 1. 私有仓库文件不存在
我会这样处理：
- 第一次读取时，如果 `data/plans.json` 不存在，返回空数组 `[]`
- 或在第一次保存时自动创建文件

### 2. Token 权限不够
你会看到：
- API 返回 `403`
- 前端提示：云端同步权限不足，请检查服务端配置

### 3. 并发保存冲突
我会这样处理：
- 前端保存按钮应在请求进行中禁用
- 服务端收到 `409/422` 类冲突时，返回“请先重新同步后再保存”

### 4. GitHub API 限流或临时失败
我会这样处理：
- 前端显示明确错误
- 不会清空本地内存数据
- 继续保留浏览器本地 `localStorage` 作为临时兜底缓存

### 5. JSON 内容损坏
我会这样处理：
- 服务端读取后先尝试 `JSON.parse`
- 失败则返回错误，不会静默吞掉

---

## 第 9 步：当前项目中的建议文件改动清单

**负责人：我**

基于当前 `day` 项目结构，建议改这些文件：

新增：
- `api/load-plans.js`
- `api/save-plans.js`
- `vercel.json`（如后续需要补充路由或配置）
- `GITHUB_SYNC_PLAN.md`

修改：
- `vite.config.js`
- `src/App.jsx`
- `src/components/SyncModal.jsx`
- `src/utils/translations.js`
- `README.md`

可选修改：
- `src/components/Header.jsx`（增加“云端同步中 / 已同步”提示）

---

## 第 10 步：上线前检查清单

**负责人：协作**

### 你需要确认
- GitHub 私有仓库已创建
- `data/plans.json` 已存在且内容合法
- Token 已限制到单仓库
- Token 只有 `Contents: Read and write`
- Vercel 环境变量已配置到 `Production / Preview / Development`
- 线上部署已经存在

### 我可以帮你完成
- 本地代码改造
- 构建检查
- 接口逻辑校验
- 文案和前端行为收尾

### 你最终需要亲自验证
- 本地通过 `vercel dev` 能正常读写
- 线上部署后，`/api/load-plans` 正常
- 线上部署后，`/api/save-plans` 正常
- 前端文案不再提本地绝对路径
- 保存按钮防重入
- 错误提示可理解

---

## 第 11 步：我建议的最小可行版本（MVP）

**负责人：协作**

第一版只做这些，先快速稳定上线：

1. 你保留私有仓库 `day-data`
2. 你确认文件 `data/plans.json`
3. 我完成 `GET /api/load-plans`
4. 我完成 `POST /api/save-plans`
5. 我保留当前 `mergePlans()` 逻辑
6. 我继续保留本地 `localStorage` 作为临时缓存
7. 我去掉“本地固定路径同步”主逻辑

先把这版跑通，再考虑：
- GitHub App 替换 PAT
- 多文件拆分
- 保存历史展示
- 冲突解决策略优化

---

## 官方参考文档

- GitHub 仓库文件读写接口：<https://docs.github.com/rest/repos/contents>
- GitHub fine-grained PAT 创建说明：<https://docs.github.com/github/extending-github/git-automation-with-oauth-tokens>
- GitHub fine-grained PAT 权限说明：<https://docs.github.com/en/rest/overview/permissions-required-for-fine-grained-personal-access-tokens>
- Vercel 上部署 Vite：<https://vercel.com/docs/frameworks/frontend/vite>
- Vercel Functions：<https://vercel.com/docs/functions>
- Vercel 环境变量：<https://vercel.com/docs/environment-variables>
- `vercel dev` 本地调试：<https://vercel.com/docs/cli/dev>

---

## 结论

这套方案适合你当前项目的原因是：
- 你现在是单用户场景
- 数据结构简单，本质就是一个 JSON 文件
- 你已经有现成的同步入口按钮和状态 UI
- 只需要把“本地文件同步”替换成“GitHub 私有仓库同步”即可

如果按实施成本和稳定性平衡来看，这就是当前最适合你的方案。
