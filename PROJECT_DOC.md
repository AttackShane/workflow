# 工作流转换器项目文档

## 项目概述

本项目是一个工作流转换器，主要用于将自定义 YAML 格式的工作流数据转换为 Coze 平台可识别的剪贴板格式（JSON）。项目包含三个核心页面：工作流管理、转换器和编辑器。

> 项目结构、快速开始等信息请参见 [README.md](./README.md)。

## 已实现功能清单

### 一、核心功能

#### 1. 转换器功能（`modules/converter.js`）

- **入口**: `convertYamlToClipboard(yaml)`
- **功能**: 将 YAML 格式工作流转换为 Coze 剪贴板格式 JSON
- **关键步骤**:
  1. 构建输出映射表（`buildOutputMap`）
  2. 遍历节点调用 `convertNode()` 转换
  3. 转换连线（`convertEdges`）
  4. 计算边界（`calculateBounds`）
- **支持节点类型**: start、end、llm、code、image_generate、video_generation、condition、variable_merge、plugin、loop、batch、intent、async_task、http、comment、text、output、input、question（共19种）

#### 2. 反向转换器（`modules/reverse.js`）

- **入口**: `convertClipboardToYaml(clipboardData)`
- **功能**: 将 Coze 剪贴板格式 JSON 转换回 YAML 格式
- **关键步骤**:
  1. 解析 Coze 剪贴板格式
  2. 遍历节点调用 `convertNodeFromCoze()` 反向转换
  3. 转换连线格式
  4. 生成 YAML 字符串
- **特性**: 保持节点类型、参数、连线关系的完整转换

#### 3. 编辑器剪贴板（`modules/workflow-clipboard.js` + `workflow-clipboard-paste.js`）

- **功能**: 支持多选节点复制，保留连线关系
- **核心方法**: `copy()` - 将选中节点转换为 Coze 剪贴板格式
- **粘贴支持**: 支持 `coze-workflow-clipboard-data` 格式、简单节点格式、多节点格式
- **ID映射**: 粘贴时自动重新映射节点ID和引用关系
- **容错处理**: 剪贴板读取失败时使用内部缓存

#### 4. 国际化支持（`i18n/`）

- **核心模块**: `i18n.js` - 国际化核心模块
- **语言包**:
  - `zh-CN.js` - 中文语言包
  - `en-US.js` - 英文语言包
- **特性**:
  - 自动检测浏览器语言
  - 支持运行时语言切换
  - 所有界面文本可配置
  - 不影响数据处理逻辑

#### 5. 节点详情复制（`modules/graph-view.js`）

- **位置**: `convertToClipboardFormat()` 函数
- **功能**: 点击节点后复制单个节点的 JSON 到剪贴板
- **支持格式**: JSON、YAML、原始节点三种格式
- **打开编辑器**: 支持一键打开工作流编辑器

#### 6. 工作流核心（`modules/workflow-core.js` + `workflow-storage.js` + `workflow-serializer.js`）

- **功能**: 工作流数据管理核心，拆分为三个模块
- **workflow-core.js**: 节点管理（创建、删除、更新位置/属性）、连线管理、历史记录、批量操作、工作流验证
- **workflow-storage.js**: 本地存储（自动保存到 localStorage）
- **workflow-serializer.js**: 导入/导出（支持 Coze 剪贴板格式和自定义格式）

### 二、性能优化

#### 1. 虚拟滚动（`modules/virtual-scroll.js`）

- **功能**: 大数据量文本编辑器的性能优化
- **实现原理**: 只渲染可见区域的内容
- **关键参数**:
  - `visibleCount`: 可见行数（自动计算）
  - `cacheCount`: 缓存行数（前后各5行）
  - `lineHeight`: 行高（自动读取CSS）
- **特性**:
  - 滚动事件被动监听（`passive: true`）
  - 行号同步滚动
  - 字体大小变化自适应

#### 2. 语法高亮（`modules/highlighter.js`）

- **功能**: YAML/JSON 语法高亮
- **实现**: Web Worker 异步处理，避免阻塞主线程
- **特性**: 支持代码折叠、行号显示

### 三、用户体验

#### 1. 键盘快捷键（`modules/converter-keyboard.js`）

- **支持快捷键**:
  - `Ctrl+C`: 复制选中节点
  - `Ctrl+V`: 粘贴节点
  - `Ctrl+Z`: 撤销
  - `Ctrl+Y` / `Ctrl+Shift+Z`: 重做
  - `Ctrl+A`: 全选所有节点
  - `Delete/Backspace`: 删除选中节点/边
  - `Escape`: 取消选中/取消连接
  - `Ctrl+S`: 保存到本地存储

#### 2. 主题控制器（`modules/theme-controller.js`）

- **功能**: 明暗主题切换
- **特性**:
  - 自动检测系统主题偏好
  - 主题状态持久化到 localStorage
  - CSS 变量驱动的主题系统

#### 3. 图形可视化（`modules/graph-view.js`）

