# Coze Workflow Editor & Converter

这是一个 **Coze 工作流编辑器/转换器**项目，支持将 YAML 格式工作流定义转换为 Coze 平台可导入格式，同时提供可视化编辑器对从 Coze 复制的工作流进行编辑。

---

## 项目概览

### 核心功能

1. **工作流转换器**：YAML → Coze 剪贴板格式转换
2. **可视化编辑器**：编辑从 Coze 复制的工作流，支持复制粘贴回 Coze
3. **工作流管理器**：本地存储多份工作流
4. **支持容器节点**：loop（循环）、batch（批处理）嵌套节点
5. **国际化**：中文/英文双语切换
6. **暗色/亮色主题**：自动适配系统主题

### 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    HTML 入口页面                          │
│  workflow-editor.html / workflow-manager.html / converter.html  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     app.js (动态导入)                     │
│  根据页面 h1 文本判断页面类型，动态加载对应模块            │
└────────────────────────────┬────────────────────────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
┌──────────────────────┐      │              ┌──────────────────┐
│  WorkflowManager     │      │              │   UI Controller   │
│  (工作流管理)         │      │              │   (转换器页面)    │
└──────────────────────┘      │              └──────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     WorkflowCore                          │
│  核心数据结构：管理 nodes[], edges[], history             │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     WorkflowUI                            │
│  UI 层：整合所有子模块， orchestration                    │
└────────────────────────────┬────────────────────────────┘
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ WorkflowCanvas│   │  WorkflowNode │   │ WorkflowEdge  │
│  (画布渲染)   │   │  (节点渲染+属性面板+选择器) │   │  (边渲染)   │
└───────────────┘   └───────────────┘   └───────────────┘
         ┌─────────────────────────────────────────────┐
         │  mixin 扩展机制：每个功能拆分为独立模块        │
         │  - mixinStorage: 本地存储                     │
         │  - mixinSerializer: 序列化/反序列化            │
         │  - mixinHistory: 历史记录                      │
         │  - mixinClipboard: 复制/粘贴                   │
         │  - mixinSearch: 节点搜索                       │
         │  - mixinMessages: 消息提示                    │
         │  - mixinAutoSave: 自动保存                    │
         │  - mixinNodeRender: 节点渲染                  │
         │  - mixinContainerRender: 容器子节点渲染        │
         │  - mixinNodePanel: 属性面板                   │
         │  - mixinNodeSelector: 节点选择器              │
         │  - mixinParamEditor: 参数编辑（输入输出/合并组）│
         └─────────────────────────────────────────────┘
