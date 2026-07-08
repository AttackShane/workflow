# Changelog

## v1.4.4 - 2026-07-08

### Bug 修复

- **workflow-align.js distribute 方法重复保存历史**：`distribute` 每次调用都会触发历史保存，修复为仅在操作完成时保存一次
- **框选/拖拽时按 Escape 事件监听器泄漏**：`_onKeyDown` 绑定后未在操作取消时移除，修复为在 Escape 处理中清理监听器
- **_pendingContainers/_ctrlDetached 清理不完整**：容器子节点状态数组在操作完成后未完全清理，添加完整的清理逻辑
- **hasDraggedCanvas 标志位残留**：拖拽画布后标志位未重置，导致后续操作行为异常，修复为在操作完成后重置
- **loadSavedWorkflow 缺少数组类型校验**：加载工作流时未校验 `nodes` 和 `edges` 是否为数组，添加类型检查防止崩溃
- **Ctrl+F 触发浏览器查询事件**：`matchShortcut` 方法对字母键大小写敏感，`e.key` 返回小写 `'f'` 而配置为大写 `'F'`，改为大小写不敏感比较
- **管理页面拖动工作流无效**：`draggable="true"` 设在卡片上但拖拽手柄是子元素，浏览器无法触发父元素 dragstart，修复为将 draggable 移至手柄
- **多选时点击工作流跳转页面**：批量模式下点击复选框或工作流卡片仍触发跳转，修复为在 click 处理器中排除复选框并检查批量模式
- **GET /utils/storage.js 404 错误**：`workflow-keyboard.js` 错误导入 `../utils/storage.js`（不存在），修复为使用 `../utils/helpers.js` 中的 `Storage` 并合并重复的 `DOM` 导入

### Feature 实现

- **网格吸附 (Snap to Grid)**：实现画布背景网格渲染与节点坐标吸附算法，支持自定义网格大小
- **工作流复制 (Duplicate)**：实现工作流深拷贝功能，自动重生成所有节点 ID 和连线 ID
- **画布搜索定位节点**：实现节点搜索功能，支持按名称/类型过滤，搜索结果可点击定位到画布对应位置
- **小地图 (Minimap)**：实现节点缩略图渲染、视口指示器、交互式导航（点击/拖拽移动视口）
- **批量删除工作流**：管理页面支持多选批量删除，包含全选/取消全选、确认对话框
- **节点锁定**：支持锁定/解锁节点，锁定后禁止拖拽和删除，UI 显示锁定状态图标
- **自定义快捷键配置**：实现快捷键配置系统，支持 Storage 持久化存储、解析匹配、模态配置界面
- **导出 SVG 格式**：实现工作流导出为 SVG 文件，包含节点/连线渲染、坐标计算、样式转换
- **工作流版本对比**：实现版本快照存储、差异对比、历史版本管理
- **节点批量参数修改**：支持选择多个节点，提取公共参数，批量更新
- **拖拽排序工作流列表**：管理页面支持拖拽排序工作流，使用 HTML5 Drag & Drop API
- **自动保存时间提示**：实现自动保存机制，定时存储工作流，状态栏显示保存状态指示
- **触摸设备支持**：实现触摸事件处理（单指拖拽、双指缩放），支持移动设备操作
- **编辑器工具栏优化**：解决工具栏拥挤问题，将低频操作整合为下拉菜单，使用事件委托管理状态
- **快捷键大小写不敏感处理**：`matchShortcut` 方法对所有单字符键进行大小写不敏感比较，支持 Ctrl+Meta 键互换

### 国际化完善

- **zh-CN.js**：补充缺失的翻译键，包括 `manager.dragHandle`、`shortcutLabels.*`、`version.*`、`batch.*` 等
- **en-US.js**：同步中文翻译键，确保双语一致性
- **UI 文本更新**：将编辑器下拉菜单、自动保存提示等硬编码文本替换为国际化动态文本

### 测试修复

