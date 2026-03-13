# 📧 邮件配置代码说明

这个文档说明你的应用代码中已经支持的邮件配置，以及如何使用。

---

## 🏗️ 代码架构

### 邮件发送模块

```
┌─────────────────────────────────────┐
│  应用代码                            │
├─────────────────────────────────────┤
│  • /api/cron.js - 定时任务          │
│  • /api/auth.js - 注册、密码重置    │
│  • /api/messages.js - 用户消息     │
└─────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────┐
│  /api/_lib/email.js                 │
│  邮件发送核心库                      │
├─────────────────────────────────────┤
│  • sendEmail() - 通用邮件发送       │
│  • sendResetCodeEmail() - 密码重置 │
│  • sendBirthdayGreetingEmail()     │
│  • sendAdminNotificationEmail()    │
└─────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────┐
│  Resend API                         │
│  https://api.resend.com/emails      │
└─────────────────────────────────────┘
```

---

## 🔧 环境变量配置

### 必需的环境变量

在 Vercel（或本地 .env.local）中需要设置：

```bash
# Resend API 密钥（必需）
RESEND_API_KEY=sk_live_xxxxx...  # 生产环境
# 或
RESEND_API_KEY=sk_test_xxxxx...  # 测试环境

# 发件人邮箱地址（必需，选其一）
MAIL_FROM=noreply@yourdomain.com
# 或
RESEND_FROM=noreply@yourdomain.com

# 管理员邮箱（可选，默认为 nanqiao.ai@gmail.com）
ADMIN_EMAIL=your-admin@example.com
```

### 优先级

代码中的优先级：
```javascript
// /api/_lib/email.js
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.MAIL_FROM || process.env.RESEND_FROM;
const adminEmail = process.env.ADMIN_EMAIL || 'nanqiao.ai@gmail.com';
```

**决策树：**
```
发件人地址选择：
  如果 MAIL_FROM 存在？
    → 使用 MAIL_FROM
  否则，如果 RESEND_FROM 存在？
    → 使用 RESEND_FROM
  否则？
    → 错误：Missing MAIL_FROM

管理员邮箱选择：
  如果 ADMIN_EMAIL 存在？
    → 使用 ADMIN_EMAIL
  否则？
    → 使用默认 nanqiao.ai@gmail.com
```

---

## 📮 邮件发送函数

### 1. `sendEmail()` - 核心发送函数

```javascript
// 位置：/api/_lib/email.js
// 作用：通过 Resend API 发送单个邮件

const sendEmail = async ({ to, subject, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MAIL_FROM || process.env.RESEND_FROM;
  
  // 验证环境变量
  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      skipped: true,
      reason: 'Missing RESEND_API_KEY or MAIL_FROM',
    };
  }
  
  // 调用 Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });
  
  // 返回结果
  return {
    sent: true,
    skipped: false,
    id: result.id,
  };
};
```

**参数：**

| 参数 | 类型 | 说明 | 例子 |
|------|------|------|------|
| `to` | string/array | 收件人邮箱 | user@example.com 或 [user1@, user2@] |
| `subject` | string | 邮件主题 | "Your Daily Digest" |
| `text` | string | 邮件内容（纯文本） | "Here's your summary..." |

**返回值：**

```javascript
// 发送成功
{
  sent: true,
  skipped: false,
  id: "email_abc123"  // Resend 的邮件 ID
}

// 环境变量缺失
{
  sent: false,
  skipped: true,
  reason: "Missing RESEND_API_KEY or MAIL_FROM"
}

// 发送失败
{
  sent: false,
  skipped: false,
  error: "Failed to send email: ..."
}
```

### 2. `sendResetCodeEmail()` - 密码重置

```javascript
// 用途：发送密码重置验证码

export const sendResetCodeEmail = async ({ email, code }) => {
  return sendEmail({
    to: email,
    subject: 'Day 密码重置验证码',
    text: `
你正在重置 Day 账号密码。

验证码: ${code}
验证码 10 分钟内有效。
如果不是你本人操作，请忽略此邮件。
    `,
  });
};
```

**在哪里使用：**
- `/api/auth.js` - 用户请求密码重置时

### 3. `sendBirthdayGreetingEmail()` - 生日祝福

```javascript
// 用途：发送生日祝福邮件

export const sendBirthdayGreetingEmail = async ({ 
  email, 
  username 
}) => {
  const displayName = username || '朋友';
  return sendEmail({
    to: email,
    subject: '生日快乐！',
    text: `
${displayName}，生日快乐！

祝你今天开心顺利，计划都能如愿完成。
愿新的一岁平安、健康、灵感满满。

— Day
    `,
  });
};
```

**在哪里使用：**
- `/api/cron.js` - 每天检查生日用户并发送祝福

### 4. `sendAdminNotificationEmail()` - 管理员通知

