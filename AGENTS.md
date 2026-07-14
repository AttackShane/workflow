# Coze 工作流编辑器 & 转换器 - 项目上下文

> 此文件为后续 AI 会话提供项目上下文，每次会话开始时优先阅读。

---

## 项目概览

### 核心功能

1. **工作流转换器**：YAML → Coze 剪贴板格式双向转换
2. **可视化编辑器**：编辑工作流，支持从 Coze 复制粘贴
3. **工作流管理器**：本地存储多份工作流，支持拖拽排序、批量删除
4. **容器节点**：loop（循环）、batch（批处理）嵌套子节点
5. **国际化**：中文/英文双语切换，所有 UI 文本使用 `t('key')`
6. **暗色/亮色主题**：自动适配系统主题
7. **网格吸附**：画布背景网格渲染，节点拖拽自动吸附
8. **小地图**：节点缩略图 + 视口指示器 + 交互式导航
9. **节点锁定**：Ctrl+L 锁定/解锁节点，锁定后禁止拖拽和删除
10. **自定义快捷键**：模态配置界面 + Storage 持久化，大小写不敏感匹配
11. **导出 SVG**：工作流导出为 SVG 矢量图
12. **版本对比**：工作流版本快照存储与差异对比
13. **批量参数编辑**：多选节点提取公共参数，批量更新
14. **自动保存**：定时自动保存，状态栏显示保存状态
15. **触摸设备支持**：单指拖拽画布，双指缩放

### 技术栈

- 纯 ES6 模块化，无框架依赖
- 浏览器原生 ES modules
- CSS 变量驱动主题切换
- Node.js >= 20.17

---

## 项目结构

```
src/
├── views/                    # HTML 入口页面
│   ├── workflow-editor.html    # 工作流编辑器
│   ├── workflow-manager.html   # 工作流管理
│   └── workflow-converter.html # YAML ↔ JSON 转换器
├── modules/                  # 核心模块
│   ├── app.js                # 入口：动态按需加载
│   ├── editor-core.js      # 核心数据结构：节点、边、历史
│   ├── editor-ui.js        # UI orchestration
│   ├── editor-canvas.js    # 画布：缩放、拖拽、视口剔除
│   ├── editor-node.js      # 节点：组合模式
│   │   ├── editor-node-render.js      # 节点渲染
│   │   ├── editor-container-render.js # 容器子节点渲染
│   │   ├── editor-node-panel.js       # 属性面板渲染
│   │   ├── editor-node-selector.js    # 变量选择器
│   │   └── editor-param-editor.js    # 参数编辑（输入输出/循环变量）
│   ├── editor-edge.js      # 边渲染
│   ├── editor-history.js   # 历史记录（撤销/重做，最多50步）
│   ├── editor-clipboard.js # 复制（导出到 Coze）
│   ├── editor-clipboard-paste.js # 粘贴（从 Coze 导入）
│   ├── shared-serializer.js # 文件加载反序列化
│   ├── editor-search.js    # 节点搜索高亮定位
│   ├── editor-selection.js # 多选与框选
│   ├── editor-keyboard.js  # 快捷键支持（含自定义配置）
│   ├── editor-align.js     # 节点对齐 + 网格吸附
│   ├── editor-autosave.js  # 自动保存 + 状态提示
│   ├── editor-storage.js   # 本地存储
│   ├── manager.js   # 工作流列表管理（批量删除、拖拽排序）
│   ├── shared-dialog.js             # 模态对话框
│   ├── converter.js          # YAML → Coze JSON 转换
│   ├── converter-keyboard.js # 转换器页面快捷键
│   ├── converter-stats.js         # 统计视图
│   ├── shared-graph.js         # 依赖图视图
│   ├── shared-navigator.js          # 页面导航
│   ├── shared-i18n.js    # i18n 控制器
│   ├── shared-theme.js   # 主题控制器
│   ├── converter-reverse.js            # 反向转换（JSON → YAML）
│   └── converter-ui.js      # 转换器页面 UI
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
│   ├── helpers.js            # DOM、Storage、deepClone、AsyncUtils 等
│   ├── logger.js             # 日志
│   └── refCache.js           # 引用缓存
├── config/
│   └── constants.js          # 常量配置
├── tests/                    # Jest 单元测试（25 套件，1127 用例）
└── example/                  # 示例工作流文件
```

---

## 架构设计要点

### 1. 组合模式

项目使用 **组合模式** 将功能拆分到独立模块，通过类实例化组合：

