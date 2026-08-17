# 位置守护（Location Guardian）

朋友之间私用的实时位置陪伴 Web App。前端部署到 Render Static Site，账号、好友关系与实时通道由 Supabase 提供；实时位置不写入业务数据库。

## 当前架构

- React 19 + Vite + Tailwind CSS
- Supabase Auth：管理员预建邮箱/密码账号，不开放公开注册
- Supabase Postgres：资料、好友关系、共享授权、邀请码与备注
- Supabase Realtime：私有 Broadcast 传递瞬时位置/提醒，Presence 表示在线状态
- IndexedDB：轨迹、地点、快捷指令等设备本地数据与好友显示缓存
- Render Static Site：静态前端与 SPA 路由托管，不使用会休眠的免费 Web Service

产品和隐私边界见 [docs/PRD.md](docs/PRD.md)，完整部署步骤见 [docs/DEPLOYMENT_RENDER_SUPABASE.md](docs/DEPLOYMENT_RENDER_SUPABASE.md)。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`，填写 Supabase 和高德地图的公开客户端配置。
2. 使用 `supabase db push` 应用 `supabase/migrations` 下的全部迁移；或在 SQL Editor 中按文件名顺序执行两条迁移。
3. 安装依赖并运行前端：

```bash
npm install
npm run dev:client
```

## 检查与构建

```bash
npm run type:check:client
npm run build:client
```

构建产物位于 `dist/client`。Render 已通过 `render.yaml` 使用同一构建命令、输出目录和 SPA rewrite。

## 安全说明

- 浏览器中只能使用 Supabase Publishable/Anon Key；不要放入 Secret/Service Role Key 或数据库直连地址。
- 好友与实时通道由数据库 RLS 校验，不能仅依赖前端隐藏按钮。
- Web 页面退到后台或被系统冻结后不保证持续定位；本项目不是报警、急救或紧急定位服务。
- Render 与 Supabase 在中国大陆的可用性受跨境网络影响，适合朋友间尽力而为的非商业使用，不提供稳定性保证。
