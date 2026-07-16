# 09 · 数据结构

> 本文档详解项目中的核心数据结构，包括节点、边、容器、引用、Coze 剪贴板格式等。

## 9.1 节点模型（内部格式）

### 9.1.1 基础节点

```js
{
    id: 'node_100001',                    // 字符串 ID（node_ + 数字）
    type: 'llm',                          // 字符串类型（见 §9.1.3）
    x: 400,                               // 画布坐标 X
    y: 200,                               // 画布坐标 Y
    width: 200,                           // 节点宽度（渲染后测量）
    height: 100,                          // 节点高度（渲染后测量）

    // 元数据
    title: '大模型调用',                  // 节点标题（i18n）
    description: '调用 LLM',              // 节点描述
    icon: '🤖',                            // 节点图标
    mainColor: '#4A90D9',                  // 节点主色

    // 参数
    parameters: {                          // 节点参数（类型相关）
        modelName: '豆包·2.0·lite',
        systemPrompt: '你是助手',
        prompt: '请回答用户问题',
        temperature: 0.7,
        maxTokens: 1024,
        // ... 类型相关字段
    },

    // 输入参数（动态入参）
    inputParams: [
        {
            name: 'question',
            type: 'string',
            valueType: 'literal',          // 'literal' | 'ref'
            value: { type: 'literal', content: '你好' },
            required: true,
            description: '用户问题',
        }
    ],

    // 输出参数（动态出参）
    outputParams: [
        {
            name: 'answer',
            type: 'string',
            required: true,
            description: '回答内容',
        }
    ],

    // 容器相关
    parentId: null,                        // 父节点 ID（仅容器子节点有）

    // 行为
    locked: false,                         // 是否锁定

    // 临时数据（不持久化）
    _temp: { ... },
}
```

### 9.1.2 容器节点（loop / batch）

```js
{
    id: 'node_100002',
    type: 'loop',
    x: 400, y: 200,
    width: 400, height: 300,              // 容器尺寸（自动调整）
    title: '循环',
    parameters: {
        loopType: 'count',                 // 'count' | 'array'
        loopCount: { type: 'integer', value: { type: 'literal', content: 10 } },
        loopItems: null,
        iterationVariable: 'item',
        variableParameters: [...],
    },
    // 子节点通过 parentId 引用
}
```

### 9.1.3 50 种节点类型

