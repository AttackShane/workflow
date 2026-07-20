/**
 * 工作流容器节点管理模块
 *
 * 负责容器节点的业务逻辑：层级查询、端口校验、父子关系管理等
 * 将容器相关逻辑从 editor-core.js 中抽离，降低核心模块耦合
 *
 * @typedef {import('../types/workflow.js').WorkflowNode WorkflowNode}
 * @typedef {import('../types/workflow.js').WorkflowEdge WorkflowEdge}
 */

import { APP_CONFIG } from '../config/constants.js';
import { t } from '../i18n/i18n.js';
export class WorkflowContainer {
    /**
     * @param {import('./editor-core.js').WorkflowCore} core - 工作流核心实例
     */
    constructor(core) {
        this.core = core;
    }

    /**
     * 检查节点是否为容器节点
     * @param {string} nodeId - 节点ID
     * @returns {boolean} 是否为容器节点
     */
    isContainer(nodeId) {
        const node = this.core.getNode(nodeId);
        if (!node) return false;
        const info = this.core.nodeTypeInfo[node.type];
        return info?.hasContainer === true;
    }

    /**
     * 获取指定节点的直接子节点
     * @param {string} parentId - 父节点ID
     * @returns {WorkflowNode[]} 直接子节点数组
     */
    getChildren(parentId) {
        return this.core.nodes.filter((n) => n.parentId === parentId);
    }

    /**
     * 递归获取所有后代节点（子、孙、曾孙...）
     * @param {string} parentId - 父节点ID
     * @returns {WorkflowNode[]} 所有后代节点数组
     */
    getAllDescendants(parentId) {
        /** @type {WorkflowNode[]} */
        const result = [];
        const stack = [parentId];
        while (stack.length > 0) {
            const id = /** @type {string} */ (stack.pop());
            const children = this.getChildren(id);
            children.forEach((child) => {
                result.push(child);
                if (this.isContainer(child.id)) {
                    stack.push(child.id);
                }
            });
        }
        return result;
    }

    /**
     * 获取节点的所有祖先节点（从直接父节点到根）
     * @param {string} nodeId - 节点ID
     * @returns {WorkflowNode[]} 祖先节点数组（从父到根）
     */
    getAncestors(nodeId) {
        /** @type {WorkflowNode[]} */
        const result = [];
        let currentId = nodeId;
        while (true) {
            const node = this.core.getNode(currentId);
            if (!node || !node.parentId) break;
            const parent = this.core.getNode(node.parentId);
            if (parent) {
                result.push(parent);
                currentId = parent.id;
            } else {
                break;
            }
        }
        return result;
    }

    /**
     * 获取节点的深度（根节点深度为0）
     * @param {string} nodeId - 节点ID
     * @returns {number} 节点深度
     */
    getDepth(nodeId) {
        let depth = 0;
        let currentId = nodeId;
        while (true) {
            const node = this.core.getNode(currentId);
            if (!node || !node.parentId) break;
            depth++;
            currentId = node.parentId;
        }
        return depth;
    }

    /**
     * 检查两个节点是否有共同的祖先容器
     * @param {string} nodeId1 - 节点1 ID
     * @param {string} nodeId2 - 节点2 ID
     * @returns {string|null} 最近共同祖先容器ID，没有则返回null
     */
    getCommonAncestor(nodeId1, nodeId2) {
        const ancestors1 = new Set(this.getAncestors(nodeId1).map((n) => n.id));
        let currentId = nodeId2;
        while (true) {
            const node = this.core.getNode(currentId);
            if (!node || !node.parentId) break;
            if (ancestors1.has(node.parentId)) {
                return node.parentId;
            }
            currentId = node.parentId;
        }
        return null;
    }

    /**
     * 检查 targetId 是否是 sourceId 的后代（子孙节点）
     * @param {string} sourceId - 源节点ID
     * @param {string} targetId - 目标节点ID
     * @returns {boolean} target 是否是 source 的后代
     */
    isDescendant(sourceId, targetId) {
        const descendants = this.getAllDescendants(sourceId);
        return descendants.some((n) => n.id === targetId);
    }

