# Coze 工作流编辑器

一个基于原生 JavaScript 实现的工作流编辑器与转换器，支持将 YAML 格式工作流导入到 Coze 平台。

## ✨ 功能特性

- **工作流编辑器**: 可视化拖拽编辑工作流节点
- **YAML 转换器**: 将 YAML 格式工作流转换为 Coze 剪贴板数据
- **历史记录**: 支持撤销/重做操作（最多50步）
- **键盘快捷键**: 支持常用操作的快捷键
- **单文件构建**: 支持打包为独立 HTML 文件，便于分发
- **局域网访问**: 支持其他设备通过局域网访问开发服务器
- **平滑导航**: 页面切换带淡入淡出动画效果
- **虚拟滚动**: 大数据量文本编辑性能优化
- **主题切换**: 支持明暗主题
- **代码优化**: 统一工具函数，消除重复代码

## 📦 支持的节点类型

| 图标 | 类型 | 说明 |
|------|------|------|
| 🚀 | start | 开始节点 |
| 🏁 | end | 结束节点 |
| 🤖 | llm | 大模型调用 |
| 🔌 | plugin | 插件调用 |
| 💻 | code | 代码执行 |
| 🔀 | condition | 条件分支 |
| 🌐 | http | HTTP 请求 |
| 📝 | text | 文本处理 |
| 🎨 | image_generate | 图片生成 |
| 📚 | knowledge | 知识库 |
| ❓ | question | 问答节点 |
| 🔄 | loop | 循环节点 |
| ⏳ | async_task | 异步任务 |

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

构建后会生成两个独立 HTML 文件：
- `coze_converter_standalone.html` - 转换器单文件版本
- `workflow_editor_standalone.html` - 编辑器单文件版本

## 📁 项目结构

```
workflow/
├── src/
│   ├── components/        # 组件处理模块
│   ├── config/            # 配置文件
│   ├── example/           # 示例工作流
│   ├── modules/           # 核心功能模块
│   ├── scripts/           # 构建与服务器脚本
│   ├── styles/            # 样式文件
│   ├── utils/             # 工具函数
│   └── views/             # HTML 视图
├── package.json
└── README.md
```

## 🔧 核心模块说明

| 模块 | 说明 |
|------|------|
| `workflow-core.js` | 工作流核心逻辑（节点管理、边管理、历史记录） |
| `workflow-ui.js` | 工作流编辑器 UI 交互 |
| `converter.js` | YAML 格式转换器 |
| `app.js` | 应用入口 |

## 📖 使用方法

### 开发模式

启动开发服务器后，可以访问以下页面：

- `/` - 工作流管理页面
- `/converter` - 工作流转换器
- `/editor` - 工作流编辑器

### 单文件模式

构建完成后，直接双击 `coze_converter_standalone.html` 即可运行，无需依赖服务器。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！