| 类型 | 数字 ID | 名称 | 输入 | 输出 | 容器 |
| --- | --- | --- | --- | --- | --- |
| `start` | 1 | 开始 | ❌ | ✅ | ❌ |
| `end` | 2 | 结束 | ✅ | ❌ | ❌ |
| `llm` | 3 | 大模型 | ✅ | ✅ | ❌ |
| `plugin` | 4 | 插件 | ✅ | ✅ | ❌ |
| `code` | 5 | 代码 | ✅ | ✅ | ❌ |
| `knowledge_query` | 6 | 知识库检索 | ✅ | ✅ | ❌ |
| `condition` | 8 | 条件分支 | ✅ | ✅ (动态) | ❌ |
| `workflow` | 9 | 子工作流 | ✅ | ✅ | ❌ |
| `sql_exec` | 12 | SQL | ✅ | ✅ | ❌ |
| `output` | 13 | 输出 | ✅ | ❌ | ❌ |
| `text` | 15 | 文本处理 | ✅ | ✅ | ❌ |
| `image_generate` | 16 | 图像生成 | ✅ | ✅ | ❌ |
| `question` | 18 | 问答 | ✅ | ✅ (动态) | ❌ |
| `break` | 19 | 退出循环 | ✅ | ❌ | ❌ |
| `loop_set_variable` | 20 | 设置变量 | ✅ | ✅ | ❌ |
| `loop` | 21 | 循环 | ✅ | ✅ | ✅ |
| `intent` | 22 | 意图识别 | ✅ | ✅ (动态) | ❌ |
| `canvas` | 23 | 画板 | ✅ | ✅ | ❌ |
| `knowledge_write` | 27 | 知识库写入 | ✅ | ✅ | ❌ |
| `batch` | 28 | 批处理 | ✅ | ✅ | ✅ |
| `loop_continue` | 29 | 继续循环 | ✅ | ❌ | ❌ |
| `input` | 30 | 输入 | ❌ | ✅ | ❌ |
| `comment` | 31 | 注释 | ❌ | ❌ | ❌ |
| `variable_merge` | 32 | 变量合并 | ✅ | ✅ | ❌ |
| `json_parse` | 37 | JSON 解析 | ✅ | ✅ | ❌ |
| `clear_conversation` | 38 | 清空会话 | ✅ | ✅ | ❌ |
| `create_conversation` | 39 | 创建会话 | ✅ | ✅ | ❌ |
| `variable_assign` | 40 | 变量赋值 | ✅ | ✅ | ❌ |
| `db_update` | 42 | 更新数据 | ✅ | ✅ | ❌ |
| `db_select` | 43 | 查询数据 | ✅ | ✅ | ❌ |
| `db_delete` | 44 | 删除数据 | ✅ | ✅ | ❌ |
| `http` | 45 | HTTP 请求 | ✅ | ✅ | ❌ |
| `db_insert` | 46 | 新增数据 | ✅ | ✅ | ❌ |
| `update_conversation` | 51 | 修改会话 | ✅ | ✅ | ❌ |
| `delete_conversation` | 52 | 删除会话 | ✅ | ✅ | ❌ |
| `list_conversation` | 53 | 会话列表 | ✅ | ✅ | ❌ |
| `get_conversation_history` | 54 | 会话历史 | ✅ | ✅ | ❌ |
| `create_message` | 55 | 创建消息 | ✅ | ✅ | ❌ |
| `update_message` | 56 | 修改消息 | ✅ | ✅ | ❌ |
| `delete_message` | 57 | 删除消息 | ✅ | ✅ | ❌ |
| `json_serialize` | 58 | JSON 序列化 | ✅ | ✅ | ❌ |
| `json_deserialize` | 59 | JSON 反序列化 | ✅ | ✅ | ❌ |
| `knowledge_delete` | 60 | 知识库删除 | ✅ | ✅ | ❌ |
| `video_extract_audio` | 63 | 提取音频 | ✅ | ✅ | ❌ |
| `video_extract_frame` | 64 | 视频抽帧 | ✅ | ✅ | ❌ |
| `video_generation` | 65 | 视频生成 | ✅ | ✅ | ❌ |
| `memory_write` | 66 | 记忆写入 | ✅ | ✅ | ❌ |
| `memory_read` | 67 | 记忆检索 | ✅ | ✅ | ❌ |
| `async_task` | 72 | 异步任务 | ✅ | ✅ | ❌ |
| `delay` | 73 | 延时 | ✅ | ✅ | ❌ |
| `database` | 74 | 数据库 | ✅ | ✅ | ❌ |
| `email` | 75 | 邮件 | ✅ | ✅ | ❌ |
| `webhook` | 76 | Webhook | ✅ | ✅ | ❌ |

## 9.2 边模型

```js
{
    id: 'edge_100001',                    // edge_ + 数字
    source: 'node_100001',                // 源节点 ID
    target: 'node_100002',                // 目标节点 ID

    // 端口信息（分支节点必填）
    sourcePort: 'branch_0',               // 或 'container_start' / 'default'
    targetPort: '',                       // 通常为空，'container_end' 用于容器出口

    // 可选：临时字段
    _temp: { ... },
}
```

### 9.2.1 端口 ID 约定

| 节点类型 | 端口 ID 格式 | 示例 |
| --- | --- | --- |
| 普通节点 | `''`（默认） | `''` |
| question | `branch_0` / `branch_1` / ... / `default` | `branch_2` |
| intent | `branch_0` / `branch_1` / ... / `default` | `branch_0` |
| condition | `branch_0` / `branch_1` / ... | `branch_3` |
| 容器入口 | `container_start` | `container_start` |
| 容器出口 | `container_end` | `container_end` |

## 9.3 引用模型

### 9.3.1 Ref 类型

```js
{
    type: 'ref',
    content: {
        source: 'block-output',          // 引用来源
        blockID: 'node_100001',          // 引用目标节点
        name: 'answer',                  // 引用输出名
    },
    rawMeta: { type: 1 }                 // 可选
}
```

