# Mail And Cron Setup

这部分需要人工配置，代码本身不能替你完成。

原因很简单：

- `RESEND_API_KEY` 是私密凭证，必须由你在平台后台手动填写
- `MAIL_FROM` / `RESEND_FROM` 必须使用你自己在 Resend 中验证过的发件地址
- GitHub Actions 的 `APP_URL` 也必须由你手动指定为真实线上地址

## 现在系统怎么判断发件人

代码会按这个顺序读取发件邮箱：

1. `MAIL_FROM`
2. `RESEND_FROM`

也就是说，推荐你只配置：

```bash
MAIL_FROM=noreply@your-domain.com
```

发邮件代码位置：

- [api/_lib/email.js](/Users/muzinan/NanMuZ/Code/day/api/_lib/email.js)

## 你需要配置的项目

### 1. Resend

你需要先在 Resend 配好：

- 一个可用账号
- 一个已验证域名，或者已验证发件邮箱
- 一个 API Key

建议使用你自己的域名，例如：

```bash
noreply@your-domain.com
```

## 2. Vercel 环境变量

打开你的 Vercel 项目后台，配置这些变量：

```bash
RESEND_API_KEY=你的_resend_api_key
MAIL_FROM=noreply@你的域名.com
```

可选：

```bash
RESEND_FROM=noreply@你的域名.com
```

但如果你已经配了 `MAIL_FROM`，通常不需要再配 `RESEND_FROM`。

### 推荐配置

```bash
RESEND_API_KEY=...
MAIL_FROM=noreply@your-domain.com
GITHUB_TOKEN=...
GITHUB_OWNER=Jo-Nan
GITHUB_REPO=day-data
GITHUB_BRANCH=main
```

### 多用户数据存储变量

如果你想明确写全，也可以在 Vercel 里补上：

```bash
GITHUB_USERS_PATH=data/users.json
GITHUB_USER_PLANS_PATH=data/plans-by-user.json
GITHUB_SNAPSHOTS_PATH=data/plan-snapshots.json
GITHUB_MESSAGES_PATH=data/messages.json
GITHUB_PLANS_PATH=data/plans.json
```

其中：

- 前四个是当前多用户系统真正使用的数据文件
- `GITHUB_PLANS_PATH` 主要是给旧数据兼容和备份脚本使用

## 3. GitHub Actions Secrets

打开 GitHub 仓库后台，进入：

`Settings -> Secrets and variables -> Actions`

至少要配置：

```bash
APP_URL=https://你的线上域名
```

例如：

```bash
APP_URL=https://myday.com
```

不要带最后的 `/`，也不要写成某个具体页面路径。

原因：

- 每日邮件工作流会调用：
  - `POST ${APP_URL}/api/cron?action=daily-digest`
  - `POST ${APP_URL}/api/cron?action=evening-report`

如果 `APP_URL` 不对，定时邮件就不会自动发出。

## 配置步骤

### 步骤 1：在 Resend 获取 API Key

1. 登录 Resend
2. 进入 API Keys
3. 创建一个新的 API Key
4. 复制保存

### 步骤 2：在 Resend 验证发件域名

1. 进入 Domains
2. 添加你的域名
3. 按提示去域名解析平台添加 DNS 记录
4. 等待验证成功
5. 决定你的发件地址，例如：
   `noreply@your-domain.com`

### 步骤 3：配置 Vercel 环境变量

在 Vercel 项目里添加：

```bash
RESEND_API_KEY=...
MAIL_FROM=noreply@your-domain.com
```

如果项目还没有 GitHub 数据源变量，也一起补上：

```bash
GITHUB_TOKEN=...
GITHUB_OWNER=Jo-Nan
GITHUB_REPO=day-data
GITHUB_BRANCH=main
```

### 步骤 4：重新部署

环境变量改完后，要重新部署才能生效。

你可以用任意一种方式：

```bash
git commit --allow-empty -m "chore: apply mail env"
git push
```

或者直接在 Vercel 后台点击重新部署。

### 步骤 5：配置 GitHub Actions Secret

在 GitHub 仓库里添加：

```bash
APP_URL=https://你的线上域名
```

## 配好后会影响哪些功能

配置完成后，这些功能才能正常工作：

- 密码重置验证码邮件
- 给管理员发消息后的通知邮件
- 每日早报邮件
- 每日晚报邮件
- 生日祝福邮件

## 如何验证

配置并重新部署后，你可以这样验证：

### 1. 管理员面板自检

打开管理员面板，运行：

- `System Self Check`

重点看：

- `Email`
- `Cron URL`
- `Data Store`
- `Backup`

### 2. 管理员面板测试邮件

管理员面板里可以手动点：

- `Test Daily Digest`
- `Test Evening Report`
- `Test Birthday`

### 3. 看 Resend 后台

去 Resend Dashboard 查看：

- 是否出现新的发送记录
- 发件人是不是你配置的 `MAIL_FROM`
- 是否有报错

## 常见问题

### Q1：这个能自动配置吗？

不能。

因为这些内容都属于外部平台的私密配置：

- API Key
- 域名验证
- 邮箱发件人
- 线上域名
- GitHub Secrets

这些都必须你手动填。

### Q2：发件人到底是谁？

发件人就是：

- `MAIL_FROM`
- 如果没配，再退回 `RESEND_FROM`

如果两个都没配，就不会有合法发件人。

### Q3：我能先不用自定义域名吗？

可以，但不推荐长期这样做。

最稳的是：

```bash
MAIL_FROM=noreply@你的正式域名
```

### Q4：只配了 `RESEND_API_KEY`，没配 `MAIL_FROM` 会怎样？

邮件仍然不会完整工作。

因为代码要求：

- 有 `RESEND_API_KEY`
- 同时有 `MAIL_FROM` 或 `RESEND_FROM`

缺一都不算完整。

## 最小可用清单

如果你只想先把邮件跑起来，至少要配这 3 个：

```bash
# Vercel
RESEND_API_KEY=...
MAIL_FROM=noreply@your-domain.com

# GitHub Actions
APP_URL=https://your-domain.com
```

配完后重新部署，再去管理员面板跑测试即可。
