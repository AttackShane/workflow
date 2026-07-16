# 00 · Code Wiki 总览

> 本文档是整个 Code Wiki 的导航与摘要，提供了项目的关键要点总结。

## 0.1 项目一句话总结

**一个零框架依赖的纯原生 JavaScript 工作台**，集 **Coze 剪贴板格式双向转换、可视化工作流编辑、本地工作流管理** 三种能力于一身，可作为单页应用（`file://`）运行，也可作为多页应用通过开发服务器运行。

## 0.2 Wiki 文档索引

| # | 文档 | 主题 | 关键内容 |
| --- | --- | --- | --- |
| 01 | [overview.md](./01-overview.md) | 项目概览 | 定位、能力矩阵、目标用户、场景、版本历史 |
| 02 | [architecture.md](./02-architecture.md) | 整体架构 | 三页面、组合模式、模块分层、数据流、状态管理 |
| 03 | [project-structure.md](./03-project-structure.md) | 项目结构 | 目录树、模块分组、文件命名、构建产物 |
| 04 | [tech-stack.md](./04-tech-stack.md) | 技术栈 | 运行时、生产依赖、开发依赖、构建、测试、CI |
| 05 | [modules-converter.md](./05-modules-converter.md) | 转换器 | YAML ↔ Coze、组件、渲染、虚拟滚动、高亮 |
| 06 | [modules-editor.md](./06-modules-editor.md) | 编辑器 | 画布、节点、边、剪贴板、属性面板、组合模式 |
| 07 | [manager-shared.md](./07-modules-manager-shared.md) | 管理器与共享 | 管理器、模板、对话框、主题、i18n、序列化 |
| 08 | [key-classes.md](./08-key-classes.md) | 关键类详解 | 25+ 类的字段、方法、协作关系、时序图 |
| 09 | [data-structures.md](./09-data-structures.md) | 数据结构 | 节点/边/容器/引用/Coze 格式/YAML 格式/存储 |
| 10 | [dependencies.md](./10-dependencies.md) | 依赖关系 | 模块依赖矩阵、有向无环图、CDN、构建依赖 |
| 11 | [run-and-build.md](./11-run-and-build.md) | 运行与构建 | dev/build/test/lint/部署/性能/安全 |
| 12 | [development-guide.md](./12-development-guide.md) | 开发指南 | 编码约定、陷阱、扩展点、调试、提交清单 |

## 0.3 项目核心数据

| 维度 | 数值 |
| --- | --- |
| **代码模块** | 45+ 个 ES Module |
| **测试套件** | 25 套件 / 1127 用例 |
| **节点类型** | 50 种（数字 ID 1~76 跨过 49 个数） |
| **依赖** | 仅 `js-yaml`（CDN 加载） |
| **框架** | 零（纯原生 ES Module） |
| **CSS 框架** | 零（CSS 变量 + 原生） |
| **生产依赖** | 1 个 (`js-yaml`) |
| **开发依赖** | 14 个 |
| **代码量** | 约 15000+ 行 JS + 3000+ 行 CSS |
| **支持浏览器** | Chrome 90+ / Firefox 88+ / Safari 14+ / Edge 90+ |
| **Node.js** | >= 20.17（CI: 22.x / 24.x） |

## 0.4 项目核心特性

### 编辑器
- 50 种节点类型 + 容器（loop / batch）嵌套
- 缩放、平移、网格吸附、小地图、视口剔除
- 撤销/重做（50 步）
- 剪贴板复制/粘贴（Coze 格式）
- 自动保存（5s 间隔）
- 搜索高亮
- 对齐与分布
- 多选与框选
- 触摸设备支持
- SVG 导出
- 批量参数编辑
- 自定义快捷键

### 转换器
- YAML ↔ Coze 双向转换
- 22 种节点转换处理器
- 语法高亮（JSON / YAML）
- 虚拟滚动（>1000 行）
- Web Worker 异步高亮
- 历史记录（20 条）
- 统计视图
- 依赖图视图

### 管理器
- 工作流 CRUD
- 批量选择/删除
- 拖拽排序
- 搜索
- 模板库
- 版本对比
- 导入/导出

### 共享
- 国际化（中英）
- 主题（深/浅）
- 模态对话框
- 序列化
- 依赖图
- 页面导航

## 0.5 关键架构决策

