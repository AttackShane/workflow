# Coze 工作流编辑器

一个基于原生 JavaScript ES Module 实现的工作流编辑器与转换器系统，支持三页面（工作流管理、YAML转换器、可视化编辑器），可在 YAML/JSON 工作流定义与 Coze 剪贴板格式之间双向转换。

## ✨ 功能特性

- **工作流编辑器**: 可视化拖拽编辑工作流节点，支持无限画布缩放和平移
- **YAML 转换器**: 将 YAML 格式工作流转换为 Coze 剪贴板数据，支持虚拟滚动和语法高亮
- **反向转换**: 支持将 Coze 格式转换回 YAML 格式（Coze → YAML）
- **工作流管理**: 工作流列表的创建、编辑、导入、导出管理
- **历史记录**: 编辑器支持撤销/重做操作（最多50步历史）
- **多选编辑**: 支持多节点选中、拖拽、复制粘贴（含连线关系）
- **键盘快捷键**: 支持 Ctrl+C/V/Z/Y/A/S/Delete/Esc/F/L 等常用操作，自定义快捷键配置
- **单文件构建**: 支持打包为三个独立 HTML 文件（`dist/`目录），兼容 `file://` 协议直接运行
- **局域网访问**: 开发服务器支持其他设备通过局域网访问
- **平滑导航**: 三页面间切换带淡入淡出动画效果
- **虚拟滚动**: 大数据量文本编辑性能优化
- **语法高亮**: YAML/JSON 语法高亮，Worker 异步处理防阻塞
- **主题切换**: 支持深色/浅色主题自动切换
- **国际化支持**: 支持中英文语言切换
- **批量转换**: 支持批量处理多个工作流文件
- **图形可视化**: 工作流图形预览，支持缩放和平移
- **统计视图**: 工作流节点统计信息展示
- **动态分支**: 条件节点支持动态多分支（12+），每个分支带独立条件表达式
- **条件表达式编辑器**: 结构化表单编辑（左值 + 操作符 + 右值，AND/OR 连接），自动转回 Coze 格式
- **批量测量**: 节点 DOM 测量优化，N 个节点仅 1 次 forced reflow
- **剪贴板集成**: 编辑器内复制节点直接生成 Coze 剪贴板格式数据
- **设置变量可视化**: `loop_set_variable` 节点属性面板支持可视化编辑变量，添加/删除变量、点击选择引用
- **样式隔离**: 容器节点（loop/batch）样式精确隔离，容器内外节点样式一致
- **健壮性**: 全面修复 `this` 绑定问题，搜索、属性面板、事件处理等模块稳定运行
- **网格吸附**: 画布背景网格渲染，节点拖拽自动吸附到网格点，支持自定义网格大小
- **工作流复制**: 支持完整工作流深拷贝，自动重生成所有节点和连线 ID
- **画布搜索**: 支持按名称/类型搜索节点，搜索结果可点击定位到画布位置
- **小地图**: 节点缩略图渲染、视口指示器、交互式导航（点击/拖拽移动视口）
- **批量删除**: 管理页面支持多选批量删除工作流，包含全选/取消全选
- **节点锁定**: 锁定/解锁节点，锁定后禁止拖拽和删除，UI 显示锁定状态
- **自定义快捷键**: 快捷键配置系统，支持 Storage 持久化、模态配置界面、大小写不敏感
- **导出 SVG**: 工作流导出为 SVG 文件，包含节点/连线渲染、坐标计算、样式转换
- **版本对比**: 工作流版本快照存储、差异对比、历史版本管理
- **批量参数编辑**: 多选节点提取公共参数，批量更新
- **拖拽排序**: 管理页面工作流列表支持拖拽排序，使用 HTML5 Drag & Drop
- **自动保存**: 定时自动保存工作流，状态栏显示保存状态指示
- **触摸支持**: 触摸事件处理（单指拖拽、双指缩放），支持移动设备操作
- **工具栏优化**: 下拉菜单整合低频操作，使用事件委托管理状态

## 📦 支持的节点类型

