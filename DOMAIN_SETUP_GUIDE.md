# 📧 域名申请 & Resend 邮件配置完整指南

配置自己的域名用于发送邮件，让你的应用更专业。总共需要 15-40 分钟。

---

## 📋 目录
1. [第一步：购买域名](#第一步购买域名)
2. [第二步：配置 Resend](#第二步配置-resend)
3. [第三步：配置 Vercel 环境变量](#第三步配置-vercel-环境变量)
4. [第四步：测试邮件](#第四步测试邮件)
5. [常见问题](#常见问题)

---

## 第一步：购买域名

### 🌐 选择域名注册商

推荐按优先级：

#### **推荐 1️⃣：Namecheap**
- 地址：https://www.namecheap.com
- 💚 优点：便宜（$8.88/年起）、有中文支持、界面清晰
- 💳 支付方式：信用卡、支付宝

#### **推荐 2️⃣：阿里云**
- 地址：https://wanwang.aliyun.com
- 💚 优点：国内服务、支付宝、DNS 配置简单
- 💳 支付方式：支付宝、银行卡

#### **推荐 3️⃣：PorkBun**
- 地址：https://porkbun.com
- 💚 优点：便宜、靠谱、支持支付宝
- 💳 支付方式：支付宝、信用卡

---

### 🔍 购买域名步骤（以 Namecheap 为例）

#### **步骤 1：搜索域名**
```
1. 访问 https://www.namecheap.com
2. 在顶部搜索框输入你想要的域名
   例如：myday.com, dayplanner.com, myplan.io
3. 点击搜索
```

**截图示意：**
```
┌─────────────────────────────────────┐
│  Namecheap 主页                      │
├─────────────────────────────────────┤
│ [搜索框: myday.com          ]  [搜索] │
└─────────────────────────────────────┘
```

#### **步骤 2：选择域名**
```
搜索结果页面：
✅ myday.com           $8.88/年   [加入购物车]
❌ myday.io            $49.99/年  (太贵)
❌ myday.cn            $10.40/年  (中文域名可选)
```

💡 **域名选择建议：**
- ✅ `.com` - 最通用，信任度最高
- ✅ `.io` - 科技感，但贵一些
- ✅ `.co` - 简洁，价格中等
- ✅ `.app` - 现代，面向应用
- ⚠️ `.xyz` - 便宜但看起来不专业

**推荐选择：**
```
myday.com          ← 最好，通用
dayplanner.app     ← 次选，现代
myplan.io          ← 可选，科技感
```

#### **步骤 3：加入购物车和结账**
```
1. 点击 "Add to Cart"
2. 右上角点击购物车图标
3. 点击 "Checkout"
4. 登录或创建账户（用 GitHub/Google 最快）
5. 选择年限（1 年就够，可以续费）
6. 选择附加服务：
   ❌ 不需要 Privacy Protection
   ❌ 不需要 Extra Features
7. 填写支付信息
8. 点击 "Complete Order"
```

**结账画面：**
```
┌─────────────────────────────┐
│ 购物车                      │
├─────────────────────────────┤
│ myday.com (1年)  $8.88     │
│ 隐私保护         ❌ OFF    │
│                            │
│ 小计：           $8.88     │
│ 税费：           $0.00     │
├─────────────────────────────┤
│ 总计：           $8.88     │
│                            │
│ [完成订单]                  │
└─────────────────────────────┘
```

#### **步骤 4：确认购买成功**
```
✅ 收到邮件确认
✅ Namecheap 账户可以看到"Active Domains"
✅ 域名现在是你的了！
```

---

### 👏 恭喜！你现在拥有自己的域名了

现在进行 **第二步：配置 Resend**

---

## 第二步：配置 Resend

### 🔑 前提条件
- ✅ 有 Resend 账户（在 https://resend.com 注册）
- ✅ 有 Resend API Key (生产环境 `sk_live_...`)
- ✅ 购买了域名（例如：myday.com）

### 📝 配置步骤

#### **步骤 1：访问 Resend 控制台**
```
1. 登录 https://resend.com/dashboard
2. 左侧菜单 → "Domains"
3. 点击 "+ Add Domain"
```

**Resend 控制台截图：**
```
┌──────────────────────────────┐
│ Resend Dashboard             │
├──────────────────────────────┤
│ 左侧菜单：                    │
│ • Dashboard                  │
│ • Emails                      │
│ • Domains          ← 点这里   │
│ • API Keys                    │
│                              │
│ 右侧：Domains                │
│ [+ Add Domain]               │
└──────────────────────────────┘
```

#### **步骤 2：输入你的域名**
```
弹窗：Add Domain
┌────────────────────────────┐
│ Domain Name                │
│ [myday.com              ]  │
│                            │
│ [Cancel]  [Add Domain]     │
└────────────────────────────┘
```

**输入你的域名（不要加 www 或 https）：**
```
✅ myday.com
❌ www.myday.com
❌ https://myday.com
```

#### **步骤 3：复制 DNS 记录**
```
Resend 会显示 3 条 DNS 记录，例如：

记录 1：
Type:  MX
Host:  myday.com
Value: feedback-smtp.resend.com
Priority: 10

记录 2：
Type:  TXT
Host:  myday.com
Value: v=spf1 resend.com ~all

记录 3：
Type:  CNAME
Host:  default._domainkey.myday.com
Value: default.resend.domains

⚠️ 重要：复制这些值！
```

**Resend 控制台显示：**
```
┌────────────────────────────────────┐
│ Add the following DNS records to   │
│ your domain provider               │
├────────────────────────────────────┤
│ Type │ Host    │ Value             │
├──────┼─────────┼──────────────────┤
│ MX   │ @       │ feedback-smtp... │
│ TX   │ @       │ v=spf1 resend... │
│ CNAME│ default │ default.resend.. │
│      │ ._doma  │                  │
│      │ inkey   │                  │
│                                   │
│ [复制全部] ← 点这个               │
└────────────────────────────────────┘
```

#### **步骤 4：在域名注册商配置 DNS**

**以 Namecheap 为例：**

```
1. 登录 Namecheap 账户
2. 点击 "Domain List"
3. 找到 myday.com，点击 "Manage"
4. 找到 "Nameservers" 或 "DNS"
```

**Namecheap 后台截图：**
```
┌─────────────────────────────────┐
│ Manage myday.com                │
├─────────────────────────────────┤
│ Tabs:                           │
│ • Domain                         │
│ • Nameservers      ← 点这里      │
│ • Advanced DNS                   │
│ • Redirect                       │
│                                 │
│ Nameserver Setup:               │
│ ○ Namecheap Default             │
│ ● Custom Nameservers            │
│   [输入框1][输入框2][输入框3]    │
└─────────────────────────────────┘
```

```
❌ 如果用 "Custom Nameservers"，会很复杂
✅ 推荐用 "Advanced DNS" 方式：

1. 点击 "Advanced DNS"
2. 找到 "Host Records" 部分
3. 删除现有的 DNS 记录（可选）
4. 添加 Resend 提供的 3 条记录
```

**添加 DNS 记录详细步骤：**

```
┌──────────────────────────────────┐
│ Advanced DNS                     │
├──────────────────────────────────┤
│ [+ Add Record]                   │
│                                  │
│ 现有记录：                        │
│ Type:A    Host:@   Value:1.2.3.4│ [删除]
│                                  │
└──────────────────────────────────┘

操作：
1. 删除旧的 A Record（如果有）
2. 点击 [+ Add Record]
3. 添加 MX 记录：
   Type: MX
   Host: @
   Value: feedback-smtp.resend.com
   Priority: 10
   
4. 再点 [+ Add Record]
5. 添加 TXT 记录：
   Type: TXT
   Host: @
   Value: v=spf1 resend.com ~all
   
6. 再点 [+ Add Record]
7. 添加 CNAME 记录：
   Type: CNAME
   Host: default._domainkey
   Value: default.resend.domains
```

**各项字段说明：**

| 字段 | 说明 | 例子 |
|------|------|------|
| Type | DNS 记录类型 | MX, TXT, CNAME |
| Host | 子域名 | @（表示根域名） |
| Value | 目标地址 | feedback-smtp.resend.com |
| Priority | MX 优先级（只有 MX） | 10 |

#### **步骤 5：等待 DNS 生效**
```
⏱️ DNS 生效时间：5-30 分钟（通常 10 分钟左右）

期间：
✅ 保持 Resend 页面打开
✅ 不要关闭或刷新
✅ Resend 会自动检测 DNS

📊 你会看到：
验证中... ⏳
(过几分钟)
验证成功 ✅ (绿色勾号)
```

**验证成功的样子：**
```
┌────────────────────────────────┐
│ Domains                        │
├────────────────────────────────┤
│ myday.com              ✅      │
│ Status: Verified              │
│ Created: Just now             │
│                               │
│ Actions:                      │
│ [设为默认] [查看] [删除]      │
└────────────────────────────────┘
```

---

## 第三步：配置 Vercel 环境变量

### 📝 获取必要的信息

#### 你需要：
1. **RESEND_API_KEY** - Resend 的 API 密钥
   - 从 https://resend.com/api-keys 复制
   - 格式：`sk_live_xxx...`

2. **MAIL_FROM** - 你的发件人邮箱
   - 使用刚刚配置的域名
   - 格式：`noreply@myday.com` 或 `no-reply@myday.com`

### 🔧 在 Vercel 配置

#### **步骤 1：打开 Vercel 项目设置**
```
1. 登录 https://vercel.com/dashboard
2. 找到 "my-schedule" 项目
3. 点击进入项目
4. 点击 "Settings" 标签
5. 左侧菜单 → "Environment Variables"
```

**Vercel 控制台截图：**
```
┌───────────────────────────────┐
│ my-schedule Settings          │
├───────────────────────────────┤
│ Environment                   │
│ Domains                       │
│ Environment Variables ← 点这里│
│ Integrations                  │
│ Webhooks                      │
│                               │
│ 右侧内容：                    │
│ Environment Variables         │
│ [+ Add]                       │
│                               │
│ 现有变量：                    │
│ RESEND_API_KEY                │
│ MAIL_FROM                     │
│ ...                           │
└───────────────────────────────┘
```

#### **步骤 2：添加或更新环境变量**

**添加 MAIL_FROM**
```
1. 点击 [+ Add]
2. 输入变量信息：

   Key:      MAIL_FROM
   Value:    noreply@myday.com
   
   选择环境：
   ☑ Production 
   ☑ Preview
   ☑ Development
   
3. 点击 [Save]
```

**截图：**
```
┌────────────────────────────────┐
│ Add Environment Variable       │
├────────────────────────────────┤
│ Key: [MAIL_FROM          ]     │
│ Value: [noreply@myday.com]     │
│                                │
│ 环境选择：                      │
│ ☑ Production                  │
│ ☑ Preview                     │
│ ☑ Development                 │
│                                │
│ [Cancel]  [Save]              │
└────────────────────────────────┘
```

**更新 RESEND_API_KEY（如果还没有）**
```
1. 如果已有 RESEND_API_KEY，点击编辑按钮
2. 确认格式是 sk_live_... (生产环境)
3. 点击 [Save]
```

#### **步骤 3：确认变量已保存**
```
✅ 变量列表中能看到：
   MAIL_FROM=noreply@myday.com
   RESEND_API_KEY=sk_live_xxx...
   
⚠️ 重要：变量生效需要重新部署
```

#### **步骤 4：触发重新部署**
```
方式 1（推荐）：推送代码更改到 GitHub
   $ git commit --allow-empty -m "trigger redeploy"
   $ git push origin main
   
方式 2：在 Vercel 手动重新部署
   Vercel 控制台 → Deployments → [最新部署] → 
   点击 "..." → "Redeploy"

等待部署完成（通常 1-2 分钟）
✅ 看到 "Ready" 状态
```

---

## 第四步：测试邮件

### 🧪 使用管理员测试端点

#### **测试方式 1：在 AdminPanel 中点击按钮**

```
1. 登录到应用
2. 打开管理面板
3. 找到 "📧 Email Testing" 卡片
4. 点击以下任一按钮：
   - 📋 Test Daily Digest
   - 📊 Test Evening Report
   - 🎂 Test Birthday
```

**管理面板截图：**
```
┌────────────────────────────┐
│ AdminPanel                 │
├────────────────────────────┤
│ 📧 Email Testing           │
│                            │
│ [📋 Test Daily Digest]     │
│ [📊 Test Evening Report]   │
│ [🎂 Test Birthday]         │
└────────────────────────────┘
```

#### **测试方式 2：使用 curl 命令**

```bash
# 测试早晨摘要
curl -X POST \
  https://my-schedule.vercel.app/api/cron?action=test-daily-digest \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"

# 测试晚间报告
curl -X POST \
  https://my-schedule.vercel.app/api/cron?action=test-evening-report \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"

# 测试生日祝福
curl -X POST \
  https://my-schedule.vercel.app/api/cron?action=test-birthday-greetings \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### ✅ 验证邮件发送成功

```
发送后应该看到：
✅ "Test daily digest sent to admin"
✅ 邮件立即显示在你的收件箱
✅ 发件人显示为：noreply@myday.com
```

**检查收到的邮件：**

```
From: noreply@myday.com
To: admin@example.com
Subject: [测试] 📋 今日简报 - 2026-03-13 | 0/0 已完成

内容：
╔════════════════════════════╗
║    亲爱的用户，早上好！ 📅 ║
╚════════════════════════════╝
📋 【今日任务统计】
...
```

### 🔧 如果没有收到邮件

**排查步骤：**

```
1. 检查垃圾邮件/隔离邮件文件夹
   → Gmail 的 Promotions、Spam 标签页
   → Outlook 的 Junk Email 文件夹

2. 检查 Vercel 日志
   Vercel Dashboard → [项目] → Deployments → 
   [最新部署] → Logs → 搜索 "email" 或 "sendEmail"
   
3. 检查环境变量
   ✅ MAIL_FROM 是否正确格式：noreply@myday.com
   ✅ RESEND_API_KEY 是否是生产环境的（sk_live_）
   
4. 检查 Resend 日志
   Resend Dashboard → Emails → 查看发送历史
   
5. 检查 DNS 配置
   Resend Dashboard → Domains → [你的域名]
   状态应该是 "Verified" ✅
```

---

## 常见问题

### Q1：DNS 一直显示 "Verifying"，过了 30 分钟还没成功？

**可能原因 1：DNS 记录输入错误**
```
检查步骤：
1. 回到 Resend → Domains → [你的域名]
2. 逐行检查 DNS 记录值，看有没有多余空格
3. 在你的域名注册商确认记录是否完全相同

常见错误：
❌ feedback-smtp.resend.com_ (多了 _)
❌ v=spf1 resend.com ~all  (多了空格)
✅ feedback-smtp.resend.com (完全匹配)
```

**可能原因 2：DNS 还在传播**
```
DNS 全球传播可能需要 24-48 小时
但通常 10-30 分钟就会生效

临时解决方案：
1. 换个浏览器重新刷新 Resend 页面
2. 清空浏览器历史记录和缓存
3. 用 DNS 检查工具验证：
   https://mxtoolbox.com/mxlookup.aspx
   输入你的域名，检查 MX 记录是否已更新
```

### Q2：邮件被标记为垃圾邮件怎么办？

**通常原因：DNS 配置不完整**
```
确保已配置这 3 条记录：
✅ MX 记录
✅ SPF 记录 (TXT)
✅ DKIM 记录 (CNAME)

如果缺少任何一条，邮件容易被过滤
```

**改善送达率：**
```
1. 确保 DKIM、SPF、DMARC 都已配置
2. 使用 Resend 的 "Verify Domain" 功能
3. 避免使用垃圾邮件敏感词：
   ❌ 免费、限时、立即行动
   ✅ 你的任务摘要、日程提醒

4. 邮件内容要简洁、有价值
   避免大量链接、图片、HTML 复杂格式
```

### Q3：想改回 onboarding@resend.dev 怎么办？

```
在 Vercel 环境变量中删除 MAIL_FROM：
1. Vercel Dashboard → Settings → Environment Variables
2. 找到 MAIL_FROM，点击删除
3. 重新部署
4. 代码会自动使用 onboarding@resend.dev

（或改成其他值，只需重新部署）
```

### Q4：多个域名（如 myday.com 和 myplan.io）怎么用？

```
在 Resend 中都添加并验证两个域名，然后：

选项 1：设置主域名
MAIL_FROM=noreply@myday.com （主要）

选项 2：在代码中切换
// 在 email.js 中添加逻辑
const fromEmail = process.env.MAIL_FROM || 
  `noreply@${process.env.PRIMARY_DOMAIN}`;
```

### Q5：域名续费价格会很贵吗？

```
通常会更便宜：
购买年：$8.88（一般优惠价）
续费年：$10.99 - $15.99（正常价格）

比较便宜的注册商续费也不会超过 $20/年

如果太贵，可以：
- 转移到其他注册商（可以转移服务）
- 多年续费可能有折扣
```

---

## 📊 配置完成检查清单

在继续之前，确保你已完成：

```
第一步：购买域名
☐ 从注册商购买了域名（如 myday.com）
☐ 能在注册商后台看到"Active"或"Active Domains"
☐ 记下了域名（待会需要用）

第二步：配置 Resend
☐ 在 Resend Dashboard 添加了域名
☐ 复制了 Resend 提供的 3 条 DNS 记录
☐ 在域名注册商的 DNS 设置中添加了这些记录
☐ Resend 显示域名 "Verified" ✅（绿色）

第三步：配置 Vercel
☐ 在 Vercel 项目中设置了 MAIL_FROM 环境变量
☐ MAIL_FROM 的值格式正确（noreply@myday.com）
☐ 触发了重新部署
☐ Vercel 显示部署成功 "Ready" ✅

第四步：测试
☐ 使用管理员面板测试了至少一封邮件
☐ 邮件成功发送到你的邮箱
☐ 邮件发件人显示为 noreply@myday.com
☐ 邮件内容正确显示
```

---

## 🎉 完成！

一旦全部配置完成，你就可以：

```
✅ 日常自动发送邮件（GitHub Actions）
   08:05 → 发送早晨摘要
   22:05 → 发送晚间报告
   
✅ 管理员随时测试邮件
   在 AdminPanel 点击按钮即时测试

✅ 用户邮件来自你的专业域名
   From: noreply@myday.com
   提升应用专业度和用户信任
```

---

## 📞 遇到问题？

如果配置过程中遇到任何问题，保存以下信息：

```
记录下来：
- 你购买的域名：_________________
- 使用的注册商：_________________
- Resend 中验证的状态：___ Verified
- 邮件测试是否成功：___ Yes / No
- 收到的错误信息：_________________
```

这样我可以更快地帮你排查问题！

---

**祝配置顺利！🚀**
