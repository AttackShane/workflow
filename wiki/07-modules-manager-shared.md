# 07 · 管理器与共享模块

## 7.1 管理器（manager）

### 7.1.1 入口与初始化

```js
// app.js 识别 h1 包含"工作流管理"
import { WorkflowManager } from './manager.js';
const manager = new WorkflowManager();
manager.init();
```

### 7.1.2 `WorkflowManager` 类

```js
class WorkflowManager {
    workflows: [];            // 工作流列表
    currentEditingId: null;   // 当前正在编辑的 ID
    batchMode: false;         // 批量操作模式
    selectedIds: Set;         // 批量选中的 ID
    elements: { ... };        // 缓存的 DOM 元素
}
```

### 7.1.3 主要职责

| 功能 | 方法 |
| --- | --- |
| 加载工作流列表 | `loadWorkflows()` |
| 渲染工作流卡片 | `renderWorkflowList()` |
| 创建新工作流 | `handleNewWorkflow()` |
| 编辑工作流 | `handleEditWorkflow(id)` |
| 删除单个工作流 | `handleDeleteWorkflow(id)` |
| 批量删除 | `handleBatchDelete()` |
| 切换批量模式 | `toggleBatchMode()` |
| 导入文件 | `handleImportFile()` |
| 导出工作流 | `handleExportWorkflow(id)` |
| 应用模板 | `applyTemplate(template)` |
| 显示模板库 | `handleShowTemplates()` |
| 搜索工作流 | `handleSearch(query)` |
| 拖拽排序 | `handleDragStart/Move/Drop()` |
| 加载编辑器保存的工作流 | `loadSavedWorkflow()` |
| 保存版本快照 | `saveWorkflowVersion(workflowId, workflow)` |

### 7.1.4 跨页通信（sessionStorage）

编辑器 → 管理器 的数据流：

```
编辑器 (editor.html)
   │  Storage.session.set('savedWorkflow', workflow)
   │  Storage.session.set('editingWorkflowId', id)
   ▼
navigateTo(manager.html)
   │
   ▼
管理器 (manager.html) loadSavedWorkflow()
   │ 读取 sessionStorage
   │ 更新 workflows[]
   │ saveWorkflows()
   │ renderWorkflowList()
```

### 7.1.5 模板库 `manager-templates.js`

```js
export const WORKFLOW_TEMPLATES = [
    {
        id: 'tpl_welcome',
        name: 'templates.tpl_welcome.name',        // i18n 键
        description: 'templates.tpl_welcome.description',
        icon: '👋',
        category: 'templates.categories.basic',
        nodes: [
            { id: 'node_100001', type: 'start', x, y, title, description }
            // ...
        ],
        edges: [ ... ]
    },
    // tpl_chatbot, tpl_image_gen, tpl_rag, tpl_loop, ...
];

export function resolveTemplateI18n(template);
```

预置模板（截至 v1.4.4）：

- `tpl_welcome` — 欢迎机器人
- `tpl_chatbot` — 智能客服（含意图识别）
- `tpl_image_gen` — 图像生成
- 更多...

### 7.1.6 工作流版本对比

- `saveWorkflowVersion(workflowId, workflow)` — 每次保存时记录版本
- 版本存储在 `localStorage[workflow_versions_${id}]`
- 支持差异对比（基于 JSON）

## 7.2 共享模块

### 7.2.1 `shared-navigator.js`

#### `Navigator` 类（单例）

```js
const navigator = new Navigator();

navigator.navigateTo(url, { animate, message });
```

- 提供带淡入淡出动画的页面切换
- 自动清理 `sessionStorage` 中的编辑器残留
- 避免重复导航（`_isNavigating` 标志）
- 三个快捷方法：
  - `goToManager()` → `/`
  - `goToEditor()` → `/editor`
  - `goToConverter()` → `/converter`

#### 关键设计

- 使用 `document.body.animate()` 替代 CSS `transition`（避免首帧前回调拥挤）
- 监听 `pageshow` 事件恢复透明度（处理浏览器返回）
- 加载 i18n 用于提示消息国际化

### 7.2.2 `shared-theme.js`

#### `ThemeController` 类（单例）

```js
const themeController = new ThemeController();
themeController.initThemeController();
```

**功能**：

- 主题切换（`dark` / `light`），持久化到 `localStorage[workflow-converter-theme]`
- 字体大小调节（12-20px），持久化到 `localStorage[workflow-converter-fontsize]`
- 行号显示切换，持久化到 `localStorage[workflow-converter-linenumbers]`
- 通过 `data-theme` 属性 + CSS 变量切换主题
- 监听 `data-theme` 变更（MutationObserver）以触发小地图重绘