- **功能**: 工作流可视化预览
- **特性**:
  - SVG 绑定渲染
  - 拖拽平移查看
  - 节点点击查看详情
  - 节点颜色按类型区分
  - 连接线带箭头指示

#### 4. 统计视图（`modules/stats-view.js`）

- **功能**: 工作流统计信息展示
- **统计项**:
  - 节点总数、各类型节点数量
  - 连线数量
  - 工作流验证结果

### 四、UI 组件

#### 1. 画布管理（`modules/workflow-canvas.js`）

- **功能**: 编辑器画布管理
- **特性**:
  - 无限画布支持
  - 缩放和平移
  - 节点拖拽定位
  - 网格背景

#### 2. 对话框组件（`modules/dialog.js`）

- **功能**: 统一的模态对话框管理
- **特性**:
  - 支持 `alert()`、`confirm()`、`success()`、`error()` 四种静态方法
  - CSS 动画驱动的弹窗进出动效
  - 键盘关闭支持（Escape）
  - 自定义内容和按钮文本

#### 3. 导航模块（`modules/navigator.js`）

- **功能**: 统一页面导航管理
- **特性**:
  - 平滑页面切换动画（淡入淡出）
  - 自动处理浏览器缓存恢复（防止后退时页面空白）
  - 提供 `goToManager()`、`goToConverter()`、`goToEditor()` 方法
  - 模块加载时自动初始化事件监听器

#### 4. UI 控制器（`modules/ui-controller.js`）

- **功能**: 统一的 UI 状态管理
- **特性**:
  - 当前数据管理
  - 视图切换控制
  - 消息提示系统

### 五、工具函数

#### 1. 类型工具（`utils/types.js`）

- **功能**: 类型定义和工具函数
- **核心内容**:
  - 节点类型映射（`TYPE_MAP`、`REV_TYPE_MAP`）
  - 节点颜色映射（`NODE_COLORS`）
  - 节点高度映射（`NODE_HEIGHTS`）
  - 工具函数：`getMainColor()`、`getSubTitle()`、`getBounds()`、`toValueObject()`

#### 2. 通用工具（`utils/utils.js`）

- **功能**: 通用工具函数
- **核心内容**:
  - YAML 输入验证（`validateYamlInput`）
  - 连线转换（正向：`convertEdges`、逆向：`convertEdgesReverse`）
  - 节点类型名称获取（`getNodeTypeName`）
  - 节点颜色获取（`getNodeColor`）
  - 图标清理（`cleanIcon`）
  - 大数字转换（`convertLargeNumbersToStrings`）

#### 3. 辅助工具（`utils/helpers.js`）

- **功能**: 通用辅助工具函数集合
- **核心模块**:
  - **DOM**: DOM 操作工具（`get`、`setText`、`setHtml`、`setAttr`、`setStyle`、`on`、`off`、`create` 等）
  - **Storage**: 本地存储操作工具（`get`、`set`、`remove`、`clear`）
  - **StringUtils**: 字符串操作工具（`escapeHtml`、`truncate`、`formatTime`、`generateId`）
  - **ArrayUtils**: 数组操作工具（`find`、`filter`、`unique`、`limit`）
  - **AsyncUtils**: 异步操作工具（`delay`、`withLoading`）
  - **ClipboardUtils**: 剪贴板操作工具（`copy`、`copyWithFeedback`）
  - **Validator**: 验证工具（`isJson`、`isYaml`、`checkFileExtension`）

#### 4. 输入/输出映射器（`components/inputMapper.js`、`components/outputMapper.js`）

- **功能**: 处理节点输入输出参数的映射转换
- **特性**: 支持复杂类型的参数映射

### 六、服务器配置（`scripts/server.js`）

- **功能**: 开发服务器
- **特性**:
  - 端口：8080
  - 路由映射（支持 `/`、`/converter`、`/editor`）
  - favicon.ico 404 处理（映射到 SVG）
  - 严格缓存控制（禁用缓存便于开发）
  - 请求日志记录
  - 支持局域网访问（自动获取本地 IP）

## 核心功能流程图

```text
YAML 输入
    ↓
validateYamlInput() - 验证输入格式（检查 nodes、edges 字段）
    ↓
buildOutputMap() - 构建输出映射表（nodeId → outputs）
    ↓
convertNode() × N - 逐个转换节点
    ↓
    ├→ nodeHandlers[type] - 调用对应节点类型处理器
    ├→ processPluginNode() - 处理插件节点特殊逻辑
    ├→ cleanIcon() - 清理图标 URL 中的特殊字符
    └→ 排序 outputs（optionId → optionContent → QUESTION_DATA）
    ↓
convertEdges() - 转换连线格式（source_node → sourceNodeID）
    ↓
calculateBounds() - 计算整体边界
    ↓
Coze 剪贴板格式输出
```

## 核心模块详细说明

### 一、转换器模块（`modules/converter.js`）

#### 1. 核心函数

**convertYamlToClipboard(yaml)**

