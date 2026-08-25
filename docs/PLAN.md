# 四象限时间管理 macOS / Windows / Linux 应用规划

## 1. 产品目标

开发一个支持 macOS、Windows、Linux 的四象限时间管理桌面应用。

第一阶段核心功能：

- 四象限任务展示
- 新建、编辑、删除任务
- 拖拽任务到不同象限
- 完成和取消完成
- 搜索和筛选
- 截止日期
- 系统通知
- 系统托盘
- 本地离线存储

四象限规则：

```text
重要 + 紧急     = 立即处理
重要 + 不紧急   = 计划处理
不重要 + 紧急   = 尽快委托或处理
不重要 + 不紧急 = 减少或删除
```

## 2. 已确定技术栈

- 桌面框架：Electron
- 编程语言：TypeScript
- UI 框架：React
- 构建工具：Vite
- 状态管理：Zustand
- 样式方案：Tailwind CSS
- 数据校验：Zod
- 包管理器：pnpm
- 打包工具：electron-builder
- 单元测试：Vitest
- React 组件测试：React Testing Library
- 端到端测试：Playwright

Pinia 不采用，因为它是 Vue 生态的状态管理库；当前项目使用 React，Zustand 更匹配。

## 3. 应用架构

```text
Electron
├── Main Process
│   ├── 窗口管理
│   ├── 系统托盘
│   ├── 系统通知
│   ├── 全局快捷键
│   └── 文件读写
├── Preload
│   └── contextBridge 安全 API
├── Renderer
│   └── React + Tailwind CSS 界面
└── Shared
    └── 类型、数据模型、校验规则
```

### Main Process

负责窗口生命周期、系统托盘、系统通知、全局快捷键和本地文件读写。

### Preload

通过 `contextBridge` 暴露受控 API，连接 Renderer 与 Main Process。

### Renderer

负责 React 页面、四象限布局、任务编辑、拖拽、搜索和筛选。

### Shared

保存 Main、Preload、Renderer 共同使用的 TypeScript 类型、数据模型和校验规则。

Electron 安全配置固定为：

```ts
nodeIntegration: false
contextIsolation: true
sandbox: true
```

Renderer 不直接访问 Node.js 和文件系统，所有系统操作都通过 Preload API 完成。

## 4. 数据设计

```ts
type Task = {
  id: string;
  title: string;
  note?: string;
  important: boolean;
  urgent: boolean;
  dueDate?: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

象限由 `important` 和 `urgent` 两个字段计算，不额外保存象限字段，避免状态不一致。

数据保存到 Electron 的用户数据目录：

```ts
app.getPath("userData")
```

第一阶段使用 JSON 文件进行本地持久化，暂不引入 SQLite 或后端服务器。文件写入应采用临时文件加原子替换，避免程序异常导致数据损坏。

## 5. 推荐目录结构

```text
src/
├── main/
│   ├── main.ts
│   ├── windows/
│   ├── ipc/
│   └── services/
├── preload/
│   └── preload.ts
├── renderer/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   └── tasks/
│   ├── stores/
│   └── styles/
└── shared/
    ├── types/
    ├── schemas/
    └── constants/
