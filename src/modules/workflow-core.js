/**
 * 工作流核心模块
 * 
 * 负责管理工作流的节点、边、历史记录和验证逻辑
 * 支持13种节点类型：start、end、llm、condition、image_generate、text、code、comment、delay、http、loop、input、output、question
 */
import { TYPE_MAP, REV_TYPE_MAP } from '../utils/types.js';
import { Storage } from '../utils/helpers.js';

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
        
        /** 
         * @type {Object} 节点类型配置信息
         * 包含每种节点的标题、图标、描述、输入输出属性和参数定义
         */
        this.nodeTypeInfo = {
            start: { 
                title: '开始', icon: '🚀', description: '工作流的起始节点，设定启动参数', 
                hasInput: false, hasOutput: true,
                parameters: [
                    { name: 'inputVariables', label: '输入变量', type: 'json', defaultValue: '{}', required: false },
                    { name: 'description', label: '描述', type: 'textarea', defaultValue: '', required: false }
                ]
            },
            end: { 
                title: '结束', icon: '🏁', description: '工作流的最终节点，返回运行结果', 
                hasInput: true, hasOutput: false,
                parameters: [
                    { name: 'outputVariable', label: '输出变量', type: 'text', defaultValue: '', required: false },
                    { name: 'description', label: '描述', type: 'textarea', defaultValue: '', required: false }
                ]
            },
            llm: { 
                title: '大模型', icon: '🤖', description: '调用大语言模型生成智能回复', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'model', label: '模型名称', type: 'select', options: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'qwen'], defaultValue: 'gpt-3.5-turbo', required: true },
                    { name: 'prompt', label: '提示词', type: 'textarea', defaultValue: '', required: true },
                    { name: 'temperature', label: '温度', type: 'number', min: 0, max: 2, step: 0.1, defaultValue: 0.7, required: false },
                    { name: 'maxTokens', label: '最大Token', type: 'number', min: 1, max: 4096, defaultValue: 1024, required: false }
                ]
            },
            condition: { 
                title: '选择器', icon: '🔀', description: '根据条件选择不同执行分支', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'condition', label: '条件表达式', type: 'text', defaultValue: '', required: true },
                    { name: 'trueBranchLabel', label: '真分支标签', type: 'text', defaultValue: '是', required: false },
                    { name: 'falseBranchLabel', label: '假分支标签', type: 'text', defaultValue: '否', required: false }
                ]
            },
            image_generate: { 
                title: '图片生成', icon: '🖼️', description: '通过文字描述生成图片', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'prompt', label: '描述词', type: 'textarea', defaultValue: '', required: true },
                    { name: 'width', label: '宽度', type: 'number', min: 256, max: 1024, defaultValue: 512, required: false },
                    { name: 'height', label: '高度', type: 'number', min: 256, max: 1024, defaultValue: 512, required: false }
                ]
            },
            text: { 
                title: '文本处理', icon: '📝', description: '处理和转换字符串类型变量', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'operation', label: '操作类型', type: 'select', options: ['concat', 'replace', 'substring', 'trim', 'uppercase', 'lowercase'], defaultValue: 'concat', required: true },
                    { name: 'value', label: '操作值', type: 'text', defaultValue: '', required: false }
                ]
            },
            code: { 
                title: '代码执行', icon: '💻', description: '执行自定义JavaScript代码', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'code', label: 'JavaScript代码', type: 'code', defaultValue: '// 输入: $input\n// 输出: 返回值\nreturn $input;', required: true }
                ]
            },
            comment: { 
                title: '注释', icon: '📋', description: '添加说明注释，不参与执行', 
                hasInput: false, hasOutput: false,
                parameters: [
                    { name: 'content', label: '注释内容', type: 'textarea', defaultValue: '', required: false }
                ]
            },
            delay: { 
                title: '延迟', icon: '⏱️', description: '暂停指定时间后继续执行', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'duration', label: '延迟时间(毫秒)', type: 'number', min: 100, max: 300000, defaultValue: 1000, required: true }
                ]
            },
            http: { 
                title: 'HTTP请求', icon: '🌐', description: '发送HTTP请求获取数据', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'url', label: '请求URL', type: 'text', defaultValue: '', required: true },
                    { name: 'method', label: '请求方法', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], defaultValue: 'GET', required: true },
                    { name: 'headers', label: '请求头', type: 'json', defaultValue: '{}', required: false },
                    { name: 'body', label: '请求体', type: 'json', defaultValue: '{}', required: false }
                ]
            },
            loop: { 
                title: '循环', icon: '🔄', description: '重复执行指定次数或遍历数组', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'loopType', label: '循环类型', type: 'select', options: ['count', 'forEach'], defaultValue: 'count', required: true },
                    { name: 'count', label: '循环次数', type: 'number', min: 1, max: 100, defaultValue: 3, required: false },
                    { name: 'arrayVar', label: '数组变量', type: 'text', defaultValue: '', required: false }
                ]
            },
            input: { 
                title: '输入', icon: '📥', description: '支持中间过程的信息输入', 
                hasInput: false, hasOutput: true,
                parameters: [
                    { name: 'outputSchema', label: '输出字段', type: 'json', defaultValue: '[]', required: false }
                ]
            },
            output: { 
                title: '输出', icon: '📤', description: '支持中间过程的消息输出', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'streamingOutput', label: '流式输出', type: 'boolean', defaultValue: false, required: false },
                    { name: 'content', label: '输出内容', type: 'textarea', defaultValue: '', required: false }
                ]
            },
            question: { 
                title: '问答', icon: '❓', description: '支持中间向用户提问问题', 
                hasInput: true, hasOutput: true,
                parameters: [
                    { name: 'answer_type', label: '回答类型', type: 'select', options: ['text', 'options'], defaultValue: 'text', required: false },
                    { name: 'options', label: '选项列表', type: 'json', defaultValue: '[]', required: false },
                    { name: 'limit', label: '选项数量限制', type: 'number', min: 1, max: 10, defaultValue: 3, required: false }
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
        const info = this.nodeTypeInfo[type] || { title: '未知节点', icon: '📦', description: '', hasInput: true, hasOutput: true };
        const nodeId = `node_${++this.nodeIdCounter}`;
        
        const nodeData = {
            id: nodeId,
            type: type,
            x: x,
            y: y,
            title: data?.title || info.title,
            description: data?.description || info.description,
            parameters: data?.parameters || {}
        };
        
        this.nodes.push(nodeData);
        return nodeData;
    }
    
    /**
     * 添加节点到工作流
     * @param {object} nodeData - 节点数据对象
     * @returns {object} 添加的节点对象
     */
    addNode(nodeData) {
        this.nodes.push(nodeData);
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
     * @returns {object|null} 创建的边对象，如果已存在则返回null
     */
    createEdge(sourceId, targetId) {
        const existingEdge = this.edges.find(e => e.source === sourceId && e.target === targetId);
        if (existingEdge) return null;
        
        const edge = {
            id: `edge_${Date.now()}`,
            source: sourceId,
            target: targetId
        };
        
        this.edges.push(edge);
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
            console.warn('边已存在:', edgeData.source, '→', edgeData.target);
            return null;
        }
        this.edges.push(edgeData);
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
    }
    
    /**
     * 保存当前状态到历史记录
     * @param {string} [action='操作'] - 操作描述
     */
    saveHistory(action = '操作') {
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
    }
    
    /**
     * 重置历史记录
     * @param {string} [action='初始化'] - 操作描述
     */
    resetHistory(action = '初始化') {
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
            errors.push('缺少开始节点');
        } else if (startNodes.length > 1) {
            errors.push('只能有一个开始节点');
        }
        
        if (endNodes.length === 0) {
            errors.push('缺少结束节点');
        }
        
        this.nodes.forEach(node => {
            if (node.type !== 'start' && node.type !== 'comment') {
                const hasInput = this.edges.some(e => e.target === node.id);
                if (!hasInput && this.nodes.length > 1) {
                    errors.push(`节点 "${node.title}" 缺少输入连接`);
                }
            }
            
            if (node.type !== 'end' && node.type !== 'comment') {
                const hasOutput = this.edges.some(e => e.source === node.id);
                if (!hasOutput && this.nodes.length > 1) {
                    errors.push(`节点 "${node.title}" 缺少输出连接`);
                }
            }
        });
        
        return {
            valid: errors.length === 0,
            message: errors.join('\n'),
            errors: errors
        };
    }
    
    /**
     * 导入工作流数据
     * @param {object} workflow - 工作流数据对象
     */
    importWorkflow(workflow) {
        if (!workflow || !workflow.nodes) return;
        
        this.clearAll();
        
        const nodeIdMap = new Map();
        
        workflow.nodes.forEach(nodeData => {
            const nodeId = `node_${nodeData.id}`;
            nodeIdMap.set(nodeData.id, nodeId);
            
            const node = {
                id: nodeId,
                type: this.getTypeFromNumber(nodeData.type),
                x: nodeData.position?.x || 0,
                y: nodeData.position?.y || 0,
                title: nodeData.title || '',
                description: nodeData.description || '',
                parameters: nodeData.parameters || {}
            };
            
            this.nodes.push(node);
        });
        
        if (workflow.edges) {
            workflow.edges.forEach(edgeData => {
                const sourceId = nodeIdMap.get(edgeData.source_node);
                const targetId = nodeIdMap.get(edgeData.target_node);
                
                if (sourceId && targetId) {
                    this.createEdge(sourceId, targetId);
                }
            });
        }
    }
    
    /**
     * 导出工作流数据
     * @returns {object} 工作流数据对象
     */
    exportWorkflow() {
        return {
            schema_version: "1.0.0",
            name: "my_workflow",
            id: `workflow_${Date.now()}`,
            description: "Created with workflow editor",
            mode: "workflow",
            icon: "plugin_icon/workflow.png",
            nodes: this.nodes.map(n => ({
                id: n.id.replace('node_', ''),
                type: this.getTypeNumber(n.type),
                title: n.title,
                description: n.description,
                position: { x: n.x, y: n.y },
                parameters: n.parameters
            })),
            edges: this.edges.map(e => ({
                source_node: e.source.replace('node_', ''),
                target_node: e.target.replace('node_', '')
            }))
        };
    }
    
    /**
     * 保存到本地存储
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否保存成功
     */
    saveToLocalStorage(key = 'workflow_current') {
        const data = {
            nodes: this.nodes,
            edges: this.edges,
            nodeIdCounter: this.nodeIdCounter,
            selectedNode: this.selectedNode,
            selectedEdge: this.selectedEdge,
            savedAt: Date.now()
        };
        Storage.set(key, data);
        return true;
    }
    
    /**
     * 从本地存储加载
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否加载成功
     */
    loadFromLocalStorage(key = 'workflow_current') {
        const data = Storage.get(key);
        if (!data) {
            return false;
        }
        
        this.nodes = data.nodes || [];
        this.edges = data.edges || [];
        this.nodeIdCounter = data.nodeIdCounter || 100000;
        this.selectedNode = data.selectedNode || null;
        this.selectedEdge = data.selectedEdge || null;
        
        this.resetHistory('从本地存储加载');
        return true;
    }
    
    /**
     * 检查是否有已保存的工作流
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否存在已保存的工作流
     */
    hasSavedWorkflow(key = 'workflow_current') {
        return Storage.get(key) !== null;
    }
    
    /**
     * 清除已保存的工作流
     * @param {string} [key='workflow_current'] - 存储键名
     */
    clearSavedWorkflow(key = 'workflow_current') {
        Storage.remove(key);
    }
    
    /**
     * 从剪贴板数据加载工作流
     * @param {object} data - 剪贴板数据对象
     */
    loadFromClipboard(data) {
        if (!data || !data.json?.nodes?.length) {
            console.warn('无效的剪贴板数据');
            return;
        }
        
        this.clearAll();
        
        const idMap = {};
        
        data.json.nodes.forEach(cozeNode => {
            const originalId = String(cozeNode.id);
            const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            idMap[originalId] = newNodeId;
            
            let type = 'plugin';
            try {
                type = this.getTypeFromNumber(cozeNode.type);
            } catch (err) {
                type = 'plugin';
            }
            
            const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
            const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;
            
            const parameters = {};
            if (cozeNode.data?.outputs) {
                cozeNode.data.outputs.forEach(output => {
                    if (output.defaultValue !== undefined) {
                        parameters[output.name] = output.defaultValue;
                    }
                });
            }
            
            const title = cozeNode.data?.nodeMeta?.title || cozeNode.title || '节点';
            const description = cozeNode.data?.nodeMeta?.description || cozeNode.description || '';
            
            const newNode = {
                id: newNodeId,
                type: type,
                x: nodeX,
                y: nodeY,
                title: title,
                description: description,
                parameters: parameters,
                width: cozeNode._temp?.bounds?.width || cozeNode.width || 180,
                height: cozeNode._temp?.bounds?.height || cozeNode.height || 80
            };
            
            this.nodes.push(newNode);
        });
        
        if (data.json.edges) {
            data.json.edges.forEach(edge => {
                const sourceId = idMap[String(edge.sourceNodeID)];
                const targetId = idMap[String(edge.targetNodeID)];
                
                if (sourceId && targetId) {
                    this.createEdge(sourceId, targetId);
                }
            });
        }
        
        this.resetHistory('从剪贴板导入');
    }
}