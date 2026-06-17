import { DOM } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 选择操作模块
 * 负责全选、框选、多选、删除选中、复制选中等选择相关操作
 */
export class WorkflowSelection {
    /**
     * @param {import('./workflow-ui.js').WorkflowUI} ui
     */
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
    }

    /**
     * 全选节点和边
     */
    selectAll() {
        document.querySelectorAll('.canvas-node').forEach(n => DOM.addClass(n, 'selected'));
        document.querySelectorAll('.workflow-edge').forEach(e => DOM.addClass(e, 'selected'));

        if (this.core.edges.length > 0) {
            this.core.selectEdge(this.core.edges[0].id);
        }
        this.ui.updateEdges();

        if (this.core.nodes.length > 0) {
            const firstNode = this.core.nodes[0];
            const node = this.core.nodes.find(n => n.id === firstNode.id);
            if (node) this.ui.node.renderPropertyPanel(node);
        }

        if (this.core.nodes.length > 1) {
            this.ui.isMultiSelectMode = true;
        }
        
        this.ui.align.updateAlignToolbar();
    }

    /**
     * 取消全选
     */
    deselectAll() {
        document.querySelectorAll('.canvas-node.selected').forEach(n => DOM.removeClass(n, 'selected'));
        document.querySelectorAll('.workflow-edge.selected').forEach(e => DOM.removeClass(e, 'selected'));
        this.ui.isMultiSelectMode = false;
        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.ui.clearPropertyPanel();
        this.ui.edge.update();
        this.ui.align.updateAlignToolbar();
    }

    /**
     * 更新选择状态
     */
    updateSelection() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');

        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);

            const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (node) this.ui.node.renderPropertyPanel(node);

            if (selectedNodes.length > 1 || selectedEdges.length > 0) {
                this.ui.isMultiSelectMode = true;
            }
        } else if (selectedEdges.length > 0) {
            const lastSelected = selectedEdges[selectedEdges.length - 1];
            const lastEdgeId = lastSelected.getAttribute('data-edge-id');
            this.core.selectEdge(lastEdgeId);

            const edge = this.core.edges.find(e => e.id === lastEdgeId);
            if (edge) this.ui.edge.renderPropertyPanel(edge);
        }

        this.ui.align.updateAlignToolbar();
    }

    /**
     * 选择指定矩形区域内的节点和边
     * @param {number} left - 左侧坐标
     * @param {number} top - 顶部坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    selectNodesInRect(left, top, width, height, accumulate = false) {
        if (!accumulate) {
            this.deselectAll();
        }

        const selectedNodeIds = new Set();

        document.querySelectorAll('.canvas-node').forEach(nodeEl => {
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

        document.querySelectorAll('.workflow-edge').forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (edgeId) {
                const edge = this.core.edges.find(e => e.id === edgeId);
                if (edge && selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
                    DOM.addClass(edgeEl, 'selected');
                }
            }
        });

        this.updateSelection();
        this.ui.edge.update();
    }

    /**
     * 删除选中项
     */
    deleteSelected() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');

        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
            return;
        }

        selectedEdges.forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            this.ui.edge.delete(edgeId, false, false);
        });

        selectedNodes.forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;
            this.ui.node.delete(nodeId, false, false);
        });

        this.core.saveHistory(t('messages.deleteSelection'));
        this.ui.showMessage(t('messages.deletedSelection'), 'success');
    }

    /**
     * 复制选中节点（Ctrl+D）
     */
    duplicateSelected() {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length === 0) return;

        selectedEls.forEach(el => {
            const nodeId = el.dataset.nodeId;
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const newNode = {
                ...JSON.parse(JSON.stringify(node)),
                id: newId,
                title: `${node.title}${t('messages.duplicateNodeSuffix')}`,
                x: node.x + 30,
                y: node.y + 30
            };

            this.core.addNode(newNode);
            const newEl = this.ui.node.createElement(newNode);
            this.ui.canvas.canvasContent.appendChild(newEl);
            newEl.classList.add('selected');
        });

        this.core.saveHistory(t('messages.duplicateNodes'));
        this.ui.showMessage(t('messages.duplicatedNodes', { count: selectedEls.length }), 'success');
    }
}