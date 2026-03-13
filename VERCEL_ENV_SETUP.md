# 📧 Vercel 环境变量配置指南

这个文档说明如何在购买域名后配置 Vercel 环境变量，使应用能正确发送邮件。

---

## 📍 位置和配置

### 当前代码支持的环境变量

你当前的代码已经支持以下变量：

**在 `/api/_lib/email.js` 中：**
```javascript
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.MAIL_FROM || process.env.RESEND_FROM;
```

这意味着你可以使用其中任何一种配置：

```bash
# 方式 1：使用 MAIL_FROM（推荐）
MAIL_FROM=noreply@myday.com

# 方式 2：使用 RESEND_FROM（备选）
RESEND_FROM=noreply@myday.com

# 必须有：Resend API Key
RESEND_API_KEY=sk_live_xxxxx...
```

---

## 🔧 Vercel 配置步骤详解

### 步骤 1：登录 Vercel 收藏板

```
打开：https://vercel.com/dashboard
使用你的 GitHub 账户登录
```

### 步骤 2：找到你的项目

```
Dashboard 中找到：my-schedule

如果看不到，可能在其他团队中：
左侧 → "Select a team/account"
或在搜索框顶部搜索 "my-schedule"
```

### 步骤 3：进入项目设置

```
点击项目卡片进入项目
顶部标签栏：
  • Deployments
  • Analytics
  • Settings  ← 点这里
```

### 步骤 4：打开环境变量配置

```
左侧菜单：
  • Environment
  • Domains
  • Environment Variables  ← 点这里
  • Integrations
  • Webhooks
```

### 步骤 5：查看当前变量和添加新变量

**当前可能已有的变量：**

```
GITHUB_BRANCH=main
GITHUB_OWNER=Jo-Nan
GITHUB_REPO=day-data
GITHUB_TOKEN=github_pat_xxx...
RESEND_API_KEY=sk_live_xxx...
```

**需要添加或更新的变量：**

任选其一：
- ✅ 添加 `MAIL_FROM` - 推荐
- 或 　添加 `RESEND_FROM` - 备选

---

## 📝 添加 MAIL_FROM 变量

### 参数详解

```
Key:     MAIL_FROM
Value:   noreply@myday.com（改成你的域名）

环境选择（建议全选）：
  ☑ Production   - Vercel 的生产部署
  ☑ Preview      - 预览部署（PR 预览）
  ☑ Development  - 本地 vercel dev 开发
```

### 添加步骤

```
1. 点击 [+ Add] 按钮

2. 填写表单：
   
   Key:              MAIL_FROM
   Value:            noreply@刚买的域名.com
   
   例如：
   noreply@myday.com
   noreply@dayplan.io
   no-reply@schedule.app
   
3. 在下方复选框选择应用环境：
   ☑ Production
   ☑ Preview
   ☑ Development
   
4. 点击 [Save] 保存
```

### 确认保存成功

```
✅ 变量列表中能看到新添加的变量
✅ 如果没有立即显示，刷新页面

示例：
┌─────────────────────────────────────┐
│ Environment Variables               │
├─────────────────────────────────────┤
│ GITHUB_BRANCH = main                │
│ GITHUB_OWNER = Jo-Nan              │
│ GITHUB_REPO = day-data             │
│ GITHUB_TOKEN = github_pat_...      │
│ RESEND_API_KEY = sk_live_...       │
│ MAIL_FROM = noreply@myday.com ✅   │
└─────────────────────────────────────┘
```

---

## 🔄 重新部署应用

**⚠️ 重要：环境变量需要重新部署才能生效**

### 方式 1：通过 GitHub push（推荐）

```bash
# 在本地项目目录运行
cd /Users/muzinan/NanMuZ/Code/day

# 创建空提交（触发部署）
git commit --allow-empty -m "chore: apply mail configuration"

# 推送到 GitHub
git push origin main
```

**验证：**
- Vercel 会自动检测到推送
- 自动触发新的部署
- 检查 Vercel Dashboard → Deployments
- 等待最新部署显示 "Ready" ✅

### 方式 2：Vercel 手动重新部署

```
1. Vercel Dashboard → my-schedule 项目
2. 点击 "Deployments" 标签
3. 找到最新的部署（通常在最上方）
4. 点击部署右侧的 "..." 菜单
5. 选择 "Redeploy" 或 "Redeploy without cache"
6. 等待部署完成
```

**部署过程：**
```
Vercel Dashboard 会显示：
⏳ Building...
⏳ Installing dependencies...
⏳ Building project...
⏳ Deploying files...
✅ Ready   ← 表示部署成功
```

---

## 🧪 验证邮件发送

### 测试方法 1：管理员面板测试

```
1. 登录应用
2. 打开管理面板（如果有菜单选项）
3. 找到 "📧 Email Testing" 卡片
4. 点击任一测试按钮：
   - 📋 Test Daily Digest
   - 📊 Test Evening Report
   - 🎂 Test Birthday
```

### 测试方法 2：检查邮件日志

