# 06 · 编辑器模块 (Editor)

> 编辑器是项目的核心，提供可视化拖拽式工作流编辑能力。

## 6.1 入口与初始化

```js
// src/views/workflow-editor.html
// 内联 <script type="module"> 触发
import { WorkflowCore } from './editor-core.js';
import { WorkflowUI } from './editor-ui.js';

const core = new WorkflowCore();
const ui = new WorkflowUI(core);
ui.init();
```

**为什么编辑器不走 `app.js`？** 因为编辑器需要同步初始化（避免淡入动画闪烁），而 `app.js` 走动态加载。

## 6.2 整体架构

```
                          ┌────────────────────────────────┐
                          │  editor-ui.js (WorkflowUI)      │
                          │  状态协调 + 事件总线             │
                          └────────────┬───────────────────┘
                                       │
       ┌──────────────┬─────────────────┼──────────────────┬──────────────┐
       ▼              ▼                 ▼                  ▼              ▼
  editor-canvas  editor-node        editor-edge        editor-history  editor-clipboard
  (画布)         (节点-组合)        (边)              (历史)          (复制)
       │              │                 │                  │              │
       │       ┌──────┴─────┐           │                  │              │
       │       ▼            ▼           │                  │              │
       │  editor-node-  editor-node-   │                  │              │
       │   render      panel           │                  │              │
       │       │            │           │                  │              │
       │       ▼            ▼           │                  │              │
       │  editor-node-  editor-node-   │                  │              │
       │   drag         selector       │                  │              │
       │       │            │           │                  │              │
       │       └─────┬──────┘           │                  │              │
       │             ▼                  │                  │              │
       │      editor-param-editor       │                  │              │
       │                                │                  │              │
       │       editor-container-render  │                  │              │
       │                                │                  │              │
       └────────────────┬───────────────┴──────────────────┴──────────────┘
                        │
       ┌────────────────┼─────────────────┐
       ▼                ▼                 ▼
  editor-core     editor-storage    shared-serializer
  (数据核心)        (localStorage)    (导入/导出)
       │
       ▼
  editor-search / editor-align / editor-keyboard / editor-selection
  editor-layout / editor-messages / editor-autosave / editor-share
```

## 6.3 数据核心 `editor-core.js`

### 6.3.1 `WorkflowCore` 类

```js
class WorkflowCore {
    nodes: [];          // 所有节点
    edges: [];          // 所有边
    nodeIdCounter: 100000;   // ID 自增计数器
    edgeIdCounter: 100000;
    selectedNode: null;
    selectedEdge: null;
    history: [];        // 历史快照
    historyIndex: -1;
    maxHistory: 50;
    _onChange: null;    // 变更回调
    _batchMode: false;  // 批量模式
    _nodeTypeInfo: {};  // 节点类型信息（带翻译）
    storage: WorkflowStorage;
    serializer: WorkflowSerializer;
}
```

### 6.3.2 节点操作

| 方法 | 用途 |
| --- | --- |
| `createNode(type, x, y, data?)` | 创建节点（自动分配 ID） |
| `addNode(nodeData)` | 添加已有节点 |
| `deleteNode(nodeId)` | 删除节点 + 关联边 + 子节点（递归） |
| `updateNodePosition(nodeId, x, y)` | 更新坐标 |
| `updateNodeProperty(nodeId, key, value)` | 更新属性 |
| `getChildNodes(parentId)` | 获取容器子节点 |
| `isContainerNode(nodeId)` | 是否为容器（loop/batch） |

### 6.3.3 边操作

| 方法 | 用途 |
| --- | --- |
| `createEdge(sourceId, targetId, sourcePort, targetPort)` | 创建边（带容器端口校验） |
| `addEdge(edgeData)` | 添加边（去重） |
| `deleteEdge(edgeId)` | 删除边 |

**容器端口校验**（避免非法连接）：

- 容器外部端口只能连外部节点
- 容器内部端口只能连内部子节点

### 6.3.4 历史记录

| 方法 | 用途 |
| --- | --- |
| `saveHistory(actionKey, params)` | 保存当前快照到历史 |
| `resetHistory(actionKey, params)` | 重置历史 |
| `undo()` | 撤销 |
| `redo()` | 重做 |
| `canUndo()` / `canRedo()` | 状态查询 |
| `batchChanges(fn)` | 批量模式（合并多次 emitChange） |

**历史快照结构**：

