# 03 · 项目结构

## 3.1 顶层目录

```
workflow/
├── src/                   # 源代码
├── tests/                 # Jest 单元测试
├── wiki/                  # 本文档目录（Code Wiki）
├── dist/                  # 构建产物（运行 npm run build 后生成）
├── .github/workflows/     # CI 配置
├── .husky/                # Git hooks
├── package.json           # 依赖与脚本
├── jest.config.js         # 测试配置
├── jest.setup.js          # 测试环境（jsdom）
├── jsconfig.json          # TypeScript 类型检查
├── .eslintrc.json         # ESLint 配置
├── .prettierrc            # Prettier 配置
├── .markdownlint.json     # Markdown lint
├── .babelrc               # Babel 配置
├── README.md              # 用户文档
├── AGENTS.md              # AI 会话上下文
├── CHANGELOG.md           # 版本历史
├── check_types.cjs        # 类型检查脚本
└── check_i18n.cjs         # i18n 一致性检查
```

## 3.2 源代码目录

```
src/
├── assets/                # 静态资源
│   └── favicon.svg
│
├── components/            # 转换器组件（独立可测试的纯函数）
│   ├── containerHandler.js     # loop/batch 容器节点转换
│   ├── inputMapper.js          # 输入参数映射
│   ├── outputMapper.js         # 输出参数映射
│   └── nodeHandlers.js         # 各节点类型导出处理器（22 种）
│
├── config/                # 全局配置
│   └── constants.js        # APP_CONFIG（历史/缩放/主题/缓存）+ SELECTORS
│
├── i18n/                  # 国际化
│   ├── i18n.js             # I18nManager 类（监听器、参数替换、嵌套 key）
│   ├── zh-CN.js            # 中文翻译
│   └── en-US.js            # 英文翻译
│
├── modules/               # 核心功能模块（45+ 文件）
│   ├── app.js                       # 入口
│   ├── editor-*.js                  # 编辑器相关
│   ├── converter*.js                # 转换器相关
│   ├── manager*.js                  # 管理器相关
│   └── shared-*.js                  # 跨页面共享
│
├── scripts/               # 构建与服务脚本
│   ├── server.js                   # 开发 HTTP 服务器（http-server 替代品）
│   ├── build.js                    # 单文件构建（terser + 内联）
│   └── batch-convert.mjs           # 批量转换命令行工具
│
├── styles/                # 样式
│   ├── style.css                   # 全局样式
│   ├── workflow-editor.css         # 编辑器样式
│   └── workflow-manager.css        # 管理页样式
│
├── utils/                 # 工具函数
│   ├── types.js                    # TYPE_MAP / REV_TYPE_MAP / 颜色 / 标题
│   ├── utils.js                    # YAML/JSON 校验、错误类
│   ├── helpers.js                  # DOM/Storage/深拷贝/事件
│   ├── logger.js                   # 日志门面
│   └── refCache.js                 # 引用缓存
│
└── views/                 # HTML 入口
    ├── workflow-editor.html        # 编辑器页
    ├── workflow-manager.html       # 管理页
    └── workflow-converter.html     # 转换器页
```

## 3.3 模块按类别分组

### 编辑器（editor-*）

| 文件 | 职责 |
| --- | --- |
| `editor-ui.js` | UI 总控：组合子模块、事件绑定、状态同步 |
| `editor-core.js` | 数据核心：节点/边 CRUD、ID 计数器、验证 |
| `editor-canvas.js` | 画布：缩放/平移/网格/小地图/视口剔除 |
| `editor-node.js` | 节点入口（组合） |
| `editor-node-render.js` | 节点 DOM 创建/拖拽/批量测量 |
| `editor-node-drag.js` | 节点拖拽/吸附/多选 |
| `editor-node-types.js` | 50 种节点元信息（标题/图标/参数定义） |
| `editor-node-panel.js` | 节点属性面板（结构化条件编辑） |
| `editor-node-selector.js` | 变量引用选择器 |
| `editor-param-editor.js` | 参数编辑器（输入/输出/合并变量） |
| `editor-container-render.js` | 容器节点（loop/batch）子节点渲染 |
| `editor-edge.js` | 边渲染（贝塞尔曲线/分支端口/增量更新） |
| `editor-clipboard.js` | 剪贴板复制（Coze 格式） |
| `editor-clipboard-paste.js` | 剪贴板粘贴（Coze/简单/多节点） |
| `editor-history.js` | 历史步骤面板（可视化导航） |
| `editor-keyboard.js` | 快捷键（默认 + 自定义配置） |
| `editor-selection.js` | 选择（全选/多选/框选） |
| `editor-align.js` | 对齐/分布工具栏 |
| `editor-layout.js` | 自动布局（拓扑排序） |
| `editor-search.js` | 节点搜索高亮 |
| `editor-messages.js` | Toast 消息提示 |
| `editor-autosave.js` | 自动保存 + 状态指示 |
| `editor-storage.js` | localStorage 持久化 |
| `editor-share.js` | 导出 zip（YAML + manifest） |
| `editor-node-selector.js` | 变量选择器（独立导出） |

