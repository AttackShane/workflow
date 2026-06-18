/**
 * 工作流核心模块
 * 
 * 负责管理工作流的节点、边、历史记录和验证逻辑
 * 支持13种节点类型：start、end、llm、condition、image_generate、text、code、comment、delay、http、loop、input、output、question
 */
import { TYPE_MAP, REV_TYPE_MAP } from '../utils/types.js';
import { t, i18n } from '../i18n/i18n.js';
import { mixinStorage } from './workflow-storage.js';
import { mixinSerializer } from './workflow-serializer.js';

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

export class WorkflowCore {
    /**
     * 构造函数
     */
    constructor() {
        /** @type {Array} 节点数组 */
        this.nodes = [];
        /** @type {Array} 边数组 */
        this.edges = [];
        /** @type {number} 节点ID计数器 */
        this.nodeIdCounter = 100000;
        /** @type {number} 边ID计数器 */
        this.edgeIdCounter = 100000;
        /** @type {string|null} 当前选中的节点ID */
        this.selectedNode = null;
        /** @type {string|null} 当前选中的边ID */
        this.selectedEdge = null;
        
        /** @type {Array} 历史记录数组 */
        this.history = [];
        /** @type {number} 当前历史记录索引 */
        this.historyIndex = -1;
        /** @type {number} 最大历史记录数量 */
        this.maxHistory = 50;

        /** @type {Function|null} 数据变更回调 */
        this._onChange = null;
        /** @type {boolean} 是否批量操作中 */
        this._batchMode = false;
        
        mixinStorage(this);
        mixinSerializer(this);
    }

    /**
     * 设置数据变更回调
     * @param {Function} fn - 回调函数 (action, data) => void
     */
    set onChange(fn) {
        this._onChange = fn;
    }

    /**
     * 触发变更通知
     * @param {string} action - 操作类型
     * @param {*} [data] - 附加数据
     */
    _emitChange(action, data) {
        if (this._onChange && !this._batchMode) {
            this._onChange(action, data);
        }
    }

    /**
     * 批量操作：在回调中批量修改数据，完成后统一触发一次刷新
     * @param {Function} fn - 批量操作函数
     */
    batchChanges(fn) {
        this._batchMode = true;
        try {
            fn();
        } finally {
            this._batchMode = false;
            if (this._onChange) {
                this._onChange('batch', null);
            }
        }
    }

