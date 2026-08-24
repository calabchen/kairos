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
