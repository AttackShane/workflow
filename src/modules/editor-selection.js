import { DOM, deepClone } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 选择操作模块
 * 负责全选、框选、多选、删除选中、复制选中等选择相关操作
 */
export class WorkflowSelection {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui
     */
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
    }

    /**
     * 全选节点和边
     */
    selectAll() {
        document.querySelectorAll('.canvas-node').forEach((n) => {
            const nodeId = n.getAttribute('data-node-id');
            const node = this.core.getNode(nodeId);
            if (node && (node.parentId || node.locked)) return;
            DOM.addClass(n, 'selected');
        });
        document.querySelectorAll('.workflow-edge').forEach((e) => {
            const edgeId = e.getAttribute('data-edge-id');
            const edge = this.core.getEdge(edgeId);
            if (!edge) return;
            const sourceNode = this.core.getNode(edge.source);
            const targetNode = this.core.getNode(edge.target);
            if ((sourceNode && sourceNode.parentId) || (targetNode && targetNode.parentId)) return;
            DOM.addClass(e, 'selected');
        });

        if (this.core.edges.length > 0) {
            this.core.selectEdge(this.core.edges[0].id);
        }
        this.ui.updateEdges();

        if (this.core.nodes.length > 0) {
            const firstNode = this.core.nodes[0];
            const node = this.core.getNode(firstNode.id);
            if (node) this.ui.node.panel.renderPropertyPanel(node);
        }

        if (this.core.nodes.length > 1) {
            this.ui.isMultiSelectMode = true;
        }

        this.ui.align.updateAlignToolbar();
        this.ui.canvas.renderMinimap();
    }

    /**
     * 取消全选
     */
    deselectAll() {
        document.querySelectorAll('.canvas-node.selected').forEach((n) => DOM.removeClass(n, 'selected'));
        document.querySelectorAll('.workflow-edge.selected').forEach((e) => DOM.removeClass(e, 'selected'));
        this.ui.isMultiSelectMode = false;
        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.ui.clearPropertyPanel();
        this.ui.edge.update();
        this.ui.align.updateAlignToolbar();
        this.ui.canvas._selectedNodeIds = new Set();
        this.ui.canvas.renderMinimap();
    }

    /**
     * 更新选择状态
     */
    updateSelection() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');

        if (selectedNodes.length > 0) {
            const lastSelected = /** @type {HTMLElement} */ (selectedNodes[selectedNodes.length - 1]);
            this.core.selectNode(lastSelected.dataset.nodeId);

            const node = this.core.getNode(lastSelected.dataset.nodeId);
            if (node) this.ui.node.panel.renderPropertyPanel(node);

            if (selectedNodes.length > 1 || selectedEdges.length > 0) {
                this.ui.isMultiSelectMode = true;
            }
        } else if (selectedEdges.length > 0) {
            const lastSelected = selectedEdges[selectedEdges.length - 1];
            const lastEdgeId = lastSelected.getAttribute('data-edge-id');
            this.core.selectEdge(lastEdgeId);

            const edge = this.core.getEdge(lastEdgeId);
            if (edge) this.ui.edge.renderPropertyPanel(edge);
        }

        this.ui.align.updateAlignToolbar();
        this.ui.canvas.renderMinimap();
    }

    /**
     * 选择指定矩形区域内的节点和边
     * @param {number} left - 左侧坐标
     * @param {number} top - 顶部坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    selectNodesInRect(left, top, width, height, accumulate = false, containerId = null) {
        if (!accumulate) {
            this.deselectAll();
        }

        const selectedNodeIds = new Set();

        document.querySelectorAll('.canvas-node').forEach((nodeEl) => {
            const nodeId = nodeEl.getAttribute('data-node-id');
            const node = this.core.getNode(nodeId);
            if (!node) return;

            if (containerId) {
                if (node.parentId !== containerId) return;
            } else {
                if (node.parentId) return;
            }

            if (node.locked) return;

            const rect = nodeEl.getBoundingClientRect();
            const nodeLeft = rect.left;
            const nodeTop = rect.top;
            const nodeWidth = rect.width;
            const nodeHeight = rect.height;

            if (
                nodeLeft < left + width &&
                nodeLeft + nodeWidth > left &&
                nodeTop < top + height &&
                nodeTop + nodeHeight > top
            ) {
                DOM.addClass(nodeEl, 'selected');
                const nodeId = nodeEl.getAttribute('data-node-id');
                if (nodeId) {
                    selectedNodeIds.add(nodeId);
                }
            }
        });

        document.querySelectorAll('.workflow-edge').forEach((edgeEl) => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (edgeId) {
                const edge = this.core.getEdge(edgeId);
                if (edge && selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
                    DOM.addClass(edgeEl, 'selected');
                }
            }
        });

        this.updateSelection();
        this.ui.edge.update();
    }

    /**
     * 删除选中项（批量操作，统一触发一次渲染）
     */
    deleteSelected() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');

        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
            return;
        }

        this.core.batchChanges(() => {
            selectedEdges.forEach((edgeEl) => {
                const edgeId = edgeEl.getAttribute('data-edge-id');
                this.ui.edge.delete(edgeId, false, false);
            });

            selectedNodes.forEach((nodeEl) => {
                const nodeId = /** @type {HTMLElement} */ (nodeEl).dataset.nodeId;
                const nodeData = this.core.getNode(nodeId);
                if (nodeData && nodeData.locked) return;
                this.ui.node.render.delete(nodeId, false, false);
            });
        });

        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.core.saveHistory('messages.deleteSelection');
        this.ui.showMessage(t('messages.deletedSelection'), 'success');
    }

    /**
     * 复制选中节点（Ctrl+D）
     * 深拷贝节点数据并重映射内部 blockID 引用
     */
    duplicateSelected() {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length === 0) return;

        // 第一遍：构建旧ID → 新ID 映射，生成克隆节点
        const idMap = {};
        const newNodes = [];

        selectedEls.forEach((el) => {
            const nodeId = /** @type {HTMLElement} */ (el).dataset.nodeId;
            const node = this.core.getNode(nodeId);
            if (!node) return;

            const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            idMap[nodeId] = newId;

            const newNode = {
                ...deepClone(node),
                id: newId,
                title: `${node.title}${t('messages.duplicateNodeSuffix')}`,
                x: node.x + 30,
                y: node.y + 30,
            };
            newNodes.push({ el, newNode });
        });

        // 第二遍：重映射 blockID 引用，加入核心数据并渲染
        newNodes.forEach(({ el, newNode }) => {
            this._remapBlockIdsForNode(newNode, idMap);
            this.core.addNode(newNode);
            const newEl = this.ui.node.render.createElement(newNode);
            this.ui.canvas.canvasContent.appendChild(newEl);
            newEl.classList.add('selected');
        });

        this.core.saveHistory('messages.duplicateNodes');
        this.ui.showMessage(t('messages.duplicatedNodes', { count: selectedEls.length }), 'success');
    }

    /**
     * 重映射节点内部 blockID 引用（用于复制/克隆场景）
     * @param {object} node - 节点数据
     * @param {Record<string, string>} idMap - 旧ID → 新ID 映射
     */
    _remapBlockIdsForNode(node, idMap) {
        // inputParams 中的 ref blockID
        if (node.inputParams && Array.isArray(node.inputParams)) {
            node.inputParams.forEach((param) => {
                if (param.valueType === 'ref' && param.value?.content?.blockID) {
                    const newId = idMap[String(param.value.content.blockID)];
                    if (newId) param.value.content.blockID = newId;
                }
            });
        }

        const p = node.parameters;
        if (!p) return;

        // 辅助：重映射含 type === 'ref' 的对象
        const remapValueObj = (obj) => {
            if (obj?.value?.type === 'ref' && obj.value.content?.blockID) {
                const newId = idMap[String(obj.value.content.blockID)];
                if (newId) obj.value.content.blockID = newId;
            }
        };

        // _contentRaw
        if (p._contentRaw && typeof p._contentRaw === 'object') {
            remapValueObj(p._contentRaw);
        }

        // dynamic_option
        if (p.dynamic_option && typeof p.dynamic_option === 'object') {
            remapValueObj(p.dynamic_option);
        }

        // loop_set_variable variables
        if (node.type === 'loop_set_variable' && Array.isArray(p.variables)) {
            p.variables.forEach((v) => {
                ['left', 'right'].forEach((side) => {
                    if (v[side]?.value?.content?.blockID) {
                        const newId = idMap[String(v[side].value.content.blockID)];
                        if (newId) v[side].value.content.blockID = newId;
                    }
                });
            });
        }
    }
}