- **参数**: `yaml` - YAML 解析后的对象
- **返回**: Coze 剪贴板格式对象
- **流程**:

  ```javascript
  export function convertYamlToClipboard(yaml) {
    validateYamlInput(yaml); // 验证输入
    const outputMap = buildOutputMap(yaml.nodes); // 构建输出映射
    const newNodes = yaml.nodes.map((n) => convertNode(n, outputMap)); // 转换节点
    clearRefCache(); // 清理引用缓存
    return {
      type: "coze-workflow-clipboard-data",
      source: { workflowId, flowMode, spaceId, isDouyin, host },
      json: { nodes: newNodes, edges: convertEdges(yaml.edges || []), name },
      bounds: calculateBounds(newNodes),
    };
  }
  ```

**convertNode(node, outputMap)**

- **参数**:
  - `node` - 单个节点对象
  - `outputMap` - 输出映射表
- **返回**: 转换后的 Coze 节点对象
- **关键处理步骤**:
  1. 获取节点类型并映射到 Coze 类型号
  2. 构建 `nodeMeta` 对象（title, icon, description, mainColor, subTitle）
  3. 调用对应的 `nodeHandlers` 处理输入输出参数
  4. 处理插件节点特殊逻辑
  5. 排序 outputs 数组
  6. 计算 bounds

#### 2. 辅助函数

**cleanIcon(icon)**

