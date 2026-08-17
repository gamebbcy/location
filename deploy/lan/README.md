# 局域网部署

当前部署入口：`https://192.168.1.3`

仅开放局域网 TCP 80/443。Supabase Studio、PostgreSQL、Supavisor 和内部 API 网关不直接暴露到局域网。

## 初始账号

本机部署已预创建两个账号，凭据保存在 `private/initial-accounts.txt`。该目录已加入 `.gitignore`，不要把文件提交、截图或发送给无关人员。

## 手机首次使用

在手机连接与服务器相同的 Wi-Fi 后，把 `certs/location-guardian-root.crt` 发送到手机并安装为受信任的根证书，然后访问 `https://192.168.1.3`。

- iPhone/iPad：安装描述文件后，进入“设置 → 通用 → 关于本机 → 证书信任设置”，为该根证书打开完全信任。
- Android：进入“设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书”。不同品牌菜单名称可能略有区别。

根证书只用于验证这台局域网服务器。不要把 Caddy 的私钥或 Docker 数据目录发送给其他人。

## 网络要求

- 手机和服务器必须在同一局域网，且路由器未开启 AP/客户端隔离。
- 建议在路由器中为服务器网卡保留 `192.168.1.3`，避免 DHCP 地址变化。
- 此入口不能从移动数据或其他 Wi-Fi 访问。

## 日常维护

Docker Desktop 已加入 Windows 登录启动项，容器使用 `unless-stopped` 重启策略。电脑开机并登录 Windows 后，等待 Docker Desktop 启动即可恢复服务。

运行时目录：`F:\LocationGuardianRuntime\supabase`

```powershell
$docker = 'F:\Docker\Docker\resources\bin\docker.exe'
$base = 'F:\LocationGuardianRuntime\supabase\docker-compose.yml'
$override = 'F:\LocationGuardianRuntime\supabase\docker-compose.location.yml'
$envFile = 'F:\LocationGuardianRuntime\supabase\.env'

# 查看状态
& $docker compose --env-file $envFile -f $base -f $override ps

# 启动
& $docker compose --env-file $envFile -f $base -f $override up -d --wait

# 停止（保留数据库）
& $docker compose --env-file $envFile -f $base -f $override stop
```
