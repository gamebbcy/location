# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1 为设计意图与决策上下文。Code agent 实现时以 Section 2 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: 年轻朋友/情侣/家人，移动端高频使用，期望安全感与亲密连接
- **核心目的**: 建立信任 + 实时陪伴感知 + 紧急场景下的安全感
- **情绪基调**: 安心温暖 / 避免焦虑、监控感、冰冷技术感

### 1.2 设计方向

- **Design Style**: Soft Blocks 柔色块 — 隐私安全类社交工具需柔和亲和力，半透明层次传递"轻盈不侵入"的隐私安全感
- **Application Type**: Mobile-first Social Tool — 底部Tab导航，全屏地图为主视觉
- **Aesthetic Direction**: 温润蓝绿主色调 + 毛玻璃浮层 + 呼吸感动效，营造"陪伴而非监控"的情绪体验

## 2. Color System (色彩系统)

**色彩关系**: 青绿主色(hsl(168)) + 低饱和青灰底 + 深墨文字，暖色点缀状态反馈
**配色设计理由**: 蓝绿色系传达安全、信任、陪伴，避开冷蓝的监控感和紫色的AI默认感
**主色推导**: 青绿(hsl(168))对应"位置守护"语义，兼具科技精确感与人际温度
**使用比例**: 60% 浅青灰背景 / 30% 白色卡片 / 10% 青绿primary收敛于CTA、激活态、消息气泡

### 2.1 主题颜色

| Token                | HSL 值                 | 说明                             |
| -------------------- | ---------------------- | -------------------------------- |
| `background`         | hsl(168 15% 97%)       | 浅青灰底色，护眼且区别于纯白     |
| `card`               | hsl(0 0% 100%)         | 纯白卡片容器                     |
| `foreground`         | hsl(168 20% 14%)       | 深墨绿文字，比纯黑更温润         |
| `muted-foreground`   | hsl(168 10% 50%)       | 次要说明文字                     |
| `primary`            | hsl(168 65% 42%)       | 青绿主交互色，沉稳不刺眼         |
| `primary-foreground` | hsl(0 0% 100%)         | 主按钮文字                       |
| `accent`             | hsl(168 30% 94%)       | hover/focus/skeleton 反馈背景    |
| `accent-foreground`  | hsl(168 20% 25%)       | accent上的文字                   |
| `border`             | hsl(168 12% 88%)       | 极淡边框                         |
| `destructive`        | hsl(0 72% 51%)         | 定位关闭提醒、强提醒标记         |
| `success`            | hsl(152 60% 40%)       | 在线状态点、授权成功             |
| `warning`            | hsl(38 92% 50%)        | 电量低于20%警示                  |

### 2.2 导航区配色

- **基调关系**: 复用主配色，底部Tab栏使用 `bg-card/80 backdrop-blur-lg` 毛玻璃效果
- **关键状态**: 激活态图标+文字用 `primary`，未激活用 `muted-foreground`；hover态背景用 `accent`
- **边界与背景**: 顶部无边框线，靠阴影 `shadow-[0_-1px_3px_rgba(0,0,0,0.04)]` 分隔

### 2.3 语义颜色

- **在线/离线**: 在线 `hsl(152 60% 40%)` 圆点 + 呼吸动画；离线头像 `grayscale` + `opacity-60`
- **运动状态**: 乘车 `hsl(210 70% 55%)`、跑步 `hsl(25 85% 55%)`、步行 `hsl(168 65% 42%)`、停留 `hsl(168 30% 70%)`
- **听歌状态角标**: 跟随音乐App品牌色，网易云红/QQ音乐绿/Spotify绿

## 3. Typography (字体排版)

- **Heading**: `"SF Pro Rounded", "PingFang SC", system-ui, sans-serif` + 回退 `-apple-system, BlinkMacSystemFont, "Segoe UI"`
- **Body**: `"Inter", "PingFang SC", system-ui, sans-serif` + 回退 `-apple-system, "Helvetica Neue"`
- **字体策略**: 标题优先圆润无衬线增强亲和力；正文Inter确保数字/地址/状态文本清晰可读；中文回退苹方保障iOS/Android一致性

## 4. Layout Strategy (布局策略)

- **导航意图**: 应用概要设计已声明底部Tab导航（地图/好友/消息/我的），至多一套全局导航，非透明毛玻璃背景
- **页面架构**: 移动端竖屏单栏流式布局，`max-w-md mx-auto` 约束桌面端宽度；地图页全屏铺满
- **响应式**: 桌面端居中窄栏模拟手机体验；移动端全宽自适应，底部Tab固定吸底

## 5. Visual Language (视觉语言)

- **形态参数**: 圆角 `rounded-xl (12px)` · 阴影 `shadow-sm` 卡片 / `shadow-md` 浮层 · 间距基调 `standard`
- **识别签名**: ① 好友头像标记带运动状态胶囊标签 ② 底部Tab毛玻璃模糊 ③ 隐私承诺页绿底白字大标语
- **装饰策略**: 仅用运动状态图标+呼吸光晕作为动态装饰，无多余插画或渐变飘带
- **动效原则**: 状态切换200ms ease-out；头像呼吸光晕2s infinite；页面转场slide-up 300ms
- **可及性**: 正文对比度≥4.5:1；地图浮层文字加 `drop-shadow`；交互元素有明确focus ring

## 6. Component Principles (组件原则)

- **状态完整性**: Button/Input/Tab覆盖Default/Hover/Active/Focus/Disabled；好友头像覆盖在线/离线/运动中三态
- **层级清晰**: Primary按钮填充`primary`，Ghost按钮仅边框+文字；聊天气泡自己`primary`对方`muted`
- **一致性**: 所有列表项统一 `p-4 gap-3` 内边距；状态标签统一胶囊形 `rounded-full px-2 py-0.5 text-xs`

## 7. Image Direction (图片与视觉资产)

- **Image Role**: 登录页品牌插画 + 授权引导页权限示意插图
- **Image Art Direction**: 扁平矢量插画风格，柔和线条+青绿主色调，人物抽象化处理（无面部细节），构图简洁居中，光线均匀无阴影，传递温暖陪伴感
- **Image Prompt Keywords**: flat vector illustration, teal green palette, abstract human silhouettes, location pin motif, soft rounded shapes, minimal composition, warm companion feeling, no facial features, clean white background, gentle gradient accents
- **Image Avoidance**: 避免写实人脸、3D渲染、科技感网格、紫蓝渐变、商务握手、通用地图截图

## 8. 应避免 (Anti-patterns)

- ❌ 使用深蓝/暗黑色调营造"监控仪表盘"氛围——违背"陪伴信任"情绪基调
- ❌ 地图页添加过多浮层遮挡视野——地图是核心信息载体，UI元素应半透明+最小化
- ❌ 好友详情页堆砌数据卡片无层级区分——四宫格状态需用大号数值+小标签的信息密度梯度