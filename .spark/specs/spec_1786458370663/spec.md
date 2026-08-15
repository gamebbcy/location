# 技术方案

## 开发元信息
- 开发模式: 全栈应用
- 涉及层级: [服务端, 前端]
- 核心设计原则: 服务端仅做 WebSocket 实时消息中继，不持久化存储任何位置数据或好友关系；好友关系、个人资料、轨迹记录、设置等全部保存在浏览器本地（localStorage/IndexedDB）；严格点对点隐私隔离

## 页面路由与导航

### 页面路由
| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | /login | 手机号 + 模拟验证码登录 |
| 授权引导页 | /onboarding | 首次使用权限引导（定位/通知/隐私承诺） |
| 地图页 | /map | 高德地图实时位置展示（首页） |
| 好友页 | /friends | 好友列表、添加好友、常用地点管理 |
| 消息页 | /messages | 会话列表 + 聊天界面 |
| 我的页 | /profile | 个人中心、功能入口、设置 |
| 好友详情页 | /friend/:id | 单个好友详细信息与快捷操作 |
| 快捷指令页 | /shortcuts | 自动化规则设置 |
| 假装来电页 | /fake-call | 模拟来电界面 |

### 导航设计
- 导航机制：底部 Tab 导航（移动端优先）+ 页面路由
- 底部导航项（登录后主页面共享）：
  - 地图（/map）
  - 好友（/friends）
  - 消息（/messages）
  - 我的（/profile）
- 其他页面（好友详情、快捷指令、假装来电、登录、引导）为二级页面，通过返回按钮返回

## 业务组件

| 组件 | 来源 | 关联页面 | 对应功能点 |
|------|------|---------|-----------|
| Map（高德地图 JS API） | 第三方 | 地图页、好友详情页 | 位置展示、轨迹绘制、头像标记 |
| BottomNavigation | shadcn/ui 自定义 | 地图/好友/消息/我的页 | 底部 Tab 导航 |
| Avatar | shadcn/ui | 全局 | 头像展示 |
| Button | shadcn/ui | 全局 | 操作按钮 |
| Dialog | shadcn/ui | 我的页、好友页 | 状态设置弹窗、听歌设置弹窗、添加好友弹窗 |
| Input | shadcn/ui | 登录页、聊天页 | 输入框 |
| Card | shadcn/ui | 我的页、好友详情页 | 信息卡片 |
| Switch | shadcn/ui | 我的页、快捷指令页 | 开关控制 |
| Tabs | shadcn/ui | 好友详情页 | 轨迹日期切换 |

## 服务端架构（WebSocket 中继服务）

### 核心设计
服务端使用 NestJS + WebSocket（@nestjs/websockets + socket.io）实现实时消息中继。**内存中仅维护在线用户连接映射，不持久化任何数据。** 用户断开连接后立即清除所有内存中该用户的位置状态。

### 内存数据结构
服务端内存维护以下映射（进程重启即丢失，符合隐私设计）：
- `userId → socketId`：用户连接映射
- `socketId → userId`：反向映射
- `userId → { lat, lng, accuracy, motionState, battery, networkType, deviceModel, status, musicState, lastUpdate, stayDuration }`：当前在线用户位置与状态快照（仅最近一次上报，断开即清除）

### WebSocket 消息协议

#### 连接与鉴权
- 连接路径：`/location`（Socket.IO namespace）
- 鉴权方式：客户端连接时携带 `userId`（手机号 + 设备标识哈希生成的本地 ID）和 `token`（本地生成的临时令牌，服务端仅做格式校验不持久化）
- 连接成功后服务端将该用户标记为在线，加入默认房间

#### 事件定义

```typescript
// 客户端 → 服务端

// 上报当前位置与状态（定时上报，如每 5 秒）
'location:update': {
  lat: number;
  lng: number;
  accuracy: number;         // GPS 精度（米）
  motionState: 'stay' | 'walk' | 'run' | 'vehicle';
  battery: number;          // 电量百分比
  batteryCharging: boolean;
  networkType: string;      // wifi / 4g / 5g / unknown
  deviceModel: string;      // 设备机型
  status: string;           // 个人状态文字
  musicState: { app: string; song: string } | null;
  stayDuration: number;     // 当前位置停留时长（秒）
}

// 请求获取指定好友的当前位置
'friend:location:request': {
  friendUserId: string;
}

// 发送一对一消息
'message:send': {
  toUserId: string;
  content: string;
  messageId: string;        // 客户端生成 UUID
  timestamp: number;
  type: 'text' | 'alert';   // alert = 强提醒
}

// 强提醒
'alert:send': {
  toUserId: string;
  messageId: string;
  timestamp: number;
}

// 上报状态变更（个人状态/听歌状态等）
'status:update': {
  status: string;
  musicState: { app: string; song: string } | null;
}

// 断开连接（下线通知由服务端 disconnect 事件处理）
```

