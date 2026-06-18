/**
 * 工作流存储模块
 * 负责工作流的本地存储持久化
 */
import { Storage } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

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
        this.selectedNode = data.selectedNode || null;
        this.selectedEdge = data.selectedEdge || null;

        this.resetHistory(t('messages.loadFromLocalStorage'));
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
}