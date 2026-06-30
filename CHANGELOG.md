# Changelog

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