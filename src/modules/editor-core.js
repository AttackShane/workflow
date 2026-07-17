/**
 * 工作流核心模块
 *
 * 负责管理工作流的节点、边、历史记录和验证逻辑
 * 节点类型定义由 editor-node-types.js 提供
 * @typedef {import('../types/workflow.js').WorkflowNode WorkflowNode}
 * @typedef {import('../types/workflow.js').WorkflowEdge WorkflowEdge}
 * @typedef {import('../types/workflow.js').HistoryState HistoryState}
 * @typedef {import('../types/workflow.js').NodeTypeInfo NodeTypeInfo}
 * @typedef {import('../types/workflow.js').WorkflowData WorkflowData}
 * @typedef {import('../types/workflow.js').ChangeCallback ChangeCallback}
 */
import { REV_TYPE_MAP, resolveNodeType } from '../utils/types.js';
import { t } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { deepClone } from '../utils/helpers.js';
import { WorkflowStorage } from './editor-storage.js';
import { WorkflowSerializer } from './shared-serializer.js';
import { WorkflowContainer } from './editor-container.js';
import { getNodeTypeInfo } from './editor-node-types.js';

export class WorkflowCore {
    /**
     * 构造函数
     */
    constructor() {
        /** @type {WorkflowNode[]} 节点数组 */
        this.nodes = [];
        /** @type {WorkflowEdge[]} 边数组 */
        this.edges = [];
        /** @type {number} 节点ID计数器 */
        this.nodeIdCounter = 100000;
        /** @type {number} 边ID计数器 */
        this.edgeIdCounter = 100000;
        /** @type {string|null} 当前选中的节点ID */
        this.selectedNode = null;
        /** @type {string|null} 当前选中的边ID */
        this.selectedEdge = null;

        /** @type {HistoryState[]} 历史记录数组 */
        this.history = [];
        /** @type {number} 当前历史记录索引 */
        this.historyIndex = -1;
        /** @type {number} 最大历史记录数量 */
        this.maxHistory = 50;
        /** @type {number} 操作合并时间窗口（毫秒），相同操作在此窗口内自动合并 */
        this._historyMergeWindow = 1500;
        /** @type {string|null} 上一次保存历史的操作键，用于合并判断 */
        this._lastHistoryAction = null;
        /** @type {number} 上一次保存历史的时间戳 */
        this._lastHistoryTime = 0;

        /** @type {ChangeCallback|null} 数据变更回调 */
        this._onChange = null;
        /** @type {boolean} 是否批量操作中 */
        this._batchMode = false;

        /** @type {Object.<string, NodeTypeInfo>} 节点类型信息缓存 */
        this._nodeTypeInfo = getNodeTypeInfo();
        this._nodeTypeInfoHandler = () => {
            this._nodeTypeInfo = getNodeTypeInfo();
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('languagechange', this._nodeTypeInfoHandler);
        }

        this.storage = new WorkflowStorage(this);
        this.serializer = new WorkflowSerializer(this);
        this.container = new WorkflowContainer(this);
    }

    /**
     * 设置数据变更回调
     * @param {ChangeCallback} fn - 回调函数 (action, data) => void
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
     * @param {() => void} fn - 批量操作函数
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
     * 获取节点类型配置信息（动态翻译，语言切换时自动刷新缓存）
     * @returns {Object.<string, NodeTypeInfo>} 包含每种节点的标题、图标、描述、输入输出属性和参数定义
     */
    get nodeTypeInfo() {
        return this._nodeTypeInfo;
    }

    /**
     * 获取节点默认参数值
     * @param {string} type - 节点类型
     * @returns {Object.<string, *>} 默认参数键值对
     */
    _getDefaultParameters(type) {
        const info = this.nodeTypeInfo[type];
        if (!info || !info.parameters) return {};
        const defaults = {};
        info.parameters.forEach((param) => {
            if (param.defaultValue !== undefined) {
                defaults[param.name] = param.defaultValue;
            }
        });
        return defaults;
    }

    /**
     * 创建新节点
     * @param {string} type - 节点类型
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {Partial<WorkflowNode>} [data] - 初始数据（可选）
     * @returns {WorkflowNode} 创建的节点对象
     */
    createNode(type, x, y, data = null) {
        const info = this.nodeTypeInfo[type] || {
            title: t('messages.unknownNode'),
            icon: '📦',
            description: '',
            hasInput: true,
            hasOutput: true,
        };
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
            parentId: data?.parentId || null,
        };