- **功能**: 清理图标 URL 中的特殊字符
- **参数**: `icon` - 图标 URL 字符串
- **返回**: 清理后的字符串
- **实现**:

  ```javascript
  function cleanIcon(icon) {
    if (!icon) return "";
    return String(icon)
      .replace(/[`'"\\]/g, "")
      .trim();
  }
  ```

**calculateBounds(nodes)**

- **功能**: 计算节点集合的边界框
- **参数**: `nodes` - 节点数组
- **返回**: `{ x, y, width, height }`
- **算法**: 遍历所有节点，找出最小/最大坐标

**processPluginNode(data, nodeMeta, params, type)**

- **功能**: 处理插件节点的特殊逻辑
- **处理内容**: 从 apiParam 中提取 pluginName 和 apiName，设置 subtitle

### 二、工作流核心模块（`modules/workflow-core.js`）

#### 1. 类结构

**WorkflowCore 类**

- **属性**:
  - `nodes` - 节点数组
  - `edges` - 连线数组
  - `nodeIdCounter` - 节点ID计数器（初始值：100000）
  - `selectedNode` - 当前选中节点ID
  - `selectedEdge` - 当前选中连线ID
  - `history` - 历史记录数组（最多50条）
  - `historyIndex` - 当前历史记录索引
  - `maxHistory` - 最大历史记录数（50）

#### 2. 核心方法

**createNode(type, x, y, data)**

- **功能**: 创建新节点
- **参数**:
  - `type` - 节点类型
  - `x`, `y` - 坐标位置
  - `data` - 额外数据（可选）
- **返回**: 新创建的节点对象

**createEdge(sourceId, targetId)**

- **功能**: 创建连线
- **参数**:
  - `sourceId` - 源节点ID
  - `targetId` - 目标节点ID
- **返回**: 新创建的连线对象（如果已存在返回 null）

**undo() / redo()**

- **功能**: 撤销/重做操作
- **实现**: 使用深拷贝恢复历史状态

**validate()**

- **功能**: 验证工作流完整性
- **检查项**:
  - 必须有且仅有一个开始节点
  - 至少有一个结束节点
  - 非开始/注释节点必须有输入连接
  - 非结束/注释节点必须有输出连接
- **返回**: `{ valid: boolean, message: string, errors: array }`

**importWorkflow(workflow)**

- **功能**: 从 Coze 格式导入工作流
- **参数**: `workflow` - Coze 剪贴板格式对象
- **处理**: 转换节点ID格式，重建连线关系

**exportWorkflow()**

- **功能**: 导出工作流为自定义格式
- **返回**: 工作流对象

**loadFromClipboard(data)**

- **功能**: 从剪贴板数据导入
- **参数**: `data` - 剪贴板数据对象

#### 3. 存储方法

**saveToLocalStorage(key)**

- **功能**: 保存到本地存储
- **参数**: `key` - 存储键名（默认：'workflow_current'）
- **存储内容**: nodes, edges, nodeIdCounter, selectedNode, selectedEdge, savedAt

**loadFromLocalStorage(key)**

- **功能**: 从本地存储加载
- **参数**: `key` - 存储键名
- **返回**: 是否加载成功

### 三、剪贴板模块（`modules/workflow-clipboard.js`）

#### 1. 类结构

**WorkflowClipboard 类**

- **属性**:
  - `ui` - UI 控制器实例
  - `core` - WorkflowCore 实例
  - `copiedNode` - 缓存的复制数据

#### 2. 核心方法

**copy()**

- **功能**: 复制选中节点到剪贴板
- **流程**:
  1. 获取选中节点元素
  2. 获取节点数据
  3. 转换为 Coze 剪贴板格式
  4. 写入系统剪贴板（失败时缓存到内部）
- **LLM 节点特殊处理**: 所有参数（除 `fcParamVar`、`settingOnError` 等结构字段外）全部放入 `llmParam` 数组，与 Coze 格式完全一致。编辑器内部统一使用 `modelName`（正确拼写），输出时转为 Coze 的 `modleName`（平台拼写）以保持兼容。

**paste()**

- **功能**: 从剪贴板粘贴节点
- **流程**:
  1. 读取系统剪贴板
  2. 解析数据格式
  3. 根据格式调用对应的粘贴方法

**pasteFromCozeFormat(data)**

- **功能**: 粘贴 Coze 格式数据
- **处理**:
  - 生成新的节点ID
  - 转换节点类型
  - 计算粘贴位置（偏移）
  - 重建连线关系
- **LLM 参数归一化**: `modleName`（Coze 拼写）自动修正为 `modelName`（编辑器统一命名），`prompt` 从 `llmParam` 内提取为扁平参数。

#### 3. Coze ↔ 编辑器字段映射

LLM 大模型节点参数在编辑器内部统一使用扁平结构，字段名与 Coze 保持一致：

| 编辑器字段 | Coze 位置 | 说明 |
|-----------|-----------|------|
| `modelName` | `llmParam[].name = "modleName"` | Coze 拼写为 `modleName`（少字母 e），粘贴时自动修正 |
| `prompt` | `llmParam[].name = "prompt"` | 用户提示词，在 Coze 的 `llmParam` 数组内 |
| `systemPrompt` | `llmParam[].name = "systemPrompt"` | 系统提示词 |
| `temperature` | `llmParam[].name = "temperature"` | 温度参数 |
| `maxTokens` | `llmParam[].name = "maxTokens"` | 最大 Token 数 |
| 其他参数 | `llmParam[].name = "xxx"` | `apiMode`、`frequencyPenalty`、`modelType` 等全部保留 |

原则：**不做映射，字段名与 Coze 直接统一**，仅 `modleName` ↔ `modelName` 在粘贴/复制时做拼写修正。

**pasteFromCozeFormat(data)**

- **功能**: 粘贴 Coze 格式数据
- **处理**:
  - 生成新的节点ID
  - 转换节点类型
  - 计算粘贴位置（偏移）
  - 重建连线关系

### 四、图形视图模块（`modules/graph-view.js`）

#### 1. 核心函数

**renderWorkflowGraph(data, isJson)**

- **功能**: 渲染工作流可视化图形
- **参数**:
  - `data` - JSON 或 YAML 字符串
  - `isJson` - 是否为 JSON 格式
- **流程**:
  1. 解析数据
  2. 提取节点和连线
  3. 计算布局位置
  4. 生成 SVG 图形
  5. 添加交互事件

**showNodeDetail(node)**

- **功能**: 显示节点详情弹窗
- **功能**:
  - 显示节点 JSON 数据
  - 支持复制 JSON/YAML/原始格式
  - 支持打开编辑器

**convertToClipboardFormat(node)**

- **功能**: 将节点转换为剪贴板格式
- **参数**: `node` - 节点对象
- **返回**: Coze 剪贴板格式对象
- **特殊处理**:
  - 问答节点 bounds 设置为 360x295
  - 清理图标 URL
  - 按顺序构建 data 对象（inputs → nodeMeta → outputs）

### 五、节点处理器（`components/nodeHandlers.js`）

#### 1. 处理器结构

每个节点类型对应一个处理器函数，签名为：

```javascript
handler(data, params, ctx);
```

- **data**: 输出数据对象（包含 inputs, outputs）
- **params**: 节点参数对象
- **ctx**: 上下文对象（node, outputMap, inputParams, convertNode）

#### 2. 特殊处理器说明

**question 处理器**

- **处理 llmParam**: 支持数组和对象两种格式
- **处理 outputs**: 构建 QUESTION_DATA 的 schema 结构
- **关键代码**:

  ```javascript
  question: (data, params, ctx) => {
      let llmParam = {};
      if (params.llmParam) {
          if (Array.isArray(params.llmParam)) {
              // 数组格式处理
              params.llmParam.forEach((param, index) => {
                  llmParam[String(index)] = { name, input };
              });
          } else if (typeof params.llmParam === 'object') {
              // 对象格式处理
              Object.entries(params.llmParam).forEach(([key, value]) => { ... });
          }
      }
      data.inputs = { llmParam, inputParameters, ... };
      // 处理 outputs...
  }
  ```

**plugin 处理器**

- **处理 apiParam**: 转换参数值为标准格式
- **处理 inputParameters**: 清理 video 参数的 assistType

**containerHandler（loop/batch）**

- **功能**: 处理容器节点
- **参数**: 节点类型（loop 或 batch）
- **处理**: 递归转换子节点

### 六、工具函数（`utils/types.js`）

#### 1. 类型映射

**TYPE_MAP** - YAML 类型到 Coze 类型号的映射

```javascript
const TYPE_MAP = {
  start: "1",
  end: "2",
  llm: "3",
  plugin: "4",
  code: "5",
  condition: "8",
  http: "45",
  text: "15",
  image_generate: "16",
  knowledge: "17",
  question: "18",
  loop: "21",
  intent: "22",
  break: "23",
  variable_assign: "24",
  batch: "28",
  comment: "31",
  variable_merge: "32",
  video_generation: "65",
  async_task: "72",
  output: "13",
  input: "30",
};
```

**REV_TYPE_MAP** - 反向映射（类型号到名称）

**NODE_COLORS** - 节点颜色映射

**NODE_DISPLAY_NAMES** - 节点显示名称映射

#### 2. 工具函数

**getMainColor(type)**

- **功能**: 获取节点主颜色
- **参数**: `type` - 节点类型字符串
- **返回**: 颜色十六进制值

**getSubTitle(type)**

- **功能**: 获取节点副标题（去除 emoji）
- **参数**: `type` - 节点类型字符串
- **返回**: 副标题字符串

**getBounds(node)**

- **功能**: 计算节点边界
- **参数**: `node` - 节点对象
- **返回**: `{ x, y, width, height }`
- **特殊处理**: 问答节点宽度 360，高度 295

**toValueObject(val)**

- **功能**: 将值转换为标准值对象格式
- **参数**: `val` - 任意值
- **返回**: `{ type: "literal" | "ref", content, rawMeta?, assistType? }`

**clearRefCache()**

- **功能**: 清理引用缓存

### 七、输入/输出映射器

#### 1. inputMapper（`components/inputMapper.js`）

**convertInputParameters(nodeInputs, outputMap, type)**

- **功能**: 转换输入参数
- **参数**:
  - `nodeInputs` - 节点输入定义
  - `outputMap` - 输出映射表
  - `type` - 节点类型
- **返回**: 转换后的输入参数数组

#### 2. outputMapper（`components/outputMapper.js`）

**buildOutputMap(nodes)**

- **功能**: 构建输出映射表
- **参数**: `nodes` - 节点数组
- **返回**: `{ nodeId: outputs }`

**convertOutputs(nodeOutputs, includeSchema)**

- **功能**: 转换输出定义
- **参数**:
  - `nodeOutputs` - 节点输出定义
  - `includeSchema` - 是否包含 schema
- **返回**: 转换后的输出数组

## 数据格式说明

### 一、输入格式（YAML）

```yaml
id: workflow_123
name: 示例工作流
description: 描述信息
mode: workflow
icon: plugin_icon/workflow.png
nodes:
  - id: node_1
    type: start
    title: 开始
    position: { x: 0, y: 0 }
    parameters:
      inputVariables: '{"name": "value"}'
  - id: node_2
    type: llm
    title: 大模型
    position: { x: 200, y: 0 }
    parameters:
      model: gpt-3.5-turbo
      prompt: Hello World