### 9.3.2 Literal 类型

```js
{
    type: 'literal',
    content: 'hello'                    // 直接值（字符串/数字/对象/数组）
}
```

### 9.3.3 输入参数结构

```js
{
    name: 'question',
    type: 'string',
    valueType: 'literal',                 // 'literal' | 'ref'
    value: { type: 'literal', content: 'hello' },
    // 或
    // value: { type: 'ref', content: { source, blockID, name } }

    required: true,
    description: '用户问题',
    defaultValue: '默认值',                // 可选
}
```

### 9.3.4 引用渲染显示

UI 显示为 `{{blockID.name}}` 形式，如：

```
{{node_100001.answer}}
```

## 9.4 特殊节点数据结构

### 9.4.1 `loop_set_variable`（type 20）

**关键：variables 数组必须保留 left/right 结构**

```js
{
    type: 'loop_set_variable',
    parameters: {
        variables: [
            {
                left: {
                    type: 'ref',
                    value: {
                        type: 'ref',
                        content: {
                            blockID: 'node_container',     // 容器节点 ID
                            name: 'item',                  // 迭代变量名
                        }
                    }
                },
                right: {
                    type: 'ref',
                    value: {
                        type: 'ref',
                        content: {
                            blockID: 'node_xxx',
                            name: 'output',
                        }
                    }
                }
            }
        ]
    }
}
```

导出时直接赋值：`cozeNode.data.inputs.inputParameters = node.parameters.variables`

### 9.4.2 `condition`（type 8）— 动态分支

```js
{
    type: 'condition',
    parameters: {
        branches: [
            {
                name: '是',
                condition: {
                    conditions: [
                        {
                            left: { type: 'ref', value: { type: 'ref', content: { blockID, name } } },
                            operator: 1,                     // ==
                            right: { type: 'literal', value: { type: 'literal', content: 'yes' } }
                        }
                    ],
                    logic: 1,                                // 1=AND, 2=OR
                }
            },
            {
                name: '否',
                condition: { /* ... */ }
            }
        ]
    }
}
```

### 9.4.3 `variable_merge`（type 32）

```js
{
    type: 'variable_merge',
    parameters: {
        mergeGroups: [
            {
                name: 'group1',
                variables: [
                    { name: 'var1', type: 'string', source: { blockID, name } },
                    { name: 'var2', type: 'string', source: { blockID, name } },
                ]
            }
        ]
    }
}
```

### 9.4.4 `question`（type 18）

```js
{
    type: 'question',
    parameters: {
        options: [
            '选项 1',
            '选项 2',
            // 或
            { name: '选项 1' },
            { name: '选项 2' }
        ],
        answer_type: 'option',
        llmParam: [...],
        limit: 1,
    }
}
```

### 9.4.5 `intent`（type 22）

```js
{
    type: 'intent',
    parameters: {
        categories: [
            '问候',
            '查询',
            '投诉',
            // 或
            { name: '问候' }
        ],
        intentConfig: { ... }
    }
}
```

### 9.4.6 容器节点 `loop`（type 21）

```js
{
    type: 'loop',
    parameters: {
        loopType: 'count',                 // 'count' | 'array' | 'infinite'
        loopCount: {
            type: 'integer',
            value: { type: 'literal', content: 10 }
        },
        loopItems: null,                   // array 类型时使用
        iterationVariable: 'item',         // 迭代变量名
        variableParameters: [
            // 循环中可用的参数
        ]
    }
    // 子节点通过 parentId 引用
}
```

### 9.4.7 容器节点 `batch`（type 28）

```js
{
    type: 'batch',
    parameters: {
        batchSize: {
            type: 'integer',
            value: { type: 'literal', content: 100 }
        },
        concurrentSize: {
            type: 'integer',
            value: { type: 'literal', content: 2 }
        }
    }
}
```

## 9.5 Coze 剪贴板格式

### 9.5.1 顶层结构

```js
{
    type: 'coze-workflow-clipboard-data',
    source: {
        workflowId: '123456',            // 数字字符串
    },
    json: {
        name: '工作流名',
        nodes: [ ... ],                  // Coze 节点数组
        edges: [ ... ],                  // Coze 边数组
    }
}
```