```javascript
// 用途：有新用户消息时通知管理员

export const sendAdminNotificationEmail = async ({
  userEmail,
  username,
  content,
  createdAt,
}) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'nanqiao.ai@gmail.com';
  
  return sendEmail({
    to: adminEmail,
    subject: `Day 用户消息通知 - ${userEmail}`,
    text: `
你收到一条新的用户消息。

用户邮箱: ${userEmail}
用户名: ${username || '未填写'}
发送时间: ${createdAt}

消息内容:
${content}
    `,
  });
};
```

**在哪里使用：**
- `/api/messages.js` - 用户提交消息时

---

## 🚀 在应用中使用邮件功能

### 使用场景 1：定时任务发送（cron.js）

```javascript
// /api/cron.js - 接收 POST 请求并发送邮件给所有用户

if (action === 'daily-digest' && req.method === 'POST') {
  const store = await ensureDataStore();
  
  for (const user of store.users) {
    if (user.isActive === false) continue;
    
    // 构建邮件内容
    const subject = `📋 今日简报 - ${today}`;
    const text = `任务统计...`;
    
    try {
      // 发送邮件
      const result = await sendEmail({ 
        to: user.email, 
        subject, 
        text 
      });
      
      if (result.sent) {
        sent.push(user.email);
      } else {
        failed.push({ email: user.email, error: result.reason });
      }
    } catch (err) {
      failed.push({ email: user.email, error: err.message });
    }
  }
  
  return res.status(200).json({ 
    status: 'success', 
    sent, 
    failed 
  });
}
```

### 使用场景 2：测试邮件发送（管理员）

```javascript
// /api/cron.js - 接收 POST 请求发送测试邮件给管理员

if (action === 'test-daily-digest' && req.method === 'POST') {
  const auth = await getAuthenticatedUser(req);
  if (!auth || auth.user.role !== 'admin') {
    return res.status(403).json({ 
      status: 'error', 
      message: 'Admin access required' 
    });
  }
  
  const adminEmail = auth.user.email;
  const subject = '[测试] 📋 今日简报';
  const text = `...`;
  
  try {
    const result = await sendEmail({ 
      to: adminEmail, 
      subject, 
      text 
    });
    
    return res.status(200).json({
      status: 'success',
      sent: result.sent ? [adminEmail] : [],
      failed: result.sent ? [] : [{ email: adminEmail }],
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
}
```

---

## 📊 邮件类型和时机

### 自动邮件（无需用户操作）

| 邮件类型 | 触发条件 | 时间 | 收件人 | 备注 |
|---------|---------|------|--------|------|
| **早晨摘要** | GitHub Actions cron | 每天 08:05 | 所有活跃用户 | 任务统计 + 即将截止 |
| **晚间报告** | GitHub Actions cron | 每天 22:05 | 所有活跃用户 | 完成情况 + 明日预告 |
| **生日祝福** | daily-digest 任务 | 用户生日那天 | 生日用户 | 一年一次 |

### 主动邮件（用户操作触发）

| 邮件类型 | 触发条件 | 收件人 | 备注 |
|---------|---------|--------|------|
| **密码重置码** | 用户请求重置密码 | 用户邮箱 | 有效期 10 分钟 |
| **管理员通知** | 用户提交消息 | 管理员邮箱 | 用户消息内容 |

### 测试邮件（管理员功能）

| 邮件类型 | 触发方式 | 收件人 | 用途 |
|---------|---------|--------|------|
| **测试早晨摘要** | POST /api/cron?action=test-daily-digest | 管理员邮箱 | 验证邮件格式 |
| **测试晚间报告** | POST /api/cron?action=test-evening-report | 管理员邮箱 | 验证邮件格式 |
| **测试生日祝福** | POST /api/cron?action=test-birthday-greetings | 管理员邮箱 | 验证邮件格式 |

---

## 🔍 如何调试邮件发送

### 检查点 1：环境变量是否设置

**本地测试（.env.local）：**
```bash
# .env.local 中应该有
RESEND_API_KEY=sk_live_xxxxx...
MAIL_FROM=noreply@yourdomain.com
```

**Vercel 生产环境：**
```
Dashboard → Settings → Environment Variables
应该看到：
✅ RESEND_API_KEY
✅ MAIL_FROM
```

### 检查点 2：查看函数日志

**在 Vercel 日志中查看：**
```
Dashboard → Deployments → [latest] → Function Logs

搜索关键词：
- "sendEmail"
- "Failed to send email"
- "RESEND_API_KEY"
- "MAIL_FROM"
```

**常见的日志输出：**
```
// 成功
✅ Email sent: email_abc123

// 失败 - 缺少环境变量
❌ Missing RESEND_API_KEY or MAIL_FROM

// 失败 - API 错误
❌ Failed to send email: Unauthorized
❌ Failed to send email: Invalid from address

// 成功但被跳过
⏭️ Email skipped: reason...
```

