# Vercel + Supabase 部署手册

本文对应 PRD v1.2，目标是朋友之间的小规模私用部署。建议先用两台设备和两个账号完成验收，再分享给其他朋友。

## 1. 创建 Supabase 项目

1. 新建 Supabase 项目，区域选择 Singapore。
2. 在 SQL Editor 中完整执行 `supabase/migrations/202608170001_initial.sql`。
3. 在 Authentication 设置中关闭公开注册；不要配置短信登录。
4. 在 Authentication → Users 中由管理员为每位朋友创建邮箱/密码账号，并确认账号邮箱已验证。
5. 在项目 API 设置中记录 Project URL 与 Publishable Key（旧项目可能显示为 Anon Key）。

迁移会创建资料、好友、授权、邀请码、屏蔽和备注表，并为业务表及 `realtime.messages` 开启 RLS。实时位置使用私有 Broadcast，数据库内没有位置记录表。

## 2. 本地验证

复制 `.env.example` 为 `.env.local` 并填写：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_AMAP_KEY=your-amap-js-api-key
VITE_AMAP_SECURITY_CODE=your-amap-security-code
VITE_WEATHER_KEY=your-weather-key
```

运行：

```bash
npm run type:check:client
npm run dev:client
```

分别用两个浏览器配置文件登录。A 展示邀请码，B 在 3 分钟内核销；然后让双方保持页面在前台，检查在线状态、当前定位、戳一戳和强提醒。

## 3. 部署到 Vercel

1. 将仓库导入 Vercel。
2. Framework Preset 选择 Vite；仓库中的 `vercel.json` 已指定构建命令 `npm run build:client`、输出目录 `dist/client` 和 SPA 回退规则。
3. 在 Project Settings → Environment Variables 中添加上述五个 `VITE_` 变量，并至少应用到 Production。
4. 部署后绑定自定义域名，优先选择在中国大陆网络下实测较稳定的域名和 DNS 服务商。
5. 将最终 HTTPS 域名加入 Supabase Authentication 的 Site URL；如后续使用邮件跳转，再加入 Redirect URLs。

不要在 Vercel 的前端变量中配置 Supabase Secret/Service Role Key、数据库密码或连接串。所有 `VITE_` 变量都会进入浏览器构建产物。

## 4. 上线前验收

- 未登录访问任意业务路由会回到登录页，刷新深层路由不出现 404。
- 未配置环境变量时登录页明确报错，不进入本地模拟账号。
- 只有管理员创建的账号可以登录，页面没有注册入口。
- 邀请码过期、重复使用和添加自己均失败；删除好友后双方无法继续订阅位置和在线状态。
- 用户资料与好友关系换设备后仍存在；地点和快捷指令等本地数据不会自动跨设备同步。
- Supabase 表中没有经纬度或连续轨迹；好友详情只展示本次在线连接收到的当前位置。
- 页面进入后台、锁屏、断网或跨境网络波动时，界面会停止更新，不把旧数据描述为实时位置。

## 5. 中国大陆使用边界

这个组合可以直接部署并供少量朋友使用，但 Vercel 与 Supabase 都不是中国大陆境内服务，访问质量会随地区、运营商和时段变化。建议：

- 使用自定义域名，并在朋友常用的移动和宽带网络上实测登录、地图与 Realtime WebSocket。
- 把它当作日常陪伴工具，不作为报警、急救或唯一安全联络方式。
- 出现持续访问问题时，前端可迁到中国大陆或香港托管；数据层仍可通过仓储接口和 SQL 迁移替换，业务页面无需重新设计。

## 6. 日常管理

- 新增朋友：管理员在 Supabase Auth 创建账号；用户首次登录时会自动生成资料。
- 停用账号：将 `public.profiles.enabled` 改为 `false`，RLS 会拒绝该账号的业务与实时访问；必要时同时在 Auth 中封禁用户。
- 数据备份：定期使用 Supabase 的数据库备份/导出能力。实时位置不在备份范围内。
- 结构变更：新增 SQL 文件放入 `supabase/migrations`，不要只在控制台手工改表而不回写仓库。