```js
export class WorkflowNode {
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

优势：每个模块职责单一，子模块通过 `this.node` 访问父级实例，易于维护和测试。

### 2. this 绑定规范（CRITICAL）

**必须遵守**以避免 `TypeError: Cannot read properties of undefined`：

| 场景 | 正确写法 |
|---|---|
| 事件监听器传入方法引用 | `addEventListener('click', this.method.bind(this))` 或定义为箭头函数实例属性 |
| 递归调用内部函数 | `children.forEach(child => checkNode.call(this, child))` |
| **推荐** | 使用箭头函数作为实例属性：`this.method = () => { ... }` |

**已修复的典型案例**：
- `editor-node-panel.js` - `document.addEventListener` 缺 `.bind(node)` → `this.addInputParam is not a function`
- `editor-search.js` - 递归 `checkNode(child)` 未绑定 `this` → `Cannot read properties of undefined (reading 'core')`

### 3. 容器节点 CSS 规范（CRITICAL）

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

## 键盘快捷键

| 快捷键 | 功能 | 说明 |
|---|---|---|
| `Ctrl+C` | 复制选中节点 | 含连线关系 |
| `Ctrl+V` | 粘贴节点 | 自动重映射 ID |
| `Ctrl+Z` | 撤销 | 最多 50 步 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 | 支持 Mac |
| `Ctrl+A` | 全选所有节点 | |
| `Ctrl+D` | 复制选中节点 | 直接复制 |
| `Ctrl+F` | 自动优化布局 | |
| `Ctrl+L` | 锁定/解锁选中节点 | |
| `Ctrl+S` | 保存到本地存储 | |
| `Delete` / `Backspace` | 删除选中节点/边 | |
| `Escape` | 取消选中/取消连接 | |

> **特性**：大小写不敏感匹配，Ctrl/Cmd 自动识别（兼容 Windows/Mac），支持通过模态界面自定义配置，配置持久化到 localStorage

---

## 特殊节点：loop_set_variable (type 20)

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
    variables: [  // 与 Coze inputParameters 结构一致
      { left: {...}, right: {...} }
    ]
  }
}
```

### 关键处理逻辑

| 阶段 | 处理 | 文件 |
|---|---|---|
| **复制导出** | 将 `node.parameters.variables` 直接赋值给 `cozeNode.data.inputs.inputParameters` | [editor-clipboard.js](src/modules/editor-clipboard.js) |
| **粘贴导入** | 遍历 `variables` 数组，重映射 `left.value.content.blockID` 和 `right.value.content.blockID` | [editor-clipboard-paste.js](src/modules/editor-clipboard-paste.js) |
| **文件加载** | 同上，重映射 `blockID` | [shared-serializer.js](src/modules/shared-serializer.js) |
| **属性面板** | 跳过 JSON 文本框，使用可视化编辑器渲染 | [editor-node-panel.js](src/modules/editor-node-panel.js) + [editor-param-editor.js](src/modules/editor-param-editor.js) |

### 可视化编辑器功能

- 添加/删除变量
- 点击选择 `left`（目标变量，通常是循环迭代变量）
- 点击选择 `right`（新值，可以是引用或直接输入字面量）
- 支持清除引用切换回字面量输入
- 显示已选择引用路径（节点 → 输出名）

---

## 容器节点（loop / batch）

### 数据结构

```js
// 容器节点
{ id: 'node_123', type: 'loop' | 'batch', x, y, width, height, parentId: null }

// 子节点（parentId 指向容器节点 id）
{ id: 'node_456', type: 'any', parentId: 'node_123', ... }
```

