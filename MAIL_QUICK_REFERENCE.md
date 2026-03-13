# 📧 快速参考：邮件配置三部曲

快速查看表，适合已经熟悉流程的人查阅。

---

## 📍 三个文档快速索引

| 文档 | 用途 | 适合人群 |
|------|------|---------|
| **[DOMAIN_SETUP_GUIDE.md](DOMAIN_SETUP_GUIDE.md)** | 💰 购买域名 + 配置 Resend | 第一次操作，需要详细步骤 |
| **[VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)** | 🔧 配置 Vercel 环境变量 | 已买好域名，需要部署 |
| **[MAIL_CONFIG_README.md](MAIL_CONFIG_README.md)** | 📧 代码原理说明 | 想理解邮件功能如何实现 |

---

## ⚡ 快速步骤（仅需 15-40 分钟）

### 第 1 步：购买域名（5 分钟）

```
选择注册商：
1️⃣ Namecheap (https://www.namecheap.com) - 推荐
2️⃣ 阿里云 (https://wanwang.aliyun.com) - 国内
3️⃣ PorkBun (https://porkbun.com) - 便宜

流程：
搜索域名 → 加入购物车 → 支付 ($8-15/年) → 完成
✅ 拥有域名：myday.com（或其他）
```

### 第 2 步：配置 Resend（10 分钟）

```
在 Resend Dashboard 中：

1. Domains → Add Domain
2. 输入你的域名（myday.com）
3. 复制 3 条 DNS 记录
4. 在域名注册商粘贴这些 DNS 记录
5. 等待 Resend 验证 (5-30 分钟)

✅ 域名状态：Verified ✅
```

### 第 3 步：配置 Vercel（5 分钟）

```
在 Vercel Dashboard 中：

1. Settings → Environment Variables
2. Add: MAIL_FROM = noreply@myday.com
3. 选择 Production, Preview, Development
4. Save
5. git push origin main（触发重新部署）

✅ 部署状态：Ready ✅
```

### 第 4 步：测试邮件（1 分钟）

```
在应用中：

1. 登录
2. 打开 AdminPanel（管理菜单）
3. 找到 "📧 Email Testing" 卡片
4. 点击任一按钮：
   - 📋 Test Daily Digest
   - 📊 Test Evening Report
   - 🎂 Test Birthday
5. 检查你的邮箱

✅ 邮件已收到！
```

---

## 📋 环境变量快速参考

### 需要设置的

```bash
# Vercel 环境变量（必填）
RESEND_API_KEY=sk_live_xxxxx...    # 从 https://resend.com/api-keys 获取
MAIL_FROM=noreply@myday.com        # 改成你购买的域名

# 可选
ADMIN_EMAIL=your-email@example.com # 默认是 nanqiao.ai@gmail.com
```

### 位置

```
Vercel Dashboard
  → my-schedule 项目
  → Settings
  → Environment Variables
  → [+ Add]
```

---

## 🔗 API 端点速查

### 邮件相关端点

```
GET /api/cron?action=tasks
  返回：任务列表和状态

POST /api/cron?action=daily-digest
  效果：发送早晨摘要给全部用户

POST /api/cron?action=evening-report
  效果：发送晚间报告给全部用户

POST /api/cron?action=birthday-greetings
  效果：发送生日祝福给有生日的用户

POST /api/cron?action=test-daily-digest
  效果：发送测试邮件给管理员（仅管理员可用）

POST /api/cron?action=test-evening-report
  效果：发送测试邮件给管理员（仅管理员可用）

POST /api/cron?action=test-birthday-greetings
  效果：发送测试邮件给管理员（仅管理员可用）
```

---

## ❓ 常见问题速查

### Q：使用 onboarding@resend.dev 可以吗？

A：✅ **暂时可以**（开发/测试），但邮件容易被标记为垃圾。
生产环境强烈建议配置自己的域名。

---

### Q：没有 API Key 怎么办？

A：访问 https://resend.com 注册，然后：
```
登录 → API Keys → Create API Key
选择 Environment: Production（重要！）
复制 sk_live_xxx... 的值
```

---

### Q：DNS 24 小时还没生效？

A：在 MXToolbox 检查：https://mxtoolbox.com/mxlookup.aspx
```
搜索你的域名 → 看 MX 记录是否已更新为 feedback-smtp.resend.com
已更新 → 有可能 Resend 还在验证，再等等
未更新 → 检查是否在域名注册商正确配置了 DNS
```

---

### Q：邮件被标记为垃圾邮件？