### 检查点 3：在 Resend Dashboard 中查看

**访问：** https://resend.com/dashboard

**路径：** Emails → 查看发送历史

**可以看到的信息：**
```
Timestamp: 2026-03-13 08:05:00
From: noreply@myday.com
To: user@example.com
Subject: 📋 今日简报
Status: Sent ✅
ID: email_abc123
```

### 检查点 4：测试收件箱

**检查各个邮箱的文件夹：**
```
Gmail：
  ✅ 查看 Inbox（收件箱）
  ⚠️ 查看 Promotions（促销）
  ⚠️ 查看 Spam（垃圾邮件）
  ⚠️ 查看 Quarantine（隔离）

Outlook：
  ✅ 查看 Inbox（收件箱）
  ⚠️ 查看 Junk（垃圾）
  ⚠️ 查看 Phishing（网络诈骗）
```

---

## 🧪 本地测试邮件（可选）

如果想在本地开发时测试邮件发送：

### 方式 1：在本地 .env.local 中设置

```bash
# .env.local（这个文件已经存在）
RESEND_API_KEY=sk_test_xxxxxxx...  # 使用测试 API key
MAIL_FROM=onboarding@resend.dev     # 或你的域名
```

### 方式 2：直接调用 API 进行测试

```bash
# 使用 curl 测试
curl -X POST \
  http://localhost:3000/api/cron?action=test-daily-digest \
  -H "Content-Type: application/json" \
  -H "Cookie: nanmuz_session=<你的会话token>"

# 或使用 fetch
fetch('http://localhost:3000/api/cron?action=test-daily-digest', {
  method: 'POST',
  credentials: 'include'  // 自动包含 cookie
})
.then(r => r.json())
.then(console.log)
```

### 方式 3：使用 Resend 的测试工具

```
Resend Dashboard → "Send Test Email"
帮助快速测试邮件发送效果
```

---

## 📝 代码中的关键位置

### 邮件发送核心

```
/api/_lib/email.js          ← 所有邮件函数定义
  ├─ sendEmail()            ← 核心发送函数
  ├─ sendResetCodeEmail()
  ├─ sendBirthdayGreetingEmail()
  └─ sendAdminNotificationEmail()
```

### 邮件使用位置

```
/api/cron.js                ← 定时邮件
  ├─ daily-digest
  ├─ evening-report
  ├─ birthday-greetings
  ├─ test-daily-digest
  ├─ test-evening-report
  └─ test-birthday-greetings

/api/auth.js                ← 密码重置邮件
  └─ request-password-reset

/api/messages.js            ← 管理员通知邮件
  └─ create message → sendAdminNotificationEmail()
```

### 管理员测试 UI

```
/src/components/AdminPanel.jsx
  ├─ handleTestEmailTrigger()     ← 测试邮件处理函数
  └─ Email Testing 卡片            ← UI 展示
```

---

## ✅ 配置检查清单

在正式使用前，确保：

```
代码方面：
☐ /api/_lib/email.js 中有 sendEmail() 函数
☐ /api/cron.js 中调用了 sendEmail()
☐ /api/auth.js 中调用了 sendResetCodeEmail()
☐ /src/components/AdminPanel.jsx 中有测试按钮

环境变量：
☐ Vercel → Settings → Environment Variables 中有：
   ☐ RESEND_API_KEY (sk_live_xxx...)
   ☐ MAIL_FROM (noreply@yourdomain.com)
☐ （可选）ADMIN_EMAIL

配置验证：
☐ 在 Resend Dashboard 中验证域名 (Verified ✅)
☐ DNS 记录已在域名注册商配置完成
☐ Vercel 部署已完成（Deployment: Ready ✅）
```

---

## 🚀 快速开始

### 最小化配置步骤

```
1. 获取 Resend API Key
   → https://resend.com/api-keys
   → 复制 sk_live_xxx...

2. 购买域名（如 myday.com）
   → https://www.namecheap.com

3. 在 Resend 中认证域名
   → Resend Dashboard → Domains → Add Domain
   → 按照步骤配置 DNS

4. 在 Vercel 中设置环境变量
   → Settings → Environment Variables
   → RESEND_API_KEY = sk_live_xxx...
   → MAIL_FROM = noreply@myday.com

5. 重新部署应用
   → git push origin main
   → 等待 Vercel 部署完成

6. 测试邮件
   → 登录应用，打开 AdminPanel
   → 点击 "Test Daily Digest"
   → 检查邮件是否收到
```

---

**更多详情请查看：**
- 🌐 **[DOMAIN_SETUP_GUIDE.md](DOMAIN_SETUP_GUIDE.md)** - 完整的域名和 Resend 配置指南
- 🔧 **[VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md)** - Vercel 环境变量配置指南