#### API

| 方法 | 用途 |
| --- | --- |
| `initThemeController()` | 初始化 |
| `_toggleTheme()` | 切换 |
| `_decreaseFontSize()` / `_increaseFontSize()` | 字体调节 |
| `_toggleLineNumbers()` | 切换行号 |
| `updateThemeButtonText()` | 更新按钮文本（依赖 i18n） |

#### 配置

```js
APP_CONFIG.THEME = {
    KEY: 'workflow-converter-theme',
    DEFAULT: 'light',
    FONT_SIZE_KEY: 'workflow-converter-fontsize',
    DEFAULT_FONT_SIZE: 14,
    FONT_SIZE_MIN: 12,
    FONT_SIZE_MAX: 20,
    FONT_SIZE_STEP: 1
};
```

### 7.2.3 `shared-i18n.js`

#### `I18nController` 类（单例）

```js
const i18nController = new I18nController();
i18nController.init();
```

**功能**：

- 监听 `languageBtn` 点击 → 切换语言
- 缓存需要更新的 DOM 元素
- 语言切换时更新所有 `data-i18n` 元素的文本
- 与主题按钮文本更新协作

#### API

| 方法 | 用途 |
| --- | --- |
| `init()` | 初始化 |
| `cacheElements()` | 缓存 DOM 元素 |
| `bindEvents()` | 绑定语言按钮事件 |
| `toggleLanguage()` | 切换语言 |
| `handleLanguageChange(lang)` | 语言变化处理 |
| `updateLanguageButton()` | 更新语言按钮文本 |
| `performUpdate()` | 执行 UI 文本更新 |

### 7.2.4 `shared-dialog.js`

#### `Dialog` 静态类

```js
import { Dialog } from './shared-dialog.js';

await Dialog.alert(message, title, options);
await Dialog.confirm(message, title, options);  // 返回 true/false
await Dialog.prompt(title, options);             // 返回 { name, description } / null
```

**特性**：

- 单实例（`#overlay` / `#container` / `#currentResolve`）
- 200ms 淡入淡出过渡
- ESC 关闭
- 点击遮罩关闭
- Promise 化 API（`async/await` 友好）
- 支持 `danger: true`（红色危险按钮）
- Promise 解决后清理事件监听器

#### API

| 方法 | 返回 | 用途 |
| --- | --- | --- |
| `Dialog.alert(msg, title?, options?)` | `Promise<void>` | 信息提示 |
| `Dialog.confirm(msg, title?, options?)` | `Promise<boolean>` | 确认对话框 |
| `Dialog.prompt(title?, options?)` | `Promise<{name, description} \| null>` | 输入对话框 |

#### 选项

```js
{
    danger: boolean,        // 危险样式（红色按钮）
    okText: string,         // 自定义确认按钮文本
    cancelText: string,     // 自定义取消按钮文本
    showDescription: boolean,  // prompt 是否显示描述字段
    nameValue: string,      // prompt 名称初始值
    descValue: string,      // prompt 描述初始值
    placeholder: object,    // prompt 占位符
}
```

### 7.2.5 `shared-serializer.js`

#### 核心 API

```js
// 内部 → Coze 剪贴板
export function convertInternalToClipboardNode(node, allNodes);

// Coze 剪贴板 → 内部
export function convertClipboardToInternal(data);

// 加载到 WorkflowCore
export function importWorkflow(workflow);
export function exportWorkflow(options);
export function loadFromClipboard(data);
```

#### `WorkflowSerializer` 类

```js
class WorkflowSerializer {
    constructor(core) { ... }
    importWorkflow(workflow);
    exportWorkflow(options);
    loadFromClipboard(data);
}
```

#### 关键转换规则

| 内部字段 | Coze 字段 | 说明 |
| --- | --- | --- |
| `node.id` | `cozeNode.id` (数字) | 去掉 `node_` 前缀 |
| `node.type` | `cozeNode.type` (数字) | `TYPE_MAP` 转换 |
| `node.x/y` | `cozeNode.meta.position.{x,y}` | 嵌套 |
| `node.title` | `cozeNode.data.nodeMeta.title` | |
| `node.icon` | `cozeNode.data.nodeMeta.icon` | |
| `node.parameters` | `cozeNode.data.inputs.{inputParameters,...}` | 类型相关 |
| `node.inputParams` | `cozeNode.data.inputs.inputParameters` | 动态入参 |
| `node.outputs` | `cozeNode.data.outputs` | |
| `node.outputs[].properties` | `cozeNode.data.outputs[].schema` | 数组化 |
| `edge.source/target` | `cozeNode.sourceNodeID/targetNodeID` | 去掉前缀 |
| `edge.sourcePort` | `cozeNode.sourcePortID` | |