edges:
  - source_node: node_1
    target_node: node_2
```

### 二、输出格式（Coze 剪贴板）

```json
{
  "type": "coze-workflow-clipboard-data",
  "source": {
    "workflowId": "workflow_123",
    "flowMode": 0,
    "spaceId": "imported_space",
    "isDouyin": false,
    "host": "www.coze.cn"
  },
  "json": {
    "nodes": [
      {
        "id": "node_1",
        "type": "1",
        "meta": { "position": { "x": 0, "y": 0 } },
        "data": {
          "inputs": { "inputParameters": [] },
          "nodeMeta": {
            "title": "开始",
            "icon": "",
            "description": "",
            "mainColor": "#5C62FF",
            "subTitle": "开始"
          },
          "outputs": []
        },
        "_temp": {
          "bounds": { "x": -180, "y": 0, "width": 360, "height": 112 },
          "externalData": { ... }
        }
      }
    ],
    "edges": [
      { "sourceNodeID": "node_1", "targetNodeID": "node_2" }
    ],
    "name": "示例工作流"
  },
  "bounds": { "x": -180, "y": -20, "width": 720, "height": 140 }
}
```

### 三、节点数据结构对比

| 字段 | YAML 格式             | Coze 格式                    |
| ---- | --------------------- | ---------------------------- |
| 类型 | `type: "start"`       | `type: "1"`                  |
| 位置 | `position: { x, y }`  | `meta.position: { x, y }`    |
| 参数 | `parameters: {...}`   | `data.inputs: {...}`         |
| 输出 | `node_outputs: {...}` | `data.outputs: [...]`        |
| 标题 | `title: "..."`        | `data.nodeMeta.title: "..."` |

## 配置与运行

### 一、服务器配置（`scripts/server.js`）

#### 1. 端口配置

```javascript
const PORT = 8080;
```

#### 2. 路由映射

```javascript
const routeMap = {
  "/": "/views/workflow-manager.html",
  "/index.html": "/views/workflow-manager.html",
  "/converter": "/views/workflow-converter.html",
  "/converter.html": "/views/workflow-converter.html",
  "/editor": "/views/workflow-editor.html",
  "/editor.html": "/views/workflow-editor.html",
  "/favicon.ico": "/assets/favicon.svg", // 解决 404
};
```

#### 3. 缓存控制

```javascript
'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
'Pragma': 'no-cache',
'Expires': '0'
```

### 二、启动方式

#### 开发模式

```bash
npm run dev
```

#### 访问地址

- **工作流管理**: <http://localhost:8080/>
- **转换器**: <http://localhost:8080/converter>
- **编辑器**: <http://localhost:8080/editor>

### 三、项目依赖

#### 运行时依赖

- **js-yaml**: YAML 解析

#### 开发依赖

- **Jest + Babel**: 单元测试框架
- **http-server**: 静态文件服务（备选）

## 键盘快捷键

| 快捷键                    | 功能              | 适用页面 |
| ------------------------- | ----------------- | -------- |
| `Ctrl+C`                  | 复制选中节点      | 编辑器   |
| `Ctrl+V`                  | 粘贴节点          | 编辑器   |
| `Ctrl+Z`                  | 撤销操作          | 编辑器   |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做操作          | 编辑器   |
| `Ctrl+A`                  | 全选所有节点      | 编辑器   |
| `Delete/Backspace`        | 删除选中节点/边   | 编辑器   |
| `Escape`                  | 取消选中/取消连接 | 编辑器   |
| `Ctrl+S`                  | 保存到本地存储    | 编辑器   |

## 常见问题与解决方案

### 一、转换器问题

#### 1. 问答节点无法粘贴

- **原因**: 数据结构顺序不正确
- **解决方案**: 确保 `data` 对象顺序为 `inputs` → `nodeMeta` → `outputs`

#### 2. bounds 尺寸错误

- **原因**: 问答节点需要特殊尺寸
- **解决方案**: 问答节点使用 360x295，其他节点使用 360x112

#### 3. icon 包含特殊字符

- **原因**: YAML 中的 URL 可能包含反引号等字符
- **解决方案**: 使用 `cleanIcon()` 函数清理

### 二、编辑器问题

#### 1. 粘贴失败

- **原因**: 剪贴板数据格式不正确
- **解决方案**: 检查数据是否为 `coze-workflow-clipboard-data` 格式

#### 2. 历史记录丢失

- **原因**: localStorage 被清除
- **解决方案**: 定期导出工作流备份

#### 3. 画布空白

- **原因**: 节点数据为空或格式错误
- **解决方案**: 检查节点数据结构

### 三、服务器问题

#### 1. 端口被占用

- **解决方案**: 修改 `server.js` 中的 `PORT` 常量

#### 2. favicon.ico 404

- **已修复**: 服务器已配置映射到 `favicon.svg`

#### 3. 样式不加载

- **原因**: 缓存问题
- **解决方案**: 强制刷新页面（Ctrl+Shift+R）

## 开发流程

### 一、新增节点类型

1. **在 `utils/types.js` 中添加类型映射**

   ```javascript
   TYPE_MAP.new_type = "XX";
   NODE_COLORS.new_type = "#XXXXXX";
   NODE_DISPLAY_NAMES.new_type = "📦 新类型";
   ```

2. **在 `components/nodeHandlers.js` 中添加处理器**

   ```javascript
   new_type: (data, params, ctx) => {
       data.inputs = { ... };
       data.outputs = convertOutputs(params.node_outputs, true);
   }
   ```

3. **在 `modules/workflow-core.js` 中添加节点定义**（如需要在编辑器中创建）

   ```javascript
   new_type: { title: '新类型', icon: '📦', description: '...', ... }
   ```

### 二、调试技巧

1. **控制台日志**
   - 使用 `console.log()` 输出中间结果
   - 使用 `logger.js` 模块记录日志

2. **断点调试**
   - 在关键函数处设置断点
   - 检查变量值和数据结构

3. **测试数据**
   - 使用 `example/` 目录中的测试数据
   - 创建专门的测试文件

### 三、代码规范

1. **命名规范**
   - 变量/函数: 驼峰命名（camelCase）
   - 文件: 短横线命名（kebab-case）
   - 常量: 大写下划线（UPPER_CASE）

2. **注释规范**
   - 函数添加 JSDoc 注释
   - 复杂逻辑添加注释说明
   - 避免过多注释（代码自解释）

3. **错误处理**
   - 使用 try-catch 包裹可能出错的代码
   - 提供清晰的错误信息
   - 记录错误日志

## 版本历史

### v1.4 (2026-06-11)

**构建系统完善**:

- 全面重构 `build.js` 构建脚本，支持三页面（转换器 + 编辑器 + 工作流管理器）独立构建
- 将所有模块合并为单个 HTML 文件，输出到 `dist/` 固定目录
- 解决 `file://` 协议下的 CORS 跨域问题：动态 `import()` 展开为直接函数调用
- 解决 Worker 加载失败问题：Worker 代码内联化，使用队列模拟异步消息传递
- 修复导航路径：构建时自动替换绝对路径为相对文件名，兼容 `file://` 协议
- ESM → 单文件转换：自动移除 `import`/`export` 语句，`let`/`const` → `var` 去重，解决变量重复声明错误
- 支持多行 `import` 语句处理，支持嵌套 `DOMContentLoaded` 展开