        this.nodes.push(nodeData);
        this._emitChange('addNode', nodeData);
        return nodeData;
    }

    /**
     * 添加节点到工作流
     * @param {WorkflowNode} nodeData - 节点数据对象
     * @returns {WorkflowNode} 添加的节点对象
     */
    addNode(nodeData) {
        this.nodes.push(nodeData);
        this._emitChange('addNode', nodeData);
        return nodeData;
    }

    /**
     * 删除节点及相关边（含递归删除容器子节点）
     * @param {string} nodeId - 节点ID
     */
    deleteNode(nodeId) {
        const wasBatch = this._batchMode;
        this._batchMode = true;
        try {
            const childIds = this.getChildNodes(nodeId).map((n) => n.id);
            childIds.forEach((cid) => this.deleteNode(cid));
            this.edges = this.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
            this.nodes = this.nodes.filter((n) => n.id !== nodeId);

            if (this.selectedNode === nodeId) {
                this.selectedNode = null;
            }
        } finally {
            this._batchMode = wasBatch;
            if (!wasBatch) {
                this._emitChange('deleteNode', nodeId);
            }
        }
    }

    /**
     * 获取指定节点的所有直接子节点
     * @param {string} parentId - 父节点ID
     * @returns {WorkflowNode[]} 子节点数组
     * @deprecated 请使用 this.container.getChildren(parentId)
     */
    getChildNodes(parentId) {
        return this.container.getChildren(parentId);
    }

    /**
     * 检查节点是否为容器节点
     * @param {string} nodeId - 节点ID
     * @returns {boolean} 是否为容器节点
     * @deprecated 请使用 this.container.isContainer(nodeId)
     */
    isContainerNode(nodeId) {
        return this.container.isContainer(nodeId);
    }

    /**
     * 更新节点位置
     * @param {string} nodeId - 节点ID
     * @param {number} x - 新的X坐标
     * @param {number} y - 新的Y坐标
     */
    updateNodePosition(nodeId, x, y) {
        const node = this.nodes.find((n) => n.id === nodeId);
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
        const node = this.nodes.find((n) => n.id === nodeId);
        if (node) {
            node[key] = value;
        }
    }

    /**
     * 创建新边
     * @param {string} sourceId - 源节点ID
     * @param {string} targetId - 目标节点ID
     * @param {string} [sourcePort] - 源端口标识（分支节点、容器节点使用）
     * @param {string} [targetPort] - 目标端口标识（容器节点使用）
     * @returns {WorkflowEdge|null} 创建的边对象，如果已存在或校验失败则返回null
     */
    createEdge(sourceId, targetId, sourcePort = '', targetPort = '') {
        const validation = this.container.validateContainerPorts(sourceId, targetId, sourcePort, targetPort);
        if (!validation.valid) {
            return { error: validation.reason };
        }

        const edge = {
            id: `edge_${++this.edgeIdCounter}`,
            source: sourceId,
            target: targetId,
        };
        if (sourcePort) {
            edge.sourcePort = sourcePort;
        }
        if (targetPort) {
            edge.targetPort = targetPort;
        }

        return this.addEdge(edge);
    }

    /**
     * 添加边到工作流
     * @param {WorkflowEdge} edgeData - 边数据对象
     * @returns {WorkflowEdge|null} 添加的边对象，如果已存在则返回null
     */
    addEdge(edgeData) {
        const existingEdge = this.edges.find(
            (e) =>
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
        this.edges = this.edges.filter((e) => e.id !== edgeId);
        if (this.selectedEdge === edgeId) {
            this.selectedEdge = null;
        }
        this._emitChange('deleteEdge', edgeId);
    }

    /**
     * 保存当前状态到历史记录（全量快照）
     * 支持操作合并：相同操作在时间窗口内自动合并为一条历史
     * @param {string} [actionKey='messages.defaultAction'] - i18n 操作名称键
     * @param {Object.<string, *>} [actionParams] - i18n 插值参数
     * @param {boolean} [force=false] - 强制保存，不进行合并
     */
    saveHistory(actionKey = 'messages.defaultAction', actionParams = {}, force = false) {
        const now = Date.now();
        const canMerge =
            !force &&
            this.historyIndex >= 0 &&
            actionKey === this._lastHistoryAction &&
            now - this._lastHistoryTime < this._historyMergeWindow;

        if (canMerge) {
            const currentState = this.history[this.historyIndex];
            currentState.nodes = deepClone(this.nodes);
            currentState.edges = deepClone(this.edges);
            currentState.selectedNode = this.selectedNode;
            currentState.selectedEdge = this.selectedEdge;
            currentState.timestamp = now;
            currentState.actionParams = { ...currentState.actionParams, ...actionParams };
            this._lastHistoryTime = now;
            this._emitChange('history');
            return;
        }

        /** @type {HistoryState} */
        const state = {
            nodes: deepClone(this.nodes),
            edges: deepClone(this.edges),
            selectedNode: this.selectedNode,
            selectedEdge: this.selectedEdge,
            actionKey: actionKey,
            actionParams: actionParams,
            timestamp: now,
        };

        this.historyIndex++;
        this.history[this.historyIndex] = state;
        this.history.length = this.historyIndex + 1;

        const dynamicMax = this._getDynamicMaxHistory();
        if (this.history.length > dynamicMax) {
            this.history.shift();
            this.historyIndex--;
        }

        this._lastHistoryAction = actionKey;
        this._lastHistoryTime = now;
        this._emitChange('history');
    }

    /**
     * 根据节点数动态计算最大历史记录数
     * 节点越多，历史记录越少，避免内存占用过大
     * @returns {number} 动态最大历史记录数
     */
    _getDynamicMaxHistory() {
        const nodeCount = this.nodes.length;
        if (nodeCount <= 20) return this.maxHistory;
        if (nodeCount <= 50) return 30;
        if (nodeCount <= 100) return 20;
        if (nodeCount <= 200) return 10;
        return 5;
    }

    /**
     * 重置历史记录（清空并保存初始状态）
     * @param {string} [actionKey='messages.initAction'] - i18n 操作名称键
     * @param {Object.<string, *>} [actionParams] - i18n 插值参数
     */
    resetHistory(actionKey = 'messages.initAction', actionParams = {}) {
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory(actionKey, actionParams);
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
        this.saveHistory('messages.clearCanvasTitle');
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
     * @returns {{ valid: boolean, message: string, errors: string[] }} 验证结果
     */
    validate() {
        const errors = [];
        let startCount = 0;
        let endCount = 0;

        const hasInputSet = new Set(this.edges.map((e) => e.target));
        const hasOutputSet = new Set(this.edges.map((e) => e.source));

        this.nodes.forEach((node) => {
            if (node.type === 'start') startCount++;
            if (node.type === 'end') endCount++;

            if (node.type !== 'start' && node.type !== 'comment' && node.type !== 'input') {
                if (!hasInputSet.has(node.id) && this.nodes.length > 1) {
                    errors.push(t('editor.errorNoInput', { title: node.title }));
                }
            }

            if (node.type !== 'end' && node.type !== 'comment' && node.type !== 'break') {
                if (!hasOutputSet.has(node.id) && this.nodes.length > 1) {
                    errors.push(t('editor.errorNoOutput', { title: node.title }));
                }
            }
        });

        if (startCount === 0) {
            errors.push(t('editor.errorNoStartNode'));
        } else if (startCount > 1) {
            errors.push(t('editor.errorMultipleStartNodes'));
        }

        if (endCount === 0) {
            errors.push(t('editor.errorNoEndNode'));
        }

        return {
            valid: errors.length === 0,
            message: errors.join('\n'),
            errors: errors,
        };
    }

    /**
     * 保存到本地存储（转发到 storage 模块）
     * @param {string} key
     * @returns {boolean}
     */
    saveToLocalStorage(key) {
        return this.storage.saveToLocalStorage(key);
    }

    /**
     * 从本地存储加载（转发到 storage 模块）
     * @param {string} key
     * @returns {boolean}
     */
    loadFromLocalStorage(key) {
        return this.storage.loadFromLocalStorage(key);
    }

    /**
     * 检查是否有已保存的工作流（转发到 storage 模块）
     * @param {string} key
     * @returns {boolean}
     */
    hasSavedWorkflow(key) {
        return this.storage.hasSavedWorkflow(key);
    }

    /**
     * 清除已保存的工作流（转发到 storage 模块）
     * @param {string} key
     */
    clearSavedWorkflow(key) {
        return this.storage.clearSavedWorkflow(key);
    }

    /**
     * 同步 ID 计数器（转发到 storage 模块）
     */
    syncIdCounters() {
        return this.storage.syncIdCounters();
    }

    /**
     * 导入工作流数据（转发到 serializer 模块）
     * @param {WorkflowData} workflow - 工作流数据
     */
    importWorkflow(workflow) {
        return this.serializer.importWorkflow(workflow);
    }

    /**
     * 导出工作流数据（转发到 serializer 模块）
     * @param {Object} [options] - 导出选项
     * @returns {WorkflowData} 工作流数据
     */
    exportWorkflow(options) {
        return this.serializer.exportWorkflow(options);
    }

    /**
     * 从剪贴板加载工作流（转发到 serializer 模块）
     * @param {object} data
     */
    loadFromClipboard(data) {
        return this.serializer.loadFromClipboard(data);
    }
}