| 图标 | 类型 | 说明 |
| ---- | ---- | ---- |
| 🚀 | start | 开始节点 |
| 🏁 | end | 结束节点 |
| 🤖 | llm | 大模型调用 |
| 🔌 | plugin | 插件调用 |
| 💻 | code | 代码执行 |
| 📚 | knowledge_query | 知识库检索 |
| 🔀 | condition | 条件分支 |
| 🔗 | workflow | 子工作流 |
| 🗄️ | sql_exec | SQL执行 |
| 📤 | output | 输出 |
| 📝 | text | 文本处理 |
| 🎨 | image_generate | 图像生成 |
| ❓ | question | 问答 |
| ⏹️ | break | 退出循环 |
| 📦 | loop_set_variable | 设置变量 |
| 🔄 | loop | 循环 |
| 🧠 | intent | 意图识别 |
| 🎨 | canvas | 画板 |
| 📝 | knowledge_write | 知识库写入 |
| 📤 | batch | 批处理 |
| 🔄 | loop_continue | 继续循环 |
| 📥 | input | 输入 |
| 💬 | comment | 注释 |
| 🔗 | variable_merge | 变量聚合 |
| 🔍 | json_parse | JSON解析 |
| 🗑️ | clear_conversation | 清空会话 |
| 💬 | create_conversation | 创建会话 |
| 📦 | variable_assign | 变量赋值 |
| 🔄 | db_update | 更新数据 |
| 🔍 | db_select | 查询数据 |
| 🗑️ | db_delete | 删除数据 |
| 🌐 | http | HTTP请求 |
| ➕ | db_insert | 新增数据 |
| ✏️ | update_conversation | 修改会话 |
| 🗑️ | delete_conversation | 删除会话 |
| 📋 | list_conversation | 会话列表 |
| 📜 | get_conversation_history | 会话历史 |
| 💬 | create_message | 创建消息 |
| ✏️ | update_message | 修改消息 |
| 🗑️ | delete_message | 删除消息 |
| 📦 | json_serialize | JSON序列化 |
| 📤 | json_deserialize | JSON反序列化 |
| 🗑️ | knowledge_delete | 知识库删除 |
| 🎵 | video_extract_audio | 提取音频 |
| 🖼️ | video_extract_frame | 视频抽帧 |
| 🎬 | video_generation | 视频生成 |
| 🧠 | memory_write | 记忆写入 |
| 📖 | memory_read | 记忆检索 |
| ⏳ | async_task | 异步任务 |

> 共 **50** 种节点类型

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器启动后访问 `http://localhost:8080`

### 构建单文件版本

```bash
npm run build
```

构建后会生成三个独立 HTML 文件（位于 `dist/` 目录）：

- `workflow_converter.html` - 转换器单文件版本
- `workflow_editor.html` - 编辑器单文件版本
- `workflow_manager.html` - 工作流管理单文件版本

## 📁 项目结构