```js
{
    nodes: deepClone(nodes),
    edges: deepClone(edges),
    selectedNode,
    selectedEdge,
    actionKey: 'editor.addNode',        // i18n 键
    actionParams: { name: 'xxx' },      // 翻译插值
    timestamp: Date.now(),
}
```

### 6.3.5 选择与验证

| 方法 | 用途 |
| --- | --- |
| `selectNode(nodeId)` | 选中节点（自动取消边选择） |
| `selectEdge(edgeId)` | 选中边（自动取消节点选择） |
| `clearAll()` | 清空所有 |
| `validate()` | 验证工作流（必有 1 start / ≥1 end / 节点有入边出边） |

### 6.3.6 节点类型解析

```js
getTypeNumber(type);         // 'llm' → '3'
getTypeFromNumber('3');      // → 'llm'
```

## 6.4 画布 `editor-canvas.js`

### 6.4.1 `WorkflowCanvas` 类

```js
class WorkflowCanvas {
    canvasScale: 1;                       // 缩放比例
    isMarqueeSelectionActive: false;      // 框选状态
    hasDraggedCanvas: false;
    gridVisible: false;
    snapEnabled: false;
    gridSize: 20;
    viewport: { left, top, right, bottom };
    minimapEl / minimapCanvas: HTMLElement;
    _minimapTransform: { scale, offsetX, offsetY, ... };
}
```

### 6.4.2 核心方法

| 方法 | 用途 |
| --- | --- |
| `init()` | 初始化 DOM 引用 + 事件绑定 + 缩放控件 + 小地图 |
| `setupEventListeners()` | 鼠标/滚轮/触摸事件 |
| `setupZoomControls()` | 缩放按钮 + 网格切换 + 吸附切换 + 小地图切换 |
| `onMouseMove(e)` | 处理拖拽 / 平移 |
| `onCanvasWheel(e)` | Ctrl+滚轮缩放 |
| `onCanvasMouseDown(e)` | 框选起点 / 拖拽画布 |
| `onTouchStart/Move/End` | 触摸支持（单指拖拽，双指缩放） |
| `toggleGrid()` | 切换网格显示 |
| `toggleSnap()` | 切换吸附 |
| `setGridSize(size)` | 设置网格大小（5~100） |
| `snapToGrid(value)` | 坐标吸附 |
| `initMinimap()` | 初始化小地图 |
| `toggleMinimap()` | 切换小地图 |
| `renderMinimap()` | 渲染小地图节点 + 视口指示器 |
| `updateMinimapViewport()` | 更新小地图视口位置 |
| `navigateMinimap(e)` | 通过小地图导航 |
| `centerView()` | 居中显示所有节点 |
| `resetView()` | 重置缩放/平移 |
| `exportAsImage(format)` | 导出 PNG / SVG |
| `updateSvgSize()` | 更新 SVG 层尺寸 |
| `screenToCanvas(x, y)` | 屏幕坐标 → 画布坐标 |
| `applyTransform(x, y, scale)` | 应用变换 |

### 6.4.3 性能优化

- **视口剔除（Viewport Culling）**：仅渲染可见节点
- **批量渲染**：`renderBatchSize = 50`
- **网格作为 SVG pattern**：避免 Canvas 性能开销
- **小地图独立 Canvas**：与主画布解耦
- **`requestAnimationFrame` 节流**滚动事件

### 6.4.4 触摸设备

```js
// 触摸事件
DOM.on(this.canvas, 'touchstart', (e) => this.onTouchStart(e), { passive: false });
DOM.on(this.canvas, 'touchmove', (e) => this.onTouchMove(e), { passive: false });
DOM.on(this.canvas, 'touchend', () => this.onTouchEnd());
```

- 单指拖拽画布
- 双指缩放

## 6.5 节点模块

### 6.5.1 组合入口 `editor-node.js`

```js
class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;

        this.render = new WorkflowNodeRender(this);
        this.container = new WorkflowContainerRender(this);
        this.panel = new WorkflowNodePanel(this);
        this.selector = new WorkflowNodeSelector(this);
        this.paramEditor = new WorkflowParamEditor(this);
    }
}
```

### 6.5.2 节点渲染 `editor-node-render.js`

#### 节点类型元信息 `editor-node-types.js`

```js
export function getNodeTypeInfo();  // 返回 50 种节点配置

// 节点配置结构
{
    start: {
        title,                    // '开始'
        icon,                     // '🚀'
        description,              // '工作流入口'
        hasInput: false,          // 是否有入端口
        hasOutput: true,
        hasContainer: false,      // 是否为容器
        containerMinWidth: 300,
        containerMinHeight: 200,
        parameters: [
            { name, label, type, defaultValue, required, options?, min?, max? }
        ]
    },
    // ... 50 种
}
```

