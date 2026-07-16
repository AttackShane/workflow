# 08 · 关键类详解

> 本文档深入讲解项目中最重要的类，包括字段、方法、协作关系和关键实现。

## 8.1 `WorkflowCore`（`editor-core.js`）

### 8.1.1 角色

数据核心层。负责工作流的"单一可信源"（Single Source of Truth）：

- 节点和边数组
- ID 自增计数器
- 历史快照
- 选择状态
- 验证逻辑

### 8.1.2 字段

```js
class WorkflowCore {
    // 数据
    nodes: Node[];                 // 所有节点（含子节点）
    edges: Edge[];                 // 所有边
    nodeIdCounter: number;         // 默认 100000
    edgeIdCounter: number;         // 默认 100000

    // 选择
    selectedNode: string | null;
    selectedEdge: string | null;

    // 历史
    history: HistorySnapshot[];
    historyIndex: number;          // -1 表示空
    maxHistory: number;            // 50

    // 通知
    _onChange: function | null;
    _batchMode: boolean;

    // 元信息（带 i18n）
    _nodeTypeInfo: object;         // 50 种节点配置

    // 子模块
    storage: WorkflowStorage;
    serializer: WorkflowSerializer;
}
```

### 8.1.3 关键方法

#### 变更通知

```js
set onChange(fn) { this._onChange = fn; }

_emitChange(action, data?) {
    if (this._onChange && !this._batchMode) {
        this._onChange(action, data);
    }
}

batchChanges(fn) {
    this._batchMode = true;
    try { fn(); }
    finally {
        this._batchMode = false;
        if (this._onChange) this._onChange('batch', null);
    }
}
```

#### 节点 CRUD

```js
createNode(type, x, y, data?);
addNode(nodeData);
deleteNode(nodeId);  // 递归删除子节点
getChildNodes(parentId);
isContainerNode(nodeId);
updateNodePosition(nodeId, x, y);
updateNodeProperty(nodeId, key, value);
```

#### 边 CRUD

```js
createEdge(sourceId, targetId, sourcePort?, targetPort?);
// 容器端口校验：
// - 容器外部端口只能连外部节点
// - 容器内部端口只能连容器内子节点

addEdge(edgeData);  // 去重
deleteEdge(edgeId);
```

#### 历史

```js
saveHistory(actionKey, actionParams);
resetHistory(actionKey, actionParams);
undo();
redo();
canUndo();
canRedo();
```

#### 选择

```js
selectNode(nodeId);
selectEdge(edgeId);
clearAll();
```

#### 验证

```js
validate() {
    // 返回 { valid, message, errors }
    // 规则：
    // - 必须有 1 个 start 节点
    // - 必须有 ≥1 个 end 节点
    // - 节点（除 start/comment/input）必须有入边
    // - 节点（除 end/comment/break）必须有出边
}
```

#### 类型解析

```js
getTypeNumber(type);      // 'llm' → '3'
getTypeFromNumber('3');   // → 'llm'（抛错如果未知）
```

### 8.1.4 协作关系

```
                ┌─────────────────────────┐
                │     WorkflowCore        │
                │  (data + history)       │
                └──────────┬──────────────┘
                           │
        ┌──────────────────┼────────────────────┐
        ▼                  ▼                    ▼
   WorkflowUI       WorkflowStorage      WorkflowSerializer
   (回调钩子)        (localStorage)        (导入/导出)
```

## 8.2 `WorkflowUI`（`editor-ui.js`）

### 8.2.1 角色

UI 总控层。负责：

- 协调所有子模块
- 监听数据变更并触发 UI 更新
- 处理保存、退出、导出等高层操作

### 8.2.2 字段

