# 12 · 开发指南

> 本文档面向开发者，介绍编码约定、常见陷阱、扩展点。

## 12.1 编码约定

### 12.1.1 通用规范

| 规范 | 说明 |
| --- | --- |
| **语言** | JavaScript ES2022 |
| **模块** | 浏览器原生 ES Modules（`import` / `export`） |
| **类型** | JSDoc 注释 + `jsconfig.json`（不强制 TS） |
| **格式** | Prettier（统一缩进、引号、分号） |
| **Lint** | ESLint 8 |
| **命名** | 类 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE_CASE |
| **文件** | 全小写中划线（`editor-canvas.js`） |
| **导出** | 类默认导出，工具函数命名导出 |

### 12.1.2 类与组合模式

```js
// 推荐：组合模式（避免上帝类）
export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.render = new WorkflowNodeRender(this);
        this.panel = new WorkflowNodePanel(this);
        // ...
    }
}

// 推荐：箭头函数作为实例属性（避免 this 绑定问题）
export class WorkflowMessages {
    show = (text, type) => {
        // 这里的 this 自动绑定到实例
    };
}

// 不推荐：手动 bind
class BadExample {
    constructor() {
        this.handler = this.handler.bind(this);  // 容易忘记
    }
    handler() { /* ... */ }
}
```

### 12.1.3 this 绑定规范（CRITICAL）

**必须遵守**以避免 `TypeError: Cannot read properties of undefined`：

| 场景 | 正确写法 |
| --- | --- |
| 事件监听器传入方法引用 | `addEventListener('click', this.method.bind(this))` 或箭头函数实例属性 |
| 递归调用内部函数 | `children.forEach(child => checkNode.call(this, child))` |
| **推荐** | 箭头函数作为实例属性 |

**已修复的典型案例**：

- `editor-node-panel.js` - `document.addEventListener` 缺 `.bind(node)` → `this.addInputParam is not a function`
- `editor-search.js` - 递归 `checkNode(child)` 未绑定 `this` → `Cannot read properties of undefined (reading 'core')`

### 12.1.4 容器节点 CSS 规范（CRITICAL）

容器样式必须使用 **直接子选择器 `>`**，避免样式泄漏到内部子节点：

```css
/* ✅ 正确：只匹配容器的直接子元素 */
.canvas-node.container > .node-header { ... }
.canvas-node.container > .node-type { display: none; }

/* ❌ 错误：后代选择器会匹配所有内部子节点 */
.canvas-node.container .node-header { ... }
```

### 12.1.5 国际化翻译键

翻译键必须放在正确的命名空间下：

```js
// ✅ 正确：nodes.xxx 对应 t('nodes.xxx')
nodes: {
    variables: '变量定义',
    leftVariable: '目标变量',
}

// ❌ 错误：放在根级别会找不到
variables: '变量定义',
```

添加新翻译键时务必同步中英文两个文件，并运行 `npm run check:i18n`。

### 12.1.6 历史记录保存

操作完成后**统一保存一次**历史，避免重复保存：

```js
// ✅ 正确：操作完成后保存一次
batchChanges(() => {
    node1 = core.createNode(...);
    node2 = core.createNode(...);
    edge = core.createEdge(...);
});
// batchChanges 会在内部调用 _onChange('batch')

// ❌ 错误：每个操作都保存历史
node1 = core.createNode(...);  // _emitChange('addNode') × 50
// ...
```

### 12.1.7 事件监听器清理

所有事件监听器必须在 `destroy()` / `cleanup()` 中移除，防止泄漏：

```js
class WorkflowHistory {
    init() {
        this._languageChangeHandler = () => this.updatePanel();
        document.addEventListener('languagechange', this._languageChangeHandler);
    }

    destroy() {
        if (this._languageChangeHandler) {
            document.removeEventListener('languagechange', this._languageChangeHandler);
            this._languageChangeHandler = null;
        }
    }
}
```

## 12.2 常见陷阱

### 12.2.1 ID 生成

- **使用 `core.createNode` / `core.createEdge`**，不要手动分配 ID
- 这会自动使用 `nodeIdCounter` / `edgeIdCounter` 并避免冲突
- 外部导入数据时，先调用 `core.syncIdCounters()` 同步计数器

### 12.2.2 Coze 格式 vs 内部格式

- **内部节点 ID** 是字符串（`node_100001`）
- **Coze 节点 ID** 是数字字符串（`100001`）
- **转换时去除 `node_` 前缀**：

```js
// 内部 → Coze
cozeNode.id = node.id.replace('node_', '');

// Coze → 内部
newNodeId = `node_${++counter}`;
```

### 12.2.3 `loop_set_variable` 特殊处理

