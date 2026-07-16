# 02 · 整体架构

## 2.1 三页面架构

项目由三个独立的 HTML 页面组成（共用相同的样式/JS 模块）：

```
                  ┌───────────────────────────┐
                  │  src/views/*.html         │
                  │  ─────────────────────    │
                  │  workflow-manager.html    │ ◀─── 工作流列表 / 导入导出 / 模板
                  │  workflow-converter.html  │ ◀─── YAML ↔ JSON 转换
                  │  workflow-editor.html     │ ◀─── 可视化画布
                  └────────────┬──────────────┘
                               │ <script type="module" src="modules/app.js">
                               ▼
                  ┌───────────────────────────┐
                  │  src/modules/app.js       │   入口：识别页面、按需加载
                  └────────────┬──────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
  manager.js              converter-ui.js          editor-ui.js
  (管理页)                (转换页)                  (编辑器页)
       │                       │                       │
       └───────── 共享模块 (shared-*) ─────────────────┘
```

### 页面识别

`app.js` 通过 `<h1>` 文本判断当前页面：

| 标题包含 | 加载入口模块 |
| --- | --- |
| `转换器` / `converter` | `converter-ui.js`、`converter-keyboard.js`、`converter-stats.js`、`shared-graph.js` |
| `工作流管理` / `workflow manager` | `manager.js`（实例化 `WorkflowManager`） |
| 其他 | 编辑器页（由该页内联 `<script>` 自管理） |

`initI18nController()` 和 `initThemeController()` 在所有页面预先执行，确保首屏渲染时主题/语言已应用。

## 2.2 模块分层

```
┌─────────────────────────────────────────────────────────────┐
│  视图层  (HTML)                                              │
│  src/views/*.html                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│  入口层  (App Init)                                          │
│  app.js · shared-navigator.js (初始化主题/语言/导航)          │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌────────────────────┐
│  Manager      │ │  Converter    │ │  Editor (UI)       │
│  manager.js   │ │ converter-ui  │ │ editor-ui.js       │
│               │ │ converter*.js │ │  ├ canvas          │
│               │ │               │ │  ├ node (组合模式)  │
│               │ │               │ │  ├ edge            │
│               │ │               │ │  ├ history         │
│               │ │               │ │  ├ clipboard       │
│               │ │               │ │  ├ align           │
│               │ │               │ │  ├ keyboard        │
│               │ │               │ │  ├ selection       │
│               │ │               │ │  ├ messages        │
│               │ │               │ │  ├ search          │
│               │ │               │ │  ├ autosave        │
│               │ │               │ │  └ share           │
└──────┬────────┘ └──────┬────────┘ └──────┬─────────────┘
       │                  │                 │
       └──────────────────┴─────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Core 数据    │  │  Components  │  │  Shared (通用)   │
│  editor-core │  │ nodeHandlers │  │ shared-dialog    │
│  editor-stor │  │ inputMapper  │  │ shared-theme     │
│  shared-seri │  │ outputMapper │  │ shared-i18n      │
│              │  │ containerH.  │  │ shared-graph     │
│              │  │              │  │ shared-serializer│
│              │  │              │  │ shared-node-det. │
│              │  │              │  │ shared-navigator │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Utils        │  │  i18n        │  │  Config          │
│ helpers.js    │  │ i18n.js      │  │ constants.js     │
│ types.js      │  │ zh-CN.js     │  │                  │
│ utils.js      │  │ en-US.js     │  │                  │
│ logger.js     │  │ shared-i18n  │  │                  │
│ refCache.js   │  │              │  │                  │
└───────────────┘  └──────────────┘  └──────────────────┘
```

## 2.3 组合模式 (Composite Pattern)

编辑器节点 `editor-node.js` 是组合模式的典型应用：

```js
export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.render       = new WorkflowNodeRender(this);       // DOM 创建/拖拽
        this.container    = new WorkflowContainerRender(this);  // loop/batch 子节点
        this.panel        = new WorkflowNodePanel(this);        // 属性面板
        this.selector     = new WorkflowNodeSelector(this);     // 变量选择器
        this.paramEditor  = new WorkflowParamEditor(this);      // 输入输出参数编辑
    }
}
```

每个子模块通过 `this.node` 访问父实例，构成**树形组合**：

```
WorkflowUI
└── WorkflowNode
    ├── WorkflowNodeRender
    │   └── WorkflowNodeDrag
    │   └── WorkflowContainerRender
    ├── WorkflowNodePanel
    ├── WorkflowNodeSelector
    └── WorkflowParamEditor
```

### 组合模式的优势

| 优势 | 体现 |
| --- | --- |
| **职责单一** | 每个子模块只关注一个方面（渲染/面板/选择器/参数） |
| **易测试** | 单元测试可独立 mock 父类 |
| **解耦** | 子模块通过 `this.node` 访问上下文，无需全局变量 |
| **易扩展** | 新增节点能力只需新增一个子模块类 |

## 2.4 数据流

### 2.4.1 编辑器数据流