### 转换器（converter*）

| 文件 | 职责 |
| --- | --- |
| `converter.js` | YAML → Coze 核心转换（processNode、calculateBounds） |
| `converter-reverse.js` | Coze → YAML 反向转换（TYPE_PARAMS_MAP、convertValue） |
| `converter-ui.js` | 转换页 UI 控制器（输入/输出/缓存/虚拟滚动） |
| `converter-renderer.js` | 渲染：虚拟滚动 + 语法高亮 + 异步渲染 |
| `converter-virtual-scroll.js` | 虚拟滚动（>1000 行启用） |
| `converter-highlighter.js` | 语法高亮（JSON/YAML） |
| `converter-highlighter-worker.js` | 语法高亮（Web Worker） |
| `converter-keyboard.js` | 转换页快捷键（Ctrl+Enter 转换） |
| `converter-history.js` | 转换历史（localStorage，20 条） |
| `converter-stats.js` | 统计视图 / 历史面板（节点类型分布） |
| `converter-stats-renderer.js` | 统计 DOM 渲染 |

### 管理器（manager*）

| 文件 | 职责 |
| --- | --- |
| `manager.js` | 工作流列表管理（CRUD、批量、搜索、模板） |
| `manager-templates.js` | 内置模板库（tpl_welcome、tpl_chatbot、tpl_image_gen...） |

### 共享（shared-*）

| 文件 | 职责 |
| --- | --- |
| `shared-navigator.js` | 页面导航（带淡入淡出动画） |
| `shared-theme.js` | 主题控制器（深/浅 + 字体大小 + 行号） |
| `shared-i18n.js` | i18n UI 控制器（语言按钮 + 文本更新） |
| `shared-dialog.js` | 模态对话框（alert/confirm/prompt） |
| `shared-serializer.js` | 工作流导入/导出/剪贴板加载（核心） |
| `shared-graph.js` | 依赖图视图（SVG 渲染工作流） |
| `shared-node-detail.js` | 节点详情模态框（JSON/YAML 复制） |

### 入口

| 文件 | 职责 |
| --- | --- |
| `app.js` | 应用入口：识别页面 + 动态加载 |

## 3.4 测试目录

```
tests/
├── align.test.js                # 对齐模块
├── canvas.test.js               # 画布模块
├── clipboard.test.js            # 剪贴板
├── converter.test.js            # 转换器
├── core.test.js                 # 编辑器核心
├── edge.test.js                 # 边渲染
├── helpers.test.js              # 工具函数
├── highlighter.test.js          # 语法高亮
├── history.test.js              # 历史记录
├── i18n.test.js                 # 国际化
├── keyboard.test.js             # 键盘快捷键
├── logger.test.js               # 日志
├── navigator.test.js            # 导航
├── refCache.test.js             # 引用缓存
├── reverse.test.js              # 反向转换
├── serializer.test.js           # 序列化
├── storage.test.js              # 存储
├── templates.test.js            # 模板
├── theme-controller.test.js     # 主题
├── types.test.js                # 类型映射
├── utils.test.js                # utils
└── components/
    ├── containerHandler.test.js
    ├── inputMapper.test.js
    ├── nodeHandlers.test.js
    └── outputMapper.test.js
```

## 3.5 文件命名约定

| 模式 | 含义 |
| --- | --- |
| `editor-*.js` | 编辑器相关模块 |
| `converter*.js` | 转换器相关模块（`converter.js` 是核心） |
| `converter-*.js` | 转换器 UI 层模块（UI 子系统） |
| `manager*.js` | 管理器相关模块 |
| `shared-*.js` | 跨页面共享模块 |
| `*.test.js` | 单元测试（与被测文件同目录或 tests/） |
| 大写类名 | ES6 Class 导出（PascalCase） |
| 小写函数名 | 普通函数（camelCase） |

## 3.6 模块粒度原则

| 原则 | 体现 |
| --- | --- |
| **单一职责** | 每个文件只关注一个方面（如 `editor-edge.js` 只管边） |
| **可独立测试** | 转换器组件 (`src/components/`) 是纯函数，易测试 |
| **类组合代替继承** | `editor-node.js` 组合 5 个子模块 |
| **静态方法** | `Dialog` 全部使用 `static` 方法 |
| **箭头函数实例属性** | 避免 `this` 绑定问题 |

## 3.7 静态资源

- `src/assets/favicon.svg` — 网站图标
- 字体：使用系统默认字体（`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`）
- 图标：使用 Emoji（🚀 🏁 🤖 等）作为节点图标，无需图标库

## 3.8 构建产物

`npm run build` 生成的 `dist/` 目录包含三个独立 HTML：

```
dist/
├── workflow_editor.html
├── workflow_converter.html
└── workflow_manager.html
```

每个 HTML 文件：
- 内联了所有 CSS（无外部样式请求）
- 内联了所有 JS（terser 压缩）
- 通过 `<script type="module">` 内置 `data:text/javascript;base64,...` Blob URL 加载模块
- 因此**完全离线**、**`file://` 可用**

详见 [11-run-and-build.md](./11-run-and-build.md)。
