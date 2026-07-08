// @ts-nocheck
/**
 * 工作流节点渲染模块
 * 负责节点 DOM 元素创建、canvas 交互（拖拽、点击、选择、删除）
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { mixinContainerRender } from './workflow-container-render.js';
import { mixinNodeDrag } from './workflow-node-drag.js';

/**
 * 节点渲染相关的 mixin 方法
 * @param {import('./workflow-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export function mixinNodeRender(node) {
    if (!node._elMap) {
        node._elMap = new Map();
    }

    node.createElement = function(nodeData, options = {}) {
        const info = this.core.nodeTypeInfo[nodeData.type] || { title: t('messages.unknownNode'), icon: '📦', description: '', hasInput: true, hasOutput: true };
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
                const name = typeof opt === 'string' ? opt : (opt.name || opt);
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
            outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="default" title="其他"></div>`;
        } else if (nodeData.type === 'intent' && nodeData.parameters?.categories) {
            const categories = Array.isArray(nodeData.parameters.categories) ? nodeData.parameters.categories : [];
            categories.forEach((cat, i) => {
                const name = typeof cat === 'string' ? cat : (cat.name || cat);
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
            outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="default" title="其他"></div>`;
        } else if (nodeData.type === 'condition') {
            const params = nodeData.parameters || {};
            let branches = params.branches;
            if (typeof branches === 'string') {
                try { branches = JSON.parse(branches); } catch { branches = null; }
            }
            if (!Array.isArray(branches) || branches.length === 0) {
                branches = [{ name: '是' }, { name: '否' }];
            }
            branches.forEach((branch, i) => {
                const name = (branch && branch.name) ? branch.name : (i === 0 ? 'True' : (i === 1 ? 'False' : `Branch ${i}`));
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
                this.renderContainerChildren(nodeData.id);
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

        el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX, clientY: touch.clientY,
                    shiftKey: e.shiftKey, ctrlKey: e.ctrlKey
                });
                Object.defineProperty(mouseEvent, 'target', { value: e.target });
                this.onMouseDown(mouseEvent, el);
            }
        }, { passive: false });

        const outputPoints = el.querySelectorAll('.connection-point.output');
        outputPoints.forEach(point => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const portId = point.dataset.portId || '';
                this.ui.startConnection(nodeData.id, e, portId);
            });
        });

        const inputPoints = el.querySelectorAll('.connection-point.input');
        inputPoints.forEach(point => {
            point.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (this.ui.connectingFrom && this.ui.connectingFrom !== nodeData.id) {
                    const targetPortId = point.dataset.portId || '';
                    const edge = this.core.createEdge(this.ui.connectingFrom, nodeData.id, this.ui.connectingFromPort, targetPortId);
                    if (edge) {
                        this.core.saveHistory('messages.createConnection');
                    }
                    this.ui.cancelConnection();
                }
            });
        });

        if (!options.skipMeasure) {
            const rect = this._measureElement(el);
            this._applyMeasurement(el, nodeData, rect);
        }

        this._elMap.set(nodeData.id, el);

        return el;
    };

    node._measureElement = function(el) {
        el.style.visibility = 'hidden';
        el.style.position = 'absolute';
        document.body.appendChild(el);
        const r = el.getBoundingClientRect();
        document.body.removeChild(el);
        el.style.visibility = '';
        el.style.position = '';
        return r;
    };

    node._applyMeasurement = function(el, nodeData, rect) {
        if (rect.width > 0) {
            nodeData.width = rect.width;
            nodeData.height = rect.height;
        }

        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            const totalPorts = options.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (nodeData.height * (i + 0.5) / totalPorts) + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        } else if (nodeData.type === 'intent' && nodeData.parameters?.categories) {
            const categories = Array.isArray(nodeData.parameters.categories) ? nodeData.parameters.categories : [];
            const totalPorts = categories.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (nodeData.height * (i + 0.5) / totalPorts) + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        } else if (nodeData.type === 'condition') {
            let branches = nodeData.parameters?.branches;
            if (typeof branches === 'string') {
                try { branches = JSON.parse(branches); } catch { branches = []; }
            }
            if (!Array.isArray(branches) || branches.length === 0) {
                branches = [{ name: '是' }, { name: '否' }];
            }
            const totalPorts = branches.length;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (nodeData.height * (i + 0.5) / totalPorts) + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        }
    };

    node.batchMeasureElements = function(elements) {
        if (elements.length === 0) return;

        const scale = this.ui.canvas.canvasScale || 1;

        elements.forEach(({el, nodeData}) => {
            const rect = el.getBoundingClientRect();
            const unscaledRect = {
                width: rect.width / scale,
                height: rect.height / scale,
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom
            };
            this._applyMeasurement(el, nodeData, unscaledRect);
        });
    };

    node.addToCanvas = function(type, screenX, screenY, data = null) {
        if (!type || !this.core.nodeTypeInfo[type]) return null;

        const { canvasX, canvasY } = this.ui.canvas.screenToCanvas(screenX, screenY);
        const info = this.core.nodeTypeInfo[type];

        const nodeData = this.core.createNode(type, canvasX - 100, canvasY - 50, data);
        const el = this.createElement(nodeData);
        this.ui.canvas.setEmptyState(false);

        // 检查是否拖入容器
        const containers = this.core.nodes.filter(n => this.core.isContainerNode(n.id));
        let targetContainer = null;
        for (const c of containers) {
            const cx = c.x || 0;
            const cy = c.y || 0;
            const cInfo = this.core.nodeTypeInfo[c.type] || {};
            const cw = c.width || (cInfo.containerMinWidth || 300);
            const ch = c.height || (cInfo.containerMinHeight || 200);
            if (canvasX >= cx && canvasX <= cx + cw && canvasY >= cy + 58 && canvasY <= cy + ch) {
                targetContainer = c;
                break;
            }
        }

        if (targetContainer) {
            nodeData.parentId = targetContainer.id;
            nodeData.x = Math.max(5, Math.round(canvasX - 100 - targetContainer.x));
            nodeData.y = Math.max(5, Math.round(canvasY - 50 - targetContainer.y - 58));
            this.renderContainerChildren(targetContainer.id);
        } else {
            this.ui.canvas.canvasContent.appendChild(el);
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

        this.core.saveHistory('actions.addNode', { type });

        return el;
    };

    mixinContainerRender(node);

    mixinNodeDrag(node);
    node.onClick = function(e, el) {
        if (e.target.classList.contains('connection-point')) return;

        if (this.ui.hasDragged) {
            this.ui.hasDragged = false;
            return;
        }

        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = selectedNodes.length > 1;
        const clickedNode = e.target.closest('.canvas-node');

        if (!e.shiftKey && (this.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (clickedNode && clickedNode.classList.contains('selected')) {
                return;
            } else if (clickedNode) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
                clickedNode.classList.add('selected');
                this.ui.isMultiSelectMode = false;

                this.core.selectNode(clickedNode.dataset.nodeId);
                const targetNode = this.core.nodes.find(n => n.id === clickedNode.dataset.nodeId);
                if (targetNode) this.renderPropertyPanel(targetNode);
                this.ui.updateEdges();
                this.ui.align.updateAlignToolbar();
            }
        }
    };

    node.select = function(el, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(e => e.classList.remove('selected'));
            this.core.selectEdge(null);
            this.ui.isMultiSelectMode = false;
        }

        el.classList.toggle('selected');
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');

        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);
            const targetNode = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (targetNode) this.renderPropertyPanel(targetNode);

            if (selectedNodes.length > 1) {
                this.ui.isMultiSelectMode = true;
            }
        } else {
            this.core.selectNode(null);
            this.ui.showSummaryPanel();
            this.ui.isMultiSelectMode = false;
        }

        this.ui.updateEdges();
        this.ui.align.updateAlignToolbar();
    };

    node.delete = function(nodeId, saveHistory = true, _updatePanel = true) {
        const nodeData = this.core.nodes.find(n => n.id === nodeId);
        if (nodeData && nodeData.locked) {
            this.ui.showMessage(t('messages.nodeLocked'), 'warning');
            return;
        }
        const parentId = nodeData?.parentId;

        const childNodes = this.core.getChildNodes(nodeId);
        childNodes.forEach(child => {
            document.querySelector(`[data-node-id="${child.id}"]`)?.remove();
            this._elMap.delete(child.id);
        });
        this.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
        this._elMap.delete(nodeId);

        if (parentId) {
            this.updateContainerSize(parentId);
            if (this.ui && this.ui.edge) {
                this.ui.edge.updateAffectedEdges([parentId]);
            }
        }

        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        if (selectedEdges.length > 0) {
            const stillExists = Array.from(selectedEdges).some(edge => {
                const edgeId = edge.getAttribute('data-edge-id');
                return this.core.edges.find(e => e.id === edgeId);
            });
            if (!stillExists) {
                this.core.selectEdge(null);
            }
        }

        this.ui.showSummaryPanel();

        if (saveHistory) {
            this.core.saveHistory('messages.deleteNode');
        }
    };

    node._reRenderNode = function(nodeId) {
        const nodeData = this.core.nodes.find(n => n.id === nodeId);
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

        if (this.ui && this.ui.edge) {
            this.ui.edge.updateAffectedEdges([nodeId]);
        }
        if (this.ui && this.ui.canvas) {
            this.ui.canvas.updateSvgSize();
        }

        if (nodeData.parentId) {
            this.updateContainerSize(nodeData.parentId);
        }
    };
}