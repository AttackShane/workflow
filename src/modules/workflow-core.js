import { TYPE_MAP, REV_TYPE_MAP } from '../utils/types.js';

export class WorkflowCore {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 100000;
        this.selectedNode = null;
        this.selectedEdge = null;
        
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
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
                    { name: 'code', label: 'JavaScript代码', type: 'code', defaultValue: '// 输入: $input\\n// 输出: 返回值\\nreturn $input;', required: true }
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
    
    addNode(nodeData) {
        this.nodes.push(nodeData);
        return nodeData;
    }
    
    deleteNode(nodeId) {
        this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
        }
    }
    
    updateNodePosition(nodeId, x, y) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.x = x;
            node.y = y;
        }
    }
    
    updateNodeProperty(nodeId, key, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node[key] = value;
        }
    }
    
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
    
    addEdge(edgeData) {
        const existingEdge = this.edges.find(e => e.source === edgeData.source && e.target === edgeData.target);
        if (existingEdge) {
            console.warn('边已存在:', edgeData.source, '→', edgeData.target);
            return null;
        }
        this.edges.push(edgeData);
        return edgeData;
    }
    
    deleteEdge(edgeId) {
        this.edges = this.edges.filter(e => e.id !== edgeId);
        if (this.selectedEdge === edgeId) {
            this.selectedEdge = null;
        }
    }
    
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
    
    resetHistory(action = '初始化') {
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory(action);
    }
    
    canUndo() {
        return this.historyIndex > 0;
    }
    
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
    
    undo() {
        if (!this.canUndo()) return false;
        
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        
        // 使用深拷贝避免污染历史记录
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.selectedNode = state.selectedNode;
        this.selectedEdge = state.selectedEdge;
        
        return true;
    }
    
    redo() {
        if (!this.canRedo()) return false;
        
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        
        // 使用深拷贝避免污染历史记录
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.selectedNode = state.selectedNode;
        this.selectedEdge = state.selectedEdge;
        
        return true;
    }
    
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        this.selectedEdge = null;
    }
    
    selectEdge(edgeId) {
        this.selectedEdge = edgeId;
        this.selectedNode = null;
    }
    
    clearAll() {
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.selectedEdge = null;
    }
    
    getTypeNumber(type) {
        return TYPE_MAP[type] || '4';
    }
    
    getTypeFromNumber(typeNum) {
        return REV_TYPE_MAP[String(typeNum)] || 'plugin';
    }
    
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
    
    saveToLocalStorage(key = 'workflow_current') {
        const data = {
            nodes: this.nodes,
            edges: this.edges,
            nodeIdCounter: this.nodeIdCounter,
            selectedNode: this.selectedNode,
            selectedEdge: this.selectedEdge,
            savedAt: Date.now()
        };
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('保存失败:', error);
            return false;
        }
    }
    
    loadFromLocalStorage(key = 'workflow_current') {
        try {
            const data = localStorage.getItem(key);
            if (!data) {
                return false;
            }
            
            const parsed = JSON.parse(data);
            
            this.nodes = parsed.nodes || [];
            this.edges = parsed.edges || [];
            this.nodeIdCounter = parsed.nodeIdCounter || 100000;
            this.selectedNode = parsed.selectedNode || null;
            this.selectedEdge = parsed.selectedEdge || null;
            
            this.resetHistory('从本地存储加载');
            return true;
        } catch (error) {
            console.error('加载失败:', error);
            return false;
        }
    }
    
    hasSavedWorkflow(key = 'workflow_current') {
        return localStorage.getItem(key) !== null;
    }
    
    clearSavedWorkflow(key = 'workflow_current') {
        localStorage.removeItem(key);
    }
    
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