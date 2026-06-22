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
        } else if (nodeData.type === 'condition' && nodeData.parameters?.branches) {
            const branches = Array.isArray(nodeData.parameters.branches) ? nodeData.parameters.branches : [];
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
                        this.core.saveHistory(t('messages.createConnection'));
                    }
                    this.ui.cancelConnection();
                }
            });
        });

        const rect = el.getBoundingClientRect();
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
        }

        return el;
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
            const cw = c.width || (info.containerMinWidth || 300);
            const ch = c.height || (info.containerMinHeight || 200);
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
            el.style.width = `${minW}px`;
            el.style.height = `${minH}px`;
            nodeData.width = minW;
            nodeData.height = minH;
        }

        this.core.saveHistory(t('actions.addNode', { type }));

        return el;
    };

    /**
     * 渲染容器节点的子节点
     */
    node.renderContainerChildren = function(containerId) {
        const containerEl = document.querySelector(`[data-node-id="${containerId}"]`);
        if (!containerEl) return;
        const containerBody = containerEl.querySelector('.container-body');
        if (!containerBody) return;

        const containerNode = this.core.nodes.find(n => n.id === containerId);
        if (!containerNode) return;

        const children = this.core.getChildNodes(containerId);
        
        containerBody.querySelectorAll('.canvas-node').forEach(el => el.remove());
        
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
            children.forEach(child => {
                const childEl = this.createElement(child);
                containerBody.appendChild(childEl);
            });
        }
        
        this.updateContainerSize(containerId);
    };

    /**
     * 容器布局常量
     */
    node.CONTAINER_HEADER_H = 36;
    node.CONTAINER_DESC_H = 20;
    node.CONTAINER_BORDER = 4;
    node.CONNECTION_POINT_EXT = 6;

    /**
     * 根据子节点自动调整容器大小
     */
    node.updateContainerSize = function(containerId) {
        const containerEl = document.querySelector(`[data-node-id="${containerId}"]`);
        if (!containerEl) return;
        const containerNode = this.core.nodes.find(n => n.id === containerId);
        if (!containerNode) return;
        const info = this.core.nodeTypeInfo[containerNode.type] || {};
        const minW = info.containerMinWidth || 300;
        const minH = info.containerMinHeight || 200;

        const HEADER_H = this.CONTAINER_HEADER_H;
        const DESC_H = this.CONTAINER_DESC_H;
        const BORDER = this.CONTAINER_BORDER;
        const PADDING = 20;

        const children = containerEl.querySelectorAll('.container-body .canvas-node');
        const bodyEl = containerEl.querySelector('.container-body');
        
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
            return;
        }

        const childData = [];
        let minX = Infinity, minY = Infinity;
        let maxRight = -Infinity, maxBottom = -Infinity;

        children.forEach(child => {
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
        if (alignX !== 0 || alignY !== 0) {
            childData.forEach(cd => {
                cd.left -= alignX;
                cd.top -= alignY;
            });
            containerNode.x += alignX;
            containerNode.y += alignY;
        }

        let newMinX = Infinity, newMinY = Infinity;
        let newMaxRight = -Infinity, newMaxBottom = -Infinity;
        childData.forEach(cd => {
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

        let extraW = bodyW - neededBodyW;
        let extraH = bodyH - neededBodyH;
        let offsetX = 0, offsetY = 0;
        if (extraW > 0) {
            offsetX = extraW / 2;
        }
        if (extraH > 0) {
            offsetY = extraH / 2;
        }
        if (offsetX !== 0 || offsetY !== 0) {
            childData.forEach(cd => {
                cd.left += offsetX;
                cd.top += offsetY;
            });
            containerNode.x -= offsetX;
            containerNode.y -= offsetY;
        }

        childData.forEach(cd => {
            const newLeft = Math.round(cd.left);
            const newTop = Math.round(cd.top);
            cd.el.dataset.x = newLeft;
            cd.el.dataset.y = newTop;
            cd.el.style.transform = `translate(${newLeft}px, ${newTop}px)`;
            const nodeData = this.core.nodes.find(n => n.id === cd.el.dataset.nodeId);
            if (nodeData) {
                nodeData.x = newLeft;
                nodeData.y = newTop;
            }
        });

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

        if (this.ui && this.ui.edge) {
            this.ui.edge.updateAffectedEdges([containerId]);
        }
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

                const parentContainers = new Set();
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

                this.ui._pendingContainers = parentContainers;
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
                        const containerEl = document.querySelector(`[data-node-id="${containerId}"]`);
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
                this.core.saveHistory(t('messages.moveNode'));
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
        });
        this.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();

        if (parentId) {
            this.updateContainerSize(parentId);
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
            this.core.saveHistory(t('messages.deleteNode'));
        }
    };
}