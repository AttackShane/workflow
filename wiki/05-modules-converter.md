# 05 · 转换器模块 (Converter)

> 转换器负责在 **YAML** 和 **Coze 剪贴板格式** 之间双向转换，并提供语法高亮、虚拟滚动、历史记录等能力。

## 5.1 入口与初始化

```js
// src/views/workflow-converter.html → src/modules/app.js 识别页面后动态加载
import { initUI } from './converter-ui.js?v=...';
import { initKeyboardShortcuts } from './converter-keyboard.js?v=...';
import { initHistoryPanel } from './converter-stats.js?v=...';
import { initGraphModal } from './shared-graph.js?v=...';
```

入口：`UIController`（`converter-ui.js` 中的类，未导出，但单例化）

## 5.2 核心模块协作图

```
                          ┌──────────────────────────────┐
                          │  converter-ui.js (主控)       │
                          │  - 输入/输出/文件/缓存         │
                          │  - Web Worker 调度            │
                          └────────────┬─────────────────┘
                                       │
       ┌───────────────────┬───────────┼──────────────┬──────────────────┐
       ▼                   ▼           ▼              ▼                  ▼
  converter.js    converter-reverse.js  converter-renderer.js  converter-virtual-scroll.js
  (YAML→Coze)    (Coze→YAML)            (高亮 + 虚拟滚动)        (虚拟滚动)
       │                   │                  │                       │
       ├─ nodeHandlers.js  ├─ utils.js        ├─ converter-highlighter.js
       ├─ inputMapper.js   ├─ types.js        └─ converter-highlighter-worker.js
       ├─ outputMapper.js  └─ refCache.js
       └─ containerHandler.js
                                       │
                                       ▼
                          ┌──────────────────────────────┐
                          │  converter-keyboard.js        │
                          │  (Ctrl+Enter / Ctrl+S / ...)  │
                          └──────────────────────────────┘
                                       │
                          ┌──────────────────────────────┐
                          │  converter-stats.js           │
                          │  converter-history.js         │
                          │  converter-stats-renderer.js  │
                          │  (历史面板 / 统计视图)         │
                          └──────────────────────────────┘
```

## 5.3 YAML → Coze 格式（`converter.js`）

### 5.3.1 主流程

```
输入: YAML 文本
   ↓ convertLargeNumbersToStrings (避免精度丢失)
   ↓ getJsyaml().load() → AST
   ↓
YAML AST { nodes: [...], edges: [...] }
   ↓ validateYamlInput (检查必要字段)
   ↓ calculateBounds (节点边界)
   ↓
   for each node:
       ↓ buildNodeMeta + buildExternalData
       ↓ nodeHandlers[type](data, params, ctx)
       ↓
       Coze 节点对象
   ↓
Coze 剪贴板数据
   {
     type: 'coze-workflow-clipboard-data',
     source: { workflowId },
     json: { nodes: [...], edges: [...] }
   }
```

### 5.3.2 关键 API

```js
// converter.js
export function convertYamlToClipboard(yamlString, workflowId) {
    // 1. 解析 YAML
    // 2. 校验结构
    // 3. 计算边界
    // 4. 遍历节点，调用 nodeHandlers[type]
    // 5. 返回 Coze 剪贴板格式
}

// 内部辅助
function buildNodeMeta(node, type);        // 构建 nodeMeta (title/icon/color/subTitle)
function buildExternalData(node, type, params);  // 构建 externalData
function processPluginNode(data, nodeMeta, params, type);  // 插件节点特殊处理
function calculateBounds(nodes);          // 递归计算节点边界（包含子节点）
```

### 5.3.3 节点处理器 `nodeHandlers.js`

每个节点类型对应一个处理器：

