# 📅 Daily Backup System

## 概述
自动每天备份多用户数据到 GitHub，防止数据丢失。

## 工作原理

### 自动备份流程
1. **触发时间**：每天凌晨 4:00 AM 北京时间（UTC+8）
2. **备份来源**：从 GitHub `Jo-Nan/day-data` 仓库获取最新的多用户数据文件
3. **保存位置**：`backups/multi-user/YYYYMMDD/` 目录
4. **自动提交**：备份完成后自动 git commit 和 push

### 目录结构约定
```
backups/multi-user/20260313/users.json
backups/multi-user/20260313/plans-by-user.json
backups/multi-user/20260313/plan-snapshots.json
backups/multi-user/20260313/messages.json
backups/multi-user/20260313/legacy-plans.json
backups/multi-user/20260313/manifest.json
```

## 手动备份
如果需要立即执行备份（不等待自动触发）：

```bash
# 方式 1: 直接运行脚本
GITHUB_TOKEN=your_token GITHUB_OWNER=Jo-Nan GITHUB_REPO=day-data node backup-daily.js

# 方式 2: 使用 GitHub Actions 手动触发
# 在 GitHub repo 页面 -> Actions -> Daily Backup of Plans Data -> Run workflow
```

## 数据恢复步骤

如果同步逻辑出现问题导致数据异常：

1. **查看备份** → GitHub -> my-schedule repo -> `backups/multi-user/` → 找到需要的日期目录
2. **下载备份文件** → 如 `20260313/`
3. **恢复步骤**：
   - 编辑 GitHub `Jo-Nan/day-data` 仓库中的对应文件：
     - `data/users.json`
     - `data/plans-by-user.json`
     - `data/plan-snapshots.json`
     - `data/messages.json`
   - 分别替换为备份目录中的对应文件内容
   - Commit and Push
4. **刷新网页** → 重新加载应用（可能需要清除浏览器缓存）

## 自动清理（可选）
如果备份文件变得太多，可以手动删除旧备份：
```bash
# 只保留最近 30 天的备份
# 可以定期运行此命令清理
find backups -name "*.json" -type f -mtime +30 -delete
```

## 配置说明

GitHub Actions 工作流文件：`.github/workflows/daily-backup.yml`

备份脚本：`backup-daily.js`

- 需要的环境变量（自动从 GitHub Actions secrets 读取）：
  - `DAY_DATA_TOKEN`（推荐，且跨仓库备份私有仓库时必需）
  - `GITHUB_TOKEN`（GitHub Actions 自动提供，只对当前仓库有效）
  - `GITHUB_OWNER=Jo-Nan`
  - `GITHUB_REPO=day-data`
  - `GITHUB_BRANCH=main`
  - `GITHUB_USERS_PATH=data/users.json`
  - `GITHUB_USER_PLANS_PATH=data/plans-by-user.json`
  - `GITHUB_SNAPSHOTS_PATH=data/plan-snapshots.json`
  - `GITHUB_MESSAGES_PATH=data/messages.json`
  - `GITHUB_PLANS_PATH=data/plans.json`（仅旧数据兼容）

### Secret 要求

- 如果备份源仓库和当前运行工作流的仓库不是同一个仓库，例如当前仓库是 `Jo-Nan/my-schedule`，但要读取 `Jo-Nan/day-data`，那么必须配置 `DAY_DATA_TOKEN`。
- 原因是 GitHub Actions 自动注入的 `GITHUB_TOKEN` 默认只能访问当前仓库，不能直接读取另一个私有仓库的数据。
- `DAY_DATA_TOKEN` 至少需要对 `Jo-Nan/day-data` 具备 `Contents: Read` 权限；如果组织开启了 SSO，还需要给这个 token 做 SSO 授权。

### 常见报错定位

- `Node.js 20 actions are deprecated`
  - 这只是 Actions 运行时告警，不是本次 `exit code 1` 的直接原因。
  - 当前仓库里的工作流已经升级到 `actions/checkout@v5` 和 `actions/setup-node@v5`，如果线上仍显示 `@v4`，说明运行的不是当前提交，或者有旧脚本重新生成了 workflow。
- `DAY_DATA_TOKEN is required for cross-repo backups`
  - 说明当前工作流正在从别的仓库拉备份源，但没有配置专用 token。
- `Cannot read Jo-Nan/day-data/data/users.json (HTTP 403/404)`
  - 通常表示 `DAY_DATA_TOKEN` 缺失、权限不够，或者 token 没有完成组织 SSO 授权。

## 常见问题

**Q: 备份多久保留一次？**
A: 每天凌晨 4:00 AM 北京时间自动备份一次。

**Q: 备份文件会没有空间吗？**
A: 不会。每个 plans.json 通常只有几 KB，即使保留一年也只需要几 MB。

**Q: 可以改变备份时间吗？**
A: 可以。编辑 `.github/workflows/daily-backup.yml`，找到 cron 时间表：
```yaml
- cron: '0 20 * * *'  # 改这里，格式：分 小时 日期 月 星期
```

**Q: 备份是否包含元数据？**
A: 是的。除了核心 JSON 数据文件外，还会生成 `manifest.json`，记录备份时间、来源仓库、分支和每个文件的条目数量。
