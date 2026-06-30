/**
 * 工作流模板库
 * 预置常用工作流模板，供用户快速创建
 * 模板字段使用 i18n 键，通过 resolveTemplateI18n() 解析
 */
export const WORKFLOW_TEMPLATES = [
    {
        id: 'tpl_welcome',
        name: 'templates.tpl_welcome.name',
        description: 'templates.tpl_welcome.description',
        icon: '👋',
        category: 'templates.categories.basic',
        nodes: [
            { id: 'node_100001', type: 'start', x: 400, y: 80, title: 'templates.tpl_welcome.nodes.start.title', description: 'templates.tpl_welcome.nodes.start.desc' },
            { id: 'node_100002', type: 'llm', x: 400, y: 200, title: 'templates.tpl_welcome.nodes.llm.title', description: 'templates.tpl_welcome.nodes.llm.desc', parameters: { prompt: '请生成一条友好的欢迎消息，可以包含用户的名字' } },
            { id: 'node_100003', type: 'end', x: 400, y: 320, title: 'templates.tpl_welcome.nodes.end.title', description: 'templates.tpl_welcome.nodes.end.desc' }
        ],
        edges: [
            { id: 'edge_1', source: 'node_100001', target: 'node_100002' },
            { id: 'edge_2', source: 'node_100002', target: 'node_100003' }
        ]
    },
    {
        id: 'tpl_chatbot',
        name: 'templates.tpl_chatbot.name',
        description: 'templates.tpl_chatbot.description',
        icon: '🤖',
        category: 'templates.categories.common',
        nodes: [
            { id: 'node_200001', type: 'start', x: 400, y: 80, title: 'templates.tpl_chatbot.nodes.start.title', description: 'templates.tpl_chatbot.nodes.start.desc' },
            { id: 'node_200002', type: 'llm', x: 400, y: 200, title: 'templates.tpl_chatbot.nodes.intent.title', description: 'templates.tpl_chatbot.nodes.intent.desc', parameters: { prompt: '分析用户的问题意图，返回意图标签' } },
            { id: 'node_200003', type: 'condition', x: 300, y: 320, title: 'templates.tpl_chatbot.nodes.branch.title', description: 'templates.tpl_chatbot.nodes.branch.desc' },
            { id: 'node_200004', type: 'knowledge_query', x: 150, y: 440, title: 'templates.tpl_chatbot.nodes.knowledge.title', description: 'templates.tpl_chatbot.nodes.knowledge.desc', parameters: { query: '{{用户问题}}', topK: 5, useRerank: true, useRewrite: true, isPersonalOnly: true, enableChatHistory: false, chatHistoryRound: 3 } },
            { id: 'node_200005', type: 'llm', x: 350, y: 440, title: 'templates.tpl_chatbot.nodes.chat.title', description: 'templates.tpl_chatbot.nodes.chat.desc' },
            { id: 'node_200006', type: 'end', x: 250, y: 560, title: 'templates.tpl_chatbot.nodes.end.title', description: 'templates.tpl_chatbot.nodes.end.desc' }
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
        name: 'templates.tpl_image_gen.name',
        description: 'templates.tpl_image_gen.description',
        icon: '🖼️',
        category: 'templates.categories.common',
        nodes: [
            { id: 'node_300001', type: 'start', x: 400, y: 80, title: 'templates.tpl_image_gen.nodes.start.title', description: 'templates.tpl_image_gen.nodes.start.desc' },
            { id: 'node_300002', type: 'text', x: 400, y: 200, title: 'templates.tpl_image_gen.nodes.text.title', description: 'templates.tpl_image_gen.nodes.text.desc', parameters: { text: '一只可爱的橘猫坐在窗台边看风景' } },
            { id: 'node_300003', type: 'image_generate', x: 400, y: 320, title: 'templates.tpl_image_gen.nodes.image.title', description: 'templates.tpl_image_gen.nodes.image.desc' },
            { id: 'node_300004', type: 'end', x: 400, y: 440, title: 'templates.tpl_image_gen.nodes.end.title', description: 'templates.tpl_image_gen.nodes.end.desc' }
        ],
        edges: [
            { id: 'edge_9', source: 'node_300001', target: 'node_300002' },
            { id: 'edge_10', source: 'node_300002', target: 'node_300003' },
            { id: 'edge_11', source: 'node_300003', target: 'node_300004' }
        ]
    },
    {
        id: 'tpl_data_process',
        name: 'templates.tpl_data_process.name',
        description: 'templates.tpl_data_process.description',
        icon: '📊',
        category: 'templates.categories.advanced',
        nodes: [
            { id: 'node_400001', type: 'start', x: 400, y: 80, title: 'templates.tpl_data_process.nodes.start.title', description: 'templates.tpl_data_process.nodes.start.desc' },
            { id: 'node_400002', type: 'http', x: 400, y: 200, title: 'templates.tpl_data_process.nodes.http.title', description: 'templates.tpl_data_process.nodes.http.desc', parameters: { url: 'https://api.example.com/data', method: 'GET' } },
            { id: 'node_400003', type: 'code', x: 400, y: 320, title: 'templates.tpl_data_process.nodes.code.title', description: 'templates.tpl_data_process.nodes.code.desc', parameters: { code: '// 数据处理逻辑\nconst result = data.map(item => ({\n  name: item.name,\n  value: item.value * 100\n}));\nreturn result;' } },
            { id: 'node_400004', type: 'llm', x: 400, y: 440, title: 'templates.tpl_data_process.nodes.llm.title', description: 'templates.tpl_data_process.nodes.llm.desc', parameters: { prompt: '请分析以下数据并给出洞察' } },
            { id: 'node_400005', type: 'end', x: 400, y: 560, title: 'templates.tpl_data_process.nodes.end.title', description: 'templates.tpl_data_process.nodes.end.desc' }
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
        name: 'templates.tpl_loop.name',
        description: 'templates.tpl_loop.description',
        icon: '🔄',
        category: 'templates.categories.advanced',
        nodes: [
            { id: 'node_500001', type: 'start', x: 400, y: 80, title: 'templates.tpl_loop.nodes.start.title', description: 'templates.tpl_loop.nodes.start.desc' },
            { id: 'node_500002', type: 'loop', x: 340, y: 200, title: 'templates.tpl_loop.nodes.loop.title', description: 'templates.tpl_loop.nodes.loop.desc', parameters: { loopType: 'forEach', arrayVar: '{{items}}', count: 3 } },
            { id: 'node_500003', type: 'llm', x: 420, y: 280, title: 'templates.tpl_loop.nodes.process.title', description: 'templates.tpl_loop.nodes.process.desc', parameters: { prompt: '请处理这条数据：{item}', modelName: '豆包·2.0·lite' }, parentId: 'node_500002' },
            { id: 'node_500004', type: 'code', x: 420, y: 380, title: 'templates.tpl_loop.nodes.format.title', description: 'templates.tpl_loop.nodes.format.desc', parameters: { code: 'return { result: input, processed: true }', language: 'javascript' }, parentId: 'node_500002' },
            { id: 'node_500005', type: 'end', x: 340, y: 500, title: 'templates.tpl_loop.nodes.end.title', description: 'templates.tpl_loop.nodes.end.desc' }
        ],
        edges: [
            { id: 'edge_16', source: 'node_500001', target: 'node_500002' },
            { id: 'edge_17', source: 'node_500002', target: 'node_500005' }
        ]
    },
    {
        id: 'tpl_batch',
        name: 'templates.tpl_batch.name',
        description: 'templates.tpl_batch.description',
        icon: '📤',
        category: 'templates.categories.advanced',
        nodes: [
            { id: 'node_600001', type: 'start', x: 400, y: 80, title: 'templates.tpl_batch.nodes.start.title', description: 'templates.tpl_batch.nodes.start.desc' },
            { id: 'node_600002', type: 'batch', x: 340, y: 200, title: 'templates.tpl_batch.nodes.batch.title', description: 'templates.tpl_batch.nodes.batch.desc', parameters: { inputArray: '{{dataList}}', batchSize: 10 } },
            { id: 'node_600003', type: 'http', x: 420, y: 280, title: 'templates.tpl_batch.nodes.api.title', description: 'templates.tpl_batch.nodes.api.desc', parameters: { url: 'https://api.example.com/process', method: 'POST' }, parentId: 'node_600002' },
            { id: 'node_600004', type: 'llm', x: 420, y: 380, title: 'templates.tpl_batch.nodes.analysis.title', description: 'templates.tpl_batch.nodes.analysis.desc', parameters: { prompt: '分析这批数据处理结果', modelName: '豆包·2.0·lite' }, parentId: 'node_600002' },
            { id: 'node_600005', type: 'end', x: 340, y: 500, title: 'templates.tpl_batch.nodes.end.title', description: 'templates.tpl_batch.nodes.end.desc' }
        ],
        edges: [
            { id: 'edge_19', source: 'node_600001', target: 'node_600002' },
            { id: 'edge_20', source: 'node_600002', target: 'node_600005' }
        ]
    }
];

/**
 * 解析模板中的 i18n 键，返回翻译后的模板副本
 * @param {object} template - 模板对象
 * @param {Function} t - 翻译函数
 * @returns {object} - 翻译后的模板
 */
export function resolveTemplateI18n(template, t) {
    const resolved = { ...template };
    resolved.name = t(template.name) || template.name;
    resolved.description = t(template.description) || template.description;
    resolved.category = t(template.category) || template.category;
    resolved.nodes = template.nodes.map(node => ({
        ...node,
        title: t(node.title) || node.title,
        description: t(node.description) || node.description
    }));
    return resolved;
}