**编辑器交互优化**:

- 修复 z-index 层级问题：连接点现在在最上层（z-index: 30），选中边不会遮挡连接点，可以轻松拖出新边
- 修复画布变换后虚边位置不对应：使用 `screenToCanvas()` 将屏幕坐标正确转换为画布坐标
- 修复 `goToConverter is not defined` 错误：`navigator.js` 模块已正确打包进所有构建目标
- 修复 `Cannot read properties of undefined (reading 'appendChild')` 错误：`dialog.js` 模块已正确打包
- 添加 `dialog.js` 和 `navigator.js` 到所有构建模块列表中

**核心特性完整**:

- 支持 22 种节点类型，其中编辑器支持 13 种可直接创建
- 完整的剪贴板双向转换（YAML → Coze 剪贴板格式，Coze → YAML）
- 支持 `file://` 协议直接双击打开运行，无需 HTTP 服务器

**架构梳理**:

- 明确分层结构：配置层 → 工具层 → 组件层 → 核心控制器 → 入口层 → 视图层
- 所有用户反馈的交互问题已修复
- 文档全面更新，反映当前项目实际状态

### v1.3 (2026-06-04)

**功能增强**:

- 添加反向转换器（`reverse.js`），支持 Coze 格式转换回 YAML 格式
- 添加国际化支持（`i18n/`），支持中英文语言切换
- 添加批量转换脚本（`batch-convert.mjs`），支持批量处理多个工作流文件
- 添加统计渲染器（`stats-renderer.js`），优化统计视图性能
- 添加历史记录管理器（`converter-history.js`），统一历史记录管理
- 添加引用缓存管理（`refCache.js`），优化转换性能

