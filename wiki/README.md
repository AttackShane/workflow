# Coze 工作流编辑器 & 转换器 - Code Wiki

> 本目录包含项目的完整结构化技术文档。每个文档聚焦于一个特定主题，可以独立阅读，也可以按顺序通读了解整个项目。

## 文档索引

| 文档 | 主题 | 简介 |
| --- | --- | --- |
| [01-overview.md](./01-overview.md) | 项目概览 | 项目定位、核心能力、目标用户、应用场景 |
| [02-architecture.md](./02-architecture.md) | 整体架构 | 三页面架构、组合模式、依赖关系、数据流 |
| [03-project-structure.md](./03-project-structure.md) | 项目结构 | 目录树、文件组织、命名规范 |
| [04-tech-stack.md](./04-tech-stack.md) | 技术栈 | 运行时、依赖、构建工具、测试框架 |
| [05-modules-converter.md](./05-modules-converter.md) | 转换器模块 | YAML ↔ Coze 双向转换、虚拟滚动、语法高亮 |
| [06-modules-editor.md](./06-modules-editor.md) | 编辑器模块 | 画布、节点、边、剪贴板、属性面板 |
| [07-modules-manager-shared.md](./07-modules-manager-shared.md) | 管理器与共享模块 | 工作流管理、对话框、主题、国际化、导航 |
| [08-key-classes.md](./08-key-classes.md) | 关键类详解 | 核心类的字段、方法、协作关系 |
| [09-data-structures.md](./09-data-structures.md) | 数据结构 | 节点/边模型、Coze 格式、内部格式、容器模型 |
| [10-dependencies.md](./10-dependencies.md) | 依赖关系图 | 模块依赖、内置依赖、运行时依赖 |
| [11-run-and-build.md](./11-run-and-build.md) | 运行与构建 | 开发、构建、测试、代码检查、CI |
| [12-development-guide.md](./12-development-guide.md) | 开发指南 | 编码约定、常见陷阱、扩展点 |

## 快速导航

### 我是新手开发者
按顺序阅读 01 → 02 → 03 → 04 → 11，建立整体认知。

### 我要修改某个功能
- **画布相关**：02 → 06（编辑器）→ 08（关键类）
- **转换逻辑**：02 → 05（转换器）→ 09（数据结构）
- **界面交互**：07（管理/共享）→ 08
- **键盘快捷键**：06 → 10

### 我要新增节点类型
01 → 09 → 12（开发指南）

### 我要部署或发布
04 → 11（运行与构建）

## 项目一句话总结

> **一个零框架依赖的纯原生 JavaScript 工作台**，集 **Coze 剪贴板格式双向转换、可视化工作流编辑、本地工作流管理** 三种能力于一身，可作为单页应用（`file://`）运行，也可作为多页应用通过开发服务器运行。
