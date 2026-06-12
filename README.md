# Coze 工作流编辑器

一个基于原生 JavaScript ES Module 实现的工作流编辑器与转换器系统，支持三页面（工作流管理、YAML转换器、可视化编辑器），可在 YAML/JSON 工作流定义与 Coze 剪贴板格式之间双向转换。

## ✨ 功能特性

- **工作流编辑器**: 可视化拖拽编辑工作流节点，支持无限画布缩放和平移
- **YAML 转换器**: 将 YAML 格式工作流转换为 Coze 剪贴板数据，支持虚拟滚动和语法高亮
- **反向转换**: 支持将 Coze 格式转换回 YAML 格式（Coze → YAML）
- **工作流管理**: 工作流列表的创建、编辑、导入、导出管理
- **历史记录**: 编辑器支持撤销/重做操作（最多50步历史）
- **多选编辑**: 支持多节点选中、拖拽、复制粘贴（含连线关系）
- **键盘快捷键**: 支持 Ctrl+C/V/Z/Y/A/S/Delete/Esc 等常用操作
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
- **剪贴板集成**: 编辑器内复制节点直接生成 Coze 剪贴板格式数据

## 📦 支持的节点类型

| 图标 | 类型           | 说明       |
| ---- | -------------- | ---------- |
| 🚀   | start          | 开始节点   |
| 🏁   | end            | 结束节点   |
| 🤖   | llm            | 大模型调用 |
| 🔌   | plugin         | 插件调用   |
| 💻   | code           | 代码执行   |
| 🔀   | condition      | 条件分支   |
| 🌐   | http           | HTTP 请求  |
| 📝   | text           | 文本处理   |
| 🎨   | image_generate | 图片生成   |
| 📚   | knowledge      | 知识库     |
| ❓   | question       | 问答节点   |
| 🔄   | loop           | 循环节点   |
| ⏳   | async_task     | 异步任务   |

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
│   ├── example/           # 示例工作流（13个测试用例）
│   ├── i18n/              # 国际化支持（中英文语言包）
│   ├── modules/           # 核心功能模块
│   │   ├── dialog.js      # 模态对话框组件
│   │   ├── navigator.js   # 页面导航管理
│   │   ├── converter.js   # YAML → Coze 转换
│   │   ├── reverse.js     # Coze → YAML 反向转换
│   │   ├── workflow-core.js # 工作流核心数据管理
│   │   ├── workflow-ui.js  # 编辑器 UI 总控
│   │   ├── workflow-canvas.js # 画布坐标与变换
│   │   ├── workflow-node.js  # 节点交互逻辑
│   │   ├── workflow-edge.js  # 边渲染与交互
│   │   └── ...
│   ├── scripts/           # 构建与服务器脚本
│   │   ├── server.js      # 开发 HTTP 服务器
│   │   └── build.js       # 单文件构建脚本
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

| 模块                    | 说明                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `workflow-core.js`      | 工作流核心数据管理（节点/边CRUD、历史记录、验证、导入导出） |
| `workflow-ui.js`        | 工作流编辑器 UI 总控（整合画布、节点、边、键盘快捷键）      |
| `workflow-canvas.js`    | 画布管理（无限画布、缩放、平移、屏幕/画布坐标转换）         |
| `workflow-node.js`      | 节点 UI 组件（拖拽、多选、属性面板、连接点事件）            |
| `workflow-edge.js`      | 边 UI 组件（贝塞尔曲线渲染、选中高亮、虚边拖拽连接）        |
| `workflow-clipboard.js` | 编辑器剪贴板（Coze 格式复制/粘贴、多节点+连线关系保留）     |
| `workflow-history.js`   | 历史步骤面板（可视化撤销/重做导航）                         |
| `converter.js`          | YAML → Coze 格式转换器（核心转换逻辑）                      |
| `reverse.js`            | Coze → YAML 反向转换器                                      |
| `dialog.js`             | 模态对话框组件（alert/confirm/success/error）               |
| `navigator.js`          | 页面导航管理（三页面间带淡入淡出动效的跳转）                |
| `graph-view.js`         | 图形可视化视图（SVG 渲染工作流拓扑）                        |
| `stats-view.js`         | 统计视图（节点数量/类型分布）                               |
| `theme-controller.js`   | 主题控制器（深色/浅色自动切换）                             |
| `i18n-controller.js`    | 国际化控制器（中英文切换）                                  |
| `keyboard-shortcuts.js` | 键盘快捷键管理                                              |
| `virtual-scroll.js`     | 虚拟滚动优化（大文本量性能）                                |
| `highlighter.js`        | 语法高亮（YAML/JSON Web Worker 异步处理）                   |
| `app.js`                | 应用入口（初始化 theme/i18n/页面路由）                      |
| `build.js`              | 单文件构建脚本（ESM→单 HTML 打包，兼容 file:// 协议）       |

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