```js
export const nodeHandlers = {
    start:   (data, params, ctx) => { /* 仅 outputs */ },
    end:     (data, params, ctx) => { /* 终止计划 + 输出 */ },
    llm:     (data, params, ctx) => { /* llmParam 转 Coze */ },
    plugin:  (data, params, ctx) => { /* apiParam 处理 */ },
    code:    (data, params, ctx) => { /* 代码块 + 语言 */ },
    knowledge_query: (data, params) => { /* 知识库检索 */ },
    condition:    (data, params) => { /* 动态分支 */ },
    workflow:     (data, params) => { /* 子工作流 */ },
    image_generate: (data, params) => { /* modelSetting + prompt */ },
    video_generation: (data, params) => { /* 视频参数白名单 */ },
    http:         (data, params) => { /* url/method/headers/body */ },
    database:     (data, params) => { /* SQL */ },
    loop:         (data, params) => { /* loopType/loopCount/loopItems */ },
    batch:        (data, params) => { /* batchSize/concurrentSize */ },
    question:     (data, params) => { /* 多选项 + llmParam */ },
    intent:       (data, params) => { /* intentConfig */ },
    text:         (data, params) => { /* concatParams/method */ },
    variable_merge: (data, params) => { /* mergeGroups */ },
    variable_assign: (data, params) => { /* variableName/Value */ },
    output:       (data, params) => { /* streamingOutput + content */ },
    input:        (data, params) => { /* outputSchema */ },
    async_task:   (data, params) => { /* taskConfig */ },
    comment:      (data, params) => { /* note + schemaType */ },
    // ... 22+ 种类型
};
```

### 5.3.4 输入参数映射 `inputMapper.js`

```js
export function convertInputParameters(inputParams, outputMap, type);
```

- 处理 `{ type: 'ref', content: { blockID, name, source } }` 引用
- 处理 `{ type: 'literal', content: value }` 字面量
- 自动从 `outputMap` 中查找上游节点输出，建立 `ref` 引用

### 5.3.5 输出参数映射 `outputMapper.js`

```js
export function convertOutputs(nodeOutputs, isStart);
export function buildOutputMap(nodes);  // 全局节点输出索引
```

### 5.3.6 容器节点 `containerHandler.js`

`loop` / `batch` 节点特殊处理：

- 设置 `data.inputs`（loopCount / loopItems / batchSize / concurrentSize）
- 递归处理 `data.blocks`（内部子节点）和 `data.edges`（内部边）
- 处理 `container_start` / `container_end` 端口

## 5.4 Coze → YAML（`converter-reverse.js`）

### 5.4.1 转换链路

```
输入: Coze 剪贴板数据
   ↓ validateClipboardInput
   ↓
Coze 节点列表
   ↓
   for each node:
       ↓
       TYPE_PARAMS_MAP[type] 提取白名单参数
       convertValue(value) 递归转换
       ↓
   内部表示
   ↓ js-yaml.dump
   ↓
YAML 文本
```

### 5.4.2 参数白名单

```js
const TYPE_PARAMS_MAP = {
    code: ['code', 'language'],
    llm: ['llmParam'],
    image_generate: ['modelSetting', 'prompt', 'references'],
    video_generation: ['duration', 'model', 'prompt', 'cameraFixed', 'generateAudio',
                       'generateMode', 'firstFrame', 'ratio', 'resolution', 'seed',
                       'watermark', 'dynamicParameters'],
    condition: ['branches'],
    plugin: ['apiParam'],
    loop: ['loopType', 'loopCount', 'loopItems', 'iterationVariable', 'variableParameters'],
    batch: ['batchSize', 'concurrentSize'],
    comment: ['note', 'schemaType'],
    text: ['concatParams', 'method'],
    variable_merge: ['mergeGroups'],
    variable_assign: ['variableName', 'variableValue'],
    http: ['url', 'method', 'headers', 'body', 'authType', 'authParams'],
    knowledge_query: ['knowledgeBaseId', 'query', 'topK'],
    intent: ['intentConfig'],
    async_task: ['taskConfig'],
    question: ['llmParam', 'extra_output', 'answer_type', 'option_type', 'dynamic_option',
               'options', 'limit'],
    output: ['streamingOutput', 'callTransferVoice', 'chatHistoryWriting', 'content'],
    input: ['outputSchema'],
    common: ['settingOnError'],
};
```