#### 50 种节点类型

详见 [09-data-structures.md](./09-data-structures.md)。

#### DOM 创建 `createElement(nodeData, options)`

```js
createElement(nodeData, { skipMeasure: true })
```

- 创建节点 DOM
- 根据类型设置类名 (`canvas-node` + 类型 + `container`? + `locked`?)
- 创建输入/输出端口（`connection-point`）
- 分支节点动态创建多个输出端口
- 容器节点创建 `container-body`
- **`skipMeasure`**：跳过单次测量（在批量插入时使用）

#### 批量测量 `batchMeasureElements(elements)`

```js
batchMeasureElements([{ el, nodeData }, ...])
```

- 单次 `forced reflow` 测量所有节点尺寸
- 写入 `node.width` / `node.height`
- 性能：100 个节点 100ms → 1ms

#### 添加节点 `addToCanvas(type, screenX, screenY)`

- 屏幕坐标 → 画布坐标
- 调用 `core.createNode()`
- 调用 `core.saveHistory()`

#### 删除节点 `delete(nodeId)`

- 调用 `core.deleteNode()`
- 调用 `core.saveHistory()`

#### 选中/拖拽

详见 `editor-node-drag.js`：

- `onMouseDown(e, el)` — 拖拽起点（区分锁定/未锁定）
- `onMouseMove` — 拖拽中（多选同步移动）
- `onMouseUp` — 拖拽结束（保存历史）
- 智能吸附（向最近的节点对齐）
- 容器内拖入/拖出
- 触摸设备支持

### 6.5.3 容器节点 `editor-container-render.js`

#### `WorkflowContainerRender` 类

- 渲染容器（loop / batch）的子节点
- 自动调整容器尺寸
- 子节点拖入/拖出支持

#### 方法

| 方法 | 用途 |
| --- | --- |
| `renderContainerChildren(containerId)` | 渲染容器内所有子节点 |
| `updateContainerSize(containerId)` | 调整容器尺寸以容纳子节点 |
| `addChildToContainer(childId, parentId)` | 添加子节点到容器 |
| `removeChildFromContainer(childId)` | 移除子节点 |

### 6.5.4 属性面板 `editor-node-panel.js`

#### `WorkflowNodePanel` 类

- 监听 `document.click`（**注意 `.bind(this)`**）
- 渲染属性面板表单
- 处理条件表达式（结构化编辑：左值 + 操作符 + 右值）
- 监听参数变化并保存

#### 条件表达式编辑器

支持的操作符：

| 值 | 含义 |
| --- | --- |
| 1 | `==` |
| 2 | `!=` |
| 5 | `>` |
| 6 | `<` |
| 7 | `>=` |
| 8 | `<=` |
| 3 | 包含 |
| 4 | 不包含 |
| 9 | 为空 |
| 10 | 非空 |

逻辑组合：AND（值 1）/ OR（值 2）

### 6.5.5 变量选择器 `editor-node-selector.js`

#### `WorkflowNodeSelector` 类

- `openInputParamRefSelector(prefix, index)` — 打开输入参数引用选择器
- `openOutputParamRefSelector(prefix, index)` — 输出参数
- `openMergeVariableSelector(...)` — 合并变量
- 显示已选引用的"节点 → 输出名"路径
- 支持清除引用切换回字面量输入

#### 引用数据结构

```js
{
    type: 'ref',
    content: {
        source: 'block-output',
        blockID: 'node_100001',
        name: 'answer',
    },
    rawMeta: { type: 1 }
}
```

### 6.5.6 参数编辑器 `editor-param-editor.js`

#### `WorkflowParamEditor` 类

- `renderInputOutputParams(params, prefix, nodeId)` — 渲染输入/输出参数列表
- 添加/删除参数
- 设置参数类型 / 必填 / 默认值 / 引用
- 与 `WorkflowNodeSelector` 协作

## 6.6 边 `editor-edge.js`

### 6.6.1 `WorkflowEdge` 类

```js
class WorkflowEdge {
    get svgLayer() { return this.ui.canvas.svgLayer; }
    get svgHitLayer() { return this.ui.canvas.svgHitLayer; }
}
```

### 6.6.2 核心方法