所有节点（包括子节点）存储在 `core.nodes` 扁平数组中，子节点通过 `parentId` 过滤。

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
    json_parse: "37", clear_conversation: "38", create_conversation: "39",
    variable_assign: "40", db_update: "42", db_select: "43",
    db_delete: "44", http: "45", db_insert: "46",
    update_conversation: "51", delete_conversation: "52",
    list_conversation: "53", get_conversation_history: "54",
    create_message: "55", update_message: "56", delete_message: "57",
    json_serialize: "58", json_deserialize: "59", knowledge_delete: "60",
    video_extract_audio: "63", video_extract_frame: "64",
    video_generation: "65", memory_write: "66", memory_read: "67",
    async_task: "72"
};
// 共 50 种节点类型
```

`REV_TYPE_MAP` 是反向映射（数字 → 名称）。

---

## 已知问题修复记录

### v1.4.4 (2026-07-08)

| 问题 | 根因 | 修复 |
|---|---|---|
| distribute 方法重复保存历史 | 每次调用都触发历史保存 | 仅在操作完成时保存一次 |
| Escape 事件监听器泄漏 | `_onKeyDown` 绑定后未在操作取消时移除 | 在 Escape 处理中清理监听器 |
| `_pendingContainers`/`_ctrlDetached` 清理不完整 | 操作完成后未完全清理 | 添加完整清理逻辑 |
| `hasDraggedCanvas` 标志位残留 | 拖拽画布后标志位未重置 | 在操作完成后重置 |
| `loadSavedWorkflow` 缺少数组类型校验 | 未校验 nodes 和 edges 是否为数组 | 添加 Array.isArray 检查 |
| Ctrl+F 触发浏览器查询 | `matchShortcut` 大小写敏感 | 改为大小写不敏感比较 |
| 管理页面拖动工作流无效 | `draggable="true"` 在卡片上而非手柄 | 移至拖拽手柄 |
| 多选时点击工作流跳转 | 批量模式下未阻止跳转 | 排除复选框点击，检查批量模式 |
| GET `/utils/storage.js` 404 | 导入路径错误 | 改为 `../utils/helpers.js` |
| 键盘测试 `altKey` undefined | `createMockEvent` 缺少 `altKey` 默认值 | 添加 `altKey: options.altKey \|\| false` |

### v1.4.2 (2026-06-30)

| 问题 | 根因 | 修复 |
|---|---|---|
| `loop_set_variable` 粘贴后参数丢失 | Coze 使用 `left/right` 格式，转换时未保留原始结构 | 粘贴/加载时保留 `variables` 数组，导出直接赋值 |
| 导出时 `inputs` 同时有 `inputParameters` 和 `variables` | 复制时走了通用处理分支 | 添加专属处理分支 |
| 粘贴后 `left/right` 引用无效 | `blockID` 未重映射 | 遍历 `variables` 数组进行重映射 |
| `variables` 默认值错误 | `defaultValue: '{}'` 应为 `'[]'` | 修改 editor-node-types.js |
| 翻译键显示原始文本 | 翻译键在根级别而非 `nodes` 对象 | 移动到 `nodes` 对象内 |
| `this.addInputParam is not a function` | `document.addEventListener` 缺 `.bind(node)` | 添加 `.bind(node)` |
| 搜索功能崩溃 | 递归 `checkNode(child)` 未绑定 `this` | `checkNode.call(this, child)` |
| 容器内子节点样式被覆盖 | CSS 后代选择器泄漏 | 改为 `>` 子选择器 |

---

## 可用命令

```bash
npm run dev      # 启动开发服务器 (localhost:8080)
npm run build    # 构建到 dist/（三个独立 HTML 文件）
npm run convert  # 批量转换 YAML → JSON
npm test         # 运行 Jest 单元测试（25 套件，1127 用例）
npm run lint     # ESLint 检查
npm run lint:fix # ESLint 自动修复
```

---

## 编码约定

1. **类 + 组合模式**：每个功能模块通过独立的类实现，在父类中通过 `new` 实例化组合
2. **this 绑定**：优先使用箭头函数实例属性，避免手动 bind
3. **动态导入**：`app.js` 根据页面类型动态加载对应模块，减少首屏加载
4. **视口剔除**：大规模工作流只渲染可视区域内节点，提升性能
5. **国际化**：所有用户可见文本使用 `t('key')`，翻译放在 `i18n/`
6. **CSS 选择器**：容器节点样式使用 `>` 子选择器，避免泄漏
7. **类型断言**：TypeScript 环境下使用 JSDoc `/** @type {HTMLElement} */` 窄化类型
8. **事件清理**：所有事件监听器必须在 destroy/cleanup 中移除，防止泄漏
9. **历史记录**：操作完成后统一保存历史，避免重复保存

---

## 下次会话须知

开始本项目的开发/维护时：

1. **优先检查 this 绑定**：遇到 `Cannot read properties of undefined` 时，检查事件监听器和递归调用是否绑定正确
2. **CSS 选择器作用域**：容器子节点样式异常时，检查是否使用了后代选择器而非 `>`
3. **翻译键位置**：看到原始 key 文本而非翻译时，检查翻译键是否在正确的命名空间下
4. **loop_set_variable**：`node.parameters.variables` 数组 → 导出为 `inputs.inputParameters`，粘贴/加载时需重映射 `blockID`
5. **快捷键**：大小写不敏感，Ctrl/Cmd 自动互换，支持自定义配置
6. **事件泄漏**：新增事件监听器时必须确保在 destroy/cleanup 中移除
7. **遵循现有模式**：ES6 类 + 组合模式 + 箭头函数，保持代码风格一致
8. **测试**：修改核心逻辑后运行 `npm test` 确保 1127 个用例全部通过
9. **覆盖率**：`jest.config.js` 中设定了文件级覆盖率门槛（纯逻辑 80%、混合逻辑 70%/50%），UI 文件豁免
10. **文档更新**：重大变更后更新 CHANGELOG.md、README.md、PROJECT_DOC.md 和本文件