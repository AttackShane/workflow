# CLAUDE.md - Coze Workflow Project Context

> 此文件用于给后续 AI 会话提供项目上下文，避免重复摸索。

---

## Project Overview

**Project**: Coze 工作流编辑器 / 转换器

**Purpose**:
- Convert YAML workflow definitions to Coze clipboard JSON format
- Visual editor for editing workflows copied from Coze platform
- Paste edited workflow back to Coze without losing parameters

**Key Features**:
- 70+ node types supported (full Coze coverage)
- Nested container nodes (loop, batch)
- Visual parameter editing with variable reference picker
- i18n (Chinese/English)
- Dark/light theme
- Local storage for multiple workflows
- Undo/redo history

---

## Architecture

### Module Structure

```
src/
├── views/                 HTML entry points
├── modules/
│   ├── workflow-core.js   Core data structure (nodes, edges, history)
│   ├── workflow-ui.js     UI orchestration
│   ├── workflow-canvas.js Canvas rendering with viewport culling
│   ├── workflow-node.js   Node class (aggregates mixins)
│   │   workflow-node-render.js
│   │   workflow-container-render.js
│   │   workflow-node-panel.js
│   │   workflow-node-selector.js
│   │   workflow-param-editor.js
│   ├── workflow-clipboard.js    Copy/export to Coze
│   ├── workflow-clipboard-paste.js  Paste/import from Coze
│   ├── workflow-serializer.js    File load deserialization
│   ├── converter.js      YAML → Coze JSON conversion
│   └── ...
├── components/
│   ├── nodeHandlers.js   Per-node-type conversion handlers
│   ├── inputMapper.js    Input parameter conversion
│   ├── outputMapper.js   Output parameter conversion
│   └── containerHandler.js Container processing
├── i18n/
│   ├── zh-CN.js          Chinese translations
│   └── en-US.js          English translations
├── styles/
│   └── workflow-editor.css  Editor styles
└── utils/
    ├── types.js          Type mapping (name ↔ number ID)
    └── helpers.js        DOM, Storage, utilities
```

### Design Patterns

1. **Mixin Extension Pattern**:

```js
// Each feature is split into separate mixin modules
export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        mixinNodeRender(this);      // from workflow-node-render.js
        mixinContainerRender(this); // from workflow-container-render.js
        mixinNodePanel(this);       // from workflow-node-panel.js
        // ...
    }
}
```

2. **Dynamic Import on Demand**:

```js
// app.js - entry point
if (h1Text.includes('converter')) {
    import('./ui-controller.js').then(m => m.initUI());
} else if (h1Text.includes('workflow manager')) {
    import('./workflow-manager.js').then(...);
}
```

Only loads what the current page needs.

---

## Coding Rules & Common Pitfalls

### 1. this Binding (CRITICAL)

**Always avoid**: `Cannot read properties of undefined (reading 'xxx')`

| Situation | Correct |
|---|---|
| `addEventListener` passing method reference | `el.addEventListener('click', this.method.bind(this))` OR define as `this.method = () => { ... }` |
| Recursive call inside `forEach` | `children.forEach(child => checkNode.call(this, child))` |
| Prefered | Use arrow function as instance property |

**Fixed Issues**:
- `workflow-node-panel.js:645` - `this.addInputParam is not a function` → fixed by adding `.bind(node)`
- `workflow-search.js:103` - `Cannot read properties of undefined (reading 'core')` → fixed by `.call(this)`

### 2. Container CSS Selectors (CRITICAL)

**Never** use descendant selector (space) for container styles - it leaks to child nodes inside container:

```css
/* ✅ GOOD: only matches container's direct children */
.canvas-node.container > .node-header { ... }
.canvas-node.container > .node-type { display: none; }

/* ❌ BAD: matches ALL descendants including child nodes inside container */
.canvas-node.container .node-header { ... }
```

**Fixed Issue**: container nodes were styling their inner child nodes, causing different appearance vs nodes outside container.

### 3. i18n Translation Keys

Translation keys must be in the correct namespace:

```js
// ✅ GOOD: accessed via t('nodes.variables')
nodes: {
    variables: 'Variables',
    leftVariable: 'Target Variable',
}

// ❌ BAD: placed at root, t('nodes.variables') won't find it
variables: 'Variables',
```

**Fixed Issue**: translation keys showing raw key name `nodes.variables` instead of translated text.

---

## Special Node: loop_set_variable (type 20)

### Data Structure

**Coze format (exported)**:
```js
{
  type: 'loop_set_variable',
  data: {
    inputs: {
      inputParameters: [
        {
          left: {
            type: 'string',
            value: { type: 'ref', content: { blockID: 'xxx', name: 'item' } }
          },
          right: {
            type: 'string',
            value: { type: 'ref', content: { blockID: 'yyy', name: 'output' } }
          }
        }
      ]
    }
  }
}
```