#### 特殊节点处理

- **`loop_set_variable`**：`parameters.variables` 数组直接赋值给 `inputs.inputParameters`
- **`variable_merge`**：合并组变量 + 边映射
- **容器节点（loop / batch）**：`blocks` / `edges` 递归处理
- **`comment`**：Slate JSON 提取纯文本

### 7.2.6 `shared-graph.js`

#### `GraphView` 类（单例）

```js
const graphView = new GraphView();
graphView.initGraphModal();
```

**功能**：

- 在模态框中渲染工作流依赖图（SVG）
- 节点：彩色矩形（按类型着色）
- 边：贝塞尔曲线
- 支持缩放、平移
- 点击节点 → 调用 `shared-node-detail.js` 弹出详情

#### API

| 方法 | 用途 |
| --- | --- |
| `renderWorkflowGraph(data, isJson)` | 渲染图 |
| `_findField(obj, ...keys)` | 多路径查找字段 |
| `_showNodeDetail(node)` | 弹出节点详情 |

### 7.2.7 `shared-node-detail.js`

#### `showNodeDetail(node)` 函数

弹出节点详情模态框：

- 显示节点 JSON 数据
- 显示 YAML 格式
- 复制为 JSON / YAML
- 跳转到编辑器编辑该节点

## 7.3 模块依赖关系

```
┌─────────────────────────────────────────────────────────┐
│  Manager                                                 │
│  manager.js                                              │
│   ├─→ shared-dialog.js (Dialog)                          │
│   ├─→ shared-navigator.js (navigate)                    │
│   ├─→ converter.js (YAML 转换)                            │
│   ├─→ converter-reverse.js (Coze → YAML)                  │
│   ├─→ shared-serializer.js (import/export)              │
│   ├─→ manager-templates.js (templates)                   │
│   └─→ i18n / utils / config                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Shared                                                  │
│  shared-navigator.js                                     │
│   ├─→ shared-theme.js (按钮文本更新)                       │
│   └─→ i18n (navigateTo 提示)                              │
│                                                          │
│  shared-theme.js                                         │
│   ├─→ shared-i18n.js (按钮文本)                           │
│   ├─→ config (APP_CONFIG)                                │
│   └─→ utils/helpers (Storage, DOM)                       │
│                                                          │
│  shared-i18n.js                                          │
│   ├─→ i18n/i18n.js (核心 I18n)                            │
│   └─→ shared-theme.js (按钮协作)                          │
│                                                          │
│  shared-dialog.js                                        │
│   └─→ i18n (按钮文本)                                    │
│                                                          │
│  shared-serializer.js                                    │
│   ├─→ utils/types (REV_TYPE_MAP)                         │
│   ├─→ utils/utils (deepClone)                            │
│   └─→ utils/helpers                                     │
│                                                          │
│  shared-graph.js                                         │
│   ├─→ shared-node-detail.js                              │
│   ├─→ utils/utils (颜色)                                  │
│   └─→ utils/helpers (StringUtils, jsyaml)               │
│                                                          │
│  shared-node-detail.js                                   │
│   ├─→ shared-dialog.js (复制提示)                         │
│   └─→ i18n (按钮文本)                                    │
└─────────────────────────────────────────────────────────┘
```

## 7.4 持久化数据

| 数据 | 存储 | Key | 模块 |
| --- | --- | --- | --- |
| 工作流列表 | localStorage | `workflows` | manager |
| 工作流版本 | localStorage | `workflow_versions_${id}` | manager |
| 编辑器当前工作流 | localStorage | `workflow_current` | editor |
| 主题 | localStorage | `workflow-converter-theme` | shared-theme |
| 字体大小 | localStorage | `workflow-converter-fontsize` | shared-theme |
| 行号显示 | localStorage | `workflow-converter-linenumbers` | shared-theme |
| 快捷键 | localStorage | `keyboardShortcuts` | editor-keyboard |
| 转换历史 | localStorage | `workflow-converter-history` | converter-history |
| 当前选中历史 | localStorage | `workflow-converter-selected` | converter-history |
| 语言 | localStorage | `workflow-converter-language` | i18n |
| 编辑中工作流 | sessionStorage | `editingWorkflowId` | editor / manager |
| 已保存工作流（跨页） | sessionStorage | `savedWorkflow` | editor / manager |
| 名称 / 描述（跨页） | sessionStorage | `savedWorkflowName` / `savedWorkflowDesc` | editor / manager |