A：这通常是因为 DNS 配置不完整或未全球同步
```
解决方案：
1️⃣ 确保 3 条 DNS 记录都配置了：MX、SPF、DKIM
2️⃣ 等待 DNS 全球同步（最多 48 小时）
3️⃣ 在 Resend Dashboard 检查：Domains → [你的域名] → 所有项都是 Verified ✅
4️⃣ 试试用 Resend 的 "Verify Domain" 功能重新验证
```

---

### Q：想改回 onboarding@resend.dev？

A：在 Vercel 环境变量中删除 MAIL_FROM，重新部署即可

---

### Q：多个域名怎么处理？

A：在 Resend 中全部添加并验证，MAIL_FROM 设置为主域名即可

---

## 🚀 自动邮件时间表

部署完成后，应用会自动在以下时间发送邮件：

```
每天 08:05（上海时间）
  → 早晨摘要 (Daily Digest)
  → 发送给所有活跃用户

每天 22:05（上海时间）
  → 晚间报告 (Evening Report)
  → 发送给所有活跃用户

用户生日当天
  → 生日祝福
  → 发送给有生日的用户

用户操作时（实时）
  ├─ 请求重置密码 → 发送验证码
  └─ 提交消息给管理员 → 通知管理员
```

---

## 📁 文件清单

配置完成后，项目中会有这些邮件相关的文件：

```
/api/
  ├─ _lib/
  │  └─ email.js          👈 邮件核心库
  ├─ cron.js              👈 定时任务邮件
  ├─ auth.js              👈 密码重置邮件
  └─ messages.js          👈 管理员通知邮件

/src/components/
  └─ AdminPanel.jsx       👈 管理员测试 UI

根目录（指南文档）：
  ├─ DOMAIN_SETUP_GUIDE.md         👈 域名配置指南
  ├─ VERCEL_ENV_SETUP.md           👈 Vercel 配置指南
  ├─ MAIL_CONFIG_README.md         👈 代码原理说明
  └─ MAIL_QUICK_REFERENCE.md       👈 本文件
```

---

## ✅ 配置完成检查清单

```
购买域名：
☐ 花钱购买了 myday.com（或其他）
☐ 域名在注册商后台显示为"Active"

配置 Resend：
☐ 在 Resend 添加了域名
☐ 复制了 3 条 DNS 记录到域名注册商
☐ Resend Dashboard 显示域名 "Verified" ✅

配置 Vercel：
☐ 在 Environment Variables 中添加了 MAIL_FROM
☐ 推送了代码（git push origin main）
☐ Vercel 部署完成，状态为 "Ready" ✅

测试邮件：
☐ 登录应用成功
☐ 点击了 AdminPanel 中的邮件测试按钮
☐ 收到了测试邮件
☐ 邮件发件人是 noreply@yourdomain.com ✅
```

---

## 🎯 下一步建议

### 立即可用功能
```
✅ 管理员随时测试邮件
   AdminPanel → Email Testing → 点击按钮

✅ 用户密码重置
   forgot_password → 输入邮箱 → 接收验证码

✅ 管理员收不到用户消息通知？
   检查 .env 中的 ADMIN_EMAIL 是否正确
```

### 已经配置好后
```
✅ GitHub Actions 会自动在指定时间发送邮件
   08:05、22:05 自动触发

✅ 查看邮件日志
   Resend Dashboard → Emails → 查看完整历史

✅ 优化邮件内容
   编辑 /api/cron.js 中的邮件模板
```

---

## 📞 如果遇到问题

**最常见的错误和快速修复：**

| 错误 | 原因 | 修复 |
|------|------|------|
| "Missing RESEND_API_KEY" | 环境变量缺失 | 添加到 Vercel Environment Variables |
| "Invalid from address" | MAIL_FROM 格式错误 | 改成 noreply@yourdomain.com |
| "Failed to send email: Unauthorized" | API Key 失效 | 获取新的生产环境 API Key |
| 邮件进入垃圾邮件 | DNS 未完全同步 | 等待 24-48 小时，或重新验证域名 |
| Vercel 部署不成功 | 环境变量未正确保存 | 检查 Environment Variables，重新部署 |

---

## 📚 更多帮助

- **详细步骤图文版** → [DOMAIN_SETUP_GUIDE.md](DOMAIN_SETUP_GUIDE.md)
- **Vercel 配置步骤** → [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)
- **代码和原理解释** → [MAIL_CONFIG_README.md](MAIL_CONFIG_README.md)
- **Resend 官方文档** → https://resend.com/docs
- **Vercel 官方文档** → https://vercel.com/docs

---

**祝配置顺利！有问题随时查阅对应的详细文档。** 🚀