### 9.5.2 Coze 节点

```js
{
    id: '100001',                        // 数字字符串（去掉 node_ 前缀）
    type: '3',                           // 数字字符串（TYPE_MAP 反向）
    meta: {
        position: { x: 400, y: 200 }
    },
    data: {
        nodeMeta: {
            title: '大模型调用',
            icon: '🤖',
            description: '调用 LLM',
            mainColor: '#4A90D9',
            subTitle: '豆包·2.0·lite',
        },
        outputs: [
            {
                name: 'answer',
                type: 'string',
                required: true,
                defaultValue: '',          // 可选
                description: '回答内容',
                schema: [ ... ],           // 复杂结构
                rawMeta: { type: 1 },      // 可选
                input: { ... },            // 可选
            }
        ],
        inputs: {
            inputParameters: [
                {
                    name: 'question',
                    input: {
                        type: 'string',
                        value: {
                            type: 'ref' | 'literal',
                            content: ...
                        }
                    }
                }
            ],
            // 类型特定字段
            llmParam: [ ... ],              // llm 节点
            apiParam: [ ... ],              // plugin 节点
            // ...
        }
    },
    _temp: {                              // 临时字段（仅渲染使用）
        bounds: { x, y, width, height },
        externalData: { icon, description, title, mainColor, pluginID }
    },
    blocks: [ ... ],                      // 容器节点：内部子节点
    edges: [ ... ]                        // 容器节点：内部边
}
```

### 9.5.3 Coze 边

```js
{
    sourceNodeID: '100001',              // 数字字符串
    targetNodeID: '100002',
    sourcePortID: 'branch_0'             // 可选：分支节点
}
```

## 9.6 YAML 内部格式

```yaml
name: 工作流名
nodes:
  - id: node_100001
    type: llm
    title: 大模型调用
    description: 调用 LLM
    icon: 🤖
    mainColor: '#4A90D9'
    parameters:
      modelName: 豆包·2.0·lite
      systemPrompt: 你是助手
      prompt: 请回答用户问题
      temperature: 0.7
      maxTokens: 1024
    inputParams:
      - name: question
        type: string
        valueType: ref
        value:
          type: ref
          content:
            source: block-output
            blockID: node_100000
            name: userInput
        required: true
        description: 用户问题
    outputParams:
      - name: answer
        type: string
        required: true
        description: 回答内容
edges:
  - source: node_100001
    target: node_100002
    sourcePort: branch_0
```

## 9.7 类型映射（`utils/types.js`）

### 9.7.1 `TYPE_MAP`（名称 → 数字 ID）

```js
export const TYPE_MAP = {
    start: '1', end: '2', llm: '3', plugin: '4', code: '5',
    knowledge_query: '6', condition: '8', workflow: '9',
    sql_exec: '12', output: '13', text: '15', image_generate: '16',
    question: '18', break: '19', loop_set_variable: '20',
    loop: '21', intent: '22', canvas: '23',
    knowledge_write: '27', batch: '28', loop_continue: '29',
    input: '30', comment: '31', variable_merge: '32',
    json_parse: '37', clear_conversation: '38', create_conversation: '39',
    variable_assign: '40', db_update: '42', db_select: '43',
    db_delete: '44', http: '45', db_insert: '46',
    update_conversation: '51', delete_conversation: '52',
    list_conversation: '53', get_conversation_history: '54',
    create_message: '55', update_message: '56', delete_message: '57',
    json_serialize: '58', json_deserialize: '59', knowledge_delete: '60',
    video_extract_audio: '63', video_extract_frame: '64',
    video_generation: '65', memory_write: '66', memory_read: '67',
    async_task: '72', delay: '73', database: '74', email: '75', webhook: '76',
};
```

### 9.7.2 `REV_TYPE_MAP`（数字 → 名称）

由 `TYPE_MAP` 自动生成。

### 9.7.3 `ASSIST_MAP`（辅助类型）

