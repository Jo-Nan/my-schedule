# 📅 Daily Backup System

## 概述
自动每天备份计划数据到 GitHub，防止数据丢失。

## 工作原理

### 自动备份流程
1. **触发时间**：每天凌晨 2:00 AM 北京时间（UTC+8）
2. **备份来源**：从 GitHub `Jo-Nan/day-data` 仓库获取最新的 `data/plans.json`
3. **保存位置**：`backups/` 目录，文件名为 `YYYYMMDD.json` 格式（如 `20260313.json`）
4. **自动提交**：备份完成后自动 git commit 和 push

### 文件名约定
```
backups/20260313.json  # 2026年3月13日的备份
backups/20260314.json  # 2026年3月14日的备份
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

1. **查看备份** → GitHub -> my-schedule repo -> `backups/` → 找到需要的日期版本
2. **下载备份文件** → 如 `20260313.json`
3. **恢复步骤**：
   - 编辑 GitHub `Jo-Nan/day-data` 仓库的 `data/plans.json`
   - 替换整个内容为备份文件的内容
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
  - `GITHUB_TOKEN`（GitHub Actions 自动提供）
  - `GITHUB_OWNER=Jo-Nan`
  - `GITHUB_REPO=day-data`
  - `GITHUB_BRANCH=main`
  - `GITHUB_PLANS_PATH=data/plans.json`

## 常见问题

**Q: 备份多久保留一次？**
A: 每天凌晨 2:00 AM 北京时间自动备份一次。

**Q: 备份文件会没有空间吗？**
A: 不会。每个 plans.json 通常只有几 KB，即使保留一年也只需要几 MB。

**Q: 可以改变备份时间吗？**
A: 可以。编辑 `.github/workflows/daily-backup.yml`，找到 cron 时间表：
```yaml
- cron: '0 18 * * *'  # 改这里，格式：分 小时 日期 月 星期
```

**Q: 备份是否包含元数据？**
A: 是的。备份的是完整的 JSON 文件，包含所有计划信息、时间戳等。