`parameters.variables` 数组必须保留 `left/right` 结构：

```js
// ✅ 正确
cozeNode.data.inputs.inputParameters = node.parameters.variables;

// ❌ 错误（走通用处理会转换格式）
cozeNode.data.inputs.inputParameters = node.inputParams.map(p => ({
    name: p.name,
    input: { type: p.type, value: { type: 'literal', content: p.value } }
}));
```

粘贴时必须重映射 `blockID`：

```js
// 递归遍历 variables
node.parameters.variables.forEach(v => {
    if (v.left?.value?.content?.blockID) {
        v.left.value.content.blockID = idMap[v.left.value.content.blockID];
    }
    if (v.right?.value?.content?.blockID) {
        v.right.value.content.blockID = idMap[v.right.value.content.blockID];
    }
});
```

### 12.2.4 容器节点端口校验

`createEdge` 时容器端口会校验：

```js
// 容器外部端口只能连外部节点
if (sourceIsContainer && isInternalPort && !targetIsChild) return null;
// 容器内部端口只能连容器内子节点
if (sourceIsContainer && !isInternalPort && targetIsChild) return null;
```

**绕过校验**直接调用 `addEdge`，可能导致非法边。

### 12.2.5 节点测量与缩放

- `getBoundingClientRect()` 返回**视觉坐标**（含 CSS transform 缩放）
- 计算尺寸时需要除以 `canvasScale`：

```js
const rect = el.getBoundingClientRect();
const visualWidth = rect.width / canvasScale;
const visualHeight = rect.height / canvasScale;
```

### 12.2.6 容器 `pointer-events: none`

```css
.canvas-node.container {
    pointer-events: none;  /* 让连线可点击 */
}
.canvas-node.container > .node-header {
    pointer-events: auto;  /* 恢复头部交互 */
}
```

如需修改容器样式，请保留这一约定，否则框选和点击会异常。

### 12.2.7 `connectedCallback` 与事件冒泡

- 节点面板监听 `document.click`（事件委托）
- 节点点击冒泡到 document
- 容器内点击需考虑 `pointer-events`

### 12.2.8 快捷键输入框

输入框内快捷键不触发：

```js
_isInputFocused() {
    const el = document.activeElement;
    return el && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
    );
}
```

### 12.2.9 CSS 动画 vs Web Animations API

- 页面淡入淡出用 `element.animate()` 而非 CSS `transition`
- 原因：CSS transition 依赖跨帧绘制，首帧前回调挤在同一帧

### 12.2.10 跨页数据传递

编辑器 → 管理器：

```js
// 编辑器 (editor.html)
Storage.session.set('savedWorkflow', workflow);
Storage.session.set('editingWorkflowId', id);
goToManager();

// 管理器 (manager.html)
loadSavedWorkflow() {
    const workflow = Storage.session.get('savedWorkflow');
    const editingId = Storage.session.get('editingWorkflowId');
    if (editingId) {
        // 更新已存在的工作流
    } else {
        // 新建工作流
    }
    Storage.session.remove('savedWorkflow');
    Storage.session.remove('editingWorkflowId');
}
```

注意：使用后立即 `remove` 避免下次会话残留。

## 12.3 扩展点

### 12.3.1 添加新节点类型

1. **在 `utils/types.js` 的 `TYPE_MAP` 添加**：

```js
export const TYPE_MAP = {
    // ...
    my_new_node: '99',
};
```

2. **在 `editor-node-types.js` 的 `getNodeTypeInfo` 添加**：

```js
my_new_node: {
    title: t('nodeTypes.my_new_node'),
    icon: '🆕',
    description: t('nodeTypes.description.my_new_node'),
    hasInput: true,
    hasOutput: true,
    parameters: [
        { name: 'param1', label: tl('param1'), type: 'text', defaultValue: '', required: false },
    ],
},
```

3. **在 `i18n/zh-CN.js` 和 `i18n/en-US.js` 添加翻译**：

```js
// zh-CN.js
nodeTypes: {
    my_new_node: '新节点',
    description: {
        my_new_node: '节点描述',
    },
},
nodeParams: {
    param1: '参数 1',
},
```

4. **在 `components/nodeHandlers.js` 添加转换逻辑**：

```js
export const nodeHandlers = {
    // ...
    my_new_node: (data, params) => {
        data.inputs = {
            inputParameters: [
                {
                    name: 'param1',
                    input: {
                        type: 'string',
                        value: { type: 'literal', content: params.param1 || '' }
                    }
                }
            ]
        };
        data.outputs = [];
    },
};
```

5. **（可选）在 `converter-reverse.js` 的 `TYPE_PARAMS_MAP` 添加反向参数**：