```

---

## 项目结构

```
src/
├── views/                    # HTML 入口页面
│   ├── workflow-editor.html    # 工作流编辑器
│   ├── workflow-manager.html   # 工作流管理
│   └── workflow-converter.html # YAML → JSON 转换器
├── modules/                  # 核心模块（ES6 类 + mixin 扩展）
│   ├── app.js                # 入口：动态按需加载
│   ├── workflow-core.js      # 核心数据结构：节点、边、历史
│   ├── workflow-ui.js        # UI  orchestration
│   ├── workflow-canvas.js    # 画布：缩放、拖拽、视口剔除优化
│   ├── workflow-node.js      # 节点：聚合多个 mixin
│   │   ├── workflow-node-render.js      # 节点渲染
│   │   ├── workflow-container-render.js # 容器子节点渲染
│   │   ├── workflow-node-panel.js       # 属性面板渲染
│   │   ├── workflow-node-selector.js    # 节点/变量选择器
│   │   └── workflow-param-editor.js    # 参数编辑（输入输出/循环变量）
│   ├── workflow-edge.js      # 边渲染
│   ├── workflow-history.js   # 历史记录（撤销/重做）
│   ├── workflow-clipboard.js # 复制（导出到 Coze）
│   ├── workflow-clipboard-paste.js # 粘贴（从 Coze 导入）
│   ├── workflow-serializer.js # 文件加载反序列化
│   ├── workflow-search.js    # 节点搜索高亮
│   ├── workflow-selection.js # 节点选择
│   ├── workflow-keyboard.js  # 快捷键支持
│   ├── workflow-align.js     # 节点对齐
│   ├── workflow-autosave.js  # 自动保存
│   ├── workflow-storage.js   # mixin：本地存储
│   ├── workflow-manager.js   # 工作流列表管理
│   ├── dialog.js             # 模态对话框
│   ├── converter.js          # YAML → Coze JSON 转换主逻辑
│   ├── converter-keyboard.js # 转换器页面快捷键
│   ├── stats-view.js         # 统计视图
│   ├── graph-view.js         # 依赖图视图
│   ├── navigator.js          # 页面导航
│   ├── i18n-controller.js    # i18n 控制器
│   ├── theme-controller.js   # 主题控制器
│   ├── reverse.js            # 反向转换（JSON → YAML）
│   └── ui-controller.js      # 转换器页面 UI
├── components/               # 转换器组件
│   ├── nodeHandlers.js       # 各节点类型导出处理器
│   ├── inputMapper.js        # 输入参数转换
│   ├── outputMapper.js       # 输出参数转换
│   └── containerHandler.js   # 容器节点处理
├── i18n/                     # 国际化
│   ├── zh-CN.js              # 中文翻译
│   ├── en-US.js              # 英文翻译
│   └── i18n.js               # i18n 核心
├── styles/                   # CSS
│   ├── workflow-editor.css   # 编辑器样式
│   ├── workflow-manager.css  # 管理器样式
│   └── style.css             # 全局样式
├── utils/                    # 工具函数
│   ├── types.js              # 类型映射（TYPE_MAP, REV_TYPE_MAP）
│   ├── helpers.js            # DOM、Storage、deepClone 等
│   ├── logger.js             # 日志
│   ├── refCache.js           # 引用缓存
│   └── helpers.js            # 通用工具
├── config/
│   └── constants.js          # 常量配置（SELECTORS, APP_CONFIG）
└── example/                  # 示例工作流文件
```

---

## 架构设计要点

### 1. Mixin 扩展模式

项目大量使用 **mixin** 模式将功能拆分到不同模块：

```js
// 示例：WorkflowNode 聚合多个 mixin
export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        mixinNodeRender(this);
        mixinContainerRender(this);
        mixinNodePanel(this);
        mixinNodeSelector(this);
        mixinParamEditor(this);
    }
}
```

优势：每个模块职责单一，易于维护。

### 2. this 绑定规范

**必须遵守**以避免 `TypeError: Cannot read properties of undefined`:

| 场景 | 正确写法 |
|---|---|
| 事件监听器传入方法引用 | `addEventListener('click', this.method.bind(this))` 或定义为箭头函数实例属性 |
| 递归调用内部函数 | `children.forEach(child => checkNode.call(this, child))` |
| 推荐 | 使用箭头函数作为实例属性：`this.method = () => { ... }` |

### 3. 容器节点 CSS 规范

容器样式必须使用 **直接子选择器 `>`**，避免样式泄漏到内部子节点：

```css
/* ✅ 正确：只匹配容器的直接子元素 */
.canvas-node.container > .node-header { ... }
.canvas-node.container > .node-type { display: none; }

