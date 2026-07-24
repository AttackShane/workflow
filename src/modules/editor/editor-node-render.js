/**
 * 工作流节点渲染模块
 * 负责节点 DOM 元素创建、canvas 交互（拖拽、点击、选择、删除）
 */
import { StringUtils } from '../../utils/helpers.js';
import { APP_CONFIG } from '../../config/constants.js';
import { t } from '../../i18n/i18n.js';
import { WorkflowContainerRender } from './editor-container-render.js';
import { WorkflowNodeDrag } from './editor-node-drag.js';

/**
 * 节点渲染相关的方法
 * @param {import('./editor-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export class WorkflowNodeRender {
    /**
     * @param {import('./editor-node.js').WorkflowNode} node - WorkflowNode 实例
     */
    constructor(node) {
        this.node = node;
        const n = /** @type {*} */ (node);
        if (!n._elMap) {
            n._elMap = new Map();
        }
        this.drag = new WorkflowNodeDrag(node);
        this.container = new WorkflowContainerRender(node);
    }

    createElement(nodeData, options = {}) {
        const info = this.node.core.nodeTypeInfo[nodeData.type] || {
            title: t('messages.unknownNode'),
            icon: '📦',
            description: '',
            hasInput: true,
            hasOutput: true,
        };
        const el = document.createElement('div');
        const isContainer = info.hasContainer === true;
        el.className = `canvas-node ${nodeData.type}${isContainer ? ' container' : ''}${nodeData.locked ? ' locked' : ''}`;
        el.style.left = '0';
        el.style.top = '0';
        el.dataset.x = nodeData.x;
        el.dataset.y = nodeData.y;
        el.style.transform = `translate(${nodeData.x}px, ${nodeData.y}px)`;
        el.dataset.nodeId = nodeData.id;

        const inputPoint = info.hasInput ? '<div class="connection-point input"></div>' : '';

        let outputPointsHtml = '';
        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            options.forEach((opt, i) => {
                const name = typeof opt === 'string' ? opt : opt.name || opt;
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
            outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="default" title="其他"></div>`;
        } else if (nodeData.type === 'intent' && nodeData.parameters?.categories) {
            const categories = Array.isArray(nodeData.parameters.categories) ? nodeData.parameters.categories : [];
            categories.forEach((cat, i) => {
                const name = typeof cat === 'string' ? cat : cat.name || cat;
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
            outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="default" title="其他"></div>`;
        } else if (nodeData.type === 'condition') {
            const params = nodeData.parameters || {};
            let branches = params.branches;
            if (typeof branches === 'string') {
                try {
                    branches = JSON.parse(branches);
                } catch {
                    branches = null;
                }
            }
            if (!Array.isArray(branches) || branches.length === 0) {
                branches = [{ name: '是' }, { name: '否' }];
            }
            branches.forEach((branch, i) => {
                const name = branch && branch.name ? branch.name : i === 0 ? 'True' : i === 1 ? 'False' : `Branch ${i}`;
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
        } else if (info.hasOutput) {
            outputPointsHtml = '<div class="connection-point output"></div>';
        }

        if (isContainer) {
            el.innerHTML = `
                <div class="node-header">
                    <div class="node-icon">${info.icon}</div>
                    <div class="node-title">${StringUtils.escapeHtml(nodeData.title)}</div>
                    <div class="node-type">${StringUtils.escapeHtml(nodeData.type)}</div>
                    ${nodeData.locked ? '<div class="node-lock-icon" title="已锁定">🔒</div>' : ''}
                </div>
                <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
                <div class="container-body">
                    <div class="connection-point output container-port" data-port-id="container_start"></div>
                    <div class="connection-point input container-port" data-port-id="container_end"></div>
                </div>
                ${inputPoint}
                ${outputPointsHtml}
            `;
            const minW = info.containerMinWidth || 300;
            const minH = info.containerMinHeight || 200;
            const w = nodeData.width || minW;
            const h = nodeData.height || minH;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            nodeData.width = w;
            nodeData.height = h;

            requestAnimationFrame(() => {
                this.container.renderContainerChildren(nodeData.id);
            });
        } else {
            el.innerHTML = `
                <div class="node-header">
                    <div class="node-icon">${info.icon}</div>
                    <div class="node-title">${StringUtils.escapeHtml(nodeData.title)}</div>
                    <div class="node-type">${StringUtils.escapeHtml(nodeData.type)}</div>
                    ${nodeData.locked ? '<div class="node-lock-icon" title="已锁定">🔒</div>' : ''}
                </div>
                <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
                ${inputPoint}
                ${outputPointsHtml}
            `;
        }

        el.addEventListener('mousedown', (e) => this.drag.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousedown', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                    });
                    Object.defineProperty(mouseEvent, 'target', { value: e.target });
                    this.drag.onMouseDown(mouseEvent, el);
                }
            },
            { passive: false }
        );

        const outputPoints = el.querySelectorAll('.connection-point.output');
        outputPoints.forEach((point) => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const portId = /** @type {HTMLElement} */ (point).dataset.portId || '';
                this.node.ui.startConnection(nodeData.id, e, portId);
            });
        });

        const inputPoints = el.querySelectorAll('.connection-point.input');
        inputPoints.forEach((point) => {
            point.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (this.node.ui.connectingFrom && this.node.ui.connectingFrom !== nodeData.id) {
                    const targetPortId = /** @type {HTMLElement} */ (point).dataset.portId || '';
                    const result = this.node.core.createEdge(
                        this.node.ui.connectingFrom,
                        nodeData.id,
                        this.node.ui.connectingFromPort,
                        targetPortId
                    );
                    if (result && !result.error) {
                        this.node.core.saveHistory('messages.createConnection');
                    }
                    this.node.ui.cancelConnection();
                }
            });
        });

        if (!options.skipMeasure) {
            const rect = this._measureElement(el);
            this._applyMeasurement(el, nodeData, rect);
        }

        /** @type {*} */ (this.node)._elMap.set(nodeData.id, el);

        return el;
    }

    _measureElement(el) {
        el.style.visibility = 'hidden';
        el.style.position = 'absolute';
        document.body.appendChild(el);
        const r = el.getBoundingClientRect();
        document.body.removeChild(el);
        el.style.visibility = '';
        el.style.position = '';
        return r;
    }

    _applyMeasurement(el, nodeData, rect) {
        // 不覆盖 nodeData.width/height，统一使用 CSS 定义的固定尺寸（200x100）
        // 分支端口的垂直位置仍然需要根据节点高度计算
        const effectiveHeight = nodeData.height || rect.height;

        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            const totalPorts = options.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (effectiveHeight * (i + 0.5)) / totalPorts + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        } else if (nodeData.type === 'intent' && nodeData.parameters?.categories) {
            const categories = Array.isArray(nodeData.parameters.categories) ? nodeData.parameters.categories : [];
            const totalPorts = categories.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (effectiveHeight * (i + 0.5)) / totalPorts + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        } else if (nodeData.type === 'condition') {
            let branches = nodeData.parameters?.branches;
            if (typeof branches === 'string') {
                try {
                    branches = JSON.parse(branches);
                } catch {
                    branches = [];
                }
            }
            if (!Array.isArray(branches) || branches.length === 0) {
                branches = [{ name: '是' }, { name: '否' }];
            }
            const totalPorts = branches.length;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (effectiveHeight * (i + 0.5)) / totalPorts + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        }
    }

    batchMeasureElements(elements) {
        if (elements.length === 0) return;

        const scale = this.node.ui.canvas.canvasScale || 1;

        elements.forEach(({ el, nodeData }) => {
            const rect = el.getBoundingClientRect();
            const unscaledRect = {
                width: rect.width / scale,
                height: rect.height / scale,
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            };
            this._applyMeasurement(el, nodeData, unscaledRect);
        });
    }

    addToCanvas(type, screenX, screenY, data = null) {
        if (!type || !this.node.core.nodeTypeInfo[type]) return null;

        const { canvasX, canvasY } = this.node.ui.canvas.screenToCanvas(screenX, screenY);
        const info = this.node.core.nodeTypeInfo[type];

        const nodeData = this.node.core.createNode(type, canvasX - 100, canvasY - 50, data);
        const el = this.createElement(nodeData);
        this.node.ui.canvas.setEmptyState(false);

        // 检查是否拖入容器
        const containers = this.node.core.nodes.filter((n) => this.node.core.container.isContainer(n.id));
        let targetContainer = null;
        for (const c of containers) {
            const cx = c.x || 0;
            const cy = c.y || 0;
            const cInfo = this.node.core.nodeTypeInfo[c.type] || {};
            const cw = c.width || cInfo.containerMinWidth || 300;
            const ch = c.height || cInfo.containerMinHeight || 200;
            if (
                canvasX >= cx &&
                canvasX <= cx + cw &&
                canvasY >= cy + APP_CONFIG.NODE.CONTAINER_BODY_OFFSET &&
                canvasY <= cy + ch
            ) {
                targetContainer = c;
                break;
            }
        }

        if (targetContainer) {
            nodeData.parentId = targetContainer.id;
            nodeData.x = Math.max(5, Math.round(canvasX - 100 - targetContainer.x));
            nodeData.y = Math.max(
                5,
                Math.round(canvasY - 50 - targetContainer.y - APP_CONFIG.NODE.CONTAINER_BODY_OFFSET)
            );
            this.container.renderContainerChildren(targetContainer.id);
        } else {
            this.node.ui.canvas.canvasContent.appendChild(el);
        }

        if (info.hasContainer) {
            const minW = info.containerMinWidth || 300;
            const minH = info.containerMinHeight || 200;
            const w = nodeData.width || minW;
            const h = nodeData.height || minH;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            nodeData.width = w;
            nodeData.height = h;
        }

        this.node.core.saveHistory('actions.addNode', { type });

        return el;
    }

    onClick(e, _el) {
        const target = /** @type {Element} */ (e.target);
        if (target.classList.contains('connection-point')) return;

        if (this.node.ui.hasDragged) {
            this.node.ui.hasDragged = false;
            return;
        }

        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = selectedNodes.length > 1;
        const clickedNode = target.closest('.canvas-node');

        if (!e.shiftKey && (this.node.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (clickedNode) {
                // 如果当前在多选模式或已经有多个选中，点击任意节点都清除其他选择只选这个
                // 即使节点已选中也要重新渲染属性面板
                document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
                clickedNode.classList.add('selected');
                this.node.ui.isMultiSelectMode = false;

                this.node.core.selectNode(/** @type {HTMLElement} */ (clickedNode).dataset.nodeId);
                const targetNode = this.node.core.getNode(/** @type {HTMLElement} */ (clickedNode).dataset.nodeId);
                if (targetNode) this.node.panel.renderPropertyPanel(targetNode);
                this.node.ui.updateEdges();
                this.node.ui.align.updateAlignToolbar();
            }
        } else if (clickedNode) {
            // 单选模式，清除其他选择，选中当前节点，渲染属性面板
            document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
            clickedNode.classList.add('selected');
            this.node.core.selectEdge(null);
            this.node.ui.isMultiSelectMode = false;

            this.node.core.selectNode(/** @type {HTMLElement} */ (clickedNode).dataset.nodeId);
            const targetNode = this.node.core.getNode(/** @type {HTMLElement} */ (clickedNode).dataset.nodeId);
            if (targetNode) this.node.panel.renderPropertyPanel(targetNode);
            this.node.ui.updateEdges();
            this.node.ui.align.updateAlignToolbar();
        }
    }

    select(el, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach((e) => e.classList.remove('selected'));
            this.node.core.selectEdge(null);
            this.node.ui.isMultiSelectMode = false;
        }

        el.classList.toggle('selected');
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');

        if (selectedNodes.length > 0) {
            const lastSelected = /** @type {HTMLElement} */ (selectedNodes[selectedNodes.length - 1]);
            this.node.core.selectNode(lastSelected.dataset.nodeId);
            const targetNode = this.node.core.getNode(lastSelected.dataset.nodeId);
            if (targetNode) this.node.panel.renderPropertyPanel(targetNode);

            if (selectedNodes.length > 1) {
                this.node.ui.isMultiSelectMode = true;
            }
        } else {
            this.node.core.selectNode(null);
            this.node.ui.showSummaryPanel();
            this.node.ui.isMultiSelectMode = false;
        }

        this.node.ui.updateEdges();
        this.node.ui.align.updateAlignToolbar();
    }

    delete(nodeId, saveHistory = true, _updatePanel = true) {
        const nodeData = this.node.core.getNode(nodeId);
        if (nodeData && nodeData.locked) {
            this.node.ui.showMessage(t('messages.nodeLocked'), 'warning');
            return;
        }
        const parentId = nodeData?.parentId;

        const childNodes = this.node.core.container.getChildren(nodeId);
        childNodes.forEach((child) => {
            document.querySelector(`[data-node-id="${child.id}"]`)?.remove();
            /** @type {*} */ (this.node)._elMap.delete(child.id);
        });
        this.node.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
        /** @type {*} */ (this.node)._elMap.delete(nodeId);

        if (parentId) {
            this.container.updateContainerSize(parentId);
            if (this.node.ui && this.node.ui.edge) {
                this.node.ui.edge.updateAffectedEdges([parentId]);
            }
        }

        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        if (selectedEdges.length > 0) {
            const stillExists = Array.from(selectedEdges).some((edge) => {
                const edgeId = edge.getAttribute('data-edge-id');
                return this.node.core.getEdge(edgeId);
            });
            if (!stillExists) {
                this.node.core.selectEdge(null);
            }
        }

        this.node.ui.showSummaryPanel();

        if (saveHistory) {
            this.node.core.saveHistory('messages.deleteNode');
        }
    }

    _reRenderNode(nodeId) {
        const nodeData = this.node.core.getNode(nodeId);
        if (!nodeData) return;

        const oldEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!oldEl) return;

        const parent = oldEl.parentElement;
        if (!parent) return;

        const wasSelected = oldEl.classList.contains('selected');

        const newEl = this.createElement(nodeData);
        parent.replaceChild(newEl, oldEl);

        if (wasSelected) {
            newEl.classList.add('selected');
        }

        if (this.node.ui && this.node.ui.edge) {
            this.node.ui.edge.updateAffectedEdges([nodeId]);
        }
        if (this.node.ui && this.node.ui.canvas) {
            this.node.ui.canvas.updateSvgSize();
        }

        if (nodeData.parentId) {
            this.container.updateContainerSize(nodeData.parentId);
        }
    }
}
