/**
 * 工作流容器渲染模块
 * 负责容器节点（loop、batch）的子节点管理、自动布局和大小调整
 */

import { APP_CONFIG } from '../config/constants.js';

/**
 * 容器渲染相关的 mixin 方法
 * @param {object} node - WorkflowNode 实例
 */
export class WorkflowContainerRender {
    /**
     * @param {import("./editor-node.js").WorkflowNode} node - WorkflowNode 实例
     */
    constructor(node) {
        this.node = node;
        const n = /** @type {*} */ (node);
        if (!n._elMap) {
            n._elMap = new Map();
        }
        if (!n.CONTAINER_HEADER_H) {
            n.CONTAINER_HEADER_H = APP_CONFIG.NODE.CONTAINER_HEADER_H;
        }
        if (!n.CONTAINER_DESC_H) {
            n.CONTAINER_DESC_H = APP_CONFIG.NODE.CONTAINER_DESC_H;
        }
        if (!n.CONTAINER_BORDER) {
            n.CONTAINER_BORDER = 1;
        }
        if (!n.CONNECTION_POINT_EXT) {
            n.CONNECTION_POINT_EXT = 6;
        }
    }

    /**
     * 渲染容器节点的子节点
     * @param {string} containerId - 容器节点ID
     */
    renderContainerChildren(containerId) {
        const containerEl = /** @type {*} */ (this.node)._elMap.get(containerId);
        if (!containerEl) return;
        const containerBody = containerEl.querySelector('.container-body');
        if (!containerBody) return;

        const containerNode = this.node.core.nodes.find((n) => n.id === containerId);
        if (!containerNode) return;

        const children = this.node.core.getChildNodes(containerId);

        containerBody.querySelectorAll('.canvas-node').forEach((el) => el.remove());

        let placeholder = containerBody.querySelector('.container-placeholder');
        if (children.length === 0) {
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.className = 'container-placeholder';
                placeholder.textContent = '拖入节点到此处';
                containerBody.appendChild(placeholder);
            }
        } else {
            if (placeholder) placeholder.remove();
            children.forEach((child) => {
                const childEl = this.node.render.createElement(child);
                containerBody.appendChild(childEl);
            });
        }

