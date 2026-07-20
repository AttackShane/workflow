/**
 * 工作流存储模块
 * 负责工作流的本地存储持久化
 */
import { Storage } from '../../utils/helpers.js';

export class WorkflowStorage {
    /**
     * @param {import('./editor-core.js').WorkflowCore} core - WorkflowCore 实例
     */
    constructor(core) {
        this.core = core;
    }

    /**
     * 保存到本地存储
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否保存成功
     */
    saveToLocalStorage(key = 'workflow_current') {
        const data = {
            nodes: this.core.nodes,
            edges: this.core.edges,
            nodeIdCounter: this.core.nodeIdCounter,
            edgeIdCounter: this.core.edgeIdCounter,
            selectedNode: this.core.selectedNode,
            selectedEdge: this.core.selectedEdge,
            savedAt: Date.now(),
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

        this.core.nodes = data.nodes || [];
        this.core.edges = data.edges || [];
        this.core.nodeIdCounter = data.nodeIdCounter || 100000;
        this.core.edgeIdCounter = data.edgeIdCounter || 100000;
        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.core._rebuildMaps();

        this.core.resetHistory('messages.loadFromLocalStorage');
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
     * 根据已有节点/边同步 ID 计数器，避免编号冲突
     * 在从外部数据源加载节点后调用（如 sessionStorage 的 editingWorkflow）
     */
    syncIdCounters() {
        let maxNode = this.core.nodeIdCounter;
        let maxEdge = this.core.edgeIdCounter;

        for (const node of this.core.nodes) {
            const match = node.id && node.id.match(/^node_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNode) maxNode = num;
            }
        }

        for (const edge of this.core.edges) {
            const match = edge.id && edge.id.match(/^edge_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxEdge) maxEdge = num;
            }
        }

        this.core.nodeIdCounter = maxNode;
        this.core.edgeIdCounter = maxEdge;
    }
}
