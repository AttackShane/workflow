/**
 * 工作流核心模块
 * 
 * 负责管理工作流的节点、边、历史记录和验证逻辑
 * 节点类型定义由 workflow-node-types.js 提供
 */
import { TYPE_MAP, REV_TYPE_MAP, resolveNodeType } from '../utils/types.js';
import { t } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { deepClone } from '../utils/helpers.js';
import { mixinStorage } from './workflow-storage.js';
import { mixinSerializer } from './workflow-serializer.js';
import { getNodeTypeInfo } from './workflow-node-types.js';

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
        return getNodeTypeInfo();
    }
    
    /**
     * 创建新节点
     * @param {string} type - 节点类型
     * @param {number} x - 节点X坐标
     * @param {number} y - 节点Y坐标
     * @param {object|null} [data] - 节点初始数据
     * @returns {object} 创建的节点对象
     */
    _getDefaultParameters(type) {
        const info = this.nodeTypeInfo[type];
        if (!info || !info.parameters) return {};
        const defaults = {};
        info.parameters.forEach(param => {
            if (param.defaultValue !== undefined) {
                defaults[param.name] = param.defaultValue;
            }
        });
        return defaults;
    }

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
            parameters: data?.parameters || this._getDefaultParameters(type),
            inputParams: data?.inputParams || [],
            outputParams: data?.outputParams || [],
            parentId: data?.parentId || null
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
        const childIds = this.getChildNodes(nodeId).map(n => n.id);
        childIds.forEach(cid => this.deleteNode(cid));
        this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
        }
        this._emitChange('deleteNode', nodeId);
    }

    /**
     * 获取指定节点的所有子节点
     * @param {string} parentId - 父节点ID
     * @returns {Array} 子节点数组
     */
    getChildNodes(parentId) {
        return this.nodes.filter(n => n.parentId === parentId);
    }

    /**
     * 检查节点是否为容器节点
     * @param {string} nodeId - 节点ID
     * @returns {boolean}
     */
    isContainerNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return false;
        const info = this.nodeTypeInfo[node.type];
        return info?.hasContainer === true;
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
    createEdge(sourceId, targetId, sourcePort = '', targetPort = '') {
        const existingEdge = this.edges.find(e => e.source === sourceId && e.target === targetId);
        if (existingEdge) return null;

        // 容器端口校验：外部端口只能连外部节点，内部端口只能连容器内子节点
        const sourceIsContainer = this.isContainerNode(sourceId);
        const targetIsContainer = this.isContainerNode(targetId);
        const sourceIsChild = !!this.nodes.find(n => n.id === sourceId)?.parentId;
        const targetIsChild = !!this.nodes.find(n => n.id === targetId)?.parentId;

        if (sourceIsContainer) {
            const isInternalPort = sourcePort === 'container_start';
            if (isInternalPort && !targetIsChild) return null;
            if (!isInternalPort && targetIsChild) return null;
        }
        if (targetIsContainer) {
            const isInternalPort = targetPort === 'container_end';
            if (isInternalPort && !sourceIsChild) return null;
            if (!isInternalPort && sourceIsChild) return null;
        }

        const edge = {
            id: `edge_${++this.edgeIdCounter}`,
            source: sourceId,
            target: targetId
        };
        if (sourcePort) {
            edge.sourcePort = sourcePort;
        }
        if (targetPort) {
            edge.targetPort = targetPort;
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
        const existingEdge = this.edges.find(e =>
            e.source === edgeData.source &&
            e.target === edgeData.target &&
            (e.sourcePort || '') === (edgeData.sourcePort || '') &&
            (e.targetPort || '') === (edgeData.targetPort || '')
        );
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
            nodes: deepClone(this.nodes),
            edges: deepClone(this.edges),
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
        
        this.nodes = deepClone(state.nodes);
        this.edges = deepClone(state.edges);
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
        
        this.nodes = deepClone(state.nodes);
        this.edges = deepClone(state.edges);
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
        this._emitChange('selection');
    }
    
    /**
     * 选择边
     * @param {string|null} edgeId - 边ID，null表示取消选择
     */
    selectEdge(edgeId) {
        this.selectedEdge = edgeId;
        this.selectedNode = null;
        this._emitChange('selection');
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
        return resolveNodeType(type);
    }
    
    /**
     * 从数字标识获取节点类型名称
     * @param {string|number} typeNum - 数字标识
     * @returns {string} 节点类型名称
     */
    getTypeFromNumber(typeNum) {
        const typeStr = String(typeNum);
        const typeName = REV_TYPE_MAP[typeStr];
        if (!typeName) {
            throw new Error(`Unknown node type number "${typeNum}"`);
        }
        return typeName;
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