```js
const TYPE_PARAMS_MAP = {
    // ...
    my_new_node: ['param1', 'otherParam'],
};
```

6. **运行 `npm run check` 验证类型映射和翻译一致性**。

7. **运行 `npm test` 确认无破坏**。

### 12.3.2 添加新快捷键

1. **在 `editor-keyboard.js` 的 `DEFAULT_SHORTCUTS` 添加**：

```js
const DEFAULT_SHORTCUTS = {
    // ...
    myAction: 'Ctrl+M',
};
```

2. **在 `handleKeydown` 中处理**：

```js
if (this.matchShortcut(e, this.shortcuts.myAction)) {
    e.preventDefault();
    this.ui.myAction();
    return;
}
```

3. **添加 i18n 标签**（用于快捷键配置 UI）：

```js
// zh-CN.js / en-US.js
shortcutLabels: {
    myAction: '我的操作',
},
```

### 12.3.3 添加新主题

1. **在 CSS 中添加新的 `data-theme` 样式**：

```css
[data-theme="solarized"] {
    --bg-primary: #fdf6e3;
    --text-primary: #586e75;
    /* ... */
}
```

2. **在 `shared-theme.js` 的 `_toggleTheme` 添加处理**：

```js
_toggleTheme = () => {
    // 三态循环：light → dark → solarized → light
    const order = ['light', 'dark', 'solarized'];
    const idx = order.indexOf(this._currentTheme);
    this._currentTheme = order[(idx + 1) % order.length];
    // ...
};
```

3. **更新 i18n 主题按钮文本**：

```js
// zh-CN.js
converter: {
    themeLight: '浅色',
    themeDark: '深色',
    themeSolarized: 'Solarized',
}
```

### 12.3.4 添加新工作流模板

在 `manager-templates.js` 中：

```js
export const WORKFLOW_TEMPLATES = [
    // ...
    {
        id: 'tpl_my_template',
        name: 'templates.tpl_my_template.name',           // i18n 键
        description: 'templates.tpl_my_template.description',
        icon: '🆕',
        category: 'templates.categories.custom',
        nodes: [
            { id: 'node_900001', type: 'start', x: 400, y: 80, title: '...', description: '...' },
            { id: 'node_900002', type: 'llm', x: 400, y: 200, title: '...', description: '...', parameters: { ... } },
            { id: 'node_900003', type: 'end', x: 400, y: 320, title: '...', description: '...' }
        ],
        edges: [
            { id: 'edge_900001', source: 'node_900001', target: 'node_900002' },
            { id: 'edge_900002', source: 'node_900002', target: 'node_900003' }
        ]
    },
];
```

并在 `i18n/zh-CN.js` 和 `i18n/en-US.js` 添加对应翻译。

### 12.3.5 添加新属性面板字段

1. **在 `editor-node-types.js` 的节点配置添加**：

```js
my_node: {
    parameters: [
        { name: 'newField', label: tl('newField'), type: 'text', defaultValue: '', required: false },
    ],
},
```

2. **在 `editor-node-panel.js` 的渲染函数添加**：

```js
const value = node.parameters.newField || '';
// ... 渲染 input
```

3. **在保存函数添加**：

```js
node.parameters.newField = inputEl.value;
```

4. **（可选）在 `editor-clipboard.js` 添加导出处理**：

```js
if (node.parameters.newField) {
    cozeNode.data.inputs.newField = {
        type: 'string',
        value: { type: 'literal', content: node.parameters.newField }
    };
}
```

### 12.3.6 添加新的存储模块

参考 `editor-storage.js` 实现：

```js
export class MyStorage {
    constructor(core) {
        this.core = core;
    }

    save(key) { /* ... */ }
    load(key) { /* ... */ }
    clear(key) { /* ... */ }
}
```

在 `editor-core.js` 中实例化：

```js
this.myStorage = new MyStorage(this);
```

### 12.3.7 添加新的转换组件

参考 `src/components/outputMapper.js`：

```js
export function myMapper(value, ctx) {
    // value: 内部值
    // ctx: 上下文（outputMap, allNodes 等）
    // 返回：Coze 格式值
}
```

在 `components/nodeHandlers.js` 中使用：

```js
import { myMapper } from './myMapper.js';

export const nodeHandlers = {
    my_node: (data, params, ctx) => {
        data.inputs.newField = myMapper(params.newField, ctx);
    },
};
```

## 12.4 调试技巧

### 12.4.1 启用调试日志

```js
import { Logger } from './utils/logger.js';
Logger.setLevel('DEBUG');
```

### 12.4.2 查看工作流状态

```js
// 在浏览器控制台
JSON.stringify(window.workflowUI.core.nodes, null, 2);
JSON.stringify(window.workflowUI.core.edges, null, 2);
```