### 5.4.3 值转换 `convertValue(val, options)`

| 输入 | 输出 |
| --- | --- |
| `null` / `undefined` | `null` |
| string | 原样 |
| `{ type: 'ref', content: { name, blockID, source } }` | `{ path, ref_node, source? }` |
| `{ type: 'literal', content }` | `content`（默认去包装；`keepLiteral=true` 保留包装） |
| Array | 递归 |
| Object | 递归 |

## 5.5 渲染器（`converter-renderer.js`）

### 5.5.1 渲染策略

| 数据量 | 策略 |
| --- | --- |
| `< 1000` 行 | 同步渲染 `renderSync()` |
| `>= 1000` 行 | 虚拟滚动 `renderWithVirtualScroll()` |
| Worker 可用 | 后台高亮 `renderAsync()` |

### 5.5.2 API

```js
import {
    renderWithVirtualScroll,   // 虚拟滚动
    renderSync,                // 同步渲染
    renderAsync,               // 异步渲染（Worker）
} from './converter-renderer.js';
```

### 5.5.3 HTML 安全

```js
const ALLOWED_TAGS = ['span', 'br'];

function isHighlightHtmlSafe(html) {
    // 仅允许 <span> 和 <br> 标签
    // 拒绝 <script> 等危险标签
}
```

## 5.6 虚拟滚动（`converter-virtual-scroll.js`）

### 5.6.1 阈值与缓存

```js
APP_CONFIG.VIRTUAL_SCROLL = {
    THRESHOLD: 1000,    // 超过此行数启用
    CACHE_COUNT: 5,     // 前后预渲染行数
    MIN_HEIGHT: 24,     // 最小行高（px）
};
```

### 5.6.2 实现要点

- 用 `padding-top` / `padding-bottom` 撑高容器
- 监听 `scroll` 事件动态计算可见行
- 用 `position: absolute` 渲染可见行
- 前后各缓存 5 行减少闪烁

## 5.7 语法高亮（`converter-highlighter.js` + `converter-highlighter-worker.js`）

### 5.7.1 双模式

| 模式 | 触发 | 适用 |
| --- | --- | --- |
| 主线程 | 小数据 / Worker 不可用 | 小于 1000 行 |
| Web Worker | 异步 | 大文本不阻塞 UI |

### 5.7.2 高亮规则

**JSON**：

- key：蓝色
- string：绿色
- number：橙色
- boolean / null：紫色
- 标点：灰色

**YAML**：

- key：蓝色
- value：绿色
- 锚点 / 别名：紫色
- 注释：灰色

### 5.7.3 API

```js
import { highlightJson, highlightYaml } from './converter-highlighter.js';
```

## 5.8 历史记录（`converter-history.js`）

### 5.8.1 数据结构

```js
{
    id: 1715000000000,
    name: '工作流名（自动从 YAML 提取）',
    data: '转换结果字符串',
    isJson: boolean,
    timestamp: '2026-07-08T10:00:00Z'
}
```

### 5.8.2 存储

- 位置：`localStorage[APP_CONFIG.HISTORY.KEY]` = `'workflow-converter-history'`
- 最大条目：`MAX_ITEMS = 20`
- 选中状态：`localStorage[APP_CONFIG.HISTORY.SELECTED_KEY]`

### 5.8.3 API

```js
getHistory()                              // 获取全部
saveToHistory(data, isJson, name?)        // 添加一条
deleteHistoryItem(id)                     // 删除
updateHistoryItem(id, updates)            // 更新
exportHistory()                           // 导出为 JSON
importHistory(json)                       // 从 JSON 导入
clearHistory()                            // 清空
```

