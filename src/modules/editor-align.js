import { DOM } from '../utils/helpers.js';

/**
 * 对齐与分布模块
 * 负责节点对齐工具栏、8 种对齐算法和 2 种分布算法
 */
export class WorkflowAlign {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui
     */
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
    }

    /**
     * 设置对齐工具栏事件
     */
    setupAlignToolbar() {
        const toolbar = DOM.get('alignToolbar');
        if (!toolbar) return;

        DOM.on(toolbar, 'click', (e) => {
            const btn = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest('.align-btn'));
            if (!btn) return;
            const mode = btn.dataset.align;
            if (mode) this.alignNodes(mode);
        });
    }

    /**
     * 更新对齐工具栏位置和可见性
     */
    updateAlignToolbar() {
        const toolbar = DOM.get('alignToolbar');
        if (!toolbar) return;

        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodes.length < 2) {
            DOM.removeClass(toolbar, 'visible');
            return;
        }

        const canvas = DOM.get('canvas');
        const canvasRect = canvas.getBoundingClientRect();

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        selectedNodes.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.left < minX) minX = rect.left;
            if (rect.top < minY) minY = rect.top;
            if (rect.right > maxX) maxX = rect.right;
            if (rect.bottom > maxY) maxY = rect.bottom;
        });

        const boundCenterX = (minX + maxX) / 2;
        const toolbarWidth = toolbar.offsetWidth || 280;
        const toolbarHeight = toolbar.offsetHeight || 36;
        const gap = 8;

        let toolbarLeft = boundCenterX - canvasRect.left - toolbarWidth / 2;
        let toolbarTop = minY - canvasRect.top - toolbarHeight - gap;

        toolbarLeft = Math.max(4, Math.min(toolbarLeft, canvasRect.width - toolbarWidth - 4));
        toolbarTop = Math.max(4, toolbarTop);

        if (toolbarTop + toolbarHeight > canvasRect.height - 4) {
            toolbarTop = maxY - canvasRect.top + gap;
        }

        DOM.setStyle(toolbar, 'left', toolbarLeft + 'px');
        DOM.setStyle(toolbar, 'top', toolbarTop + 'px');
        DOM.addClass(toolbar, 'visible');
    }

    /**
     * 对齐选中的节点
     * @param {string} mode - 对齐模式
     */
    alignNodes(mode) {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length < 2) return;

        const nodes = [];
        selectedEls.forEach((el) => {
            const nodeId = /** @type {HTMLElement} */ (el).dataset.nodeId;
            const node = this.core.getNode(nodeId);
            if (node) {
                nodes.push({
                    node,
                    el,
                    x: node.x,
                    y: node.y,
                    width: node.width || 200,
                    height: node.height || 100,
                });
            }
        });

        if (nodes.length < 2) return;

        const isDistribute = mode === 'distH' || mode === 'distV';

        switch (mode) {
            case 'left':
                this.alignLeft(nodes);
                break;
            case 'centerH':
                this.alignCenterH(nodes);
                break;
            case 'right':
                this.alignRight(nodes);
                break;
            case 'top':
                this.alignTop(nodes);
                break;
            case 'centerV':
                this.alignCenterV(nodes);
                break;
            case 'bottom':
                this.alignBottom(nodes);
                break;
            case 'distH':
                this.distributeHorizontal(nodes);
                break;
            case 'distV':
                this.distributeVertical(nodes);
                break;
        }

        if (!isDistribute) {
            this.core.saveHistory('messages.alignNodes');
        }
    }

    alignLeft(nodes) {
        if (!nodes || nodes.length === 0) return;
        const minX = Math.min(...nodes.map((n) => n.x));
        nodes.forEach((n) => {
            this.core.updateNodePosition(n.node.id, minX, n.y);
            n.el.dataset.x = minX;
            n.el.dataset.y = n.y;
            n.el.style.transform = `translate(${minX}px, ${n.y}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    alignCenterH(nodes) {
        const centerX = nodes.reduce((s, n) => s + n.x + n.width / 2, 0) / nodes.length;
        nodes.forEach((n) => {
            const newX = centerX - n.width / 2;
            this.core.updateNodePosition(n.node.id, newX, n.y);
            n.el.dataset.x = newX;
            n.el.dataset.y = n.y;
            n.el.style.transform = `translate(${newX}px, ${n.y}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    alignRight(nodes) {
        const maxX = Math.max(...nodes.map((n) => n.x + n.width));
        nodes.forEach((n) => {
            const newX = maxX - n.width;
            this.core.updateNodePosition(n.node.id, newX, n.y);
            n.el.dataset.x = newX;
            n.el.dataset.y = n.y;
            n.el.style.transform = `translate(${newX}px, ${n.y}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    alignTop(nodes) {
        const minY = Math.min(...nodes.map((n) => n.y));
        nodes.forEach((n) => {
            this.core.updateNodePosition(n.node.id, n.x, minY);
            n.el.dataset.x = n.x;
            n.el.dataset.y = minY;
            n.el.style.transform = `translate(${n.x}px, ${minY}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    alignCenterV(nodes) {
        const centerY = nodes.reduce((s, n) => s + n.y + n.height / 2, 0) / nodes.length;
        nodes.forEach((n) => {
            const newY = centerY - n.height / 2;
            this.core.updateNodePosition(n.node.id, n.x, newY);
            n.el.dataset.x = n.x;
            n.el.dataset.y = newY;
            n.el.style.transform = `translate(${n.x}px, ${newY}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    alignBottom(nodes) {
        const maxY = Math.max(...nodes.map((n) => n.y + n.height));
        nodes.forEach((n) => {
            const newY = maxY - n.height;
            this.core.updateNodePosition(n.node.id, n.x, newY);
            n.el.dataset.x = n.x;
            n.el.dataset.y = newY;
            n.el.style.transform = `translate(${n.x}px, ${newY}px)`;
        });
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    distributeHorizontal(nodes) {
        if (nodes.length < 3) return;
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((s, n) => s + n.width, 0);
        const minX = sorted[0].x;
        const maxX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
        const gap = (maxX - minX - totalWidth) / (sorted.length - 1);

        let curX = sorted[0].x;
        sorted.forEach((n) => {
            this.core.updateNodePosition(n.node.id, curX, n.y);
            n.el.dataset.x = curX;
            n.el.dataset.y = n.y;
            n.el.style.transform = `translate(${curX}px, ${n.y}px)`;
            curX += n.width + gap;
        });
        this.core.saveHistory('messages.distributeHorizontal');
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }

    distributeVertical(nodes) {
        if (nodes.length < 3) return;
        const sorted = [...nodes].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((s, n) => s + n.height, 0);
        const minY = sorted[0].y;
        const maxY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
        const gap = (maxY - minY - totalHeight) / (sorted.length - 1);

        let curY = sorted[0].y;
        sorted.forEach((n) => {
            this.core.updateNodePosition(n.node.id, n.x, curY);
            n.el.dataset.x = n.x;
            n.el.dataset.y = curY;
            n.el.style.transform = `translate(${n.x}px, ${curY}px)`;
            curY += n.height + gap;
        });
        this.core.saveHistory('messages.distributeVertical');
        this.ui.updateEdges();
        this.updateAlignToolbar();
    }
}