### 12.4.3 查看历史

```js
window.workflowUI.core.history.forEach((s, i) => {
    console.log(`#${i} (${i === window.workflowUI.core.historyIndex ? 'current' : ''}): ${s.actionKey}`);
});
```

### 12.4.4 节点 ID 冲突检测

```js
const ids = new Set();
const dups = [];
window.workflowUI.core.nodes.forEach(n => {
    if (ids.has(n.id)) dups.push(n.id);
    ids.add(n.id);
});
console.log('Duplicates:', dups);
```

### 12.4.5 边有效性检查

```js
const nodeIds = new Set(window.workflowUI.core.nodes.map(n => n.id));
const invalidEdges = window.workflowUI.core.edges.filter(
    e => !nodeIds.has(e.source) || !nodeIds.has(e.target)
);
console.log('Invalid edges:', invalidEdges);
```

## 12.5 提交前清单

提交前请确认：

- [ ] `npm run lint` 无错误
- [ ] `npm test` 全部通过
- [ ] `npm run check` 类型 + i18n 一致
- [ ] 新增的节点类型已加入 `TYPE_MAP` / `getNodeTypeInfo` / `nodeHandlers`
- [ ] 新增的 i18n key 在中英文两个文件中均存在
- [ ] 新增的事件监听器在 `destroy()` 中清理
- [ ] 新增的快捷键大小写不敏感
- [ ] 新增的 CSS 使用 `>` 子选择器（容器相关）
- [ ] 重大变更更新了 `CHANGELOG.md` 和 `AGENTS.md`

## 12.6 性能注意事项

| 场景 | 建议 |
| --- | --- |
| 大量节点渲染 | 使用视口剔除（`editor-canvas.js`） |
| 大文本转换 | 使用虚拟滚动（`converter-virtual-scroll.js`） |
| 大文本高亮 | 使用 Web Worker（`converter-highlighter-worker.js`） |
| 批量节点测量 | 使用 `batchMeasureElements` |
| 批量操作 | 使用 `core.batchChanges(fn)` |
| 拖拽性能 | 使用 `requestAnimationFrame` 防抖 |
| 边更新 | 使用 `_upsertEdgeElements` 增量更新 |

## 12.7 浏览器兼容性

| 特性 | 最低浏览器 |
| --- | --- |
| ES Modules | Chrome 61+ / Firefox 60+ / Safari 11+ |
| CSS Variables | Chrome 49+ / Firefox 31+ / Safari 9.1+ |
| Web Animations API | Chrome 36+ / Firefox 48+ / Safari 13.1+ |
| Touch Events | 移动端 |
| MutationObserver | Chrome 26+ / Firefox 14+ / Safari 6+ |
| Web Worker | Chrome 4+ / Firefox 3.5+ / Safari 4+ |

> **结论**：项目支持 Chrome/Edge/Firefox/Safari 近 4 年版本，不支持 IE。

## 12.8 资源链接

- [README.md](../README.md) — 用户文档
- [CHANGELOG.md](../CHANGELOG.md) — 版本历史
- [AGENTS.md](../AGENTS.md) — AI 会话上下文
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML 库
- [JSZip](https://stuk.github.io/jszip/) — ZIP 库
- [Coze 平台](https://www.coze.cn) — 目标平台

## 12.9 关键文件位置速查

| 需求 | 文件 |
| --- | --- |
| 添加节点类型 | `utils/types.js` + `editor-node-types.js` + `components/nodeHandlers.js` + `i18n/*.js` |
| 添加快捷键 | `editor-keyboard.js` + `i18n/*.js` |
| 添加工作流模板 | `manager-templates.js` + `i18n/*.js` |
| 添加属性面板字段 | `editor-node-types.js` + `editor-node-panel.js` + `editor-clipboard.js` |
| 修改节点行为 | `editor-node-drag.js` + `editor-node-render.js` |
| 修改边行为 | `editor-edge.js` |
| 修改历史行为 | `editor-core.js` + `editor-history.js` |
| 修改剪贴板行为 | `editor-clipboard.js` + `editor-clipboard-paste.js` |
| 修改存储行为 | `editor-storage.js` + `editor-autosave.js` |
| 修改转换逻辑 | `converter.js` + `components/*.js` |
| 修改反向转换 | `converter-reverse.js` |
| 修改主题 | `shared-theme.js` + `styles/*.css` |
| 修改国际化 | `i18n/i18n.js` + `i18n/zh-CN.js` + `i18n/en-US.js` |
| 修改对话框 | `shared-dialog.js` |
| 修改导航 | `shared-navigator.js` |
| 修改样式 | `styles/*.css` |