```js
export const ASSIST_MAP = {
    image: 2, audio: 8, video: 10, file: 1, svg: 11, voice: 12,
    doc: 3, ppt: 5, time: 10000,
};
```

### 9.7.4 `RAW_TYPE`（原始类型）

```js
export const RAW_TYPE = {
    string: 1, integer: 2, float: 4, boolean: 3,
    stringList: 99, list: 100, objectList: 103,
    image: 7, imageList: 104,
    // ... 30+ 种
};
```

### 9.7.5 颜色与图标

```js
// NODE_COLORS：节点主色
export const NODE_COLORS = {
    start: '#00C896', end: '#FF6B6B', llm: '#5B7FFF',
    plugin: '#FFA94D', code: '#9775FA',
    // ...
};

// NODE_DISPLAY_NAMES：节点显示名（备用，主要用 i18n）
export const NODE_DISPLAY_NAMES = {
    start: '开始', end: '结束', llm: '大模型',
    // ...
};
```

## 9.8 条件表达式数据结构

### 9.8.1 Coze 原生格式

```js
{
    conditions: [
        {
            left: {
                type: 'ref' | 'literal',
                value: {
                    type: 'ref' | 'literal',
                    content: ...                  // 引用或值
                }
            },
            operator: 1,                          // 1-10
            right: { /* 同 left */ }
        }
    ],
    logic: 1                                     // 1=AND, 2=OR
}
```

### 9.8.2 内部简化格式

```js
[
    {
        left: { type: 'ref', value: { type: 'ref', content: { blockID, name } } },
        operator: '==',
        right: { type: 'literal', value: { type: 'literal', content: 'yes' } }
    }
]
```

## 9.9 存储格式

### 9.9.1 localStorage: `workflow_current`（编辑器当前工作流）

```js
{
    nodes: [...],
    edges: [...],
    nodeIdCounter: 100001,
    edgeIdCounter: 100001,
    selectedNode: null,
    selectedEdge: null,
    savedAt: 1715000000000
}
```

### 9.9.2 localStorage: `workflows`（管理页工作流列表）

```js
[
    {
        id: 'wf_1715000000000',
        name: '工作流名',
        description: '描述',
        nodes: [...],
        edges: [...],
        createdAt: 1715000000000,
        updatedAt: 1715000000000,
    }
]
```

### 9.9.3 localStorage: `workflow_versions_${id}`（版本快照）

```js
[
    {
        version: 1,
        timestamp: 1715000000000,
        nodes: [...],
        edges: [...],
        name: 'v1'
    }
]
```

### 9.9.4 localStorage: `workflow-converter-history`（转换历史）

```js
[
    {
        id: 1715000000000,
        name: '工作流名',
        data: '...',
        isJson: true,
        timestamp: '2026-07-08T10:00:00Z'
    }
]
```

### 9.9.5 localStorage: `keyboardShortcuts`（快捷键配置）

```js
{
    delete: 'Delete',
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    // ...
}
```

## 9.10 验证数据结构

`WorkflowCore.validate()` 返回：

```js
{
    valid: true | false,
    message: '错误信息\n...',
    errors: [
        '节点"大模型"没有入边',
        '缺少结束节点',
        // ...
    ]
}
```

验证规则：

- 必须有 1 个 `start` 节点
- 必须有 ≥1 个 `end` 节点
- 除 `start` / `comment` / `input` 外，其他节点必须有入边
- 除 `end` / `comment` / `break` 外，其他节点必须有出边
- 不允许多个 `start` 节点

## 9.11 数据流图

```
┌──────────────┐
│ 用户输入       │
│ YAML / 拖拽    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 内部格式       │ ◀────── 单一可信源 (WorkflowCore)
│ 节点/边       │
└──────┬───────┘
       │
       ├─→ ┌────────────────┐
       │   │ Coze 剪贴板     │ (导出 / 复制)
       │   │ JSON 格式      │
       │   └────────────────┘
       │
       ├─→ ┌────────────────┐
       │   │ localStorage   │ (自动保存)
       │   │ workflow_current│
       │   └────────────────┘
       │
       └─→ ┌────────────────┐
           │ sessionStorage  │ (跨页传输)
           │ savedWorkflow   │
           └────────────────┘
```