```text
workflow/
├── src/
│   ├── assets/            # 静态资源（favicon.svg）
│   ├── components/        # 组件处理模块（节点处理器、输入输出映射）
│   ├── config/            # 配置文件（constants.js）
│   ├── i18n/              # 国际化支持（中英文语言包）
│   ├── modules/           # 核心功能模块
│   │   ├── app.js                     # 应用入口
│   │   ├── converter.js               # YAML → Coze 转换核心
│   │   ├── converter-renderer.js      # 渲染器（虚拟滚动、语法高亮）
│   │   ├── converter-reverse.js       # Coze → YAML 反向转换
│   │   ├── converter-ui.js            # UI 控制器（输出渲染、历史、文件操作）
│   │   ├── converter-virtual-scroll.js # 虚拟滚动优化
│   │   ├── converter-highlighter.js   # 语法高亮（主线程）
│   │   ├── converter-highlighter-worker.js # 语法高亮（Worker）
│   │   ├── converter-keyboard.js      # 转换器键盘快捷键
│   │   ├── converter-history.js       # 转换历史管理
│   │   ├── converter-stats.js         # 统计视图
│   │   ├── converter-stats-renderer.js # 统计渲染器
│   │   ├── editor-core.js             # 工作流核心（节点/边CRUD、验证）
│   │   ├── editor-storage.js          # 工作流本地存储
│   │   ├── editor-ui.js               # 编辑器 UI 总控
│   │   ├── editor-messages.js         # 消息提示
│   │   ├── editor-search.js           # 搜索功能
│   │   ├── editor-autosave.js         # 自动保存
│   │   ├── editor-share.js            # 分享功能
│   │   ├── editor-canvas.js           # 画布坐标与变换
│   │   ├── editor-node.js             # 节点入口（mixin组装）
│   │   ├── editor-node-types.js       # 节点类型定义（50+种）
│   │   ├── editor-node-render.js      # 节点渲染（DOM创建、拖拽、批量测量）
│   │   ├── editor-node-drag.js        # 节点拖拽交互
│   │   ├── editor-container-render.js # 容器节点渲染（循环/批处理）
│   │   ├── editor-node-panel.js       # 节点属性面板（含条件表达式编辑器）
│   │   ├── editor-param-editor.js     # 参数编辑器
│   │   ├── editor-node-selector.js    # 变量选择器
│   │   ├── editor-edge.js             # 边渲染与交互
│   │   ├── editor-clipboard.js        # 剪贴板（复制）
│   │   ├── editor-clipboard-paste.js  # 剪贴板（粘贴）
│   │   ├── editor-history.js          # 历史步骤面板
│   │   ├── editor-keyboard.js         # 编辑器键盘快捷键
│   │   ├── editor-selection.js        # 多选与框选
│   │   ├── editor-align.js            # 节点对齐
│   │   ├── editor-layout.js           # 布局管理
│   │   ├── manager.js                 # 工作流管理页面
│   │   ├── manager-templates.js       # 管理页 HTML 模板
│   │   ├── shared-dialog.js           # 模态对话框组件
│   │   ├── shared-navigator.js        # 页面导航管理
│   │   ├── shared-graph.js            # 图形可视化视图
│   │   ├── shared-theme.js            # 主题控制器
│   │   ├── shared-i18n.js             # 国际化控制器
│   │   ├── shared-serializer.js       # 工作流序列化/反序列化
│   │   └── shared-node-detail.js      # 节点详情模态框
│   ├── scripts/           # 构建与服务器脚本
│   │   ├── server.js      # 开发 HTTP 服务器
│   │   ├── build.js       # 单文件构建脚本
│   │   └── batch-convert.mjs  # 批量转换脚本
│   ├── styles/            # 样式文件
│   │   ├── style.css      # 通用样式
│   │   ├── workflow-editor.css # 编辑器样式
│   │   └── workflow-manager.css # 管理页样式
│   ├── utils/             # 工具函数
│   │   ├── types.js       # 类型定义与映射
│   │   ├── utils.js       # 转换通用工具
│   │   ├── helpers.js     # DOM/存储/字符串工具
│   │   ├── logger.js      # 日志模块
│   │   └── refCache.js    # 引用缓存
│   └── views/             # HTML 视图
│       ├── workflow-manager.html   # 工作流管理页面
│       ├── workflow-converter.html # 转换器页面
│       └── workflow-editor.html    # 编辑器页面
├── dist/                  # 构建产物（三个独立 HTML 文件）
├── package.json
├── PROJECT_DOC.md         # 详细项目文档
└── README.md
```

## 🔧 核心模块说明

模块按功能分为四个类别：**转换器**（converter）、**编辑器**（editor）、**管理器**（manager）、**共享**（shared）。

### 转换器 (converter)

| 模块                              | 行数 | 说明                                                         |
| --------------------------------- | :--: | ------------------------------------------------------------ |
| `converter.js`                    | 228  | YAML → Coze 格式转换器（核心转换逻辑）                       |
| `converter-renderer.js`           | 156  | 转换器渲染器（虚拟滚动、语法高亮、异步渲染）                 |
| `converter-reverse.js`            | 253  | Coze → YAML 反向转换器                                       |
| `converter-ui.js`                 | 451  | 转换器 UI 控制器（输出渲染、历史、文件操作）                  |
| `converter-virtual-scroll.js`     | 139  | 虚拟滚动优化（大文本量性能）                                 |
| `converter-highlighter.js`        | 67   | 语法高亮（YAML/JSON 主线程处理）                             |
| `converter-highlighter-worker.js` | -    | 语法高亮（Web Worker 异步处理）                              |
| `converter-keyboard.js`           | 57   | 键盘快捷键管理（转换器页面）                                 |
| `converter-history.js`            | 173  | 转换历史记录管理器（localStorage 存储）                      |
| `converter-stats.js`              | 639  | 统计视图与历史面板（节点数量/类型分布、编辑/删除/确认弹窗）   |
| `converter-stats-renderer.js`     | 143  | 统计渲染器（统计数据的 DOM 渲染）                            |

### 编辑器 (editor)