| 方法 | 用途 |
| --- | --- |
| `_computeEdgeGeometry(edge)` | 计算边的几何（纯函数） |
| `_upsertEdgeElements(edge, geom)` | 增量更新边 DOM（path / arrow / hit / label） |
| `updateAllEdges()` | 全量更新所有边 |
| `startConnection(nodeId, e, portId)` | 开始创建连接 |
| `cancelConnection()` | 取消连接 |
| `delete(edgeId)` | 删除边 |
| `renderPropertyPanel(edge)` | 渲染边属性面板 |

### 6.6.3 几何计算

```
贝塞尔曲线:
M x1 y1 C (x1+ctrl) y1, (x2-ctrl) y2, x2 y2

ctrl = max(|x2 - x1| * 0.4, 50)
```

### 6.6.4 分支端口处理

**问题节点（question）**：

- 每个选项生成一个输出端口
- 最后一个端口为 "其他"（默认分支）
- 端口 ID：`branch_0`, `branch_1`, ..., `default`

**意图节点（intent）**：类似 question，按 `categories` 数量

**条件节点（condition）**：按 `branches` 数量，每个 branch 一个端口

### 6.6.5 边标签

每条边起点显示对应的分支名（如"是" / "否" / 用户输入）

## 6.7 历史记录 `editor-history.js`

### 6.7.1 `WorkflowHistory` 类

| 方法 | 用途 |
| --- | --- |
| `init()` | 初始化 DOM + 语言监听器 |
| `destroy()` | 移除语言监听器 |
| `updatePanel()` | 重渲历史步骤面板 |
| `goTo(index)` | 跳转到指定历史步骤 |
| `undo()` | 撤销 |
| `redo()` | 重做 |

### 6.7.2 历史步骤面板

- 显示所有历史操作（按时间倒序）
- 当前步骤高亮
- 点击步骤 → 跳转到该状态
- 国际化操作名称（`t(state.actionKey, state.actionParams)`）

## 6.8 剪贴板

### 6.8.1 复制 `editor-clipboard.js`

`WorkflowClipboard` 类：

- `copy()` — 复制选中节点（含容器内子节点 + 边）
- 转换为 Coze 剪贴板格式
- 处理 `node_outputs` / `node_inputs`
- **特殊处理 `loop_set_variable`**：保留 `parameters.variables` 数组
- 写入剪贴板（`navigator.clipboard.writeText`）

### 6.8.2 粘贴 `editor-clipboard-paste.js`

`WorkflowClipboardPaste` 类：

- `pasteFromCozeFormat(data)` — 从 Coze 格式粘贴
- ID 重映射（`node_${Date.now()}_${rand}`）
- `blockID` 重映射（递归处理 variables、引用等）
- 端口转换（`true/false` → `branch_0/branch_n`，`loop-function-inline-output` → `container_start`）
- 计算粘贴位置（屏幕坐标 → 画布坐标）

## 6.9 选择 `editor-selection.js`

### 6.9.1 `WorkflowSelection` 类

| 方法 | 用途 |
| --- | --- |
| `selectAll()` | 全选（Ctrl+A，排除 locked/子节点） |
| `deselectAll()` | 取消全选（Esc） |
| `updateSelection()` | 更新选中状态（单选/多选） |
| `deleteSelected()` | 删除选中（Delete） |
| `copySelected()` | 复制选中（Ctrl+C） |

### 6.9.2 多选逻辑

- **Shift+点击**：增选
- **拖拽框选**：圈选
- **Ctrl+框选**：累加
- **点击空白**：取消选择
- **锁定节点不参与多选**

## 6.10 对齐 `editor-align.js`

### 6.10.1 `WorkflowAlign` 类

| 方法 | 用途 |
| --- | --- |
| `setupAlignToolbar()` | 设置对齐工具栏 |
| `updateAlignToolbar()` | 更新工具栏位置/可见性 |
| `alignNodes(mode)` | 执行对齐（8 种模式） |
| `distribute(mode)` | 分布（2 种：水平/垂直） |

### 6.10.2 对齐模式

| mode | 含义 |
| --- | --- |
| `left` | 左对齐 |
| `right` | 右对齐 |
| `center-h` | 水平居中 |
| `top` | 顶部对齐 |
| `bottom` | 底部对齐 |
| `center-v` | 垂直居中 |
| `distribute-h` | 水平等距分布 |
| `distribute-v` | 垂直等距分布 |

## 6.11 布局 `editor-layout.js`

### 6.11.1 `autoOptimizeLayout(core, canvas)`