```
用户操作 (拖拽/连线/编辑)
       │
       ▼
  子模块 (node/edge/panel/...)
       │
       ▼
WorkflowCore  ◀──── 内部数据结构 (nodes[], edges[], history[])
       │
       ▼
  _emitChange(action)
       │
       ▼
WorkflowUI.onChange()  ◀──── 回调钩子
       │
       ├── refreshCanvas()  (全量重渲染)
       ├── updateEdges()    (增量更新 SVG)
       ├── updateSummary()  (统计面板)
       └── history.updatePanel() (历史步骤面板)
```

### 2.4.2 转换器数据流

**YAML → Coze 格式**：

```
YAML 文本
   │ (js-yaml.load)
   ▼
YAML AST
   │ (validateYamlInput, calculateBounds)
   ▼
节点列表
   │ (每个节点走 nodeHandlers[type])
   ▼
Coze 剪贴板数据 { type, source, json: { nodes, edges } }
   │ (JSON.stringify)
   ▼
JSON 文本（高亮显示）
```

**Coze 格式 → YAML**（反向）：

```
Coze 剪贴板数据
   │ (validateClipboardInput)
   ▼
节点列表
   │ (TYPE_PARAMS_MAP 提取白名单参数 + convertValue 递归)
   ▼
YAML AST
   │ (js-yaml.dump)
   ▼
YAML 文本
```

### 2.4.3 双向同步（编辑器 ↔ Coze）

- **导出**：`convertInternalToClipboardNode(node, allNodes)` → Coze JSON
- **导入**：`pasteFromCozeFormat(data)` → ID 重映射 + blockID 重映射 → 内部节点
- **内部格式 ≠ Coze 格式**：内部使用 `parameters: { name, value }`，Coze 使用 `inputs: { inputParameters: [{ name, input: { type, value } }] }`

## 2.5 状态管理

### 编辑器（`WorkflowCore`）

```js
class WorkflowCore {
    nodes: [];          // 节点列表
    edges: [];          // 边列表
    nodeIdCounter: 100000;
    edgeIdCounter: 100000;
    selectedNode: null;
    selectedEdge: null;
    history: [];        // 历史快照（最多 50 步）
    historyIndex: -1;
    maxHistory: 50;
    _onChange: null;    // 数据变更回调
    _batchMode: false;  // 批量模式（合并多次变更）
    _nodeTypeInfo: {};  // 节点类型元信息（含翻译）
}
```

### 转换器（`UIController`）

```js
class UIController {
    _curData: null;          // 当前转换结果
    _curDataType: null;      // 'json' | 'yaml'
    _selectedFile: null;
    _worker: null;           // Web Worker（语法高亮）
    _virtualScroll: null;    // 虚拟滚动实例
    _conversionCache: Map;   // 转换缓存
    _highlightCache: Map;    // 高亮缓存
}
```

### 管理器（`WorkflowManager`）

```js
class WorkflowManager {
    workflows: [];            // 工作流列表
    currentEditingId: null;
    batchMode: false;         // 批量操作模式
    selectedIds: Set;         // 批量选中 ID
}
```

## 2.6 跨模块通信机制

| 机制 | 用途 |
| --- | --- |
| **构造器注入** | `new WorkflowUI(core)`、`new WorkflowClipboard(ui)` |
| **事件回调** | `core.onChange = (action) => { ... }` |
| **i18n 监听器** | `i18n.addListener((lang) => { ... })` |
| **languagechange DOM 事件** | 跨模块语言切换（通过 `document.dispatchEvent`） |
| **sessionStorage 跨页通信** | 编辑器 → 管理器：保存工作流 |
| **localStorage 持久化** | 工作流存储、主题、字体大小、快捷键配置 |
| **类组合 (`this.node` / `this.ui`)** | 子模块访问父模块 |

## 2.7 关键设计决策

| 决策 | 原因 |
| --- | --- |
| 零框架依赖 | 产物可单文件运行，`file://` 直开 |
| 组合模式代替继承 | 节点相关功能复杂，避免上帝类 |
| 内部格式与 Coze 格式分离 | 编辑器内部操作更简单，剪贴板导入/导出时做映射 |
| 样式用 CSS 变量 | 一套样式 + 主题切换 |
| 容器内 `pointer-events: none` + 子节点恢复 | 容器内连线可点击 + 框选可识别容器范围 |
| 历史记录保存 deepClone | 撤销/重做时回滚到完整快照，简单可靠 |
| 网格吸附、缩放、小地图独立开关 | 大工作流性能优化按需启用 |
| 边采用增量更新 (`_upsertEdgeElements`) | 避免全量重绘 |
| 节点批量测量 (`batchMeasureElements`) | N 个节点仅 1 次 forced reflow |
| 翻译键放在 `nodes` 等命名空间下 | 避免命名冲突并方便按模块管理 |
| 容器样式用 `>` 子选择器 | 避免样式泄漏到子节点 |
| `this` 绑定使用箭头函数实例属性 | 避免 `TypeError: Cannot read properties of undefined` |
| 快捷键大小写不敏感 | 用户输入 "Ctrl+F" 与 "Ctrl+f" 等价 |
| Ctrl/Cmd 自动互换 | Windows 与 Mac 统一 |