/* ❌ 错误：后代选择器会匹配所有内部子节点 */
.canvas-node.container .node-header { ... }
```

### 4. 国际化翻译键

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

---

## 特殊节点处理：loop_set_variable (type 20)

### 数据结构

**Coze 导出格式：**
```js
{
  type: 'loop_set_variable',
  data: {
    inputs: {
      inputParameters: [
        {
          left: { type: 'string', value: { type: 'ref', content: { blockID: 'xxx', name: 'item' } } },
          right: { type: 'string', value: { type: 'ref', content: { blockID: 'yyy', name: 'output' } } }
        }
      ]
    }
  }
}
```

**编辑器内部格式：**
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

### 关键处理逻辑

| 阶段 | 处理 | 文件 |
|---|---|---|
| **复制导出** | 将 `node.parameters.variables` 直接赋值给 `cozeNode.data.inputs.inputParameters` | [workflow-clipboard.js](src/modules/workflow-clipboard.js) |
| **粘贴导入** | 遍历 `variables` 数组，重映射 `left.value.content.blockID` 和 `right.value.content.blockID` | [workflow-clipboard-paste.js](src/modules/workflow-clipboard-paste.js) |
| **文件加载** | 同上，重映射 `blockID` | [workflow-serializer.js](src/modules/workflow-serializer.js) |
| **属性面板** | 跳过 JSON 文本框，使用可视化编辑器渲染 | [workflow-node-panel.js](src/modules/workflow-node-panel.js) + [workflow-param-editor.js](src/modules/workflow-param-editor.js) |

### 可视化编辑器功能

- ✅ 添加/删除变量
- ✅ 点击选择 `left`（目标变量，通常是循环迭代变量）
- ✅ 点击选择 `right`（新值，可以是引用或直接输入字面量）
- ✅ 支持清除引用切换回字面量输入
- ✅ 显示已选择引用路径（节点 → 输出名）

---

## 容器节点（loop / batch）

### 数据结构

```js
{
  id: 'node_xxx',
  type: 'loop' | 'batch',
  x, y, width, height,
  parentId: null,
  // 子节点保存在顶层 nodes 数组，通过 parentId 关联
}
```

子节点 `parentId` = 容器节点 `id`。

### 渲染

容器节点在画布上渲染一个带边框的矩形区域，内部渲染所有子节点。CSS 使用 `>` 子选择器避免样式泄漏。

---

## 已知问题修复记录（2026-06）

| 问题 | 根因 | 修复 |
|---|---|---|
| `loop_set_variable` 粘贴后参数丢失 | Coze 使用 `left/right` 格式，转换时未保留原始结构 | 粘贴/加载时保留 `variables` 数组，导出直接赋值 |
| 导出时 `inputs` 同时有 `inputParameters` 和 `variables` | 复制时走了通用处理分支 | 添加 `loop_set_variable` 专属处理分支 |
| 粘贴后 `left/right` 引用无效 | `blockID` 未重映射 | 遍历 `variables` 数组进行重映射 |
| `variables` 默认值错误 | `defaultValue: '{}'` 应为 `'[]'` | 修改 [workflow-node-types.js](src/modules/workflow-node-types.js) |
| 翻译键显示 `nodes.variables` 原始文本 | 翻译键位置错误（根级别而非 `nodes` 对象） | 移动到 `nodes` 对象内 |
| `this.addInputParam is not a function` | `document.addEventListener` 缺少 `.bind(node)` | 添加 `.bind(node)` |
| `Cannot read properties of undefined (reading 'core')` 搜索功能崩溃 | 递归 `checkNode(child)` 未绑定 `this` | `checkNode.call(this, child)` |
| 容器内子节点样式被覆盖 | CSS 使用后代选择器 `.container .node-header` | 改为 `> .node-header` 子选择器 |

---

## 节点类型映射

Coze 使用数字 ID，编辑器使用字符串名称：

```js
TYPE_MAP = {
    start: "1", end: "2", llm: "3", plugin: "4", code: "5",
    knowledge_query: "6", condition: "8", workflow: "9",
    sql_exec: "12", output: "13", text: "15", image_generate: "16",
    question: "18", break: "19", loop_set_variable: "20",
    loop: "21", intent: "22", canvas: "23",
    knowledge_write: "27", batch: "28", loop_continue: "29",
    input: "30", comment: "31", variable_merge: "32",
    ...
};
```

支持 **70+** 种节点类型。

---

## 可用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建到 dist/
npm run convert  # 批量转换 YAML → JSON
npm test        # 运行 Jest 单元测试
npm run lint    # ESLint 检查
npm run lint:fix # ESLint 自动修复
```

---

## 开发环境

- Node.js >= 20.17
- 纯 ES6 模块化，无框架依赖
- 浏览器原生支持 ES modules
- 样式使用 CSS 变量支持主题切换

---

## 编码约定

1. **类 + 构造函数** + 箭头函数实例属性用于需要绑定 `this` 的方法
2. **mixin 模式**拆分功能模块，每个 mixin 是一个函数接收 `this`
3. **动态导入**：`app.js` 根据页面类型动态加载对应模块，减少首屏加载
4. **视口剔除**：大规模工作流只渲染可视区域内节点，提升性能
5. **国际化**：所有用户可见文本使用 `t('key')`，翻译放在 `i18n/`