    /**
     * 获取节点类型配置信息（动态翻译）
     * @returns {Object} 包含每种节点的标题、图标、描述、输入输出属性和参数定义
     */
    get nodeTypeInfo() {
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
                hasInput: true, hasOutput: true,
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
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'inputArray', label: tl('inputArray'), type: 'text', defaultValue: '', required: true },
                    { name: 'batchSize', label: tl('batchSize'), type: 'number', min: 1, max: 100, defaultValue: 10, required: false }
                ]
            },
            knowledge: { 
                title: t('nodeTypes.knowledge'), icon: '📚', description: t('nodeTypes.description.knowledge'), 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'query', label: tl('query'), type: 'text', defaultValue: '', required: true },
                    { name: 'knowledgeId', label: tl('knowledgeId'), type: 'text', defaultValue: '', required: true },
                    { name: 'topK', label: tl('topK'), type: 'number', min: 1, max: 20, defaultValue: 5, required: false }
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
                parameters: [
                    { name: 'condition', label: tl('condition'), type: 'text', defaultValue: '', required: false }
                ]
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
            }
        };
    }
    
    /**
     * 创建新节点
     * @param {string} type - 节点类型
     * @param {number} x - 节点X坐标
     * @param {number} y - 节点Y坐标
     * @param {object|null} [data] - 节点初始数据
     * @returns {object} 创建的节点对象
     */
    createNode(type, x, y, data = null) {
        const info = this.nodeTypeInfo[type] || { title: t('messages.unknownNode'), icon: '📦', description: '', hasInput: true, hasOutput: true };
        const nodeId = `node_${++this.nodeIdCounter}`;
        
        const nodeData = {
            id: nodeId,
            type: type,
            x: x,
            y: y,
            title: data?.title || info.title,
            description: data?.description || info.description,
            parameters: data?.parameters || {},
            inputParams: data?.inputParams || [],
            outputParams: data?.outputParams || []
        };
        
        this.nodes.push(nodeData);
        this._emitChange('addNode', nodeData);
        return nodeData;
    }
    
    /**
     * 添加节点到工作流
     * @param {object} nodeData - 节点数据对象
     * @returns {object} 添加的节点对象
     */
    addNode(nodeData) {
        this.nodes.push(nodeData);
        this._emitChange('addNode', nodeData);
        return nodeData;
    }
    
    /**
     * 删除节点及相关边
     * @param {string} nodeId - 节点ID
     */
    deleteNode(nodeId) {
        this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
        }
        this._emitChange('deleteNode', nodeId);
    }
    
    /**
     * 更新节点位置
     * @param {string} nodeId - 节点ID
     * @param {number} x - 新的X坐标
     * @param {number} y - 新的Y坐标
     */
    updateNodePosition(nodeId, x, y) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.x = x;
            node.y = y;
        }
    }
    
    /**
     * 更新节点属性
     * @param {string} nodeId - 节点ID
     * @param {string} key - 属性名称
     * @param {*} value - 属性值
     */
    updateNodeProperty(nodeId, key, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node[key] = value;
        }
    }
    
    /**
     * 创建新边
     * @param {string} sourceId - 源节点ID
     * @param {string} targetId - 目标节点ID
     * @param {string} sourcePort - 源端口ID（可选，用于分支节点）
     * @returns {object|null} 创建的边对象，如果已存在则返回null
     */
    createEdge(sourceId, targetId, sourcePort = '') {
        const existingEdge = this.edges.find(e => e.source === sourceId && e.target === targetId);
        if (existingEdge) return null;
        
        const edge = {
            id: `edge_${++this.edgeIdCounter}`,
            source: sourceId,
            target: targetId
        };
        if (sourcePort) {
            edge.sourcePort = sourcePort;
        }
        
        this.edges.push(edge);
        this._emitChange('createEdge', edge);
        return edge;
    }
    
    /**
     * 添加边到工作流
     * @param {object} edgeData - 边数据对象
     * @returns {object|null} 添加的边对象，如果已存在则返回null
     */
    addEdge(edgeData) {
        const existingEdge = this.edges.find(e => e.source === edgeData.source && e.target === edgeData.target);
        if (existingEdge) {
            Logger.warn('边已存在:', edgeData.source, '→', edgeData.target);
            return null;
        }
        this.edges.push(edgeData);
        this._emitChange('addEdge', edgeData);
        return edgeData;
    }
    
    /**
     * 删除边
     * @param {string} edgeId - 边ID
     */
    deleteEdge(edgeId) {
        this.edges = this.edges.filter(e => e.id !== edgeId);
        if (this.selectedEdge === edgeId) {
            this.selectedEdge = null;
        }
        this._emitChange('deleteEdge', edgeId);
    }
    
    /**
     * 保存当前状态到历史记录
     * @param {string} [action='操作'] - 操作描述
     */
    saveHistory(action = t('messages.defaultAction')) {
        const state = {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            edges: JSON.parse(JSON.stringify(this.edges)),
            selectedNode: this.selectedNode,
            selectedEdge: this.selectedEdge,
            action: action,
            timestamp: Date.now()
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        } else {
            this.historyIndex = this.history.length - 1;
        }
        this._emitChange('history');
    }
    
    /**
     * 重置历史记录
     * @param {string} [action='初始化'] - 操作描述
     */
    resetHistory(action = t('messages.initAction')) {
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory(action);
    }
    
    /**
     * 检查是否可以撤销
     * @returns {boolean} 是否可以撤销
     */
    canUndo() {
        return this.historyIndex > 0;
    }
    
    /**
     * 检查是否可以重做
     * @returns {boolean} 是否可以重做
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
    
    /**
     * 撤销操作
     * @returns {boolean} 是否撤销成功
     */
    undo() {
        if (!this.canUndo()) return false;
        
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.selectedNode = state.selectedNode;
        this.selectedEdge = state.selectedEdge;
        
        this._emitChange('undo');
        return true;
    }
    
    /**
     * 重做操作
     * @returns {boolean} 是否重做成功
     */
    redo() {
        if (!this.canRedo()) return false;
        
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.selectedNode = state.selectedNode;
        this.selectedEdge = state.selectedEdge;
        
        this._emitChange('redo');
        return true;
    }
    
    /**
     * 选择节点
     * @param {string|null} nodeId - 节点ID，null表示取消选择
     */
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        this.selectedEdge = null;
    }
    
    /**
     * 选择边
     * @param {string|null} edgeId - 边ID，null表示取消选择
     */
    selectEdge(edgeId) {
        this.selectedEdge = edgeId;
        this.selectedNode = null;
    }
    
    /**
     * 清空所有节点和边
     */
    clearAll() {
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.selectedEdge = null;
        this._emitChange('clearAll');
    }
    
    /**
     * 获取节点类型对应的数字标识
     * @param {string} type - 节点类型名称
     * @returns {string} 数字标识
     */
    getTypeNumber(type) {
        return TYPE_MAP[type] || '4';
    }
    
    /**
     * 从数字标识获取节点类型名称
     * @param {string|number} typeNum - 数字标识
     * @returns {string} 节点类型名称
     */
    getTypeFromNumber(typeNum) {
        return REV_TYPE_MAP[String(typeNum)] || 'plugin';
    }
    
    /**
     * 验证工作流的有效性
     * @returns {object} 验证结果 { valid, message, errors }
     */
    validate() {
        const errors = [];
        const startNodes = this.nodes.filter(n => n.type === 'start');
        const endNodes = this.nodes.filter(n => n.type === 'end');
        
        if (startNodes.length === 0) {
            errors.push(t('editor.errorNoStartNode'));
        } else if (startNodes.length > 1) {
            errors.push(t('editor.errorMultipleStartNodes'));
        }
        
        if (endNodes.length === 0) {
            errors.push(t('editor.errorNoEndNode'));
        }
        
        this.nodes.forEach(node => {
            if (node.type !== 'start' && node.type !== 'comment' && node.type !== 'input') {
                const hasInput = this.edges.some(e => e.target === node.id);
                if (!hasInput && this.nodes.length > 1) {
                    errors.push(t('editor.errorNoInput', { title: node.title }));
                }
            }
            
            if (node.type !== 'end' && node.type !== 'comment' && node.type !== 'break') {
                const hasOutput = this.edges.some(e => e.source === node.id);
                if (!hasOutput && this.nodes.length > 1) {
                    errors.push(t('editor.errorNoOutput', { title: node.title }));
                }
            }
        });
        
        return {
            valid: errors.length === 0,
            message: errors.join('\n'),
            errors: errors
        };
    }
}