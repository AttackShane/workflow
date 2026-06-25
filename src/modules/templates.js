/**
 * 工作流模板库
 * 预置常用工作流模板，供用户快速创建
 */
export const WORKFLOW_TEMPLATES = [
    {
        id: 'tpl_welcome',
        name: '欢迎消息',
        description: '一个简单的欢迎工作流，包含开始→LLM→结束',
        icon: '👋',
        category: '入门',
        nodes: [
            { id: 'node_100001', type: 'start', x: 400, y: 80, title: '开始', description: '工作流起点' },
            { id: 'node_100002', type: 'llm', x: 400, y: 200, title: '生成欢迎语', description: '生成友好的欢迎消息', parameters: { prompt: '请生成一条友好的欢迎消息，可以包含用户的名字' } },
            { id: 'node_100003', type: 'end', x: 400, y: 320, title: '结束', description: '工作流终点' }
        ],
        edges: [
            { id: 'edge_1', source: 'node_100001', target: 'node_100002' },
            { id: 'edge_2', source: 'node_100002', target: 'node_100003' }
        ]
    },
    {
        id: 'tpl_chatbot',
        name: '智能客服',
        description: '多轮对话客服机器人，包含问答分支',
        icon: '🤖',
        category: '常用',
        nodes: [
            { id: 'node_200001', type: 'start', x: 400, y: 80, title: '用户提问', description: '接收用户问题' },
            { id: 'node_200002', type: 'llm', x: 400, y: 200, title: '意图识别', description: '分析用户意图', parameters: { prompt: '分析用户的问题意图，返回意图标签' } },
            { id: 'node_200003', type: 'condition', x: 300, y: 320, title: '意图分支', description: '根据意图分流' },
            { id: 'node_200004', type: 'knowledge_query', x: 150, y: 440, title: '知识库检索', description: '从知识库检索匹配的答案', parameters: { query: '{{用户问题}}', topK: 5, useRerank: true, useRewrite: true, isPersonalOnly: true, enableChatHistory: false, chatHistoryRound: 3 } },
            { id: 'node_200005', type: 'llm', x: 350, y: 440, title: '闲聊回复', description: '生成闲聊回复' },
            { id: 'node_200006', type: 'end', x: 250, y: 560, title: '回复用户', description: '输出最终回复' }
        ],
        edges: [
            { id: 'edge_3', source: 'node_200001', target: 'node_200002' },
            { id: 'edge_4', source: 'node_200002', target: 'node_200003' },
            { id: 'edge_5', source: 'node_200003', target: 'node_200004' },
            { id: 'edge_6', source: 'node_200003', target: 'node_200005' },
            { id: 'edge_7', source: 'node_200004', target: 'node_200006' },
            { id: 'edge_8', source: 'node_200005', target: 'node_200006' }
        ]
    },
    {
        id: 'tpl_image_gen',
        name: '图片生成',
        description: '文本描述→图片生成流程',
        icon: '🖼️',
        category: '常用',
        nodes: [
            { id: 'node_300001', type: 'start', x: 400, y: 80, title: '开始', description: '接收输入' },
            { id: 'node_300002', type: 'text', x: 400, y: 200, title: '图片描述', description: '生成或接收图片描述文本', parameters: { text: '一只可爱的橘猫坐在窗台边看风景' } },
            { id: 'node_300003', type: 'image_generate', x: 400, y: 320, title: '生成图片', description: '根据描述生成图片' },
            { id: 'node_300004', type: 'end', x: 400, y: 440, title: '输出图片', description: '输出生成的图片' }
        ],
        edges: [
            { id: 'edge_9', source: 'node_300001', target: 'node_300002' },
            { id: 'edge_10', source: 'node_300002', target: 'node_300003' },
            { id: 'edge_11', source: 'node_300003', target: 'node_300004' }
        ]
    },
    {
        id: 'tpl_data_process',
        name: '数据处理',
        description: 'HTTP请求→代码处理→LLM分析',
        icon: '📊',
        category: '进阶',
        nodes: [
            { id: 'node_400001', type: 'start', x: 400, y: 80, title: '开始', description: '触发数据处理' },
            { id: 'node_400002', type: 'http', x: 400, y: 200, title: '获取数据', description: '从API获取数据', parameters: { url: 'https://api.example.com/data', method: 'GET' } },
            { id: 'node_400003', type: 'code', x: 400, y: 320, title: '数据清洗', description: '清洗和转换数据格式', parameters: { code: '// 数据处理逻辑\nconst result = data.map(item => ({\n  name: item.name,\n  value: item.value * 100\n}));\nreturn result;' } },
            { id: 'node_400004', type: 'llm', x: 400, y: 440, title: '数据分析', description: 'LLM分析处理结果', parameters: { prompt: '请分析以下数据并给出洞察' } },
            { id: 'node_400005', type: 'end', x: 400, y: 560, title: '输出报告', description: '输出分析报告' }
        ],
        edges: [
            { id: 'edge_12', source: 'node_400001', target: 'node_400002' },
            { id: 'edge_13', source: 'node_400002', target: 'node_400003' },
            { id: 'edge_14', source: 'node_400003', target: 'node_400004' },
            { id: 'edge_15', source: 'node_400004', target: 'node_400005' }
        ]
    },
    {
        id: 'tpl_loop',
        name: '循环处理',
        description: '循环节点内包含子节点，逐条处理数据',
        icon: '🔄',
        category: '进阶',
        nodes: [
            { id: 'node_500001', type: 'start', x: 400, y: 80, title: '开始', description: '接收批量数据' },
            { id: 'node_500002', type: 'loop', x: 340, y: 200, title: '循环处理', description: '逐条处理数据', parameters: { loopType: 'forEach', arrayVar: '{{items}}', count: 3 } },
            { id: 'node_500003', type: 'llm', x: 420, y: 280, title: '处理单条', description: '大模型处理每条数据', parameters: { prompt: '请处理这条数据：{item}', modelName: '豆包·2.0·lite' }, parentId: 'node_500002' },
            { id: 'node_500004', type: 'code', x: 420, y: 380, title: '结果格式化', description: '格式化单条处理结果', parameters: { code: 'return { result: input, processed: true }', language: 'javascript' }, parentId: 'node_500002' },
            { id: 'node_500005', type: 'end', x: 340, y: 500, title: '汇总输出', description: '输出汇总结果' }
        ],
        edges: [
            { id: 'edge_16', source: 'node_500001', target: 'node_500002' },
            { id: 'edge_17', source: 'node_500002', target: 'node_500005' }
        ]
    },
    {
        id: 'tpl_batch',
        name: '批处理',
        description: '批量处理数据，每批独立执行子工作流',
        icon: '📤',
        category: '进阶',
        nodes: [
            { id: 'node_600001', type: 'start', x: 400, y: 80, title: '开始', description: '接收大批量数据' },
            { id: 'node_600002', type: 'batch', x: 340, y: 200, title: '批处理', description: '分批处理数据', parameters: { inputArray: '{{dataList}}', batchSize: 10 } },
            { id: 'node_600003', type: 'http', x: 420, y: 280, title: '调用API', description: '对每批数据调用外部API', parameters: { url: 'https://api.example.com/process', method: 'POST' }, parentId: 'node_600002' },
            { id: 'node_600004', type: 'llm', x: 420, y: 380, title: '结果分析', description: '分析每批处理结果', parameters: { prompt: '分析这批数据处理结果', modelName: '豆包·2.0·lite' }, parentId: 'node_600002' },
            { id: 'node_600005', type: 'end', x: 340, y: 500, title: '汇总输出', description: '输出全部结果' }
        ],
        edges: [
            { id: 'edge_19', source: 'node_600001', target: 'node_600002' },
            { id: 'edge_20', source: 'node_600002', target: 'node_600005' }
        ]
    }
];