```js
class WorkflowUI {
    core: WorkflowCore;
    canvas: WorkflowCanvas;
    node: WorkflowNode;
    edge: WorkflowEdge;
    history: WorkflowHistory;
    clipboard: WorkflowClipboard;
    align: WorkflowAlign;
    keyboard: WorkflowKeyboard;
    selection: WorkflowSelection;
    search: WorkflowSearch;
    autoSave: WorkflowAutoSave;
    share: WorkflowShare;
    messages: WorkflowMessages;

    // 状态
    isMultiSelectMode: boolean;
    connectingFrom: object | null;
    _changeVersion: number;
    _lastSavedVersion: number;
    _confirmingExit: boolean;
    currentDescription: string;
}
```

### 8.2.3 关键方法

#### 生命周期

```js
init() {
    this._initSubModules();
    this._initEventBindings();
    this._renderInitialNodes();
    this._lastSavedVersion = this._captureSnapshot();
    this.autoSave.startAutoSave();
    i18n.addListener(() => this.handleLanguageChange());
}
```

#### 事件总线

```js
core.onChange = (action) => {
    this._changeVersion++;
    if (action === 'undo' || action === 'redo' || action === 'clearAll' || action === 'batch' || action === 'jumpToHistory') {
        this.refreshCanvas();
        this.history.updatePanel();
        this.renderNodePalette();
    } else if (action === 'history') {
        this.history.updatePanel();
    } else if (action === 'selection') {
        this.renderNodePalette();
    } else {
        this.updateEdges();
        this.canvas.updateSvgSize();
        this.updateSummary();
        if (this.core.nodes.length === 0) this.canvas.setEmptyState(true);
    }
};
```

#### 关键操作

```js
// 节点
addNodeToCanvas(type, screenX, screenY);  // 委托给 node.render
deleteNode(nodeId);                         // 委托给 node.render
saveNodeDetail(nodeId);                     // 委托给 node.panel

// 边
deleteEdge(edgeId);                         // 委托给 edge
startConnection(nodeId, e, portId);         // 委托给 edge
cancelConnection();                          // 委托给 edge

// 选择
toggleSelectedNodesLock();                  // Ctrl+L

// 画布
validate();                                 // 验证并提示
clearCanvas();                              // 确认后清空
exportAsImage();                            // PNG
exportAsSvg();                              // SVG

// 保存
saveAndReturn();                            // 保存到管理页
confirmExit();                              // 退出前确认
quickSave();                                // 快速保存（不退出）

// 状态
hasUnsavedChanges();                        // 用于退出确认
markSaved();
```

## 8.3 `WorkflowCanvas`（`editor-canvas.js`）

### 8.3.1 角色

画布层。负责坐标系变换、视口管理、网格/吸附、小地图、缩放。

### 8.3.2 字段

```js
class WorkflowCanvas {
    canvas: HTMLElement;
    canvasContent: HTMLElement;
    svgLayer: SVGElement;             // 边渲染层
    svgHitLayer: SVGElement;          // 边点击层
    alignmentGuides: SVGElement;      // 对齐辅助线
    emptyState: HTMLElement;
    gridSvg: SVGElement;
    gridPattern: SVGElement;

    canvasScale: number;              // 0.25 ~ 3
    isMarqueeSelectionActive: boolean;
    hasDraggedCanvas: boolean;
    gridVisible: boolean;
    snapEnabled: boolean;
    gridSize: number;                 // 5 ~ 100

    minimapEl: HTMLElement;
    minimapCanvas: HTMLCanvasElement;
    minimapViewport: HTMLElement;
    minimapVisible: boolean;
    minimapScale: number;             // 0.08
    _minimapTransform: object;

    viewport: { left, top, right, bottom };
    lastMouseX: number;
    lastMouseY: number;

    // 性能
    renderDebounceTimer: number;
    visibleNodes: Set;
    renderBatchSize: number;          // 50
    renderThreshold: number;          // 50
}
```

### 8.3.3 关键方法

#### 缩放/平移

```js
zoomIn() / zoomOut();
centerView();
resetView();
onCanvasWheel(e);          // Ctrl + 滚轮
applyTransform(x, y, scale);
getCurrentTransform();
```

#### 网格

```js
toggleGrid();
toggleSnap();
setGridSize(size);
snapToGrid(value);
_createGridLayer();        // 创建 SVG pattern
```

#### 小地图

