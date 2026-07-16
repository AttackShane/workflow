# 10 · 依赖关系图

> 本文档展示项目内部模块间的依赖关系，以及与外部库的依赖。

## 10.1 模块依赖矩阵

### 10.1.1 编辑器核心模块

| 模块 | 依赖 |
| --- | --- |
| `editor-core.js` | `utils/types.js`, `i18n/i18n.js`, `utils/logger.js`, `utils/helpers.js`, `editor-storage.js`, `shared-serializer.js`, `editor-node-types.js` |
| `editor-storage.js` | `utils/helpers.js` |
| `editor-ui.js` | `editor-canvas.js`, `editor-node.js`, `editor-edge.js`, `editor-history.js`, `editor-clipboard.js`, `editor-align.js`, `editor-keyboard.js`, `editor-selection.js`, `utils/logger.js`, `shared-dialog.js`, `shared-navigator.js`, `config/constants.js`, `utils/helpers.js`, `i18n/i18n.js`, `editor-messages.js`, `editor-search.js`, `editor-autosave.js`, `editor-share.js` |
| `editor-canvas.js` | `config/constants.js`, `utils/helpers.js`, `editor-layout.js` |
| `editor-node.js` | `editor-node-render.js`, `editor-container-render.js`, `editor-node-panel.js`, `editor-node-selector.js`, `editor-param-editor.js` |
| `editor-node-render.js` | `utils/helpers.js`, `i18n/i18n.js`, `editor-container-render.js`, `editor-node-drag.js` |
| `editor-node-drag.js` | (内部) |
| `editor-node-types.js` | `i18n/i18n.js` |
| `editor-node-panel.js` | `utils/helpers.js`, `i18n/i18n.js` |
| `editor-node-selector.js` | `utils/helpers.js` |
| `editor-param-editor.js` | `utils/helpers.js`, `i18n/i18n.js` |
| `editor-container-render.js` | (内部) |
| `editor-edge.js` | `utils/helpers.js`, `i18n/i18n.js` |
| `editor-clipboard.js` | `utils/types.js`, `utils/helpers.js`, `i18n/i18n.js`, `editor-clipboard-paste.js` |
| `editor-clipboard-paste.js` | `i18n/i18n.js`, `utils/helpers.js` |
| `editor-history.js` | `i18n/i18n.js`, `utils/helpers.js` |
| `editor-keyboard.js` | `utils/helpers.js`, `shared-navigator.js`, `i18n/i18n.js` |
| `editor-selection.js` | `utils/helpers.js`, `i18n/i18n.js` |
| `editor-align.js` | `utils/helpers.js` |
| `editor-layout.js` | (内部) |
| `editor-search.js` | `utils/helpers.js`, `utils/types.js`, `i18n/i18n.js` |
| `editor-messages.js` | `utils/helpers.js` |
| `editor-autosave.js` | `i18n/i18n.js` |
| `editor-share.js` | `utils/helpers.js`, `i18n/i18n.js`, `converter-reverse.js`, `shared-serializer.js` |

### 10.1.2 转换器模块

| 模块 | 依赖 |
| --- | --- |
| `converter.js` | `utils/types.js`, `components/outputMapper.js`, `components/inputMapper.js`, `components/nodeHandlers.js`, `utils/utils.js`, `i18n/i18n.js` |
| `converter-reverse.js` | `utils/types.js`, `utils/utils.js`, `utils/logger.js` |
| `converter-ui.js` | `converter.js`, `converter-reverse.js`, `converter-stats.js`, `shared-navigator.js`, `config/constants.js`, `utils/helpers.js`, `utils/utils.js`, `utils/logger.js`, `i18n/i18n.js`, `converter-renderer.js` |
| `converter-renderer.js` | `converter-highlighter.js`, `config/constants.js`, `utils/helpers.js`, `utils/logger.js` |
| `converter-virtual-scroll.js` | (内部) |
| `converter-highlighter.js` | (内部) |
| `converter-highlighter-worker.js` | (Worker 入口) |
| `converter-keyboard.js` | (内部) |
| `converter-history.js` | `config/constants.js`, `utils/helpers.js`, `utils/utils.js` |
| `converter-stats.js` | `converter-ui.js`, `shared-dialog.js`, `config/constants.js`, `utils/helpers.js`, `i18n/i18n.js`, `converter-history.js`, `converter-stats-renderer.js` |
| `converter-stats-renderer.js` | (内部) |
| `components/nodeHandlers.js` | `utils/types.js`, `utils/utils.js`, `components/outputMapper.js`, `components/inputMapper.js`, `components/containerHandler.js` |
| `components/inputMapper.js` | `utils/types.js`, `utils/utils.js` |
| `components/outputMapper.js` | `utils/types.js`, `utils/utils.js` |
| `components/containerHandler.js` | `utils/types.js`, `utils/utils.js` |

