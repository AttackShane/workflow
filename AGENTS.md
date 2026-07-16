# Coze 工作流编辑器 & 转换器 - AI 会话上下文

> 此文件为 AI 会话提供项目上下文，每次会话开始时优先阅读。详细技术文档请参见 `wiki/` 目录。

---

## 项目定位

**零框架依赖的纯原生 JavaScript 工作台**，集以下能力于一身：
1. **工作流转换器**：YAML ↔ Coze 剪贴板格式双向转换
2. **可视化编辑器**：拖拽式画布编辑工作流
3. **工作流管理器**：本地存储、复用、整理多份工作流

**关键指标**：50 种节点类型、25 测试套件 / 1127 用例、纯 ES Module、零框架依赖、单文件 `file://` 可用。

---

## 核心架构

### 三页面架构
- **转换器页**（converter）：YAML ↔ Coze 转换、虚拟滚动、语法高亮
- **编辑器页**（editor）：可视化画布、节点/边/历史/剪贴板
- **管理页**（manager）：工作流 CRUD、批量操作、模板

### 组合模式
`WorkflowNode` 组合 5 个子模块：`render`、`container`、`panel`、`selector`、`paramEditor`

### 关键文件
- 入口：`app.js`（动态按需加载）
- 数据核心：`editor-core.js`（节点/边/历史）
- 画布：`editor-canvas.js`（缩放/平移/网格/小地图）
- 节点：`editor-node.js`（组合模式入口）
- 边：`editor-edge.js`（贝塞尔曲线/分支端口）
- 转换器：`converter.js` / `converter-reverse.js`
- 共享：`shared-dialog.js` / `shared-theme.js` / `shared-i18n.js`

---

## CRITICAL 编码规范

### 1. this 绑定（CRITICAL）
- 使用箭头函数实例属性：`this.method = () => { ... }`
- 事件监听器传入方法时必须 `.bind(this)`
- 递归调用使用 `.call(this, ...)`

### 2. 容器 CSS（CRITICAL）
- 容器样式必须使用直接子选择器 `>`：`.canvas-node.container > .node-header`
- 避免后代选择器泄漏到子节点

### 3. 国际化翻译键（CRITICAL）
- 翻译键必须放在正确的命名空间下：`t('nodes.variables')` 而非 `t('variables')`
- 新增翻译需同步中英文两个文件，运行 `npm run check:i18n`

### 4. 历史记录（CRITICAL）
- 批量操作使用 `core.batchChanges(fn)`，避免重复保存历史
- 操作完成后统一保存一次历史

### 5. 事件清理（CRITICAL）
- 所有事件监听器必须在 `destroy()` / `cleanup()` 中移除

---

## 特殊节点：loop_set_variable (type 20)

- **内部格式**：`node.parameters.variables` 数组（left/right 结构）
- **导出**：直接赋值给 `cozeNode.data.inputs.inputParameters`
- **导入**：遍历 `variables` 数组，重映射 `blockID`
- **属性面板**：可视化编辑器（跳过 JSON 文本框）

---

## 容器节点（loop / batch）

- 所有节点存储在 `core.nodes` 扁平数组中
- 子节点通过 `parentId` 指向容器节点
- 容器端口校验：外部端口只能连外部节点，内部端口只能连内部子节点

---

## 快捷键

- 大小写不敏感匹配
- Ctrl/Cmd 自动互换（兼容 Windows/Mac）
- 自定义配置持久化到 localStorage
- 默认：Ctrl+C/V/Z/Y/A/D/F/L/S/Delete/Esc

---

## 快速排查清单

| 问题现象 | 排查方向 |
|----------|----------|
| `Cannot read properties of undefined` | 检查事件监听器和递归调用的 `this` 绑定 |
| 容器内子节点样式异常 | 检查 CSS 是否使用 `>` 子选择器 |
| 翻译键显示原始文本 | 检查翻译键是否在正确的命名空间下 |
| `loop_set_variable` 参数丢失 | 检查导出/导入时是否保留 `variables` 数组 |
| 边连接异常 | 检查容器端口校验逻辑 |
| 对话框不显示 | 检查 `Dialog` 的 DOM 插入（`#show()` 中 `appendChild`） |

---

## 可用命令

```bash
npm run dev      # 开发服务器 (localhost:8080)
npm run build    # 构建到 dist/（三个独立 HTML 文件）
npm run test     # Jest 测试（25 套件，1127 用例）
npm run lint     # ESLint 检查
npm run check    # 类型 + i18n 一致性检查
```

---

## 详细文档索引

| 文档 | 主题 |
|------|------|
| [wiki/README.md](wiki/README.md) | Wiki 入口与索引 |
| [wiki/01-overview.md](wiki/01-overview.md) | 项目概览、目标用户、应用场景 |
| [wiki/02-architecture.md](wiki/02-architecture.md) | 整体架构、组合模式、数据流 |
| [wiki/03-project-structure.md](wiki/03-project-structure.md) | 目录树、模块分组、命名约定 |
| [wiki/04-tech-stack.md](wiki/04-tech-stack.md) | 技术栈、依赖、构建、测试 |
| [wiki/05-modules-converter.md](wiki/05-modules-converter.md) | 转换器模块详解 |
| [wiki/06-modules-editor.md](wiki/06-modules-editor.md) | 编辑器模块详解 |
| [wiki/07-modules-manager-shared.md](wiki/07-modules-manager-shared.md) | 管理器与共享模块 |
| [wiki/08-key-classes.md](wiki/08-key-classes.md) | 25+ 关键类详解 |
| [wiki/09-data-structures.md](wiki/09-data-structures.md) | 数据结构详解 |
| [wiki/10-dependencies.md](wiki/10-dependencies.md) | 依赖关系图 |
| [wiki/11-run-and-build.md](wiki/11-run-and-build.md) | 运行与构建 |
| [wiki/12-development-guide.md](wiki/12-development-guide.md) | 开发指南 |

---

## 版本历史

参见 [CHANGELOG.md](CHANGELOG.md)

---

## 上次会话修复

- **对话框不显示**：[shared-dialog.js](src/modules/shared-dialog.js) 的 `#show()` 方法缺少 `document.body.appendChild(this.#overlay)`，导致对话框元素创建后从未添加到 DOM。已修复：在 `#show()` 中添加 DOM 插入，在 `#close()` 动画结束后移除 DOM。
