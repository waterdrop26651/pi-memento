# pi-memento

[English](./README.md) | 中文

[![npm](https://img.shields.io/npm/v/pi-memento)](https://www.npmjs.com/package/pi-memento) [![pi-package](https://img.shields.io/badge/pi-package-pi.dev%2Fpackages-blue)](https://pi.dev/packages) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**为 [pi coding agent](https://pi.dev) 打造的研究记忆与实验追踪扩展。**
`pi-memento` 为 LLM agent 提供分层外部记忆：事实账本（`runs.csv`）、带预测的受控
对照（`contrasts.csv`）、含更新规则的假设账本（`hypotheses.md`），以及冷记忆归档
召回 —— 让陈旧笔记永远不会污染下一次决策。安装命令：`pi install npm:pi-memento`。

本项目是 [Memento-skill](https://github.com/waterdrop26651/Memento-skill)（MIT，作者 waterdrop26651）的 pi 原生移植版，重构为纯 pi **扩展**：脚手架命令、agent 可调用的工具、tracker 校验，以及按需加载的完整方法论 —— 无 skill、无 Python、无额外运行时。

## 它做什么

Memento 把零散的实验、笔记和假设整理成分层外部记忆，让新的 agent 会话在几分钟内恢复*当前决策面*，而不必重放整个项目历史：

```text
CURRENT_STATE.md    ->  新 agent 的最小入口
ACTIVE_TRACKER.*    ->  只保留仍有决策梯度的证据
EVIDENCE_LOG.md     ->  当前信念的压缩论证
runs.csv            ->  事实账本，每次 run 一行
contrasts.csv       ->  预测、控制、观测到的差异
hypotheses.md       ->  信念 + 什么证据会改变它
archive/            ->  冷记忆：有索引、可召回、永不删除
```

事实、对照和信念分别记在三本账里。旧分支归档到索引之后，只有出现触发理由时才召回。

当当前项目中存在 tracker 时，扩展会自动提醒 agent 阅读顺序（热路径优先，archive 最后），让陈旧碎片远离默认上下文。

## 安装

```bash
pi install npm:pi-memento
```

或从本地检出的源码安装：

```bash
pi install /path/to/pi-memento
```

## 使用

### 命令

| 命令 | 作用 |
|---|---|
| `/memento init [dir] [--full]` | 初始化 tracker。默认只建核心文件；`--full` 追加完整的热/冷分层布局。永不覆盖已有文件。 |
| `/memento validate [dir]` | 校验 tracker 文件（schema、交叉引用、假设标记）。 |
| `/memento status [dir]` | 显示各记忆层的存在情况和账本行数。 |

### Agent 工具

| 工具 | 用途 |
|---|---|
| `memento_init` | agent 工作过程中初始化 tracker。 |
| `memento_validate` | 编辑 tracker 后自我校验。 |
| `memento_status` | 检查记忆层与账本规模。 |
| `memento_guide` | 按需加载方法论：`guide`（默认）、`templates`（起始文件 schema）、`reference`（完整质量准则）。 |

### 独立校验

无需 Python —— 校验器是原版 `validate_tracker.py` 的忠实 Node.js 移植：

```bash
node <package>/extensions/lib/validate_tracker.mjs <tracker_dir>
```

## 适用场景

- 项目里 run 很多，临时笔记互相矛盾。
- 跨会话交接研究工作，不想每次完整重放上下文。
- 想按信息增益（而不是直觉）排序下一组消融/对照实验。
- 想把阴性结果保存为决策资产，而不是随手丢弃。

## 包结构

```text
extensions/index.ts                  -> /memento 命令、agent 工具、tracker 感知上下文
extensions/lib/validate_tracker.mjs  -> Node 校验器（CLI + 供工具调用）
extensions/references/GUIDE.md       -> 由 memento_guide 提供的方法论
extensions/references/TEMPLATES.md   -> 起始文件 schema 与示例
extensions/references/REFERENCE.md   -> 完整质量准则
assets/banner.jpg                    -> 画廊封面图（原创，来自上游）
```

## 致谢与许可证

MIT。方法论、模板与封面图改编自 waterdrop26651 的
[Memento-skill](https://github.com/waterdrop26651/Memento-skill)。
pi 扩展与 Node 校验器移植遵循同一许可证。

## 发布（维护者清单）

1. 在 `package.json` 中更新 `author` / `repository` 为你自己的账号。
2. 可选的画廊预览：推送到 GitHub 后，在 `pi` 清单中加入
   `"image": "https://raw.githubusercontent.com/<user>/<repo>/main/assets/banner.jpg"`。
3. `npm publish` —— `pi-package` 关键字会让它自动出现在
   [pi.dev/packages](https://pi.dev/packages)。
