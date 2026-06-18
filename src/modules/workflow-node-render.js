/**
 * 工作流节点渲染模块
 * 负责节点 DOM 元素创建、canvas 交互（拖拽、点击、选择、删除）
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 节点渲染相关的 mixin 方法
 * @param {import('./workflow-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export function mixinNodeRender(node) {
    node.createElement = function(nodeData) {
        const info = this.core.nodeTypeInfo[nodeData.type] || { title: t('messages.unknownNode'), icon: '📦', description: '', hasInput: true, hasOutput: true };
        const el = document.createElement('div');
        el.className = `canvas-node ${nodeData.type}`;
        el.style.left = `${nodeData.x}px`;
        el.style.top = `${nodeData.y}px`;
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
        } else if (nodeData.type === 'condition' && nodeData.parameters?.branches) {
            const branches = Array.isArray(nodeData.parameters.branches) ? nodeData.parameters.branches : [];
            branches.forEach((branch, i) => {
                const name = (branch && branch.name) ? branch.name : (i === 0 ? 'True' : (i === 1 ? 'False' : `Branch ${i}`));
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
        } else if (info.hasOutput) {
            outputPointsHtml = '<div class="connection-point output"></div>';
        }

        el.innerHTML = `
            <div class="node-header">
                <div class="node-icon">${info.icon}</div>
                <div class="node-title">${StringUtils.escapeHtml(nodeData.title)}</div>
                <div class="node-type">${StringUtils.escapeHtml(nodeData.type)}</div>
            </div>
            <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
            ${inputPoint}
            ${outputPointsHtml}
        `;

        el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener('dblclick', () => this.openEditor(nodeData.id));

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
                    const edge = this.core.createEdge(this.ui.connectingFrom, nodeData.id, this.ui.connectingFromPort);
                    if (edge) {
                        this.core.saveHistory(t('messages.createConnection'));
                    }
                    this.ui.cancelConnection();
                }
            });
        });

        const rect = el.getBoundingClientRect();
        nodeData.width = rect.width;
        nodeData.height = rect.height;

        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            const totalPorts = options.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (nodeData.height * (i + 0.5) / totalPorts) + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        }

        return el;
    };

    node.addToCanvas = function(type, screenX, screenY, data = null) {
        if (!type || !this.core.nodeTypeInfo[type]) return null;

        const { canvasX, canvasY } = this.ui.canvas.screenToCanvas(screenX, screenY);

        const nodeData = this.core.createNode(type, canvasX - 100, canvasY - 50, data);
        const el = this.createElement(nodeData);
        this.ui.canvas.canvasContent.appendChild(el);
        this.ui.canvas.setEmptyState(false);

        this.core.saveHistory(t('actions.addNode', { type }));

        return el;
    };

    node.onMouseDown = function(e, el) {
        if (e.target.classList.contains('connection-point')) return;

        e.preventDefault();
        e.stopPropagation();

        this.ui.dragStartX = e.clientX;
        this.ui.dragStartY = e.clientY;
        this.ui.hasDragged = false;

        const preSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = preSelectedNodes.length > 1;
        const ctrlPressed = e.ctrlKey || e.metaKey;
        const isAlreadySelected = el.classList.contains('selected');

        if (ctrlPressed && isAlreadySelected) {
            el.classList.remove('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length === 0) {
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(null);
                this.ui.showSummaryPanel();
            } else {
                const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
                this.core.selectNode(lastSelected.dataset.nodeId);
                const clickedNode = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
                if (clickedNode) this.renderPropertyPanel(clickedNode);
            }
        } else if (ctrlPressed && !isAlreadySelected) {
            el.classList.add('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length > 1) {
                this.ui.isMultiSelectMode = true;
                this.ui.showSummaryPanel();
            } else {
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.core.nodes.find(n => n.id === el.dataset.nodeId);
                if (clickedNode) this.renderPropertyPanel(clickedNode);
            }
        } else if (!this.ui.isMultiSelectMode && !ctrlPressed && !hasMultipleSelected) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
            el.classList.add('selected');
            this.ui.isMultiSelectMode = false;
            this.core.selectNode(el.dataset.nodeId);
            const clickedNode = this.core.nodes.find(n => n.id === el.dataset.nodeId);
            if (clickedNode) this.renderPropertyPanel(clickedNode);
        } else if (ctrlPressed && (this.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (!isAlreadySelected) {
                el.classList.add('selected');
            }
            this.ui.isMultiSelectMode = true;
            this.ui.showSummaryPanel();
        } else {
            if (!isAlreadySelected && (hasMultipleSelected || this.ui.isMultiSelectMode)) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.core.nodes.find(n => n.id === el.dataset.nodeId);
                if (clickedNode) this.renderPropertyPanel(clickedNode);
            }
            el.classList.add('selected');
        }

        this.ui.align.updateAlignToolbar();

        el.classList.add('dragging');
        el.style.zIndex = 1000;

        const nodeStartPositions = {};
        const selectedNodeEls = Array.from(document.querySelectorAll('.canvas-node.selected'));
        selectedNodeEls.forEach(nodeEl => {
            nodeStartPositions[nodeEl.dataset.nodeId] = {
                x: parseInt(nodeEl.style.left) || 0,
                y: parseInt(nodeEl.style.top) || 0
            };
        });

        let rafId = null;

        const onMouseMove = (e) => {
            const dx = Math.abs(e.clientX - this.ui.dragStartX);
            const dy = Math.abs(e.clientY - this.ui.dragStartY);
            if (dx > 5 || dy > 5) {
                this.ui.hasDragged = true;
            }

            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                const moveDx = (e.clientX - this.ui.dragStartX) / this.ui.canvas.canvasScale;
                const moveDy = (e.clientY - this.ui.dragStartY) / this.ui.canvas.canvasScale;

                for (const nodeEl of selectedNodeEls) {
                    const startPos = nodeStartPositions[nodeEl.dataset.nodeId];
                    const newX = startPos.x + moveDx;
                    const newY = startPos.y + moveDy;
                    nodeEl.style.left = `${newX}px`;
                    nodeEl.style.top = `${newY}px`;
                }
            });
        };

        const onMouseUp = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            selectedNodeEls.forEach(nodeEl => {
                nodeEl.classList.remove('dragging');
                nodeEl.style.zIndex = '';
                const newX = parseInt(nodeEl.style.left) || 0;
                const newY = parseInt(nodeEl.style.top) || 0;
                this.core.updateNodePosition(nodeEl.dataset.nodeId, newX, newY);
            });
            el.classList.remove('dragging');
            el.style.zIndex = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (this.ui.hasDragged) {
                this.core.saveHistory(t('messages.moveNode'));
            }

            this.ui.updateEdges();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    node.onClick = function(e, el) {
        if (e.target.classList.contains('connection-point')) return;

        if (this.ui.hasDragged) {
            this.ui.hasDragged = false;
            return;
        }

        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = selectedNodes.length > 1;
        const clickedNode = e.target.closest('.canvas-node');

        if (!e.ctrlKey && !e.metaKey && (this.ui.isMultiSelectMode || hasMultipleSelected)) {
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

    node.delete = function(nodeId, saveHistory = true, updatePanel = true) {
        this.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();

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
            this.core.saveHistory(t('messages.deleteNode'));
        }
    };
}