```typescript
// 服务端 → 客户端

// 好友位置更新推送（仅推送给直接好友）
'friend:location:update': {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  motionState: 'stay' | 'walk' | 'run' | 'vehicle';
  battery: number;
  batteryCharging: boolean;
  networkType: string;
  deviceModel: string;
  status: string;
  musicState: { app: string; song: string } | null;
  stayDuration: number;
  lastUpdate: number;
}

// 好友下线通知
'friend:offline': {
  userId: string;
}

// 好友上线通知（连接时向其所有好友广播）
'friend:online': {
  userId: string;
}

// 收到消息
'message:receive': {
  fromUserId: string;
  content: string;
  messageId: string;
  timestamp: number;
  type: 'text' | 'alert';
}

// 收到强提醒
'alert:receive': {
  fromUserId: string;
  messageId: string;
  timestamp: number;
}
```

### 隐私隔离机制
服务端关键安全保障：
1. **好友关系验证**：客户端请求好友位置、发送消息、发送强提醒时，服务端**不校验好友关系**——因为服务端不存储好友关系。但要求客户端上报时明确指定目标 `friendUserId`，服务端仅做在线存在性检查后转发
2. **防骚扰设计**：每个用户每分钟最多接收 N 条来自陌生 ID 的消息（简单速率限制），超过则丢弃
3. **用户 ID 不可枚举**：用户 ID 采用手机号哈希 + 随机盐的长字符串，避免被枚举
4. **数据不落地**：所有位置、状态、消息均只在内存中转，不落库、不写日志文件正文

## 前端架构

### 本地数据存储（IndexedDB + localStorage）
所有持久化数据存储在浏览器本地，服务端零存储。

**localStorage（轻量配置）：**
- `auth`：登录状态（phone、userId、token）
- `profile`：个人资料（nickname、avatar base64/dataURL）
- `onboarding`：引导页是否已完成
- `permissions`：权限授权状态
- `theme`：主题偏好（light/dark/system）
- `sensitiveWords`：自定义敏感词列表

**IndexedDB（大容量数据）：**
- `friends` 对象仓库：好友列表（userId、nickname、avatar、phone、inviteCode、addedAt）
- `messages` 对象仓库：消息记录（按好友分组，含 content、timestamp、direction、type、read）
- `trajectories` 对象仓库：本地轨迹记录（按日期存储，每日期一组轨迹点 { lat, lng, timestamp, motionState }）
- `places` 对象仓库：常用地点（name、address、lat、lng、tag）
- `shortcuts` 对象仓库：快捷指令规则（name、conditions、actions、enabled）
- `conversations` 对象仓库：会话元数据（friendId、lastMessage、unreadCount）

### 核心工具函数

| 工具 | 用途 |
|------|------|
| `haversineDistance(lat1, lng1, lat2, lng2)` | 计算两点间球面距离（Haversine 公式），返回 km |
| `calculateMotionSpeed(prevLat, prevLng, prevTime, currLat, currLng, currTime)` | 根据位置变化计算速度（km/h） |
| `detectMotionState(speedKmh)` | 根据速度判断运动状态：<1→stay, 1-7→walk, 7-15→run, >15→vehicle |
| `parseDeviceModel(userAgent)` | 解析 userAgent 获取设备机型描述 |
| `getNetworkType()` | 通过 `navigator.connection.effectiveType` 获取网络类型 |
| `getBatteryInfo()` | 通过 `navigator.getBattery()` 获取电量与充电状态 |
| `generateInviteCode()` | 生成 6 位邀请码（数字+大写字母） |
| `filterSensitiveWords(text, wordList)` | 敏感词替换为 `*` |
| `formatStayDuration(seconds)` | 格式化停留时长显示 |
| `parseUserAgentForOS()` | 判断系统类型（iOS/Android），用于假装来电样式匹配 |