```js
initMinimap();
toggleMinimap();
renderMinimap();           // 节点缩略图
updateMinimapViewport();   // 视口指示器
navigateMinimap(e);        // 点击/拖拽
calculateNodesBounds();    // 计算节点边界
```

#### 坐标转换

```js
screenToCanvas(screenX, screenY);  // 屏幕 → 画布
canvasToScreen(canvasX, canvasY);  // 画布 → 屏幕
```

#### 视口

```js
updateViewport();           // 更新视口矩形
scheduleRenderUpdate();     // 防抖渲染
```

#### 触摸

```js
onTouchStart(e);            // 单指/双指
onTouchMove(e);
onTouchEnd();
```

#### 导出

```js
exportAsImage(format);      // 'png' | 'svg'
```

## 8.4 `WorkflowNode`（`editor-node.js`）

### 8.4.1 角色

节点功能组合入口。**不直接实现功能**，通过 5 个子模块组合。

### 8.4.2 结构

```js
class WorkflowNode {
    ui: WorkflowUI;
    core: WorkflowCore;
    propertyContent: HTMLElement;

    render: WorkflowNodeRender;
    container: WorkflowContainerRender;
    panel: WorkflowNodePanel;
    selector: WorkflowNodeSelector;
    paramEditor: WorkflowParamEditor;
}
```

## 8.5 `WorkflowNodeRender`（`editor-node-render.js`）

### 8.5.1 字段

```js
class WorkflowNodeRender {
    node: WorkflowNode;
    drag: WorkflowNodeDrag;
    container: WorkflowContainerRender;

    // 共享状态
    _elMap: Map;              // nodeId → HTMLElement（通过 node._elMap 共享）
    CONTAINER_HEADER_H: 36;
    CONTAINER_DESC_H: 20;
    CONTAINER_BORDER: 1;
    CONNECTION_POINT_EXT: 6;
}
```

### 8.5.2 关键方法

```js
createElement(nodeData, options?);
batchMeasureElements(elements);  // 批量测量（性能关键）
addToCanvas(type, screenX, screenY);
delete(nodeId);
_reRenderNode(nodeId);            // 单节点重渲
```

## 8.6 `WorkflowEdge`（`editor-edge.js`）

### 8.6.1 字段

```js
class WorkflowEdge {
    ui: WorkflowUI;
    core: WorkflowCore;
    propertyContent: HTMLElement;
}
```

### 8.6.2 关键方法

```js
_computeEdgeGeometry(edge);   // 纯函数：边 → 几何
_upsertEdgeElements(edge, geom);  // 增量更新
updateAllEdges();
startConnection(nodeId, e, portId);
cancelConnection();
delete(edgeId);
renderPropertyPanel(edge);
```

## 8.7 `WorkflowKeyboard`（`editor-keyboard.js`）

### 8.7.1 字段

```js
const DEFAULT_SHORTCUTS = {
    delete: 'Delete',
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    duplicate: 'Ctrl+D',
    selectAll: 'Ctrl+A',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    save: 'Ctrl+S',
    search: 'Ctrl+F',
    lock: 'Ctrl+L',
    escape: 'Escape',
};

class WorkflowKeyboard {
    shortcuts: { ...DEFAULT_SHORTCUTS };
    _keydownHandler: function;
    _navConverterHandler: function;
    _navManagerHandler: function;
}
```

### 8.7.2 关键方法

```js
parseShortcut(shortcutStr);   // 字符串 → { ctrl, shift, alt, meta, key }
matchShortcut(e, shortcutStr);  // 大小写不敏感 + Ctrl/Cmd 互换
saveShortcuts(newShortcuts);    // 保存到 localStorage
resetShortcuts();
getShortcuts();
loadShortcuts();
setupEventListeners();
setupShortcutSettingsEvents();  // 模态配置 UI
handleKeydown(e);               // 主分发器
```

## 8.8 `WorkflowStorage`（`editor-storage.js`）

### 8.8.1 字段与方法