- **keyboard.test.js**：添加 `localStorage` 模拟、修复 `createMockEvent` 缺少 `altKey` 默认值、修复 `Cmd+Shift+Z` 测试用例的快捷键配置、修复 `matchShortcut` 的 Ctrl/Meta 键互换逻辑

## v1.4.3 - 2026-07-03

### 问答/选择器节点输出连接点缩放后布局修复

- **根因**：`batchMeasureElements` 使用 `getBoundingClientRect()` 测量节点尺寸，该方法返回视觉坐标（含 CSS transform 缩放），导致 `nodeData.height` 被放大。后续 `_applyMeasurement` 基于错误的 `height` 计算分支端口 `top` 位置，`centerView()` 重置缩放后布局异常
- **修复**：`getBoundingClientRect()` 返回值除以 `canvasScale`，确保分支端口始终基于节点真实 CSS 像素高度计算

### 连接点过渡动画优化

- **根因**：`.connection-point` 的 `transition: all 0.2s` 导致 `_applyMeasurement` 更新分支端口 `top` 值时产生回弹动画
- **修复**：`transition` 从 `all` 改为仅对 `transform`、`border-color`、`background` 过渡，排除 `top` 属性

### 容器内子节点连线可选中

- **根因**：`canvas-content`（z-index: 20）在 `svg-hit-layer`（z-index: 15）上层，`.canvas-node.container` 的 `pointer-events: auto` 拦截了容器内部连线点击，事件无法到达 hit layer
- **修复**：`.canvas-node.container` 设置 `pointer-events: none`，`.node-header` 显式恢复 `pointer-events: auto`；子节点和连接点自身已有 `pointer-events: auto`，不受影响

### 容器内框选修复

- **根因**：`pointer-events: none` 后 `e.target.closest('.container-body')` 失效，容器内框选退化为普通框选，错误选中容器本身
- **修复**：`onCanvasMouseDown` 新增坐标检测：遍历容器元素，用 `getBoundingClientRect()` 判断点击是否落在容器 body 区域，命中则按容器内框选处理

### 多选系统键位统一

- **边点击**：`ctrlKey/metaKey` 改为 `shiftKey`，与整个多选系统保持一致
- **移除冗余**：`isMultiSelectMode` 判断已由 `select()` 方法内部处理，点击处无需重复判断

## v1.4.2 - 2026-06-30

### loop_set_variable 节点完整修复

- **粘贴/加载参数丢失**：`loop_set_variable` 节点粘贴后 `variables` 参数消失，修复 Coze 使用 `left/right` 格式与编辑器通用 `name/input` 格式的转换问题
- **导出格式错误**：复制时 `inputs` 里同时出现 `inputParameters`（通用格式）和 `variables` 字段，添加专属处理分支，确保导出为 `left/right` 格式
- **引用 blockID 未重映射**：粘贴/加载时 `left.value.content.blockID` 和 `right.value.content.blockID` 未更新，导致引用指向错误节点
- **属性面板可视化编辑器**：将 `variables` 参数从 JSON 文本框升级为可视化编辑器，支持添加/删除变量、点击选择引用（左值/右值）、字面量直接输入
- **默认值修复**：`variables` 参数 `defaultValue` 从 `'{}'` 改为 `'[]'`

### this 绑定修复

- **属性面板事件处理**：`document.addEventListener('click', node._handleAction)` 缺少 `.bind(node)`，导致 `this` 指向 `document`，所有 `this.addInputParam` 等方法报 `is not a function`
- **节点搜索功能**：递归调用 `checkNode(child)` 未绑定 `this`，导致 `this.core` 为 `undefined`，搜索功能完全不可用
- **全局扫描**：确认所有其他事件监听器和 forEach 回调均使用箭头函数或已绑定，无遗漏

### 容器节点样式隔离

- 修复容器（loop/batch）内子节点样式被覆盖的问题，CSS 选择器从后代选择器（空格）改为子选择器（`>`），容器样式不再泄漏到内部节点

### 国际化翻译修复