    /**
     * 校验容器端口连线是否合法
     * 容器外部端口只能连外部节点，内部端口只能连容器内子节点
     * @param {string} sourceId - 源节点ID
     * @param {string} targetId - 目标节点ID
     * @param {string} [sourcePort] - 源端口标识
     * @param {string} [targetPort] - 目标端口标识
     * @returns {boolean} 连线是否合法
     */
    /**
     * 校验容器节点端口连接是否合法
     * @returns {{ valid: true } | { valid: false, reason: string }}
     */
    validateContainerPorts(sourceId, targetId, sourcePort = '', targetPort = '') {
        const sourceIsContainer = this.isContainer(sourceId);
        const targetIsContainer = this.isContainer(targetId);
        const sourceIsChild = !!this.core.getNode(sourceId)?.parentId;
        const targetIsChild = !!this.core.getNode(targetId)?.parentId;

        if (sourceIsContainer) {
            const isInternalPort = sourcePort === 'container_start';
            if (isInternalPort && !targetIsChild) return { valid: false, reason: t('actions.containerInternalOnly') };
            if (!isInternalPort && targetIsChild) return { valid: false, reason: t('actions.containerExternalOnly') };
        }
        if (targetIsContainer) {
            const isInternalPort = targetPort === 'container_end';
            if (isInternalPort && !sourceIsChild) return { valid: false, reason: t('actions.containerInternalOnly') };
            if (!isInternalPort && sourceIsChild) return { valid: false, reason: t('actions.containerExternalOnly') };
        }
        return { valid: true };
    }

    /**
     * 获取容器节点的外部边界（包含所有子节点的最小矩形）
     * @param {string} containerId - 容器节点ID
     * @returns {{ x: number, y: number, width: number, height: number }|null} 边界矩形
     */
    getContainerBounds(containerId) {
        const children = this.getChildren(containerId);
        if (children.length === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        children.forEach((child) => {
            minX = Math.min(minX, child.x);
            minY = Math.min(minY, child.y);
            const childW = child.width || APP_CONFIG.NODE.DEFAULT_NODE_WIDTH;
            const childH = child.height || APP_CONFIG.NODE.DEFAULT_NODE_HEIGHT;
            maxX = Math.max(maxX, child.x + childW);
            maxY = Math.max(maxY, child.y + childH);
        });

        const padding = 20;
        return {
            x: minX - padding,
            y: minY - padding - APP_CONFIG.NODE.CONTAINER_HEADER_H,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2 + APP_CONFIG.NODE.CONTAINER_HEADER_H,
        };
    }

    /**
     * 将节点加入容器
     * @param {string} nodeId - 要加入的节点ID
     * @param {string} containerId - 容器节点ID
     * @returns {boolean} 是否成功
     */
    addToContainer(nodeId, containerId) {
        if (!this.isContainer(containerId)) return false;
        if (this.isDescendant(nodeId, containerId)) return false;
        const node = this.core.getNode(nodeId);
        if (!node) return false;
        node.parentId = containerId;
        return true;
    }

    /**
     * 将节点从容器中移出
     * @param {string} nodeId - 节点ID
     * @returns {boolean} 是否成功
     */
    removeFromContainer(nodeId) {
        const node = this.core.getNode(nodeId);
        if (!node || !node.parentId) return false;
        node.parentId = null;
        return true;
    }

    /**
     * 收集所有容器节点
     * @returns {WorkflowNode[]} 容器节点数组
     */
    getAllContainers() {
        return this.core.nodes.filter((n) => this.isContainer(n.id));
    }

    /**
     * 获取根级节点（不在任何容器内的节点）
     * @returns {WorkflowNode[]} 根级节点数组
     */
    getRootNodes() {
        return this.core.nodes.filter((n) => !n.parentId);
    }
}
