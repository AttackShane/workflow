/**
 * 工作流核心模块
 *
 * 负责管理工作流的节点、边、历史记录和验证逻辑
 * 节点类型定义由 editor-node-types.js 提供
 * @typedef {import('../../types/workflow.js').WorkflowNode WorkflowNode}
 * @typedef {import('../../types/workflow.js').WorkflowEdge WorkflowEdge}
 * @typedef {import('../../types/workflow.js').HistoryState HistoryState}
 * @typedef {import('../../types/workflow.js').NodeTypeInfo NodeTypeInfo}
 * @typedef {import('../../types/workflow.js').WorkflowData WorkflowData}
 * @typedef {import('../../types/workflow.js').ChangeCallback ChangeCallback}
 */
import { REV_TYPE_MAP, resolveNodeType } from '../../utils/types.js';
import { t } from '../../i18n/i18n.js';
import { Logger } from '../../utils/logger.js';
import { deepClone } from '../../utils/helpers.js';
import { WorkflowStorage } from './editor-storage.js';
import { WorkflowSerializer } from '../shared/shared-serializer.js';
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
        /** @type {Map<string, WorkflowNode>} 节点ID → 节点对象 的快速查找索引 */
        this._nodeMap = new Map();
        /** @type {Map<string, WorkflowEdge>} 边ID → 边对象 的快速查找索引 */
        this._edgeMap = new Map();
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
        /** @type {number} 增量快照的基准间隔，每隔此数步创建完整快照 */
        this._historyBaseInterval = 10;

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
     * 从 nodes/edges 数组重建 Map 索引
     * 在数组被整体替换后调用（如 undo/redo/import/loadFromLocalStorage）
     */
    _rebuildMaps() {
        this._nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
        this._edgeMap = new Map(this.edges.map((e) => [e.id, e]));
    }

    /**
     * 从基准状态重建完整状态
     * @param {number} index - 目标历史记录索引
     * @returns {{nodes: WorkflowNode[], edges: WorkflowEdge[], selectedNode: string|null, selectedEdge: string|null}}
     */
    _reconstructHistoryState(index) {
        if (index < 0 || index >= this.history.length) {
            return { nodes: [], edges: [], selectedNode: null, selectedEdge: null };
        }

        const state = this.history[index];
        if (state.baseIndex === -1) {
            return {
                nodes: deepClone(state.nodes),
                edges: deepClone(state.edges),
                selectedNode: state.selectedNode,
                selectedEdge: state.selectedEdge,
            };
        }

        const baseState = this._reconstructHistoryState(state.baseIndex);
        const nodes = baseState.nodes.slice();
        const edges = baseState.edges.slice();

        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const edgeMap = new Map(edges.map((e) => [e.id, e]));

        if (state.nodes) {
            if (state.nodes.deleted) {
                state.nodes.deleted.forEach((id) => nodeMap.delete(id));
            }
            if (state.nodes.added) {
                Object.values(state.nodes.added).forEach((node) => nodeMap.set(node.id, deepClone(node)));
            }
            if (state.nodes.updated) {
                Object.values(state.nodes.updated).forEach((node) => nodeMap.set(node.id, deepClone(node)));
            }
        }

        if (state.edges) {
            if (state.edges.deleted) {
                state.edges.deleted.forEach((id) => edgeMap.delete(id));
            }
            if (state.edges.added) {
                Object.values(state.edges.added).forEach((edge) => edgeMap.set(edge.id, deepClone(edge)));
            }
            if (state.edges.updated) {
                Object.values(state.edges.updated).forEach((edge) => edgeMap.set(edge.id, deepClone(edge)));
            }
        }

        return {
            nodes: Array.from(nodeMap.values()),
            edges: Array.from(edgeMap.values()),
            selectedNode: state.selectedNode,
            selectedEdge: state.selectedEdge,
        };
    }

    /**
     * 计算当前状态与基准状态的差异
     * @param {WorkflowNode[]} baseNodes - 基准节点数组
     * @param {WorkflowEdge[]} baseEdges - 基准边数组
     * @returns {{nodes: Object, edges: Object}}
     */
    _computeDiff(baseNodes, baseEdges) {
        const baseNodeMap = new Map(baseNodes.map((n) => [n.id, n]));
        const baseEdgeMap = new Map(baseEdges.map((e) => [e.id, e]));

        const currentNodeMap = new Map(this.nodes.map((n) => [n.id, n]));
        const currentEdgeMap = new Map(this.edges.map((e) => [e.id, e]));

        const nodes = { deleted: [], added: {}, updated: {} };
        const edges = { deleted: [], added: {}, updated: {} };

        baseNodeMap.forEach((node, id) => {
            if (!currentNodeMap.has(id)) {
                nodes.deleted.push(id);
            } else {
                const currentNode = currentNodeMap.get(id);
                if (JSON.stringify(node) !== JSON.stringify(currentNode)) {
                    nodes.updated[id] = deepClone(currentNode);
                }
            }
        });

        currentNodeMap.forEach((node, id) => {
            if (!baseNodeMap.has(id)) {
                nodes.added[id] = deepClone(node);
            }
        });

        baseEdgeMap.forEach((edge, id) => {
            if (!currentEdgeMap.has(id)) {
                edges.deleted.push(id);
            } else {
                const currentEdge = currentEdgeMap.get(id);
                if (JSON.stringify(edge) !== JSON.stringify(currentEdge)) {
                    edges.updated[id] = deepClone(currentEdge);
                }
            }
        });

        currentEdgeMap.forEach((edge, id) => {
            if (!baseEdgeMap.has(id)) {
                edges.added[id] = deepClone(edge);
            }
        });

        return { nodes, edges };
    }

    /**
     * 按 ID 快速获取节点（O(1) Map 查找）
     * @param {string} id - 节点ID
     * @returns {WorkflowNode|undefined}
     */
    getNode(id) {
        return this._nodeMap.get(id);
    }

    /**
     * 按 ID 快速获取边（O(1) Map 查找）
     * @param {string} id - 边ID
     * @returns {WorkflowEdge|undefined}
     */
    getEdge(id) {
        return this._edgeMap.get(id);
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
        this._nodeMap.set(nodeData.id, nodeData);
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
        this._nodeMap.set(nodeData.id, nodeData);
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
            const childIds = this.container.getChildren(nodeId).map((n) => n.id);
            childIds.forEach((cid) => this.deleteNode(cid));
            const removedEdges = this.edges.filter((e) => e.source === nodeId || e.target === nodeId);
            this.edges = this.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
            removedEdges.forEach((e) => this._edgeMap.delete(e.id));
            this.nodes = this.nodes.filter((n) => n.id !== nodeId);
            this._nodeMap.delete(nodeId);

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
     * 更新节点位置
     * @param {string} nodeId - 节点ID
     * @param {number} x - 新的X坐标
     * @param {number} y - 新的Y坐标
     */
    updateNodePosition(nodeId, x, y) {
        const node = this._nodeMap.get(nodeId);
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
        const node = this._nodeMap.get(nodeId);
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
        this._edgeMap.set(edgeData.id, edgeData);
        this._emitChange('addEdge', edgeData);
        return edgeData;
    }

    /**
     * 删除边
     * @param {string} edgeId - 边ID
     */
    deleteEdge(edgeId) {
        this.edges = this.edges.filter((e) => e.id !== edgeId);
        this._edgeMap.delete(edgeId);
        if (this.selectedEdge === edgeId) {
            this.selectedEdge = null;
        }
        this._emitChange('deleteEdge', edgeId);
    }

    /**
     * 保存当前状态到历史记录（增量快照）
     * 支持操作合并：相同操作在时间窗口内自动合并为一条历史
     * 每隔 _historyBaseInterval 步创建完整快照，其余为增量快照
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
            currentState.baseIndex = -1;
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

        const newIndex = this.historyIndex + 1;
        const needFullSnapshot = newIndex === 0 || newIndex % this._historyBaseInterval === 0;

        /** @type {HistoryState} */
        let state;

        if (needFullSnapshot) {
            state = {
                baseIndex: -1,
                nodes: deepClone(this.nodes),
                edges: deepClone(this.edges),
                selectedNode: this.selectedNode,
                selectedEdge: this.selectedEdge,
                actionKey: actionKey,
                actionParams: actionParams,
                timestamp: now,
            };
        } else {
            const baseIndex = this._findNearestBaseIndex(this.historyIndex);
            const baseState = this._reconstructHistoryState(baseIndex);
            const diff = this._computeDiff(baseState.nodes, baseState.edges);

            state = {
                baseIndex: baseIndex,
                nodes: diff.nodes,
                edges: diff.edges,
                selectedNode: this.selectedNode,
                selectedEdge: this.selectedEdge,
                actionKey: actionKey,
                actionParams: actionParams,
                timestamp: now,
            };
        }

        this.historyIndex = newIndex;
        this.history[this.historyIndex] = state;
        this.history.length = this.historyIndex + 1;

        const dynamicMax = this._getDynamicMaxHistory();
        if (this.history.length > dynamicMax) {
            const removedIndex = 0;

            this.history.forEach((s) => {
                if (s.baseIndex === removedIndex) {
                    const idx = this.history.indexOf(s);
                    const fullState = this._reconstructHistoryState(idx);
                    s.baseIndex = -1;
                    s.nodes = fullState.nodes;
                    s.edges = fullState.edges;
                } else if (s.baseIndex > removedIndex) {
                    s.baseIndex--;
                }
            });

            this.history.shift();
            this.historyIndex--;
        }

        this._lastHistoryAction = actionKey;
        this._lastHistoryTime = now;
        this._emitChange('history');
    }

    /**
     * 查找最近的完整快照索引
     * @param {number} startIndex - 起始搜索索引
     * @returns {number} 完整快照索引
     */
    _findNearestBaseIndex(startIndex) {
        for (let i = startIndex; i >= 0; i--) {
            if (this.history[i].baseIndex === -1) {
                return i;
            }
        }
        return -1;
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
     * 撤销操作（从增量快照恢复）
     * @returns {boolean} 是否撤销成功
     */
    undo() {
        if (!this.canUndo()) return false;

        this.historyIndex--;
        const fullState = this._reconstructHistoryState(this.historyIndex);

        this.nodes = fullState.nodes;
        this.edges = fullState.edges;
        this.selectedNode = fullState.selectedNode;
        this.selectedEdge = fullState.selectedEdge;
        this._rebuildMaps();

        this._emitChange('undo');
        return true;
    }

    /**
     * 重做操作（从增量快照恢复）
     * @returns {boolean} 是否重做成功
     */
    redo() {
        if (!this.canRedo()) return false;

        this.historyIndex++;
        const fullState = this._reconstructHistoryState(this.historyIndex);

        this.nodes = fullState.nodes;
        this.edges = fullState.edges;
        this.selectedNode = fullState.selectedNode;
        this.selectedEdge = fullState.selectedEdge;
        this._rebuildMaps();

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
        this._nodeMap.clear();
        this._edgeMap.clear();
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