- 基于拓扑排序
- 从左到右分层
- 紧凑不重叠
- 支持容器节点嵌套
- 自动调整容器尺寸

### 6.11.2 算法

```
1. 拓扑排序（按入度）
2. 按层分配 X 坐标
3. 同一层内按子节点数分配 Y 坐标
4. 容器节点独立布局
5. 调整 SVG 尺寸
6. 居中视口
```

## 6.12 搜索 `editor-search.js`

### 6.12.1 `WorkflowSearch` 类

- `setupSearchHandler()` — 监听搜索输入框
- `performSearch(term, scope)` — 执行搜索
  - `scope`：`all` / `name` / `description`
- `invalidateTypeNameMapCache()` — 语言切换后清缓存

### 6.12.2 搜索行为

- **匹配**：节点标题/描述/类型名包含关键词
- **高亮**：匹配节点添加 `search-highlight` 类
- **降暗**：不匹配节点添加 `search-dimmed` 类
- **结果计数**：显示 `找到 N 个匹配`

## 6.13 键盘 `editor-keyboard.js`

详见 [08-key-classes.md](./08-key-classes.md#87-workflowkeyboardeditor-keyboardjs) 与 [10-dependencies.md](./10-dependencies.md)。

### 6.13.1 默认快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+C` | 复制选中 |
| `Ctrl+V` | 粘贴 |
| `Ctrl+D` | 直接复制（duplicate） |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+A` | 全选 |
| `Ctrl+S` | 保存到 localStorage |
| `Ctrl+F` | 自动优化布局 |
| `Ctrl+L` | 锁定/解锁节点 |
| `Delete` / `Backspace` | 删除选中 |
| `Esc` | 取消选择/连接 |

### 6.13.2 自定义配置

- 通过模态配置界面修改
- 大小写不敏感
- Ctrl/Cmd 自动互换
- 持久化到 `localStorage[keyboardShortcuts]`

## 6.14 自动保存 `editor-autosave.js`

### 6.14.1 `WorkflowAutoSave` 类

- `startAutoSave()` — 启动 5s 间隔定时器
- `stopAutoSave()` — 停止
- `saveWorkflow()` — 手动保存
- `clearSavedWorkflow()` — 清除保存

### 6.14.2 状态指示

- 状态栏显示"刚刚保存 / N 秒前 / N 分钟前 / N 小时前"
- 颜色：未保存 = 灰，刚保存 = 绿

## 6.15 消息 `editor-messages.js`

### 6.15.1 `WorkflowMessages` 类

- `createContainer()` — 创建消息容器（fixed 定位右上）
- `show(text, type)` — 显示消息
  - `type`：`success` / `error` / `info` / `warning`
  - 不同类型不同图标 + 颜色
  - 自动消失（3~5 秒）

## 6.16 存储 `editor-storage.js`

### 6.16.1 `WorkflowStorage` 类

- `saveToLocalStorage(key='workflow_current')` — 保存
- `loadFromLocalStorage(key)` — 加载
- `hasSavedWorkflow(key)` — 检查是否存在
- `clearSavedWorkflow(key)` — 清除
- `syncIdCounters()` — 同步 ID 计数器（避免冲突）

## 6.17 分享 `editor-share.js`

### 6.17.1 `WorkflowShare` 类

- `exportWorkflow()` — 导出为 zip
  - 内部节点 → Coze 剪贴板格式
  - Coze 剪贴板 → YAML
  - 写入 `manifest.json`（type / version / main）
  - 用 JSZip 打包

### 6.17.2 导入

通过 `editor-share.js` 分享的链接 `/editor?data=<encoded>` 在 `WorkflowUI.checkImportedData()` 中解析。

## 6.18 序列化 `shared-serializer.js`

### 6.18.1 导出 API

```js
convertInternalToClipboardNode(node, allNodes);
// 内部节点 → Coze 剪贴板节点
```

### 6.18.2 导入 API

```js
convertClipboardToInternal(data);
// Coze 剪贴板数据 → { nodes, edges }

importWorkflow(workflow);
exportWorkflow(options);
loadFromClipboard(data);
```

### 6.18.3 关键处理

- **`loop_set_variable` 特殊处理**：`variables` 数组保留，`blockID` 重映射
- **`variable_merge` 处理**：合并组变量 + 边映射
- **Slate 富文本提取**：`note` 字段从 Slate JSON 提取纯文本
- **`llmParam` 双格式支持**：数组 / 对象

## 6.19 关键类概览

| 类 | 文件 | 实例化方式 | 数量 |
| --- | --- | --- | --- |
| `WorkflowUI` | editor-ui.js | `new WorkflowUI(core)` | 1 |
| `WorkflowCore` | editor-core.js | `new WorkflowCore()` | 1 |
| `WorkflowCanvas` | editor-canvas.js | `new WorkflowCanvas(ui)` | 1 |
| `WorkflowNode` | editor-node.js | `new WorkflowNode(ui)` | 1 |
| `WorkflowNodeRender` | editor-node-render.js | `new WorkflowNodeRender(node)` | 1 |
| `WorkflowNodeDrag` | editor-node-drag.js | `new WorkflowNodeDrag(node)` | 1 |
| `WorkflowContainerRender` | editor-container-render.js | `new WorkflowContainerRender(node)` | 1 |
| `WorkflowNodePanel` | editor-node-panel.js | `new WorkflowNodePanel(node)` | 1 |
| `WorkflowNodeSelector` | editor-node-selector.js | `new WorkflowNodeSelector(node)` | 1 |
| `WorkflowParamEditor` | editor-param-editor.js | `new WorkflowParamEditor(node)` | 1 |
| `WorkflowEdge` | editor-edge.js | `new WorkflowEdge(ui)` | 1 |
| `WorkflowHistory` | editor-history.js | `new WorkflowHistory(ui)` | 1 |
| `WorkflowClipboard` | editor-clipboard.js | `new WorkflowClipboard(ui)` | 1 |
| `WorkflowClipboardPaste` | editor-clipboard-paste.js | `new WorkflowClipboardPaste(clipboard)` | 1 |
| `WorkflowAlign` | editor-align.js | `new WorkflowAlign(ui)` | 1 |
| `WorkflowSelection` | editor-selection.js | `new WorkflowSelection(ui)` | 1 |
| `WorkflowKeyboard` | editor-keyboard.js | `new WorkflowKeyboard(ui)` | 1 |
| `WorkflowSearch` | editor-search.js | `new WorkflowSearch(ui)` | 1 |
| `WorkflowAutoSave` | editor-autosave.js | `new WorkflowAutoSave(ui)` | 1 |
| `WorkflowMessages` | editor-messages.js | `new WorkflowMessages(ui)` | 1 |
| `WorkflowShare` | editor-share.js | `new WorkflowShare(ui)` | 1 |
| `WorkflowStorage` | editor-storage.js | `new WorkflowStorage(core)` | 1 |
| `WorkflowSerializer` | shared-serializer.js | `new WorkflowSerializer(core)` | 1 |

## 6.20 关键文件清单

| 文件 | 行数（约） | 关键导出 |
| --- | --- | --- |
| `editor-ui.js` | 700 | `WorkflowUI` |
| `editor-core.js` | 550 | `WorkflowCore` |
| `editor-canvas.js` | 1200 | `WorkflowCanvas` |
| `editor-node.js` | 30 | `WorkflowNode` |
| `editor-node-render.js` | 700 | `WorkflowNodeRender` |
| `editor-node-drag.js` | 400 | `WorkflowNodeDrag` |
| `editor-node-types.js` | 500 | `getNodeTypeInfo` |
| `editor-node-panel.js` | 600 | `WorkflowNodePanel` |
| `editor-node-selector.js` | 400 | `WorkflowNodeSelector` |
| `editor-param-editor.js` | 300 | `WorkflowParamEditor` |
| `editor-container-render.js` | 300 | `WorkflowContainerRender` |
| `editor-edge.js` | 600 | `WorkflowEdge` |
| `editor-history.js` | 100 | `WorkflowHistory` |
| `editor-clipboard.js` | 600 | `WorkflowClipboard` |
| `editor-clipboard-paste.js` | 800 | `WorkflowClipboardPaste` |
| `editor-selection.js` | 200 | `WorkflowSelection` |
| `editor-align.js` | 300 | `WorkflowAlign` |
| `editor-keyboard.js` | 300 | `WorkflowKeyboard` |
| `editor-search.js` | 200 | `WorkflowSearch` / `invalidateTypeNameMapCache` |
| `editor-messages.js` | 100 | `WorkflowMessages` |
| `editor-autosave.js` | 120 | `WorkflowAutoSave` |
| `editor-storage.js` | 100 | `WorkflowStorage` |
| `editor-share.js` | 200 | `WorkflowShare` |
| `editor-layout.js` | 300 | `autoOptimizeLayout` |