## 5.9 统计视图（`converter-stats.js` + `converter-stats-renderer.js`）

### 5.9.1 功能

- **节点类型分布**：饼图 / 柱状图
- **边数量 / 节点总数**
- **历史面板**：搜索、筛选、批量删除

### 5.9.2 触发方式

- 自动：每次成功转换后调用 `showStats()`
- 手动：工具栏按钮

## 5.10 依赖图视图（`shared-graph.js`）

`initGraphModal()` 初始化模态框，使用 SVG 渲染工作流拓扑：

- 节点：彩色矩形（按类型着色）
- 边：贝塞尔曲线
- 支持缩放、平移
- 点击节点 → 调用 `shared-node-detail.js` 弹出详情

## 5.11 快捷键（`converter-keyboard.js`）

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Enter` | 触发转换（文本模式） |
| `Ctrl+S` | 保存到历史 |
| `Ctrl+C` | 复制输出 |
| `Ctrl+L` | 切换主题（部分版本） |
| `Esc` | 失焦输入框 |

## 5.12 关键数据结构（转换器）

### 5.12.1 Coze 剪贴板格式

```js
{
    type: 'coze-workflow-clipboard-data',
    source: { workflowId: '123456' },
    json: {
        name: '工作流名',
        nodes: [
            {
                id: '100001',                       // 数字 ID
                type: '3',                          // 数字类型（3 = llm）
                meta: { position: { x: 400, y: 200 } },
                data: {
                    nodeMeta: { title, icon, mainColor, subTitle, description },
                    outputs: [{ name, type, required, defaultValue, schema }],
                    inputs: {
                        inputParameters: [
                            { name, input: { type, value: { type: 'ref'|'literal', content } } }
                        ],
                        // ... 特定类型的其他参数
                    }
                },
                _temp: { bounds, externalData },     // 临时渲染信息
                blocks: [...],                        // 容器内子节点
                edges: [...],                         // 容器内边
            }
        ],
        edges: [
            { sourceNodeID: '...', targetNodeID: '...', sourcePortID: '...' }
        ]
    }
}
```

### 5.12.2 YAML 内部格式

```yaml
name: 工作流名
nodes:
  - id: node_100001
    type: llm
    title: 大模型调用
    parameters:
      modelName: 豆包·2.0·lite
      systemPrompt: 你是助手
      prompt: 请回答用户问题
      temperature: 0.7
    node_outputs:
      answer:
        type: string
        description: 回答内容
    node_inputs:
      question:
        type: string
        value: '{{start.userInput}}'   # 引用格式
edges:
  - source: node_100001
    target: node_100002
```

## 5.13 关键文件清单

| 文件 | 行数（约） | 关键导出 |
| --- | --- | --- |
| `converter.js` | 500 | `convertYamlToClipboard` |
| `converter-reverse.js` | 400 | `convertClipboardToYaml` |
| `converter-ui.js` | 700 | `UIController` 类 |
| `converter-renderer.js` | 200 | `renderSync / renderAsync / renderWithVirtualScroll` |
| `converter-virtual-scroll.js` | 200 | `VirtualScroll` 类 |
| `converter-highlighter.js` | 200 | `highlightJson / highlightYaml` |
| `converter-highlighter-worker.js` | 200 | (Worker 入口) |
| `converter-keyboard.js` | 200 | `initKeyboardShortcuts` |
| `converter-history.js` | 100 | `getHistory / saveToHistory / ...` |
| `converter-stats.js` | 300 | `initHistoryPanel / showStats` |
| `converter-stats-renderer.js` | 200 | `renderStats / renderStatsDetail` |
| `components/nodeHandlers.js` | 300 | `nodeHandlers` 字典 |
| `components/inputMapper.js` | 150 | `convertInputParameters` |
| `components/outputMapper.js` | 100 | `convertOutputs / buildOutputMap` |
| `components/containerHandler.js` | 200 | `processContainerNode` |