### 10.1.3 管理器模块

| 模块 | 依赖 |
| --- | --- |
| `manager.js` | `shared-dialog.js`, `shared-navigator.js`, `utils/helpers.js`, `i18n/i18n.js`, `utils/logger.js`, `converter.js`, `shared-serializer.js`, `converter-reverse.js`, `manager-templates.js` |
| `manager-templates.js` | (内部) |

### 10.1.4 共享模块

| 模块 | 依赖 |
| --- | --- |
| `shared-dialog.js` | `i18n/i18n.js`, `utils/helpers.js` |
| `shared-navigator.js` | `utils/logger.js`, `utils/helpers.js` |
| `shared-theme.js` | `config/constants.js`, `utils/helpers.js`, `utils/logger.js`, `i18n/i18n.js` |
| `shared-i18n.js` | `i18n/i18n.js`, `shared-theme.js` |
| `shared-serializer.js` | `i18n/i18n.js`, `utils/logger.js`, `utils/helpers.js`, `utils/types.js` |
| `shared-graph.js` | `utils/utils.js`, `utils/helpers.js`, `utils/logger.js`, `shared-node-detail.js` |
| `shared-node-detail.js` | (内部) |

### 10.1.5 工具与基础设施

| 模块 | 依赖 |
| --- | --- |
| `utils/helpers.js` | `utils/logger.js` |
| `utils/types.js` | `utils/refCache.js`, `utils/logger.js` |
| `utils/utils.js` | `utils/types.js` |
| `utils/logger.js` | (无) |
| `utils/refCache.js` | (无) |
| `i18n/i18n.js` | `i18n/zh-CN.js`, `i18n/en-US.js`, `utils/logger.js`, `utils/helpers.js` |
| `i18n/zh-CN.js` | (无) |
| `i18n/en-US.js` | (无) |
| `config/constants.js` | (无) |
| `app.js` | `shared-theme.js`, `shared-i18n.js`, `shared-navigator.js` |

## 10.2 模块依赖图（有向无环图）

```
                        ┌──────────────────┐
                        │  config/         │
                        │  constants.js    │
                        └────────┬─────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  utils/      │         │  i18n/       │         │  shared/     │
│  helpers.js  │         │  i18n.js     │         │  *.js        │
│  types.js    │         │  zh-CN.js    │         └──────────────┘
│  utils.js    │         │  en-US.js    │
│  logger.js   │         └──────────────┘
│  refCache.js │
└──────┬───────┘                │
       │                        │
       └────────────┬───────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
  components/    modules/      (其他)
  *.js           editor-*.js / converter-*.js / manager-*.js
       │            │
       └────────────┘
```

## 10.3 编辑器依赖层次

```
Layer 0: config, utils, i18n
   ↓
Layer 1: 基础设施（storage, serializer, dialog, theme, i18n-controller, navigator）
   ↓
Layer 2: 核心数据（editor-core, editor-node-types）
   ↓
Layer 3: 子模块（canvas, node 子模块, edge, history, clipboard, align, keyboard, ...）
   ↓
Layer 4: UI 总控（editor-ui）
   ↓
Layer 5: 应用入口（workflow-editor.html）
```

## 10.4 循环依赖检测

**项目内无循环依赖**。所有依赖都遵循单向流动。

## 10.5 第三方依赖

### 10.5.1 运行时

| 包 | 版本 | 用途 | 引入方式 |
| --- | --- | --- | --- |
| `js-yaml` | ^4.1.1 | YAML 解析/序列化 | CDN `<script>` |

### 10.5.2 通过 CDN 加载

```html
<!-- src/views/*.html 中 -->
<script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
```

| 资源 | 版本 | 用途 |
| --- | --- | --- |
| `js-yaml` | 4.1.0 | YAML 解析与序列化 |
| `JSZip` | 3.10.1 | 导出工作流 zip 包 |

## 10.6 构建工具依赖

| 工具 | 用途 |
| --- | --- |
| `terser` | JS 压缩 |
| `@babel/core` + `@babel/preset-env` | ESM → ES5 转译（Jest） |
| `babel-jest` | Jest 通过 Babel 转译 |
| `eslint` + `prettier` | 代码检查与格式化 |
| `husky` + `lint-staged` | Git hooks |
| `jest` + `jest-environment-jsdom` | 单元测试 |
| `http-server` | 备用静态服务器（项目自写 `server.js`） |

## 10.7 完整依赖图