| 模块                            | 行数 | 说明                                                         |
| ------------------------------- | :--: | ------------------------------------------------------------ |
| `editor-core.js`                | 471  | 工作流核心（节点/边CRUD、历史记录、验证、批量操作）          |
| `editor-storage.js`             | 97   | 工作流本地存储（localStorage 读写）                          |
| `editor-ui.js`                  | 604  | 编辑器 UI 总控（批量测量、画布、节点、边、键盘快捷键）       |
| `editor-canvas.js`              | 881  | 画布管理（无限画布、缩放、平移、视口剔除、坐标转换）         |
| `editor-node.js`                | 19   | 节点入口（mixin 组装 render/panel/selector）                 |
| `editor-node-types.js`          | 399  | 节点类型定义与映射（50种节点、动态分支配置）                 |
| `editor-node-render.js`         | 724  | 节点渲染（DOM创建、拖拽、选择、删除、批量测量）              |
| `editor-node-drag.js`           | -    | 节点拖拽交互（移动、吸附）                                   |
| `editor-container-render.js`    | 216  | 容器节点渲染（循环/批处理容器）                              |
| `editor-node-panel.js`          | 635  | 节点属性面板（参数编辑、条件表达式结构化编辑器）              |
| `editor-param-editor.js`        | 319  | 参数编辑器（输入输出参数、合并组变量）                       |
| `editor-node-selector.js`       | 346  | 变量选择器（输入参数引用、变量弹窗、合并变量管理）            |
| `editor-edge.js`                | 425  | 边 UI 组件（贝塞尔曲线渲染、选中高亮、虚边拖拽连接）          |
| `editor-clipboard.js`           | 631  | 剪贴板复制（Coze 格式复制、多节点+连线关系保留）             |
| `editor-clipboard-paste.js`     | 512  | 剪贴板粘贴（Coze/简单/多节点三种格式、分支名提取）            |
| `editor-history.js`             | 69   | 历史步骤面板（可视化撤销/重做导航）                          |
| `editor-keyboard.js`            | 94+  | 编辑器键盘快捷键（Ctrl+C/V/Z/Y/A/S/Delete/Esc/F/L，自定义配置） |
| `editor-search.js`              | 152  | 搜索功能（节点搜索、跳转）                                   |
| `editor-messages.js`            | 79   | 消息提示（success/error/warning）                            |
| `editor-selection.js`           | 213  | 多选与框选（Shift多选、框选兜底）                            |
| `editor-align.js`               | 234  | 节点对齐（多节点自动对齐布局）                               |
| `editor-layout.js`              | -    | 布局管理（对齐、分布）                                       |
| `editor-autosave.js`            | 81   | 自动保存（定时保存到 localStorage）                          |
| `editor-share.js`               | 74   | 分享功能（生成分享链接）                                     |

### 管理器 (manager)

| 模块                   | 行数 | 说明                                       |
| ---------------------- | :--: | ------------------------------------------ |
| `manager.js`           | 613  | 工作流管理页面（列表、创建、编辑、导入导出） |
| `manager-templates.js` | 118  | 管理页 HTML 模板（节点详情、编辑器弹窗等）   |

### 共享 (shared)

| 模块                     | 行数 | 说明                                                 |
| ------------------------ | :--: | ---------------------------------------------------- |
| `shared-dialog.js`       | 387  | 模态对话框组件（alert/confirm/success/error）        |
| `shared-navigator.js`    | 141  | 页面导航管理（三页面间带淡入淡出动效的跳转）         |
| `shared-graph.js`        | 407  | 图形可视化视图（SVG 渲染工作流拓扑）                 |
| `shared-theme.js`        | 134  | 主题控制器（深色/浅色自动切换）                      |
| `shared-i18n.js`         | 197  | 国际化控制器（中英文切换）                           |
| `shared-serializer.js`   | 386  | 工作流序列化/反序列化（导入导出）                    |
| `shared-node-detail.js`  | 275  | 节点详情模态框（JSON/YAML 复制、编辑器跳转）        |

### 入口

| 模块      | 行数 | 说明                                    |
| --------- | :--: | --------------------------------------- |
| `app.js`  | 28   | 应用入口（初始化 theme/i18n/页面路由）  |

## 📖 使用方法

### 开发模式

启动开发服务器后，可以访问以下页面：

- `/` - 工作流管理页面
- `/converter` - 工作流转换器
- `/editor` - 工作流编辑器

### 单文件模式

构建完成后，直接双击 `dist/` 目录下的 HTML 文件即可运行，无需依赖服务器。

- `dist/workflow_converter.html` - 工作流转换器
- `dist/workflow_editor.html` - 工作流编辑器
- `dist/workflow_manager.html` - 工作流管理器

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！