| 决策 | 原因 |
| --- | --- |
| 零框架依赖 | 产物可 `file://` 单文件运行 |
| 组合模式 | 避免上帝类，易测试易扩展 |
| 内部格式与 Coze 格式分离 | 编辑器内操作简化，导入/导出做映射 |
| CSS 变量驱动主题 | 一套样式支持多主题 |
| 容器 `>` 子选择器 | 避免样式泄漏 |
| 箭头函数实例属性 | 避免 `this` 绑定问题 |
| 快捷键大小写不敏感 | 用户友好 |
| Web Animations API | 跨帧绘制一致性 |
| 虚拟滚动 + Worker | 大数据量性能 |
| `core.batchChanges(fn)` | 合并多次变更通知 |
| `data:text/javascript;base64` 内联 | 单文件构建 |

## 0.6 项目目录结构

```
workflow/
├── src/
│   ├── views/             # HTML 入口
│   ├── modules/           # 核心模块
│   ├── components/        # 转换器组件
│   ├── i18n/              # 国际化
│   ├── styles/            # CSS
│   ├── utils/             # 工具
│   ├── config/            # 配置
│   ├── scripts/           # 构建脚本
│   └── assets/            # 静态资源
├── tests/                 # Jest 测试
├── wiki/                  # 本文档
├── package.json
├── jest.config.js
├── README.md
├── AGENTS.md
└── CHANGELOG.md
```

## 0.7 快速链接

### 我想了解...
- **项目是什么** → [01-overview.md](./01-overview.md)
- **怎么组织代码** → [02-architecture.md](./02-architecture.md) + [03-project-structure.md](./03-project-structure.md)
- **用什么技术** → [04-tech-stack.md](./04-tech-stack.md)
- **怎么转换 YAML 和 Coze 格式** → [05-modules-converter.md](./05-modules-converter.md)
- **怎么编辑工作流** → [06-modules-editor.md](./06-modules-editor.md)
- **怎么管理工作流** → [07-modules-manager-shared.md](./07-modules-manager-shared.md)
- **关键类怎么工作** → [08-key-classes.md](./08-key-classes.md)
- **数据结构长什么样** → [09-data-structures.md](./09-data-structures.md)
- **模块怎么依赖** → [10-dependencies.md](./10-dependencies.md)
- **怎么运行和构建** → [11-run-and-build.md](./11-run-and-build.md)
- **怎么开发新功能** → [12-development-guide.md](./12-development-guide.md)

### 我要开发...
- **新节点类型** → [12-development-guide.md § 12.3.1](./12-development-guide.md#1231-添加新节点类型)
- **新快捷键** → [12-development-guide.md § 12.3.2](./12-development-guide.md#1232-添加新快捷键)
- **新主题** → [12-development-guide.md § 12.3.3](./12-development-guide.md#1233-添加新主题)
- **新模板** → [12-development-guide.md § 12.3.4](./12-development-guide.md#1234-添加新工作流模板)
- **新属性面板字段** → [12-development-guide.md § 12.3.5](./12-development-guide.md#1235-添加新属性面板字段)

### 我遇到了...
- **`Cannot read properties of undefined`** → [12-development-guide.md § 12.1.3](./12-development-guide.md#1213-this-绑定规范-critical)
- **容器内样式异常** → [12-development-guide.md § 12.1.4](./12-development-guide.md#1214-容器节点-css-规范-critical)
- **翻译键显示原文** → [12-development-guide.md § 12.1.5](./12-development-guide.md#1215-国际化翻译键)
- **`loop_set_variable` 参数丢失** → [12-development-guide.md § 12.2.3](./12-development-guide.md#1223-loop_set_variable-特殊处理)
- **边连接异常** → [12-development-guide.md § 12.2.4](./12-development-guide.md#1224-容器节点端口校验)
- **快捷键不生效** → [12-development-guide.md § 12.2.8](./12-development-guide.md#1228-快捷键输入框)

## 0.8 维护与更新

| 场景 | 更新文档 |
| --- | --- |
| 新增节点类型 | `09-data-structures.md` + `08-key-classes.md`（`editor-node-types.js`） |
| 新增模块 | `10-dependencies.md` + `03-project-structure.md` |
| 重大架构变更 | `02-architecture.md` + `AGENTS.md` |
| 新增快捷键 | `12-development-guide.md`（默认列表） |
| 修复重要 bug | `12-development-guide.md`（陷阱部分） |
| 发布新版本 | `CHANGELOG.md` + `01-overview.md`（里程碑） |

## 0.9 反馈与贡献

- **问题反馈**：GitHub Issues
- **代码贡献**：参见 [12-development-guide.md](./12-development-guide.md) 提交前清单
- **AI 协作**：参见 `AGENTS.md`