**代码优化**:

- 重构工具函数模块，分离 `helpers.js` 和 `utils.js`
- 优化工作流核心模块结构
- 统一错误处理和日志记录
- **消除重复代码**: Web Worker 改为使用 ES Module 方式，消除 `highlighter-worker.js` 中约 70 行重复代码

### v1.2 (2026-05-29)

**代码优化**:

- 消除重复代码：将 `cleanIcon`、`convertLargeNumbersToStrings`、`escapeHtml` 函数统一到工具模块
- 创建 `ClipboardUtils` 剪贴板操作工具模块，统一管理所有复制功能
- 简化 `graph-view.js` 中的复制按钮逻辑（从 ~15 行/个简化为 2 行/个）
- 优化 `escapeHtml` 实现（从 DOM 操作改为正则替换，性能提升）
- 更新 `workflow-manager.js` 使用统一的导航模块
- 删除多个文件中的重复函数定义

**核心修复**:

- 修复虚拟滚动行号不匹配问题（切换到1k行以下内容时行号同步）
- 修复滚动位置重置（切换历史记录时从第一行开始显示）
- 修复 YAML 字符串转义（代码块中的实际换行符不再被错误转义）
- 修复循环/批处理节点参数结构错误
- 修复字体大小范围（调整为12-20px）
- 修复行号区域宽度（动态计算确保四位行号显示完整）
- 修复行号右对齐（添加 `text-align: right` 和 `min-width: 4ch`）
- 修复删除历史记录时输出区域未清除的问题
- 修复浏览器后退时页面空白（处理缓存恢复）
- 修复 ES Module 中使用 `require()` 的错误

**功能增强**:

- 创建统一导航模块（`navigator.js`），支持平滑页面切换动画
- 添加局域网访问支持（服务器自动获取本地IP）
- 添加页面间导航按钮（编辑器和管理页面）
- 集中管理页面缓存恢复逻辑

### v1.1 (2026-05-29)

**核心修复**:

- 修复虚拟滚动行号不匹配问题
- 修复滚动位置重置问题
- 修复 YAML 字符串转义问题
- 修复循环/批处理节点参数结构错误
- 修复字体大小范围和行号显示问题

**功能增强**:

- 创建统一导航模块
- 添加局域网访问支持

### v1.0 (2026-05-28)

**核心修复**:

- 修复数据结构顺序（`inputs` → `nodeMeta` → `outputs`）
- 修复问答节点 bounds 尺寸（360x295）
- 添加 `cleanIcon()` 函数清理特殊字符
- 修复 outputs 顺序（`optionId` → `optionContent` → `QUESTION_DATA`）
- 修复 `QUESTION_DATA` 的 `options` schema 结构
- 支持 `llmParam` 的对象和数组两种格式
- 添加 favicon.ico 404 路由映射

**功能增强**:

- 添加图形可视化功能
- 添加节点详情弹窗
- 添加统计视图
- 添加虚拟滚动优化
- 添加键盘快捷键支持
- 添加主题切换功能

**项目结构**:

- 重构模块划分
- 添加组件目录
- 添加工具函数目录
- 创建项目文档

## 已修复的问题

### 问题1: 数据结构顺序错误

- **现象**: 输出顺序为 `nodeMeta` -> `outputs` -> `inputs`
- **修复**: 改为 `inputs` -> `nodeMeta` -> `outputs`
- **影响文件**: `converter.js`, `graph-view.js`

### 问题2: 问答节点 bounds 尺寸错误

