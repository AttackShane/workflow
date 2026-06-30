/**
 * 工作流存储模块
 * 负责工作流的本地存储持久化
 */
import { Storage } from '../utils/helpers.js';

/**
 * 存储相关的 mixin 方法
 * @param {import('./workflow-core.js').WorkflowCore} core - WorkflowCore 实例
 */
export function mixinStorage(core) {
    /**
     * 保存到本地存储
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否保存成功
     */
    core.saveToLocalStorage = function(key = 'workflow_current') {
        const data = {
            nodes: this.nodes,
            edges: this.edges,
            nodeIdCounter: this.nodeIdCounter,
            edgeIdCounter: this.edgeIdCounter,
            selectedNode: this.selectedNode,
            selectedEdge: this.selectedEdge,
            savedAt: Date.now()
        };
        Storage.set(key, data);
        return true;
    };

    /**
     * 从本地存储加载
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否加载成功
     */
    core.loadFromLocalStorage = function(key = 'workflow_current') {
        const data = Storage.get(key);
        if (!data) {
            return false;
        }

        this.nodes = data.nodes || [];
        this.edges = data.edges || [];
        this.nodeIdCounter = data.nodeIdCounter || 100000;
        this.edgeIdCounter = data.edgeIdCounter || 100000;
        this.selectedNode = null;
        this.selectedEdge = null;

        this.resetHistory('messages.loadFromLocalStorage');
        return true;
    };

    /**
     * 检查是否有已保存的工作流
     * @param {string} [key='workflow_current'] - 存储键名
     * @returns {boolean} 是否存在已保存的工作流
     */
    core.hasSavedWorkflow = function(key = 'workflow_current') {
        return Storage.get(key) !== null;
    };

    /**
     * 清除已保存的工作流
     * @param {string} [key='workflow_current'] - 存储键名
     */
    core.clearSavedWorkflow = function(key = 'workflow_current') {
        Storage.remove(key);
    };

    /**
     * 根据已有节点/边同步 ID 计数器，避免编号冲突
     * 在从外部数据源加载节点后调用（如 sessionStorage 的 editingWorkflow）
     */
    core.syncIdCounters = function() {
        let maxNode = this.nodeIdCounter;
        let maxEdge = this.edgeIdCounter;

        for (const node of this.nodes) {
            const match = node.id && node.id.match(/^node_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNode) maxNode = num;
            }
        }

        for (const edge of this.edges) {
            const match = edge.id && edge.id.match(/^edge_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxEdge) maxEdge = num;
            }
        }

        this.nodeIdCounter = maxNode;
        this.edgeIdCounter = maxEdge;
    };
}