/**
 * 工作流节点渲染模块
 * 负责节点 DOM 元素创建、canvas 交互（拖拽、点击、选择、删除）
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { mixinContainerRender } from './workflow-container-render.js';

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
        el.className = `canvas-node ${nodeData.type}${isContainer ? ' container' : ''}`;
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
                </div>
                <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
                ${inputPoint}
                ${outputPointsHtml}
            `;
        }

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

        elements.forEach(({el, nodeData}) => {
            const rect = el.getBoundingClientRect();
            this._applyMeasurement(el, nodeData, rect);
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

    node.onMouseDown = function(e, el) {
        if (e.target.classList.contains('connection-point')) return;

        if (el.classList.contains('container') && e.target.closest('.container-body')) {
            return;
        }

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
                x: parseFloat(nodeEl.dataset.x) || 0,
                y: parseFloat(nodeEl.dataset.y) || 0
            };
        });

        let rafId = null;
        let dropTarget = null;

        const clearDropHighlight = () => {
            if (dropTarget) {
                dropTarget.classList.remove('drop-target');
                dropTarget = null;
            }
        };

        const findDropTarget = (clientX, clientY) => {
            selectedNodeEls.forEach(el => el.style.pointerEvents = 'none');
            const elem = document.elementFromPoint(clientX, clientY);
            selectedNodeEls.forEach(el => el.style.pointerEvents = '');
            if (!elem) return null;
            const container = elem.closest('.canvas-node.container');
            if (container && !selectedNodeEls.includes(container)) return container;
            return null;
        };

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
                const ctrlHeld = e.ctrlKey || e.metaKey;
                const moveDx = (e.clientX - this.ui.dragStartX) / this.ui.canvas.canvasScale;
                const moveDy = (e.clientY - this.ui.dragStartY) / this.ui.canvas.canvasScale;

                if (!this.ui._pendingContainers) {
                    this.ui._pendingContainers = new Set();
                }
                const parentContainers = this.ui._pendingContainers;
                const detachedSet = this.ui._ctrlDetached || (this.ui._ctrlDetached = new Set());

                for (const nodeEl of selectedNodeEls) {
                    const startPos = nodeStartPositions[nodeEl.dataset.nodeId];
                    const newX = startPos.x + moveDx;
                    const newY = startPos.y + moveDy;
                    nodeEl.dataset.x = newX;
                    nodeEl.dataset.y = newY;
                    nodeEl.style.transform = `translate(${newX}px, ${newY}px)`;

                    const nodeId = nodeEl.dataset.nodeId;
                    const nodeData = this.core.nodes.find(n => n.id === nodeId);

                    if (ctrlHeld && nodeData && nodeData.parentId && !detachedSet.has(nodeId)) {
                        const parent = this.core.nodes.find(n => n.id === nodeData.parentId);
                        if (parent) {
                            const absX = (parent.x || 0) + newX;
                            const absY = (parent.y || 0) + 58 + newY;

                            nodeEl.remove();
                            this.ui.canvas.canvasContent.appendChild(nodeEl);
                            nodeEl.dataset.x = absX;
                            nodeEl.dataset.y = absY;
                            nodeEl.style.transform = `translate(${absX}px, ${absY}px)`;

                            nodeData.parentId = null;
                            nodeData.x = absX;
                            nodeData.y = absY;

                            nodeStartPositions[nodeId] = { x: absX, y: absY };
                            detachedSet.add(nodeId);

                            parentContainers.add(parent.id);

                            // 断开容器内连接（子节点间、内部端口↔子节点），保留外部端口连接
                            const oldChildren2 = this.core.getChildNodes(parent.id);
                            const childIds2 = new Set(oldChildren2.map(c => c.id));
                            this.core.edges = this.core.edges.filter(edge => {
                                if (edge.source === nodeId) {
                                    if (childIds2.has(edge.target)) return false;
                                    if (edge.target === parent.id) return edge.targetPort !== 'container_end';
                                    return true;
                                }
                                if (edge.target === nodeId) {
                                    if (childIds2.has(edge.source)) return false;
                                    if (edge.source === parent.id) return edge.sourcePort !== 'container_start';
                                    return true;
                                }
                                return true;
                            });
                        }
                    } else if (nodeData && nodeData.parentId && !detachedSet.has(nodeId)) {
                        parentContainers.add(nodeData.parentId);
                    }
                }
            });
        };

        const onMouseUp = (e) => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            const finalTarget = findDropTarget(e.clientX, e.clientY);
            clearDropHighlight();

            const ctrlHeld = e.ctrlKey || e.metaKey;
            const draggedNodeIds = selectedNodeEls.map(el => el.dataset.nodeId);
            const affectedNodeIds = new Set(draggedNodeIds);
            selectedNodeEls.forEach(nodeEl => {
                nodeEl.classList.remove('dragging');
                nodeEl.style.zIndex = '';

                const nodeId = nodeEl.dataset.nodeId;
                const nodeData = this.core.nodes.find(n => n.id === nodeId);
                if (!nodeData) return;

                const newX = parseFloat(nodeEl.dataset.x) || 0;
                const newY = parseFloat(nodeEl.dataset.y) || 0;

                if (finalTarget && !ctrlHeld && finalTarget.dataset.nodeId !== nodeId) {
                    const containerId = finalTarget.dataset.nodeId;
                    const containerNode = this.core.nodes.find(n => n.id === containerId);
                    if (nodeData.parentId !== containerId) {
                        const oldParentId = nodeData.parentId;
                        if (nodeData.parentId) {
                            nodeData.parentId = null;
                        }
                        const containerEl = this._elMap.get(containerId);
                        const body = containerEl.querySelector('.container-body');
                        const headerH = 36;
                        const descH = 20;
                        const containerAbsX = containerNode.x;
                        const containerAbsY = containerNode.y;
                        const relX = newX - containerAbsX;
                        const relY = newY - containerAbsY - headerH - descH;
                        nodeData.parentId = containerId;
                        nodeData.x = Math.max(5, Math.round(relX));
                        nodeData.y = Math.max(5, Math.round(relY));
                        nodeEl.remove();
                        this.renderContainerChildren(containerId);

                        if (oldParentId && oldParentId !== containerId) {
                            this.updateContainerSize(oldParentId);
                            affectedNodeIds.add(oldParentId);
                        }
                        affectedNodeIds.add(containerId);

                        // 断开容器外连接，只保留容器内连接（子节点间、内部端口↔子节点）
                        const containerChildren = this.core.getChildNodes(containerId);
                        const childIds = new Set(containerChildren.map(c => c.id));
                        this.core.edges = this.core.edges.filter(edge => {
                            if (edge.source === nodeId) {
                                if (childIds.has(edge.target)) return true;
                                if (edge.target === containerId) return edge.targetPort === 'container_end';
                                return false;
                            }
                            if (edge.target === nodeId) {
                                if (childIds.has(edge.source)) return true;
                                if (edge.source === containerId) return edge.sourcePort === 'container_start';
                                return false;
                            }
                            return true;
                        });
                    } else {
                        this.core.updateNodePosition(nodeId, newX, newY);
                        this.updateContainerSize(containerId);
                        affectedNodeIds.add(containerId);
                    }
                } else if (ctrlHeld && nodeData.parentId) {
                    const oldParentId = nodeData.parentId;
                    const oldContainer = this.core.nodes.find(n => n.id === oldParentId);
                    const headerH = 36;
                    const descH = 20;
                    const absX = (oldContainer.x || 0) + newX;
                    const absY = (oldContainer.y || 0) + (headerH + descH) + newY;
                    nodeData.parentId = null;
                    nodeData.x = Math.round(absX);
                    nodeData.y = Math.round(absY);
                    nodeEl.remove();
                    this.ui.canvas.canvasContent.appendChild(nodeEl);
                    nodeEl.dataset.x = absX;
                    nodeEl.dataset.y = absY;
                    nodeEl.style.transform = `translate(${absX}px, ${absY}px)`;
                    this.renderContainerChildren(oldParentId);
                    affectedNodeIds.add(oldParentId);

                    // 断开容器内连接（子节点间、内部端口↔子节点），保留外部端口连接
                    const oldChildren = this.core.getChildNodes(oldParentId);
                    const childIds = new Set(oldChildren.map(c => c.id));
                    this.core.edges = this.core.edges.filter(edge => {
                        if (edge.source === nodeId) {
                            if (childIds.has(edge.target)) return false;
                            if (edge.target === oldParentId) return edge.targetPort !== 'container_end';
                            return true;
                        }
                        if (edge.target === nodeId) {
                            if (childIds.has(edge.source)) return false;
                            if (edge.source === oldParentId) return edge.sourcePort !== 'container_start';
                            return true;
                        }
                        return true;
                    });
                } else {
                    this.core.updateNodePosition(nodeId, newX, newY);
                    if (nodeData.parentId) {
                        this.updateContainerSize(nodeData.parentId);
                        affectedNodeIds.add(nodeData.parentId);
                    }
                }
            });

            el.classList.remove('dragging');
            el.style.zIndex = '';

            this.ui._ctrlDetached = null;

            // 拖拽结束后统一处理所有受影响的容器大小（仅触发一次 Reflow）
            if (this.ui._pendingContainers) {
                this.ui._pendingContainers.forEach(pid => {
                    affectedNodeIds.add(pid);
                    this.updateContainerSize(pid);
                });
                this.ui._pendingContainers = null;
            }

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (this.ui.hasDragged) {
                this.core.saveHistory('messages.moveNode');
            }

            this.ui.edge.updateAffectedEdges(Array.from(affectedNodeIds));
            this.ui.canvas.updateSvgSize();
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
        const nodeData = this.core.nodes.find(n => n.id === nodeId);
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