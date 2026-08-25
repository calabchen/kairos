# Kairos UI Design System

本文件是 Renderer UI 的固定验收口径。业务界面不使用独立手写 CSS 选择器；样式必须使用 Tailwind utility class，并由 `tailwind.config.ts` 中的令牌统一生成。

## 视觉方向

- 主题：安静、离线、偏工作台的浅色界面。
- 画布：`canvas`；内容面板：`panel`；正文：`ink`；辅助文字：`muted`。
- 主操作：`moss`；成功/帮助背景：`mossSoft`。
- 四象限只使用 `coral`、`saffron`、`lake`、`slate` 四种低饱和状态色。
- 危险操作使用 `danger`，不使用额外红色。

## 尺寸与间距

- 主按钮、次按钮和设置操作统一高度 `36px`，使用 `h-9`、`rounded-lg`、`px-4`、`text-xs`。
- 图标按钮统一 `h-9 w-9`，关闭/帮助按钮不得使用单独尺寸。
- 卡片统一 `rounded-xl`、`border`、`p-4`；任务卡统一 `rounded-lg`、`p-3`。
- 任务卡内容顺序固定为“标题在上、日期在下”；右侧操作区使用图标，不显示文字按钮。
- 任务卡图标固定为：完成绿色对勾、编辑蓝色齿轮、删除红色垃圾桶；停止重复使用中性停止图标。
- 任务卡操作顺序固定为：编辑齿轮、完成对勾、停止重复、删除垃圾桶。
- 任务卡操作仅在 hover/focus 时显示；每个图标必须提供 `aria-label` 和 `title`。
- 删除必须使用应用内二次确认弹窗；重复任务还要在弹窗内选择当前实例或整个序列。
- 页面主区使用 `gap-4`，卡片内部使用 `gap-3`；不使用小于 `gap-2` 的业务布局间距。
- 正文最小字号为 `text-xs`；仅数据徽标和状态元信息可以使用 `text-[11px]`。

## 交互状态

- 所有按钮必须有 `hover`、`focus-visible` 和 `disabled` 状态。
- 主按钮：`bg-ink text-panel`；次按钮：`border-line bg-panel text-ink`；安静按钮：`text-muted`。
- 活跃导航：`bg-ink text-panel`；非活跃导航：透明背景，hover 使用 `bg-panel`。
- 表单控件统一 `h-10 rounded-lg border-line bg-panel px-3 text-sm`。

## 布局原则

- 页面级不滚动：`body` 和应用壳层使用 Tailwind 的 `overflow-hidden`。
- 四象限网格占用主区剩余高度；任务列表只在象限内部 `overflow-y-auto`，并使用 `scrollbar-none` 的 Tailwind 任意属性隐藏滚动条。
- 设置页使用统一卡片网格，避免小字、按钮和说明文字挤在同一行。

## 已确认的边界

- 最小窗口为 `960 × 640`，保持完整文字侧栏，不增加折叠模式。
- 任务卡操作仅在 hover/focus 时显示。
- 设置页暂不增加“恢复默认设置”或版本信息区域。
- 重复任务星期选择按周一至周日展示为“一”到“七”；内部数据仍使用 JavaScript 的 `0`（周日）到 `6`（周六）编码。