- **现象**: 所有节点尺寸都是 180x80
- **修复**: 问答节点类型（`question` 或 `18`）使用 360x295
- **影响文件**: `converter.js`, `graph-view.js`, `utils/types.js`

### 问题3: icon 字段包含特殊字符

- **现象**: icon URL 可能包含反引号等特殊字符
- **修复**: 添加 `cleanIcon()` 函数清理
- **影响文件**: `converter.js`, `graph-view.js`

### 问题4: outputs 顺序错误

- **现象**: outputs 顺序不符合 Coze 平台要求
- **修复**: 按 `optionId` -> `optionContent` -> `QUESTION_DATA` 排序
- **影响文件**: `converter.js`

### 问题5: QUESTION_DATA 的 options schema 结构错误

- **现象**: 数组类型的 schema 缺少嵌套结构
- **修复**: 支持 YAML 中的 `items` 属性，构建正确的嵌套 schema
- **影响文件**: `components/nodeHandlers.js`

### 问题6: llmParam 处理不完整

- **现象**: 只处理了数组格式的 llmParam
- **修复**: 支持对象和数组两种格式
- **影响文件**: `components/nodeHandlers.js`

### 问题7: favicon.ico 404 错误

- **现象**: 浏览器请求 .ico 文件但项目中只有 .svg
- **修复**: 在 server.js 中添加路由映射
- **影响文件**: `scripts/server.js`

### 问题8: 连接点被选中的边遮挡，无法拖出新边

- **现象**: 当边被选中时，边图层在连接点上方，无法点击连接点拖出新边
- **修复**: 调整 z-index 层级：连接点 z-index: 30、画布内容 z-index: 3、点击层 z-index: 2、SVG 层 z-index: 1，连接点始终在最上层
- **影响文件**: `src/styles/workflow-editor.css`

### 问题9: 拖动画布后虚边位置不对应

- **现象**: 画布平移/缩放后，鼠标跟随的虚边位置与实际鼠标位置偏差很大
- **修复**: 在 `startConnection` 和 `onMouseMove` 中使用 `screenToCanvas()` 将屏幕坐标正确转换为画布坐标
- **影响文件**: `src/modules/workflow-edge.js`

### 问题10: `goToConverter is not defined` 错误

- **现象**: 点击页面导航按钮时报导航函数未定义
- **修复**: `navigator.js` 模块已添加到 `editorModules` 和 `managerModules`，构建时正确打包
- **影响文件**: `src/scripts/build.js`

### 问题11: `Cannot read properties of undefined (reading 'appendChild')` 错误

- **现象**: 调用 `showMessage()` 时报 `messageContainer` 未初始化
- **修复**: `dialog.js` 模块已添加到 `editorModules` 和 `managerModules`，构建时正确打包
- **影响文件**: `src/scripts/build.js`

### 问题12: `file://` 协议下 CORS 策略阻止动态 import

- **现象**: `Access to script at ... from origin 'null' has been blocked by CORS policy`
- **修复**: `build.js` 将动态 `import()` 展开为直接函数调用，无需异步加载
- **影响文件**: `src/scripts/build.js`

### 问题13: Worker 加载失败 (`Failed to construct 'Worker'`)

- **现象**: `file://` 协议下无法从本地文件系统加载 Worker
- **修复**: `build.js` 将 highlighter-worker 内联化，通过 `Blob URL` 创建 Worker，解决 CORS 问题
- **影响文件**: `src/scripts/build.js`

## 测试

项目使用 Jest 进行单元测试，测试文件位于 `tests/` 目录：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `core.test.js` | 工作流核心逻辑（节点/边 CRUD、历史记录、验证） |
| `canvas.test.js` | 画布坐标转换、视口剔除、性能统计 |
| `edge.test.js` | 边几何计算（贝塞尔路径、箭头、容器节点） |
| `keyboard.test.js` | 键盘快捷键、输入框/模态框过滤 |
| `clipboard.test.js` | 剪贴板复制/粘贴 |
| `converter.test.js` | YAML → Coze 格式转换 |
| `reverse.test.js` | Coze → YAML 反向转换 |
| `helpers.test.js` | 工具函数 |

运行测试：

```bash
npm run test
```

## 优化思路与方向

大部分优化项已在 v1.0 ~ v1.4 中完成，包括：

- **代码质量**: 重复代码消除、数据结构规范化、构建系统完善
- **功能增强**: 批量转换、数据校验、节点类型扩展（22种）
- **性能优化**: 虚拟滚动、Web Worker 语法高亮、引用缓存
- **用户体验**: 编辑器增强、图形预览、主题切换、页面导航、对话框
- **架构优化**: 模块化重构、WorkflowCore 集中状态管理
- **安全优化**: XSS 防护、路径白名单

### 待实现

| 优先级 | 优化项 | 说明 |
|--------|--------|------|
| P1 | 自动化测试持续完善 | 持续补充测试用例，提升覆盖率 |
| P2 | ESLint + Git Hooks | 代码规范自动化检查 |
| P3 | CI/CD 流水线 | 自动化测试与构建 |