### 高德地图集成
- 通过 `<script>` 动态加载高德地图 JS API（key 配置在 `src/config/map.ts` 中预留，用户自行填入）
- 地图标记使用自定义 DOM 覆盖物（AMap.Marker + content）展示头像 + 运动状态图标
- 轨迹使用 AMap.Polyline 绘制，按日期分色
- 支持点击标记、缩放、定位、图层切换

### 天气 API 集成
- 使用和风天气 API（key 预留配置项）
- 在好友详情页点击天气按钮时，根据好友经纬度调用实时天气接口
- 展示：天气状况、温度、体感温度

### 第三方导航跳转
- 高德地图：`androidamap://navi?sourceApplication=appname&lat={lat}&lon={lng}&dev=0&style=2`
- 百度地图：`baidumap://map/direction?destination=latlng:{lat},{lng}|name:{name}&mode=driving`
- 网页兜底：`https://uri.amap.com/navigation?to={lng},{lat},{name}&mode=car`

## 业务模型

### 前端数据模型

```typescript
// 用户资料
interface UserProfile {
  userId: string;           // 本地生成的唯一标识
  phone: string;            // 手机号
  nickname: string;
  avatar: string;           // base64/dataURL
  status: string;           // 个人状态文字
  musicState: MusicState | null;
}

// 听歌状态
interface MusicState {
  app: 'netease' | 'qqmusic' | 'spotify' | 'apple' | 'other';
  song: string;
}

// 好友信息
interface Friend {
  userId: string;
  nickname: string;
  avatar: string;
  phone?: string;           // 可选，用户手动添加
  inviteCode: string;       // 对方邀请码（去重标识）
  addedAt: number;
  isOnline: boolean;        // 实时状态（内存）
}

// 轨迹点
interface TrajectoryPoint {
  lat: number;
  lng: number;
  timestamp: number;
  motionState: MotionState;
}

// 常用地点
interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tag: 'home' | 'company' | 'school' | 'other';
}

// 快捷指令规则
interface ShortcutRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: ShortcutCondition[];
  actions: ShortcutAction[];
}

type ShortcutCondition = 
  | { type: 'time'; operator: 'after' | 'before'; value: string }  // "HH:mm"
  | { type: 'location'; value: string; operator: 'near' | 'far' }  // placeId
  | { type: 'status'; value: string };

type ShortcutAction = 
  | { type: 'notify'; title: string; body: string }
  | { type: 'sendMessage'; friendId: string; content: string }
  | { type: 'setStatus'; value: string };

// 聊天消息
interface ChatMessage {
  id: string;
  friendId: string;
  direction: 'sent' | 'received';
  content: string;
  timestamp: number;
  type: 'text' | 'alert' | 'system';
  read: boolean;
}

// 实时位置快照
interface LocationSnapshot {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  motionState: MotionState;
  battery: number;
  batteryCharging: boolean;
  networkType: string;
  deviceModel: string;
  status: string;
  musicState: MusicState | null;
  stayDuration: number;
  lastUpdate: number;
  isOnline: boolean;
}

type MotionState = 'stay' | 'walk' | 'run' | 'vehicle';
```

### 服务端模块设计

| 模块 | 文件路径 | 职责 |
|------|---------|------|
| WebSocket Gateway | `server/modules/realtime/realtime.gateway.ts` | Socket.IO 网关，处理连接、断开、消息路由 |
| 连接管理 Service | `server/modules/realtime/connection.service.ts` | 维护在线用户映射、上下线广播 |
| 位置中继 Service | `server/modules/realtime/location.service.ts` | 位置上报与转发 |
| 消息中继 Service | `server/modules/realtime/message.service.ts` | 一对一消息与强提醒转发 |
| 速率限制 | `server/modules/realtime/rate-limit.service.ts` | 简单速率限制防滥用 |

### 配置项预留
在 `client/src/config/index.ts` 中集中管理：
```typescript
export const APP_CONFIG = {
  amapKey: '',              // 高德地图 JS API key（用户自行填入）
  weatherKey: '',           // 和风天气 API key（可选）
  wsUrl: '',                // WebSocket 服务地址（默认同域 /location）
  locationUpdateInterval: 5000,  // 位置上报间隔（毫秒）
  trajectoryRetentionDays: 7,     // 轨迹保留天数
};
```