```

## 6. 体积与分发目标

最初的 256KB 目标不适用于完整 Electron 应用，因为 Electron 需要携带 Chromium 运行时。

当前目标调整为：

- 业务代码和资源尽量控制在 1MB 内
- 完整安装包接受数十到上百 MB
- 使用 ASAR 和压缩优化分发体积
- macOS、Windows、Linux 分别构建对应安装包
- 不内置大型资源、数据库或后台服务进程

应用包体积和运行时内存占用分开评估，不把二者混为一个指标。

## 7. 第一阶段范围

第一阶段实现：

- Electron 主窗口
- 四象限布局
- 任务增删改查
- 拖拽移动任务
- 完成状态
- 搜索和基础筛选
- JSON 本地持久化
- 系统托盘
- 基础系统通知
- macOS、Windows、Linux 打包验证

第一阶段暂不实现：

- 用户账号
- 云同步
- 在线服务
- SQLite 数据库
- 插件系统
- 复杂权限体系
- 自动更新
- 第三方大型 UI 组件库

## 8. 备选方案记录

- Tauri：体积更小，但开发体验和兼容性不作为当前首选。
- Avalonia + .NET：支持三平台，但不符合当前技术偏好。
- Qt/QML：跨平台成熟，但需要引入 C++/QML 技术栈。
- 原生平台实现：可以追求更小体积，但需要分别维护三套 UI。

当前正式方案为 Electron + TypeScript + React + Zustand + Tailwind CSS。

## 9. 主窗口小组件模式计划

### 9.1 产品目标

在不创建第二个 Electron 窗口的前提下，让主窗口可以切换为轻量四象限小组件模式。两种模式共用同一份任务数据、提醒调度和 Renderer 进程，降低内存占用与同步复杂度。

### 9.2 窗口模式

主窗口支持以下两种模式：

- **普通模式**：保留完整四象限、搜索、筛选、回收站、设置、导入/导出等功能。
- **小组件模式**：隐藏侧栏和页面级功能，只展示四象限、任务卡、完成操作和新增任务入口。

通过顶部 `Pin` 按钮切换模式。`Pin` 表示固定窗口形态与位置，不表示窗口总在最前；小组件不设置 `alwaysOnTop`，其他应用窗口可以覆盖它，也不会抢夺焦点。

### 9.3 小组件界面

小组件模式固定窗口尺寸，初始建议为 `560 × 430`，不允许通过边缘调整大小；窗口顶部提供：

- Kairos 标识与当前活跃任务数量
- `Pin` / 取消固定按钮
- 新增任务按钮
- 返回普通模式入口

四个象限继续使用现有颜色和任务排序规则。任务卡保留标题、截止时间、重复标记和完成图标，支持直接完成任务。新增任务复用现有任务字段和校验逻辑，以紧凑弹窗完成标题、截止时间、象限、提醒和重复规则设置。

### 9.4 窗口行为

- 普通模式使用系统窗口边框；进入小组件模式时重建为无边框窗口，隐藏 macOS 红绿灯和其他平台标题栏，调整到固定尺寸并禁止调整大小。
- 小组件顶部自定义栏使用 Electron 的拖动区域；按钮、任务卡和输入控件排除在拖动区域之外，保持正常点击。
- 小组件不启用置顶、不穿透点击、不阻塞其他应用操作。
- 退出小组件模式时恢复普通模式的窗口尺寸、最小尺寸和系统窗口行为。
- 关闭窗口仍然隐藏到系统托盘，不结束 Electron 进程。
- macOS、Windows、Linux 均使用同一套 Electron 窗口 API；平台差异只在必要的窗口装饰和位置校验处封装。

### 9.5 设置持久化

新增窗口偏好设置，至少保存：

```ts
type WindowPreferences = {
  mode: "normal" | "widget";
  normalBounds?: { x: number; y: number; width: number; height: number };
  widgetPosition?: { x: number; y: number };
};
```

偏好写入 Electron 用户数据目录。启动时恢复上次模式和位置；如果显示器配置发生变化，先校验窗口是否仍位于可见工作区，不可见时移动到默认显示器的安全位置。

### 9.6 数据与 IPC

继续复用现有 `TaskRuntime`、Zustand Store 和 `tasks.json`，不增加第二套任务业务逻辑。需要新增受控 IPC：

- 读取和保存窗口模式/位置偏好
- 切换主窗口模式
- 主进程保存任务后向所有 Renderer 广播 `tasks:changed`

小组件不使用定时轮询；启动时加载一次任务，之后仅在任务保存或收到 `tasks:changed` 时刷新。主窗口和小组件模式同时存在于同一窗口生命周期内时，必须保持任务状态一致。

### 9.7 推荐实现拆分

建议新增：

```text
src/main/services/windowPreferences.ts
src/renderer/components/WidgetShell.tsx
```

并调整：

```text
src/main/main.ts
src/preload/preload.ts
src/shared/ipc.ts
src/shared/window.d.ts
src/renderer/App.tsx
src/renderer/stores/taskStore.ts
```

小组件应复用任务卡、任务编辑表单和 Store 操作；窗口控制通过 Preload 暴露，不允许 Renderer 直接访问 Electron 或文件系统。

### 9.8 实施阶段

- [x] 抽取窗口偏好服务，加入模式和位置的读写及边界校验。
- [x] 增加窗口模式 IPC 与 Preload 类型安全 API，实现普通模式/小组件模式切换。
- [x] 将小组件顶部栏设为可拖动区域，按钮区域排除拖动，保留原生窗口跨平台拖动行为。
- [x] 实现精简四象限界面，保留直接新增和完成任务操作。
- [x] 接入任务变更广播，避免小组件使用轮询并保持任务状态更新。
- [x] 补充 Renderer、Main 和端到端测试；生产构建验证通过。

实现备注：三平台安装包的真实窗口生命周期、位置恢复和桌面覆盖行为仍需分别在 macOS、Windows、Linux 实机验收。

### 9.9 验收标准

- `Pin` 可以在普通模式和小组件模式之间切换。
- 小组件固定尺寸，可拖动，重启后恢复模式和位置。
- 小组件不设置 `alwaysOnTop`，其他应用窗口可以覆盖它。
- 小组件可以直接新增任务和完成任务，重复任务规则不回归。
- 拖动窗口不会误触发任务拖拽；点击按钮不会移动窗口。
- 主窗口和小组件模式使用同一份本地任务数据，无轮询刷新。
- 关闭窗口后应用继续驻留托盘并调度提醒。
- `pnpm typecheck`、`pnpm test`、`pnpm build` 通过；端到端测试覆盖模式切换、位置恢复、新增和完成任务。
- macOS、Windows、Linux 的安装包均完成窗口生命周期和桌面覆盖行为验收。