```
在 Resend 控制台查看：
1. 登录 https://resend.com/dashboard
2. 点击 "Emails" 标签
3. 查看表格中是否有新的 "Sent" 邮件
4. 点击邮件查看详情（发件人、收件人、状态）
```

### 测试方法 3：查看 Vercel 日志

```
1. Vercel Dashboard → 项目 → Deployments
2. 点击最新的部署
3. 点击 "Function Logs" 或 "Runtime Logs"
4. 搜索关键词：
   - "sendEmail"
   - "MAIL_FROM"
   - "Resend"
5. 如果有错误消息会显示在这里
```

### ✅ 邮件发送成功的表现

```
邮件列表中显示：
✅ Status: Sent
   From: noreply@myday.com
   To: admin@example.com
   Subject: [测试] 📋 今日简报

邮件正文应该包含：
├─ 发件人：noreply@myday.com
├─ 收件人：你的邮箱
├─ 内容格式正确，有 emoji 和表格
└─ 邮件能正常显示
```

---

## ❌ 常见问题排查

### 问题 1：邮件没有发送

**检查清单：**

```
☐ 1. Vercel 环境变量是否已保存？
   → Dashboard → Settings → Environment Variables
   → 能看到 MAIL_FROM 和 RESEND_API_KEY

☐ 2. 是否重新部署了应用？
   → Dashboard → Deployments
   → 最新部署状态是否为 "Ready" ✅

☐ 3. DNS 是否已验证？
   → Resend → Domains → 你的域名
   → 状态应为 "Verified" ✅

☐ 4. MAIL_FROM 格式是否正确？
   ✅ noreply@myday.com
   ❌ noreply@myday.com. (多了点)
   ❌ noreply@myday (少了顶级域)

☐ 5. RESEND_API_KEY 是否有效？
   → 应该以 sk_live_ 开头（生产）
   → 或 sk_test_ 开头（测试）
   → 不应该过期或被撤销
```

### 问题 2：Vercel 日志中出现错误

**常见错误信息：**

```
错误 1：Missing RESEND_API_KEY or MAIL_FROM
修复：检查 Vercel Environment Variables 中这两个变量是否存在

错误 2：Failed to send email: Unauthorized
修复：检查 RESEND_API_KEY 是否正确，是否有效期内

错误 3：Failed to send email: Invalid from address
修复：检查 MAIL_FROM 值：
    - 格式是否为 noreply@myday.com
    - 域名是否在 Resend 中已验证
    - 域名 DNS 是否完全同步
    
错误 4：Invalid recipient address
修复：检查收件人邮箱地址是否有效
```

### 问题 3：邮件被标记为垃圾

**改善方案：**

```
1. 检查 DNS 配置是否完整：
   Resend Dashboard → Domains → 你的域名
   ✅ MX Record - Verified
   ✅ SPF Record - Verified
   ✅ DKIM Record - Verified

2. 等待 DNS 全球同步（可能需要 24 小时）

3. 检查邮件内容：
   避免垃圾词汇：限时、免费、立即、点击
   使用专业语气
   
4. 从小规模开始测试：
   先发给自己的邮箱
   确认成功后才发给用户
```

---

## 📋 配置完成检查单

完成后，请检查：

```
✅ Vercel Environment Variables 中有 MAIL_FROM
✅ MAIL_FROM 值正确（格式：noreply@yourdomain.com）
✅ RESEND_API_KEY 存在且有效
✅ 已重新部署应用（Deployment 显示 Ready）
✅ Resend 中域名状态为 Verified
✅ DNS 记录已在域名注册商配置
✅ 测试邮件已成功发送
✅ 收到的邮件发件人为 noreply@yourdomain.com
```

---

## 🚀 下一步

现在你的邮件系统应该可以正常运行：

### 自动邮件（GitHub Actions）
```
每天：
08:05 上海时间 → automatic daily-digest
22:05 上海时间 → automatic evening-report
```

### 管理员测试
```
任何时间：
打开 AdminPanel → Email Testing → 点击按钮 → 立即发送测试邮件
```

### 用户邮件
```
生日邮件：
每年用户生日 → 自动发送生日祝福邮件

密码重置：
用户请求重置 → 立即发送验证码邮件
```

---

## 💾 参考信息

### 你的项目信息

```
项目名：my-schedule
Vercel 地址：https://my-schedule.vercel.app
GitHub 仓库：Jo-Nan/my-schedule
邮件：通过 Resend API 发送
```

### 关键文件

```
邮件发送代码：/api/_lib/email.js
邮件使用代码：/api/cron.js
管理面板：/src/components/AdminPanel.jsx
```

### 有用的 API 端点

```
获取邮件任务信息：GET /api/cron?action=tasks
测试早晨摘要：POST /api/cron?action=test-daily-digest
测试晚间报告：POST /api/cron?action=test-evening-report
测试生日祝福：POST /api/cron?action=test-birthday-greetings
```

---

**需要帮助？查看 DOMAIN_SETUP_GUIDE.md 中的更多详细信息！**
