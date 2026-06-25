/**
 * 工作流节点类型定义模块
 * 
 * 包含所有节点类型的配置信息：标题、图标、描述、参数定义
 * 支持 20+ 种节点类型，通过 i18n 实现动态翻译
 */
import { t, i18n } from '../i18n/i18n.js';

/**
 * 翻译模型名称
 * @param {string} name - 原始模型名
 * @returns {string} 翻译后的模型名
 */
function translateModelName(name) {
    const locale = i18n.getLocale();
    const modelNames = locale.modelNames || {};
    return modelNames[name] || name;
}

/**
 * 获取节点类型配置信息（动态翻译）
 * @returns {Object} 包含每种节点的标题、图标、描述、输入输出属性和参数定义
 */
export function getNodeTypeInfo() {
    const tl = (key) => t('nodeParams.' + key);
    return {
        start: { 
            title: t('nodeTypes.start'), icon: '🚀', description: t('nodeTypes.description.start'), 
            hasInput: false, hasOutput: true,
            parameters: [
                { name: 'inputVariables', label: tl('inputVariables'), type: 'json', defaultValue: '{}', required: false },
                { name: 'description', label: tl('description'), type: 'textarea', defaultValue: '', required: false }
            ]
        },
        end: { 
            title: t('nodeTypes.end'), icon: '🏁', description: t('nodeTypes.description.end'), 
            hasInput: true, hasOutput: false,
            parameters: [
                { name: 'outputVariable', label: tl('outputVariable'), type: 'text', defaultValue: '', required: false },
                { name: 'description', label: tl('description'), type: 'textarea', defaultValue: '', required: false }
            ]
        },
        llm: { 
            title: t('nodeTypes.llm'), icon: '🤖', description: t('nodeTypes.description.llm'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'modelName', label: tl('modelName'), type: 'select', options: ['GLM-4.7', '豆包·2.0·pro', '豆包·2.0·lite', '豆包·2.0·mini', '豆包·1.8·深度思考', '豆包·1.6·思考深度调节', 'DeepSeek-V3.2'].map(m => ({ value: m, label: translateModelName(m) })), defaultValue: '豆包·2.0·lite', required: true },
                { name: 'systemPrompt', label: tl('systemPrompt'), type: 'textarea', defaultValue: '', required: false },
                { name: 'prompt', label: tl('prompt'), type: 'textarea', defaultValue: '', required: true },
                { name: 'temperature', label: tl('temperature'), type: 'number', min: 0, max: 2, step: 0.1, defaultValue: 0.7, required: false },
                { name: 'maxTokens', label: tl('maxTokens'), type: 'number', min: 1, max: 4096, defaultValue: 1024, required: false }
            ]
        },
        condition: { 
            title: t('nodeTypes.condition'), icon: '🔀', description: t('nodeTypes.description.condition'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'condition', label: tl('condition'), type: 'text', defaultValue: '', required: true },
                { name: 'trueBranchLabel', label: tl('trueBranchLabel'), type: 'text', defaultValue: t('messages.yes'), required: false },
                { name: 'falseBranchLabel', label: tl('falseBranchLabel'), type: 'text', defaultValue: t('messages.no'), required: false }
            ]
        },
        image_generate: { 
            title: t('nodeTypes.image_generate'), icon: '🖼️', description: t('nodeTypes.description.image_generate'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'prompt', label: tl('imagePrompt'), type: 'textarea', defaultValue: '', required: true },
                { name: 'width', label: tl('width'), type: 'number', min: 256, max: 1024, defaultValue: 512, required: false },
                { name: 'height', label: tl('height'), type: 'number', min: 256, max: 1024, defaultValue: 512, required: false }
            ]
        },
        text: { 
            title: t('nodeTypes.text'), icon: '📝', description: t('nodeTypes.description.text'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'operation', label: tl('operation'), type: 'select', options: ['concat', 'replace', 'substring', 'trim', 'uppercase', 'lowercase'], defaultValue: 'concat', required: true },
                { name: 'value', label: tl('value'), type: 'text', defaultValue: '', required: false }
            ]
        },
        code: { 
            title: t('nodeTypes.code'), icon: '💻', description: t('nodeTypes.description.code'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'code', label: tl('code'), type: 'code', defaultValue: '// Input: $input\n// Output: return value\nreturn $input;', required: true }
            ]
        },
        comment: { 
            title: t('nodeTypes.comment'), icon: '📋', description: t('nodeTypes.description.comment'), 
            hasInput: false, hasOutput: false,
            parameters: [
                { name: 'content', label: tl('content'), type: 'textarea', defaultValue: '', required: false }
            ]
        },
        delay: { 
            title: t('nodeTypes.delay'), icon: '⏱️', description: t('nodeTypes.description.delay'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'duration', label: tl('duration'), type: 'number', min: 100, max: 300000, defaultValue: 1000, required: true }
            ]
        },
        http: { 
            title: t('nodeTypes.http'), icon: '🌐', description: t('nodeTypes.description.http'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'url', label: tl('url'), type: 'text', defaultValue: '', required: true },
                { name: 'method', label: tl('method'), type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], defaultValue: 'GET', required: true },
                { name: 'headers', label: tl('headers'), type: 'json', defaultValue: '{}', required: false },
                { name: 'body', label: tl('body'), type: 'json', defaultValue: '{}', required: false }
            ]
        },
        loop: { 
            title: t('nodeTypes.loop'), icon: '🔄', description: t('nodeTypes.description.loop'), 
            hasInput: true, hasOutput: true, hasContainer: true, containerMinWidth: 300, containerMinHeight: 200,
            parameters: [
                { name: 'loopType', label: tl('loopType'), type: 'select', options: ['count', 'forEach'], defaultValue: 'count', required: true },
                { name: 'count', label: tl('count'), type: 'number', min: 1, max: 100, defaultValue: 3, required: false },
                { name: 'arrayVar', label: tl('arrayVar'), type: 'text', defaultValue: '', required: false }
            ]
        },
        input: { 
            title: t('nodeTypes.input'), icon: '📥', description: t('nodeTypes.description.input'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'outputSchema', label: tl('outputSchema'), type: 'json', defaultValue: '[]', required: false }
            ]
        },
        output: { 
            title: t('nodeTypes.output'), icon: '📤', description: t('nodeTypes.description.output'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'streamingOutput', label: tl('streamingOutput'), type: 'boolean', defaultValue: false, required: false },
                { name: 'content', label: tl('content'), type: 'textarea', defaultValue: '', required: false }
            ]
        },
        question: { 
            title: t('nodeTypes.question'), icon: '❓', description: t('nodeTypes.description.question'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'answer_type', label: tl('answer_type'), type: 'select', options: ['text', 'options'], defaultValue: 'text', required: false },
                { name: 'options', label: tl('options'), type: 'json', defaultValue: '[]', required: false },
                { name: 'limit', label: tl('limit'), type: 'number', min: 1, max: 10, defaultValue: 3, required: false }
            ]
        },
        variable_assign: { 
            title: t('nodeTypes.variable_assign'), icon: '📦', description: t('nodeTypes.description.variable_assign'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'variables', label: tl('variables'), type: 'json', defaultValue: '{}', required: true }
            ]
        },
        variable_merge: { 
            title: t('nodeTypes.variable_merge'), icon: '🔗', description: t('nodeTypes.description.variable_merge'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'mergeStrategy', label: tl('mergeStrategy'), type: 'select', options: ['overwrite', 'merge', 'first'], defaultValue: 'merge', required: false }
            ]
        },
        batch: { 
            title: t('nodeTypes.batch'), icon: '📤', description: t('nodeTypes.description.batch'), 
            hasInput: true, hasOutput: true, hasContainer: true, containerMinWidth: 300, containerMinHeight: 200,
            parameters: [
                { name: 'inputArray', label: tl('inputArray'), type: 'text', defaultValue: '', required: true },
                { name: 'batchSize', label: tl('batchSize'), type: 'number', min: 1, max: 100, defaultValue: 10, required: false }
            ]
        },
        knowledge_query: { 
            title: t('nodeTypes.knowledge_query'), icon: '📚', description: t('nodeTypes.description.knowledge_query'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'text', defaultValue: '', required: true },
                { name: 'datasetList', label: tl('datasetList'), type: 'json', defaultValue: '[]', required: true },
                { name: 'topK', label: tl('topK'), type: 'number', min: 1, max: 20, defaultValue: 5, required: false },
                { name: 'useRerank', label: tl('useRerank'), type: 'boolean', defaultValue: true, required: false },
                { name: 'useRewrite', label: tl('useRewrite'), type: 'boolean', defaultValue: true, required: false },
                { name: 'isPersonalOnly', label: tl('isPersonalOnly'), type: 'boolean', defaultValue: true, required: false },
                { name: 'enableChatHistory', label: tl('enableChatHistory'), type: 'boolean', defaultValue: false, required: false },
                { name: 'chatHistoryRound', label: tl('chatHistoryRound'), type: 'number', min: 1, max: 20, defaultValue: 3, required: false }
            ]
        },
        intent: { 
            title: t('nodeTypes.intent'), icon: '🧠', description: t('nodeTypes.description.intent'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'categories', label: tl('categories'), type: 'json', defaultValue: '[]', required: true },
                { name: 'input', label: tl('input'), type: 'text', defaultValue: '', required: true }
            ]
        },
        break: { 
            title: t('nodeTypes.break'), icon: '⏹️', description: t('nodeTypes.description.break'), 
            hasInput: true, hasOutput: false,
            parameters: []
        },
        loop_set_variable: { 
            title: t('nodeTypes.loop_set_variable'), icon: '📦', description: t('nodeTypes.description.loop_set_variable'), 
            hasInput: true, hasOutput: false,
            parameters: [
                { name: 'variables', label: tl('variables'), type: 'json', defaultValue: '{}', required: true }
            ]
        },
        loop_continue: { 
            title: t('nodeTypes.loop_continue'), icon: '🔄', description: t('nodeTypes.description.loop_continue'), 
            hasInput: true, hasOutput: false,
            parameters: []
        },
        plugin: { 
            title: t('nodeTypes.plugin'), icon: '🔌', description: t('nodeTypes.description.plugin'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'pluginId', label: tl('pluginId'), type: 'text', defaultValue: '', required: true },
                { name: 'pluginParams', label: tl('pluginParams'), type: 'json', defaultValue: '{}', required: false }
            ]
        },
        async_task: { 
            title: t('nodeTypes.async_task'), icon: '⏳', description: t('nodeTypes.description.async_task'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'taskType', label: tl('taskType'), type: 'text', defaultValue: '', required: true },
                { name: 'timeout', label: tl('timeout'), type: 'number', min: 1, max: 3600, defaultValue: 300, required: false },
                { name: 'pollInterval', label: tl('pollInterval'), type: 'number', min: 1, max: 60, defaultValue: 5, required: false }
            ]
        },
        video_generation: { 
            title: t('nodeTypes.video_generation'), icon: '🎬', description: t('nodeTypes.description.video_generation'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'prompt', label: tl('imagePrompt'), type: 'textarea', defaultValue: '', required: true },
                { name: 'duration', label: tl('duration'), type: 'number', min: 1, max: 60, defaultValue: 5, required: false },
                { name: 'resolution', label: tl('resolution'), type: 'select', options: ['720p', '1080p'], defaultValue: '720p', required: false }
            ]
        },
        database: { 
            title: t('nodeTypes.database'), icon: '🗄️', description: t('nodeTypes.description.database'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'dbType', label: tl('dbType'), type: 'select', options: ['mysql', 'postgresql', 'mongodb', 'redis'], defaultValue: 'mysql', required: true },
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'SELECT * FROM table', required: true },
                { name: 'connection', label: tl('connection'), type: 'json', defaultValue: '{}', required: true }
            ]
        },
        email: { 
            title: t('nodeTypes.email'), icon: '📧', description: t('nodeTypes.description.email'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'to', label: tl('to'), type: 'text', defaultValue: '', required: true },
                { name: 'subject', label: tl('subject'), type: 'text', defaultValue: '', required: true },
                { name: 'body', label: tl('body'), type: 'textarea', defaultValue: '', required: true },
                { name: 'isHtml', label: tl('isHtml'), type: 'boolean', defaultValue: false, required: false }
            ]
        },
        webhook: { 
            title: t('nodeTypes.webhook'), icon: '🪝', description: t('nodeTypes.description.webhook'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'url', label: tl('url'), type: 'text', defaultValue: '', required: true },
                { name: 'payload', label: tl('payload'), type: 'json', defaultValue: '{}', required: false },
                { name: 'secret', label: tl('secret'), type: 'text', defaultValue: '', required: false }
            ]
        },
        json_parse: { 
            title: t('nodeTypes.json_parse'), icon: '🔍', description: t('nodeTypes.description.json_parse'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'input', label: tl('input'), type: 'json', defaultValue: '{}', required: true },
                { name: 'schema', label: tl('schema'), type: 'json', defaultValue: '{}', required: false }
            ]
        },
        workflow: { 
            title: t('nodeTypes.workflow'), icon: '🔗', description: t('nodeTypes.description.workflow'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        sql_exec: { 
            title: t('nodeTypes.sql_exec'), icon: '🗄️', description: t('nodeTypes.description.sql_exec'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'SELECT * FROM table', required: true }
            ]
        },
        canvas: { 
            title: t('nodeTypes.canvas'), icon: '🎨', description: t('nodeTypes.description.canvas'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        knowledge_write: { 
            title: t('nodeTypes.knowledge_write'), icon: '📝', description: t('nodeTypes.description.knowledge_write'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'datasetList', label: tl('datasetList'), type: 'json', defaultValue: '[]', required: true }
            ]
        },
        knowledge_delete: { 
            title: t('nodeTypes.knowledge_delete'), icon: '🗑️', description: t('nodeTypes.description.knowledge_delete'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'datasetList', label: tl('datasetList'), type: 'json', defaultValue: '[]', required: true }
            ]
        },
        clear_conversation: { 
            title: t('nodeTypes.clear_conversation'), icon: '🗑️', description: t('nodeTypes.description.clear_conversation'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        create_conversation: { 
            title: t('nodeTypes.create_conversation'), icon: '💬', description: t('nodeTypes.description.create_conversation'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        db_update: { 
            title: t('nodeTypes.db_update'), icon: '🔄', description: t('nodeTypes.description.db_update'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'UPDATE table SET ...', required: true }
            ]
        },
        db_select: { 
            title: t('nodeTypes.db_select'), icon: '🔍', description: t('nodeTypes.description.db_select'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'SELECT * FROM table', required: true }
            ]
        },
        db_delete: { 
            title: t('nodeTypes.db_delete'), icon: '🗑️', description: t('nodeTypes.description.db_delete'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'DELETE FROM table', required: true }
            ]
        },
        db_insert: { 
            title: t('nodeTypes.db_insert'), icon: '➕', description: t('nodeTypes.description.db_insert'), 
            hasInput: true, hasOutput: true,
            parameters: [
                { name: 'query', label: tl('query'), type: 'code', defaultValue: 'INSERT INTO table ...', required: true }
            ]
        },
        update_conversation: { 
            title: t('nodeTypes.update_conversation'), icon: '✏️', description: t('nodeTypes.description.update_conversation'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        delete_conversation: { 
            title: t('nodeTypes.delete_conversation'), icon: '🗑️', description: t('nodeTypes.description.delete_conversation'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        list_conversation: { 
            title: t('nodeTypes.list_conversation'), icon: '📋', description: t('nodeTypes.description.list_conversation'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        get_conversation_history: { 
            title: t('nodeTypes.get_conversation_history'), icon: '📜', description: t('nodeTypes.description.get_conversation_history'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        create_message: { 
            title: t('nodeTypes.create_message'), icon: '💬', description: t('nodeTypes.description.create_message'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        update_message: { 
            title: t('nodeTypes.update_message'), icon: '✏️', description: t('nodeTypes.description.update_message'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        delete_message: { 
            title: t('nodeTypes.delete_message'), icon: '🗑️', description: t('nodeTypes.description.delete_message'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        json_serialize: { 
            title: t('nodeTypes.json_serialize'), icon: '📦', description: t('nodeTypes.description.json_serialize'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        json_deserialize: { 
            title: t('nodeTypes.json_deserialize'), icon: '📤', description: t('nodeTypes.description.json_deserialize'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        video_extract_audio: { 
            title: t('nodeTypes.video_extract_audio'), icon: '🎵', description: t('nodeTypes.description.video_extract_audio'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        video_extract_frame: { 
            title: t('nodeTypes.video_extract_frame'), icon: '🖼️', description: t('nodeTypes.description.video_extract_frame'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        memory_write: { 
            title: t('nodeTypes.memory_write'), icon: '🧠', description: t('nodeTypes.description.memory_write'), 
            hasInput: true, hasOutput: true,
            parameters: []
        },
        memory_read: { 
            title: t('nodeTypes.memory_read'), icon: '📖', description: t('nodeTypes.description.memory_read'), 
            hasInput: true, hasOutput: true,
            parameters: []
        }
    };
}