- 修复 `nodes.variables`、`nodes.leftVariable`、`nodes.rightValue` 翻译键显示原始 key 文本的问题，翻译键从根级别移动到 `nodes` 对象内

### 文档

- 新增 `AGENTS.md` - AI 会话上下文注入文件，包含项目架构、编码规范、常见陷阱
- 新增 `CLAUDE.md` - AI 会话上下文注入文件，包含数据结构、修复记录、后续指南
- 更新 `CHANGELOG.md`、`README.md`、`PROJECT_DOC.md` 同步最新改动

## v1.4.1 - 2026-06-30

### 条件节点动态分支
- 条件节点从固定 2 分支改为动态 N 分支（支持 12+ 分支）
- 每个分支包含 `name` + `condition` 表达式
- 粘贴时从 Coze 分支的 `condition.conditions[0].right.input.value.content` 提取分支名

### 条件表达式编辑器
- 属性面板新增结构化条件编辑表单（替代 JSON textarea）
- 支持 左值 + 操作符 + 右值，AND/OR 连接
- 引用格式 `{{blockID.name}}`，普通文本为字面量
- 保存时自动转回 Coze 结构化 `{input: {type, value: {type, content}}}` 格式

### 性能优化
- 节点批量测量：N 个节点仅 1 次 forced reflow（原为 N 次），消除 143ms 性能警告
- `createElement` 新增 `skipMeasure` 选项，`batchMeasureElements` 方法统一测量
- 移除 `updateContainerSize` 中冗余的 `getBoundingClientRect()` 调用

### CI/CD 修复
- 修复 `package-lock.json` 被 gitignore 导致 CI 找不到锁文件的问题
- CI 矩阵从 `[20.x, 22.x]` 更新为 `[22.x, 24.x]`（Node.js 20 已弃用）

### 文档
- 更新 README.md 项目结构、模块行数、功能特性
- 更新 PROJECT_DOC.md 测试数据引用

## v1.4.0 - 2026-06-25

### 架构重构 - 模块化拆分

#### 转换器模块拆分
- `converter.js` 拆分出 `converter-renderer.js` - 语法高亮渲染、虚拟滚动、异步渲染
- `history-manager.js` → 重命名为 `converter-history.js`
- `keyboard-shortcuts.js` → 重命名为 `converter-keyboard.js`

#### 编辑器模块拆分
- `workflow-node.js` 拆分出以下子模块:
  - `workflow-container-render.js` - 容器节点（loop/batch）子节点管理与自动布局
  - `workflow-node-detail-modal.js` - 节点详情模态框（JSON/YAML 复制、编辑器跳转）
  - `workflow-node-types.js` - 节点类型定义（20+ 种节点类型配置）
  - `workflow-param-editor.js` - 参数编辑器（输入输出参数、合并组变量编辑）
- 移除 `workflow-canvas-optimized.js`（功能合并到 canvas 模块）

### 工程化建设

#### 代码质量
- 新增 `.eslintrc.json` ESLint 配置
- 新增 `eslint` 依赖（^8.57.1）
- 新增 `husky` 依赖（^9.1.7）+ `.husky/pre-commit` Git hooks
- 配置 `lint-staged` 自动修复 + 关联测试

#### CI/CD
- 新增 `.github/workflows/ci.yml` - GitHub Actions 自动运行 ESLint + Jest

### 测试
- 新增 `tests/canvas.test.js` - 画布模块测试
- 新增 `tests/edge.test.js` - 连线模块测试
- 新增 `tests/keyboard.test.js` - 键盘快捷键测试

### 文档
- 更新 `PROJECT_DOC.md` - 精简项目结构文档，移除冗余文件树
- 更新 `README.md` - 修正文件引用（history-manager → converter-history, keyboard-shortcuts → converter-keyboard）

### 修改文件
- `package.json` - 新增 eslint、husky 依赖
- `src/modules/converter.js` - 拆分渲染逻辑
- `src/modules/workflow-node.js` - 拆分节点模块
- `src/modules/ui-controller.js` - 适配模块拆分
- 其他 30+ 文件 - 适配模块重命名和导入路径调整

