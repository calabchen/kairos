# Git 提交规范

## 格式

```text
type: description
```

## 规则

- `type` 必须使用英文小写。
- `description` 必须使用简体中文。
- `description` 应简洁明确，不超过 50 个字符。
- `type` 与 `description` 之间使用一个冒号和一个空格。
- 不使用 Commitizen、提交模板或自动校验工具，提交前由提交者自行检查。

## 类型

| type | 用途 |
| --- | --- |
| `fix` | 修复 bug |
| `add` | 新增功能 |
| `update` | 更新已有功能 |
| `style` | 修改代码格式或样式 |
| `test` | 增加或修改测试代码 |
| `revert` | 撤销上一次提交 |
| `build` | 修改构建工具或构建过程 |

## 示例

```text
add: 完成首轮核心功能闭环
fix: 修复回收站排序错误
test: 增加重复任务测试
build: 更新 Electron 构建配置
```