```
                              ┌─────────────────────┐
                              │  workflow-editor     │
                              │  workflow-converter  │
                              │  workflow-manager    │
                              │  (.html)             │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │  app.js (入口)       │
                              └──────────┬───────────┘
                                         │
        ┌────────────────────┬───────────┼────────────┬────────────────────┐
        ▼                    ▼           ▼            ▼                    ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐
│  editor-ui   │  │  converter-ui    │  │  manager        │  │  shared-*      │
│              │  │                  │  │                 │  │                │
└──────┬───────┘  └────────┬─────────┘  └────────┬────────┘  └───────┬────────┘
       │                   │                     │                   │
       │    ┌──────────────┼─────────────────────┤                   │
       │    │              │                     │                   │
       │    ▼              ▼                     ▼                   ▼
       │  ┌────────────────────────────────────────────────────────────┐
       │  │  editor-* (canvas/node/edge/history/clipboard/...)         │
       │  │  converter-* (renderer/highlighter/...)                    │
       │  │  shared-serializer                                        │
       │  └─────────────────────┬──────────────────────────────────────┘
       │                        │
       │                        ▼
       │            ┌────────────────────────┐
       │            │  editor-core           │
       │            │  editor-storage        │
       │            │  editor-node-types     │
       │            └────────────┬───────────┘
       │                         │
       ▼                         ▼
┌────────────────────────────────────────────────────────────────┐
│  utils/* (helpers, types, utils, logger, refCache)             │
│  config/constants                                              │
│  i18n/* (i18n, zh-CN, en-US)                                  │
│  components/* (inputMapper, outputMapper, nodeHandlers, ...)  │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  window.jsyaml (CDN)      │
                    │  window.JSZip (CDN)       │
                    └──────────────────────────┘
```

## 10.8 被引用最多的模块

按引用次数排序（粗略估计）：

1. **`utils/helpers.js`** — 35+ 处使用（DOM、Storage、StringUtils、deepClone）
2. **`i18n/i18n.js`** — 30+ 处使用（`t()` 翻译）
3. **`utils/types.js`** — 20+ 处使用（TYPE_MAP、颜色）
4. **`shared-dialog.js`** — 15+ 处使用（Dialog）
5. **`config/constants.js`** — 10+ 处使用（APP_CONFIG、SELECTORS）
6. **`shared-navigator.js`** — 10+ 处使用（goToManager 等）
7. **`utils/logger.js`** — 20+ 处使用（Logger）
8. **`utils/utils.js`** — 15+ 处使用（YAML/JSON 工具）

## 10.9 关键路径依赖

### 10.9.1 启动编辑器

```
workflow-editor.html
   → app.js (识别页面)
   → editor-ui.js (UI 总控)
   → editor-core.js (数据核心)
   → editor-node.js (节点组合)
   → editor-canvas.js (画布)
   → editor-edge.js (边)
   → editor-history.js (历史)
   → editor-clipboard.js (剪贴板)
   → editor-clipboard-paste.js (粘贴)
   → editor-keyboard.js (快捷键)
   → editor-align.js (对齐)
   → editor-selection.js (选择)
   → editor-search.js (搜索)
   → editor-messages.js (消息)
   → editor-autosave.js (自动保存)
   → editor-share.js (分享)
   → utils/helpers.js, types.js, i18n.js
   → shared-serializer.js
```

### 10.9.2 启动转换器

```
workflow-converter.html
   → app.js (识别页面)
   → converter-ui.js (UI 控制器)
   → converter.js (YAML → Coze)
   → converter-reverse.js (Coze → YAML)
   → converter-renderer.js (渲染)
   → converter-virtual-scroll.js (虚拟滚动)
   → converter-highlighter.js (高亮)
   → converter-keyboard.js (快捷键)
   → converter-history.js (历史)
   → converter-stats.js (统计)
   → shared-graph.js (图视图)
   → shared-navigator.js
   → components/nodeHandlers, inputMapper, outputMapper, containerHandler
   → utils/*
   → config/constants
```

### 10.9.3 启动管理器

```
workflow-manager.html
   → app.js (识别页面)
   → manager.js
   → manager-templates.js
   → shared-dialog.js
   → shared-navigator.js
   → shared-serializer.js
   → converter.js
   → converter-reverse.js
   → utils/*
```

## 10.10 依赖最佳实践

| 实践 | 体现 |
| --- | --- |
| **依赖单向流动** | Layer 0 → 5，无循环 |
| **高内聚低耦合** | 每个模块只依赖必要的工具 |
| **避免深层嵌套** | 最深 3~4 层 |
| **使用局部依赖** | 工具函数按需导入 |
| **工具类无业务依赖** | `helpers.js`、`logger.js` 不依赖业务 |
| **共享与业务分离** | `shared-*` 可独立使用 |
| **配置集中** | `config/constants.js` 统一管理常量 |