---

## v1.3.0 - 2026-06-25

### 功能修复

#### 剪贴板导入/导出
- 修复剪贴板粘贴时参数引用嵌套处理问题，支持 `note` 字段的 Slate 富文本提取
- 修复 `llmParam` 参数解析兼容对象和数组两种格式
- 优化剪贴板导入逻辑，增加参数类型安全校验，防止异常数据导致崩溃
- 增强剪贴板导出数据完整性，确保所有节点参数正确序列化

#### 参数引用与保存
- 修复参数引用嵌套保存后丢失问题，改进 JSON 序列化逻辑
- 修复参数删除后引用未清理导致的残留问题
- 修复 ID 计数器在多次操作后可能重复的问题

#### 保存逻辑
- 修复保存时属性面板数据与节点数据不同步问题
- 优化存储模块的保存时机判断

#### 示例文件清理
- 清理 `src/example/` 目录下不再使用的示例工作流文件

### 测试
- 新增剪贴板模块测试用例（+241 行），覆盖粘贴、导出、参数解析等场景

### 修改文件
- `workflow-clipboard-paste.js` - 重构粘贴逻辑，增强参数解析
- `workflow-clipboard.js` - 优化导出逻辑
- `workflow-core.js` - 修复 ID 计数器
- `workflow-serializer.js` - 改进序列化逻辑
- `workflow-storage.js` - 修复保存逻辑
- `workflow-manager.js` - 同步属性面板与节点数据
- `workflow-node-render.js` - 修复参数引用渲染
- `workflow-canvas.js` / `workflow-keyboard.js` / `workflow-ui.js` - 细节修复
- `tests/clipboard.test.js` - 新增测试

---

## v1.2.0 - 2026-06-17

### 新增功能
- **问答节点分支可视化**：每个选项生成独立输出端口，垂直均匀分布
- **连线分支标签**：每条边起点显示对应选项名称，一目了然
- **鼠标悬浮提示**：连接点显示选项名称提示

### 功能修复

#### 数据一致性
- 修复"不修改直接保存破坏节点数据"问题 → 属性面板与节点数据双向同步
- 修复"输入参数引用保存后丢失"问题 → 修正 JSON 序列化，移除错误的 HTML 转义
- 修复"粘贴节点后引用指向错误 output"问题 → `blockID` 映射路径修正为 `content.blockID`

#### 多选交互逻辑
- 修复"按住 Ctrl 选中单个节点属性面板仍显示全部节点"问题 → 选中数量为 1 时正确显示单个属性面板
- 修复"松开 Ctrl 点击新节点仍保持增选"问题 → 松开 Ctrl 自动切换单选模式
- 修复"多选后单击边未取消节点选中"问题 → 单击边无条件清空节点选中
- 修复"多选后拖动选中节点被取消选中"问题 → 点击已选中节点保持多选状态
- 修复"Ctrl+框选不能累计选中"问题 → 支持 Ctrl+多次框选累加选中

### 架构改进
- 支持 `sourcePort` 端口信息存储在边数据中
- 兼容 Coze 格式剪贴板导入的 `sourcePortID`
- 引用数据结构保持 `{ type: 'ref', content: { blockID, name } }` 一致
- 所有模块职责清晰，模块化拆分完成

### 节点类型支持（共 30+ 种）
- start / end
- llm / image_generate / video_generation / knowledge
- condition / loop / break / question / intent
- text / code / comment / json_parse
- http / webhook / database / email
- input / output / variable_assign / variable_merge / batch
- delay / async_task / plugin

---

## v1.1.0 - 之前版本

- 支持 Coze 工作流剪贴板导入/导出
- 支持动态输入输出参数配置
- 支持变量引用选择器
- 支持节点对齐与分布
- 支持历史撤销/重做
- 支持自动保存
- 支持国际化（中文/英文）
- 支持暗色主题