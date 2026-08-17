# Render Static Site + Supabase 部署手册

该方案用于朋友之间小规模使用：Render 只托管编译后的静态前端，Supabase 托管 Auth、Postgres 和 Realtime。前端不运行 Render Web Service，因此不会受到免费 Web Service 15 分钟休眠的影响。

## 1. 创建 Supabase 项目

1. 在 Supabase 创建项目，区域选择 Singapore，并妥善保存数据库密码。
2. 在项目的 **Project Settings → API** 记录 Project URL 和 Publishable Key。旧项目可能显示为 Anon Key。
3. 安装并登录 Supabase CLI，然后在仓库根目录执行：

   ```bash
   supabase login
   supabase link --project-ref <你的-project-ref>
   supabase db push --dry-run
   supabase db push
   ```

   `db push` 会按顺序应用：

   - `supabase/migrations/202608170001_initial.sql`
   - `supabase/migrations/202608170002_realtime_location_fixes.sql`

   如果不使用 CLI，也可以在 Supabase SQL Editor 中先完整执行 `202608170001_initial.sql`，成功后再执行 `202608170002_realtime_location_fixes.sql`。
4. 在 **Realtime Settings** 中关闭 Allow public access，私有频道将使用迁移中定义的 RLS 策略。
5. 在 **Authentication → Providers → Email** 中关闭公开注册；不要开启短信登录。
6. 在 **Authentication → Users** 中由管理员创建两个邮箱/密码账号，并确保邮箱已确认。

本机 Supabase 中已有的账号、密码和好友关系不会自动迁移。最稳妥的方式是在托管 Supabase 中重新创建账号并重新添加好友。

## 2. 准备地图配置

在高德开放平台创建 Web 端（JS API）应用，记录 Key 和安全密钥。天气功能不需要时，`VITE_WEATHER_KEY` 可以暂时留空。

需要填写的前端构建变量：

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_AMAP_KEY=your_amap_web_key
VITE_AMAP_SECURITY_CODE=your_amap_security_code
VITE_WEATHER_KEY=your_weather_key
```

不要把 Supabase Secret Key、Service Role Key、数据库密码或数据库连接串放进 `VITE_` 变量。所有 `VITE_` 变量都会进入浏览器构建产物。

## 3. 部署 Render Static Site

1. 将当前仓库推送到 GitHub、GitLab 或 Bitbucket。
2. 打开 Render Dashboard，选择 **New → Blueprint**，连接该仓库。
3. Render 会读取仓库根目录的 `render.yaml`，创建名为 `location-guardian` 的 Static Site。
4. 按提示填写上面的五个 `VITE_` 构建变量，然后部署。
5. 部署完成后记录 `https://<站点名>.onrender.com` 地址。

`render.yaml` 已包含：

- 构建命令 `npm ci && npm run build:client`
- 发布目录 `dist/client`
- React Router 的 `/* → /index.html` 重写

## 4. 配置 Supabase 登录回调

在 Supabase **Authentication → URL Configuration** 中：

- Site URL 填 Render 最终 HTTPS 地址。
- Redirect URLs 添加 `https://<站点名>.onrender.com/**`。

当前项目使用管理员创建的邮箱/密码账号，不依赖邮件跳转，但仍建议把地址配置正确。

## 5. 双账号验收

1. 手机和电脑分别打开 Render 地址并登录不同账号。
2. 两台设备都允许精确位置权限，并先进入一次地图页。
3. A 生成邀请码，B 在有效期内添加 A。
4. 检查好友列表和好友主页均显示在线。
5. 检查双方都能看到当前定位，并测试拍一拍与强提醒。
6. 锁屏、切后台或断网后，页面应停止更新，不应把旧坐标继续描述为实时位置。

## 6. 免费档与中国大陆网络边界

- Render Static Site 不会像免费 Web Service 一样休眠。
- Supabase Free 项目在连续约 7 天低活动时可能暂停，可在 Supabase Dashboard 恢复。
- Render 和 Supabase 都没有中国大陆计算节点。建议选择 Supabase Singapore，并分别使用移动网络和家用宽带测试 HTTPS、登录与 Realtime WebSocket。
- 该项目不应作为报警、急救或唯一安全联络工具。