```js
class WorkflowStorage {
    core: WorkflowCore;

    saveToLocalStorage(key='workflow_current');
    loadFromLocalStorage(key);
    hasSavedWorkflow(key);
    clearSavedWorkflow(key);
    syncIdCounters();  // 根据已有节点/边同步计数器
}
```

### 8.8.2 数据结构

```js
// 存储格式
{
    nodes: [...],
    edges: [...],
    nodeIdCounter: number,
    edgeIdCounter: number,
    selectedNode,
    selectedEdge,
    savedAt: timestamp
}
```

## 8.9 `WorkflowSerializer`（`shared-serializer.js`）

### 8.9.1 字段与方法

```js
class WorkflowSerializer {
    core: WorkflowCore;

    importWorkflow(workflow);
    exportWorkflow(options);
    loadFromClipboard(data);
}

// 独立函数（供 manager 等使用）
export function convertClipboardToInternal(data);
export function convertInternalToClipboardNode(node, allNodes);
```

### 8.9.2 关键转换

详见 [07-manager-shared § 7.2.5](./07-modules-manager-shared.md#725-shared-serializerjs)。

## 8.10 `Dialog`（`shared-dialog.js`）

### 8.10.1 静态类

```js
class Dialog {
    static #overlay;           // 单例遮罩
    static #container;         // 单例对话框容器
    static #currentResolve;    // 当前 Promise 解析器
    static #keydownHandler;    // ESC 监听器
    static #isClosing;
    static #closeTimer;
    static #TRANSITION_MS = 200;

    static #init();
    static #close(result);
    static #createOverlay();

    static alert(msg, title?, options?);
    static confirm(msg, title?, options?);
    static prompt(title?, options?);
}
```

### 8.10.2 内部状态

- 单实例（避免重复创建）
- Promise 化 API
- 200ms 过渡
- ESC / 点击遮罩关闭

## 8.11 `I18nManager`（`i18n/i18n.js`）

### 8.11.1 字段

```js
class I18nManager {
    language: string;       // 'zh-CN' | 'en-US'
    listeners: Function[];  // 监听器列表
}
```

### 8.11.2 关键方法

```js
getLanguage();
setLanguage(lang);
t(key, params?);           // 获取翻译（支持嵌套 key + 占位符）
addListener(fn);
removeListener(fn);
notifyListeners();
loadFromStorage();
saveToStorage();
getValueByKey(obj, key);   // 嵌套 key 解析（'a.b.c'）
replaceParams(str, params);  // {{var}} 替换
```

### 8.11.3 占位符语法

```js
// 语言包
{
    history: {
        jumpTo: '跳转到 {{action}}'
    }
}

// 使用
i18n.t('history.jumpTo', { action: '添加节点' });
// → "跳转到 添加节点"
```

## 8.12 `Navigator`（`shared-navigator.js`）

### 8.12.1 字段

```js
class Navigator {
    _isNavigating: boolean;
    _tFn: Function | null;  // i18n 翻译函数
}
```

### 8.12.2 关键方法

```js
navigateTo = (url, { animate, message }) => { ... };
goToManager();
goToConverter();
goToEditor();
_loadI18n();
_restoreOpacity();
```

### 8.12.3 动画实现

使用 Web Animations API：

```js
document.body.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 200,
    easing: 'ease-in',
    fill: 'forwards'
});
```

（替代 CSS transition，避免首帧回调拥挤导致过渡不触发）

## 8.13 `WorkflowMessages`（`editor-messages.js`）

### 8.13.1 字段

```js
class WorkflowMessages {
    ui: WorkflowUI;
    container: HTMLElement;
}
```

### 8.13.2 关键方法

```js
createContainer();   // 创建右上角消息容器
show(text, type);    // type: success/error/info/warning
```

## 8.14 `WorkflowAutoSave`（`editor-autosave.js`）

### 8.14.1 字段

```js
class WorkflowAutoSave {
    ui: WorkflowUI;
    autoSaveTimer: number;            // 5s 间隔
    _autoSaveIndicatorTimer: number;   // 10s 间隔（更新状态文本）
    _lastAutoSaveTime: number;
}
```

### 8.14.2 状态显示

```js
if (elapsed < 10) text = '刚刚保存';
else if (elapsed < 60) text = 'N 秒前';
else if (elapsed < 3600) text = 'N 分钟前';
else text = 'N 小时前';
```

## 8.15 `WorkflowClipboard` 与 `WorkflowClipboardPaste`

### 8.15.1 `WorkflowClipboard`

```js
class WorkflowClipboard {
    ui: WorkflowUI;
    core: WorkflowCore;
    pasteHandler: WorkflowClipboardPaste;
    copiedNode: object | null;

    async copy();  // 复制选中 → Coze 格式 → 剪贴板
}
```

### 8.15.2 `WorkflowClipboardPaste`

```js
class WorkflowClipboardPaste {
    clipboard: WorkflowClipboard;

    pasteFromCozeFormat(data);
    pasteFromSimpleFormat(text);
    pasteFromSimpleNodeFormat(text);
}
```

### 8.15.3 关键处理

- **ID 重映射**：`node_${Date.now()}_${rand}`
- **blockID 重映射**：递归遍历 `variables`、`inputParameters`、`mergeGroups` 等
- **端口转换**：`true/false` → `branch_0/branch_n`
- **`loop_set_variable` 特殊处理**：保留 `variables` 数组

## 8.16 `ThemeController`（`shared-theme.js`）

### 8.16.1 字段

```js
class ThemeController {
    _elements: { themeBtn, fontSizeDisplay, fontSmallBtn, fontLargeBtn, ... };
    _currentTheme: 'light' | 'dark';
    _currentFontSize: number;
    _storageTimeout: number;
}
```

### 8.16.2 关键方法

```js
initThemeController = () => { ... };  // 箭头函数（this 绑定）
_toggleTheme = () => { ... };
_decreaseFontSize = () => { ... };
_increaseFontSize = () => { ... };
_toggleLineNumbers = () => { ... };
_updateThemeButtonText();
_updateFontSize();
_saveThemeToStorage(theme);
```

## 8.17 `WorkflowAlign`（`editor-align.js`）

### 8.17.1 字段

```js
class WorkflowAlign {
    ui: WorkflowUI;
    core: WorkflowCore;
}
```

### 8.17.2 关键方法

```js
setupAlignToolbar();
updateAlignToolbar();
alignNodes(mode);  // 8 种对齐模式
distribute(mode);  // 2 种分布模式
```

### 8.17.3 对齐算法

```js
// 左对齐：所有节点 x = minX
// 右对齐：所有节点 x = maxX - width
// 居中：所有节点 x = (minX + maxX) / 2 - width / 2
// 顶部：所有节点 y = minY
// 底部：所有节点 y = maxY - height
// 水平居中：所有节点 y = (minY + maxY) / 2 - height / 2
// 水平分布：节点间 x 间距相等
// 垂直分布：节点间 y 间距相等
```

## 8.18 `WorkflowSelection`（`editor-selection.js`）

### 8.18.1 关键方法

```js
selectAll();         // 排除 locked/子节点
deselectAll();
updateSelection();   // 单选/多选切换
```

## 8.19 `WorkflowSearch`（`editor-search.js`）

### 8.19.1 关键方法

```js
setupSearchHandler();
performSearch(term, scope);   // scope: all | name | description
invalidateTypeNameMapCache(); // 语言切换后清缓存
```

### 8.19.2 内部状态

```js
let _typeNameMapCache = null;  // 类型名缓存
function getTypeNameMap();     // 懒加载
```

## 8.20 `WorkflowShare`（`editor-share.js`）

### 8.20.1 关键方法

```js
async exportWorkflow();
```

### 8.20.2 流程

```
1. 从 ui.core.nodes/edges 获取数据
2. convertInternalToClipboardNode() → Coze 剪贴板
3. convertClipboardToYaml() → YAML
4. 构造 manifest.json
5. JSZip 打包
6. 触发下载
```

## 8.21 类协作时序图

### 8.21.1 创建节点

```
用户拖拽节点面板
   ↓
DOM dragstart
   ↓
WorkflowUI.addNodeToCanvas(type, x, y)
   ↓
node.render.addToCanvas(type, x, y)
   ↓
core.createNode(type, x, y) → nodeData
   ↓
core._emitChange('addNode', nodeData)
   ↓
core.saveHistory('messages.addNode', { name })
   ↓
core._emitChange('history')
   ↓
WorkflowUI.onChange('addNode')
   ↓
node.render.createElement(nodeData)
   ↓
canvasContent.appendChild(el)
   ↓
batchMeasureElements([el])
   ↓
updateEdges()
   ↓
canvas.updateSvgSize()
   ↓
updateSummary()
```

### 8.21.2 复制粘贴

```
Ctrl+C
   ↓
WorkflowKeyboard.handleKeydown
   ↓
clipboard.copy()
   ↓
选中的 .canvas-node 元素
   ↓
expandedNodeIds (含容器子节点)
   ↓
selectedNodes + selectedEdges
   ↓
for each node:
   - 构造 cozeNode (type 数字, position, nodeMeta, outputs, inputs)
   - loop_set_variable 特殊处理
   - variables array → inputParameters
   ↓
构造 clipboard data { type, source, json }
   ↓
navigator.clipboard.writeText(JSON.stringify(data))
   ↓
ui.showMessage('已复制到剪贴板', 'success')

Ctrl+V
   ↓
WorkflowKeyboard.handleKeydown
   ↓
navigator.clipboard.readText()
   ↓
pasteHandler.pasteFromCozeFormat(data)
   ↓
   - 收集所有 node ID
   - 分配新 ID (idMap)
   - for each cozeNode:
       - 递归处理 blocks
       - 端口转换 (true/false → branch_n)
       - blockID 重映射
   - 创建内部节点 + 边
   ↓
core._emitChange('batch')
   ↓
WorkflowUI.refreshCanvas()
   ↓
ui.showMessage('已粘贴 N 个节点', 'success')
```

### 8.21.3 撤销

```
Ctrl+Z
   ↓
WorkflowKeyboard.handleKeydown
   ↓
history.undo()
   ↓
core.undo()
   ↓
historyIndex--
state = history[historyIndex]
core.nodes = deepClone(state.nodes)
core.edges = deepClone(state.edges)
core.selectedNode = state.selectedNode
core.selectedEdge = state.selectedEdge
   ↓
core._emitChange('undo')
   ↓
WorkflowUI.onChange('undo')
   ↓
ui.refreshCanvas()
   ↓
history.updatePanel()
   ↓
renderNodePalette()
```

## 8.22 类继承图（伪）

虽然项目使用组合模式而非继承，这里用伪 UML 展示"is-a"语义上的关系：

```
                          ┌──────────────────┐
                          │  Object          │
                          └────────┬─────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
WorkflowCore              WorkflowUI                  WorkflowStorage
                          │                           WorkflowSerializer
                          │ uses (组合)
                          ▼
                  ┌────────────────────────────────────────┐
                  │ WorkflowCanvas                          │
                  │ WorkflowNode ──→ WorkflowNodeRender    │
                  │              └→ WorkflowContainerRender │
                  │              └→ WorkflowNodePanel       │
                  │              └→ WorkflowNodeSelector    │
                  │              └→ WorkflowParamEditor     │
                  │ WorkflowEdge                             │
                  │ WorkflowHistory                          │
                  │ WorkflowClipboard ──→ ClipboardPaste     │
                  │ WorkflowAlign                            │
                  │ WorkflowSelection                        │
                  │ WorkflowKeyboard                         │
                  │ WorkflowSearch                           │
                  │ WorkflowAutoSave                         │
                  │ WorkflowMessages                         │
                  │ WorkflowShare                            │
                  └─────────────────────────────────────────┘

Dialog (static)
Navigator (singleton)
ThemeController (singleton)
I18nController (singleton)
I18nManager (singleton)
```
