# Kairos 验收记录

## 2026-08-25 · macOS arm64

- 平台：macOS，Apple Silicon，构建目标 macOS 13+
- 构建命令：`pnpm exec electron-builder --mac --arm64`
- 产物：`release/ap-mac-xnu.dmg`
- 产物大小：约 107 MB
- DMG 校验：`hdiutil verify` 通过
- DMG 挂载：成功，包含 `Kairos.app` 和 `Applications` 快捷方式
- 打包应用启动：成功，显示名称为 `Kairos`
- 关闭窗口：窗口隐藏，应用进程继续运行
- 正式退出：从应用菜单退出后，进程结束
- 通知权限：用户在本机 macOS 手工验证，首次通知成功
- 重新请求通知：用户在本机 macOS 手工验证，重新请求成功

## 2026-08-25 · macOS 启动与数据可靠性

- Main 启动阶段主动加载用户数据、补齐逾期重复实例并初始化提醒调度；登录项隐藏启动时不依赖 Renderer 窗口。
- `TaskRuntime` 测试验证同一启动周期只加载一次、只保存一次迁移结果并只调度一次。
- 损坏 `tasks.json` 测试验证读取失败并保留原文件内容。
- 原子替换失败测试验证原文件内容保持不变，临时文件会清理。
- 当前策略：损坏数据不自动覆盖、不自动重置；显示窗口后由 Renderer 展示中文错误和“重新读取”入口。

本次本机手工结果：

- DMG 已挂载并将 `Kairos.app` 复制到 `/Applications`；安装后曾出现白屏，已定位为 Vite 生产资源使用绝对路径，修复为 `base: "./"` 后重新构建并验证看板正常显示。
- 首次引导完成后，开启开机启动；macOS 登录项读取结果包含 `Kairos`。
- 关闭窗口后应用进程仍运行；从 Kairos 菜单正式退出后进程结束。
- 关闭开机启动后，macOS 登录项读取结果仅剩 `DockDoor`，与应用状态一致。
- 将 `/Applications/Kairos.app` 移到临时验收目录，应用本体移除成功；`~/Library/Application Support/kairos/tasks.json` 仍保留。
- 未执行注销/重新登录，故“真实登录后仅托盘启动”仍需下一轮在用户方便时验证；Main 启动路径已通过 `TaskRuntime` 自动化测试覆盖。

## 2026-08-25 · 自动化与跨平台交叉构建

- `pnpm test`：17 个测试通过（Shared、持久化、导入冲突、App）
- `pnpm typecheck`：Renderer/Shared 与 Electron Main/Preload 均通过
- `pnpm build`：生产构建通过
- `pnpm test:e2e`：5 个 Playwright 用例通过，覆盖创建/完成、搜索/回收站、拖拽重载、重复序列和导入导出冲突
- 构建输出目录调整为 `release/`，避免 electron-builder 将 `dist/` 内的旧平台输出递归打包进应用
- Windows x64：`release/ms-win-nt#.exe`，NSIS 安装器与 `.blockmap` 均生成；当前 macOS 仅完成交叉构建和文件类型检查，未完成 Windows 实机安装/生命周期验收
- Linux x64：`release/lf-lin-lnx.deb`，`ar` 检查包含 `debian-binary`、`control.tar.xz`、`data.tar.xz`；当前 macOS 仅完成交叉构建和包结构检查，未完成 Linux 实机安装/生命周期验收
- macOS arm64：重新生成 `release/ap-mac-xnu.dmg`，`hdiutil verify` 通过

备注：当前构建未配置 Apple Developer ID 签名和公证，electron-builder 输出了 unsigned app/DMG。Windows/Linux 的安装、托盘、通知和开机启动仍需在对应平台实机完成；RTL 目前有基础 App 测试，但尚未覆盖 Checklist 要求的完整组件矩阵。