**Editor internal format**:
```js
{
  id: 'node_xxx',
  type: 'loop_set_variable',
  parameters: {
    variables: [  // same structure as Coze inputParameters
      { left: {...}, right: {...} }
    ]
  }
}
```

### Processing Pipeline

| Stage | What to do | File |
|---|---|---|
| **Copy/Export** | `cozeNode.data.inputs.inputParameters = node.parameters.variables` | `workflow-clipboard.js` |
| **Paste/Import** | Remap `blockID` in `left.value.content.blockID` and `right.value.content.blockID` | `workflow-clipboard-paste.js` |
| **File Load** | Same remapping as paste | `workflow-serializer.js` |
| **Property Panel** | Skip JSON textarea, render visual editor | `workflow-node-panel.js` + `workflow-param-editor.js` |

### Remapping Code Pattern:

```js
if (node.type === 'loop_set_variable' && Array.isArray(node.parameters.variables)) {
  node.parameters.variables.forEach(v => {
    if (v.left?.value?.content?.blockID) {
      const newBlockId = idMap[String(v.left.value.content.blockID)];
      if (newBlockId) v.left.value.content.blockID = newBlockId;
    }
    if (v.right?.value?.content?.blockID) {
      const newBlockId = idMap[String(v.right.value.content.blockID)];
      if (newBlockId) v.right.value.content.blockID = newBlockId;
    }
  });
}
```

### Visual Editor Features:

- Add/remove variables
- Click to select `left` (target variable - usually loop item)
- Click to select `right` (new value - reference or literal)
- Clear reference to switch back to literal input
- Displays selected reference path

---

## Container Nodes (loop / batch)

### Data Structure:

```js
// Container node
{
  id: 'node_123',
  type: 'loop' | 'batch',
  x: number, y: number, width: number, height: number,
  parentId: null
}

// Child node
{
  id: 'node_456',
  type: 'any',
  parentId: 'node_123',  // reference to container
  ...
}
```

All nodes (including children) stored in `core.nodes` flat array. Children filtered by `parentId`.

---

## Node Type Mapping

Coze uses numeric IDs, editor uses string names:

```js
TYPE_MAP = {
  start: '1',
  end: '2',
  llm: '3',
  plugin: '4',
  code: '5',
  loop_set_variable: '20',
  loop: '21',
  batch: '28',
  ... // 70+ total
};
```

`REV_TYPE_MAP` is reverse mapping (`id` → `name`).

---

## Recent Fixes (2026-06)

| File | Fix |
|---|---|
| `workflow-clipboard.js` | Add special handler for `loop_set_variable` to avoid duplicate `variables` field in `inputs` |
| `workflow-clipboard-paste.js` | Add `blockID` remapping for `loop_set_variable.variables` |
| `workflow-serializer.js` | Add `blockID` remapping for `loop_set_variable.variables` |
| `workflow-node-types.js` | Fix `variables` defaultValue from `'{}'` → `'[]'` |
| `workflow-param-editor.js` | Add `renderLoopVariables()` visual editor |
| `workflow-node-selector.js` | Add `addLoopVariable`, `removeLoopVariable`, `openLoopVariableSelector` |
| `workflow-node-panel.js` | Integrate visual editor, fix `_handleAction.bind(this)` |
| `workflow-search.js` | Fix recursion `this` binding with `.call(this)` |
| `workflow-editor.css` | Change container selectors from descendant to child `>` |
| `i18n/zh-CN.js`, `i18n/en-US.js` | Move `variables`, `leftVariable`, `rightValue` into `nodes` object |

---

## Build/Dev Commands

```bash
npm run dev      # Start dev server
npm run build    # Build to dist/
npm run convert  # Batch convert YAML → JSON
npm test        # Run Jest tests
npm run lint    # ESLint check
npm run lint:fix # ESLint fix
```

---

## For Next Session

When you start working on this project:

1. **Check this binding first** if you see `Cannot read properties of undefined`
2. **Check CSS selector scope** if container child nodes have wrong style
3. **Check translation key location** if raw key shows instead of text
4. **Remember** `loop_set_variable` stores array in `node.parameters.variables` → exports to `inputs.inputParameters`
5. **Remember** all references in `variables` array need `blockID` remapping on paste/load
6. **Follow existing patterns** - this project uses ES6 classes + mixins + arrow functions

---

## Environment

- Node.js >= 20.17
- ES6 modules (type: module in package.json)
- Vanilla JavaScript, no framework
- CSS variables for theming
- Works in modern browsers