        this.updateContainerSize(containerId);
    }

    /**
     * 根据子节点自动调整容器大小
     * @param {string} containerId - 容器节点ID
     */
    updateContainerSize(containerId) {
        const containerNode = this.node.core.nodes.find((n) => n.id === containerId);
        if (!containerNode) return;
        const containerEl = /** @type {*} */ (this.node)._elMap.get(containerId);
        if (!containerEl) return;
        const info = this.node.core.nodeTypeInfo[containerNode.type] || {};
        const minW = info.containerMinWidth || 300;
        const minH = info.containerMinHeight || 200;

        const HEADER_H = /** @type {*} */ (this.node).CONTAINER_HEADER_H;
        const DESC_H = /** @type {*} */ (this.node).CONTAINER_DESC_H;
        const BORDER = /** @type {*} */ (this.node).CONTAINER_BORDER;
        const PADDING = 20;

        const children = containerEl.querySelectorAll('.container-body .canvas-node');
        const bodyEl = containerEl.querySelector('.container-body');

        const allTransitionEls = [containerEl];
        if (bodyEl) allTransitionEls.push(bodyEl);
        children.forEach((child) => allTransitionEls.push(child));
        allTransitionEls.forEach((el) => {
            el.style.transition = 'none';
        });
        containerEl.offsetHeight;

        if (children.length === 0) {
            const bodyW = minW - 2 * BORDER;
            const bodyH = minH - HEADER_H - DESC_H - 2 * BORDER;
            if (bodyEl) {
                bodyEl.style.width = `${bodyW}px`;
                bodyEl.style.height = `${bodyH}px`;
            }
            containerEl.style.width = `${minW}px`;
            containerEl.style.height = `${minH}px`;
            containerNode.width = minW;
            containerNode.height = minH;
            containerEl.offsetHeight;
            allTransitionEls.forEach((el) => {
                el.style.transition = '';
            });
            return;
        }

        const childData = [];
        let minX = Infinity,
            minY = Infinity;
        let maxRight = -Infinity,
            maxBottom = -Infinity;

        children.forEach((child) => {
            const left = parseFloat(child.dataset.x) || 0;
            const top = parseFloat(child.dataset.y) || 0;
            const childW = child.offsetWidth;
            const childH = child.offsetHeight;
            childData.push({ el: child, left, top, w: childW, h: childH });
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxRight = Math.max(maxRight, left + childW);
            maxBottom = Math.max(maxBottom, top + childH);
        });

        const alignX = minX - PADDING;
        const alignY = minY - PADDING;
        if (!containerNode._skipLayout && (alignX !== 0 || alignY !== 0)) {
            childData.forEach((cd) => {
                cd.left -= alignX;
                cd.top -= alignY;
            });
            containerNode.x += alignX;
            containerNode.y += alignY;
        }

        let newMinX = Infinity,
            newMinY = Infinity;
        let newMaxRight = -Infinity,
            newMaxBottom = -Infinity;
        childData.forEach((cd) => {
            newMinX = Math.min(newMinX, cd.left);
            newMinY = Math.min(newMinY, cd.top);
            newMaxRight = Math.max(newMaxRight, cd.left + cd.w);
            newMaxBottom = Math.max(newMaxBottom, cd.top + cd.h);
        });
        minX = newMinX;
        minY = newMinY;
        maxRight = newMaxRight;
        maxBottom = newMaxBottom;

        const childW = maxRight - minX;
        const childH = maxBottom - minY;
        const neededBodyW = childW + 2 * PADDING;
        const neededBodyH = childH + 2 * PADDING;
        let bodyW = Math.max(minW - 2 * BORDER, neededBodyW);
        let bodyH = Math.max(minH - HEADER_H - DESC_H - 2 * BORDER, neededBodyH);

        const extraW = bodyW - neededBodyW;
        const extraH = bodyH - neededBodyH;
        let offsetX = 0,
            offsetY = 0;
        if (!containerNode._skipLayout) {
            if (extraW > 0) {
                offsetX = extraW / 2;
            }
            if (extraH > 0) {
                offsetY = extraH / 2;
            }
        }
        if (offsetX !== 0 || offsetY !== 0) {
            childData.forEach((cd) => {
                cd.left += offsetX;
                cd.top += offsetY;
            });
            containerNode.x -= offsetX;
            containerNode.y -= offsetY;
        }

        if (!containerNode._skipLayout) {
            childData.forEach((cd) => {
                const newLeft = Math.round(cd.left);
                const newTop = Math.round(cd.top);
                cd.el.dataset.x = newLeft;
                cd.el.dataset.y = newTop;
                cd.el.style.transform = `translate(${newLeft}px, ${newTop}px)`;
                const nodeData = this.node.core.nodes.find((n) => n.id === cd.el.dataset.nodeId);
                if (nodeData) {
                    nodeData.x = newLeft;
                    nodeData.y = newTop;
                }
            });
        } else {
            childData.forEach((cd) => {
                cd.el.dataset.x = cd.left;
                cd.el.dataset.y = cd.top;
                cd.el.style.transform = `translate(${cd.left}px, ${cd.top}px)`;
            });
        }

        containerNode.x = Math.round(containerNode.x);
        containerNode.y = Math.round(containerNode.y);
        containerEl.dataset.x = containerNode.x;
        containerEl.dataset.y = containerNode.y;
        containerEl.style.transform = `translate(${containerNode.x}px, ${containerNode.y}px)`;

        bodyW = Math.round(bodyW);
        bodyH = Math.round(bodyH);
        if (bodyEl) {
            bodyEl.style.width = `${bodyW}px`;
            bodyEl.style.height = `${bodyH}px`;
        }

        const w = Math.round(Math.max(minW, bodyW + 2 * BORDER));
        const h = Math.round(Math.max(minH, HEADER_H + DESC_H + bodyH + 2 * BORDER));
        containerEl.style.width = `${w}px`;
        containerEl.style.height = `${h}px`;
        containerNode.width = w;
        containerNode.height = h;
        delete containerNode._skipLayout;

        if (this.node.ui && this.node.ui.edge) {
            this.node.ui.edge.updateAffectedEdges([containerId]);
        }

        containerEl.offsetHeight;
        allTransitionEls.forEach((el) => {
            el.style.transition = '';
        });
    }
}
