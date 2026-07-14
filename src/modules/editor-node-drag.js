/**
 * 工作流节点拖拽模块
 * 处理节点拖拽、多选拖拽、智能对齐吸附、容器拖入拖出
 */

/**
 * 混入拖拽和对齐相关方法到 WorkflowNode
 * @param {import('./editor-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export class WorkflowNodeDrag {
    /**
     * @param {import('./editor-node.js').WorkflowNode} node - WorkflowNode 实例
     */
    constructor(node) {
        this.node = node;
    }

    /**
     * 处理鼠标按下开始拖拽
     * @param {MouseEvent} e - 鼠标事件
     * @param {HTMLElement} el - 节点元素
     */
    onMouseDown(e, el) {
        if (/** @type {Element} */ (e.target).classList.contains('connection-point')) return;

        if (el.classList.contains('container') && /** @type {Element} */ (e.target).closest('.container-body')) {
            return;
        }

        const nodeId = el.dataset.nodeId;
        const nodeData = this.node.core.nodes.find((n) => n.id === nodeId);
        if (nodeData && nodeData.locked) {
            if (e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                const isAlreadySelected = el.classList.contains('selected');

                if (isAlreadySelected) {
                    el.classList.remove('selected');
                    const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
                    if (newSelectedNodes.length === 0) {
                        this.node.ui.isMultiSelectMode = false;
                        this.node.core.selectNode(null);
                        this.node.ui.showSummaryPanel();
                    } else {
                        const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
                        this.node.core.selectNode(/** @type {HTMLElement} */ (lastSelected).dataset.nodeId);
                        const clickedNode = this.node.core.nodes.find(
                            (n) => n.id === /** @type {HTMLElement} */ (lastSelected).dataset.nodeId
                        );
                        if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
                    }
                } else {
                    el.classList.add('selected');
                    const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
                    if (newSelectedNodes.length > 1) {
                        this.node.ui.isMultiSelectMode = true;
                        this.node.ui.showSummaryPanel();
                    } else {
                        this.node.ui.isMultiSelectMode = false;
                        this.node.core.selectNode(el.dataset.nodeId);
                        const clickedNode = this.node.core.nodes.find((n) => n.id === el.dataset.nodeId);
                        if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
                    }
                    this.node.ui.align.updateAlignToolbar();
                }
            } else if (!el.classList.contains('selected')) {
                e.preventDefault();
                e.stopPropagation();
                document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
                el.classList.add('selected');
                this.node.ui.isMultiSelectMode = false;
                this.node.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.node.core.nodes.find((n) => n.id === el.dataset.nodeId);
                if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
                this.node.ui.align.updateAlignToolbar();
            }
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.node.ui.dragStartX = e.clientX;
        this.node.ui.dragStartY = e.clientY;
        this.node.ui.hasDragged = false;

        const preSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = preSelectedNodes.length > 1;
        const shiftPressed = e.shiftKey;
        const isAlreadySelected = el.classList.contains('selected');

        if (shiftPressed && isAlreadySelected) {
            el.classList.remove('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length === 0) {
                this.node.ui.isMultiSelectMode = false;
                this.node.core.selectNode(null);
                this.node.ui.showSummaryPanel();
            } else {
                const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
                this.node.core.selectNode(/** @type {HTMLElement} */ (lastSelected).dataset.nodeId);
                const clickedNode = this.node.core.nodes.find(
                    (n) => n.id === /** @type {HTMLElement} */ (lastSelected).dataset.nodeId
                );
                if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
            }
        } else if (shiftPressed && !isAlreadySelected) {
            el.classList.add('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length > 1) {
                this.node.ui.isMultiSelectMode = true;
                this.node.ui.showSummaryPanel();
            } else {
                this.node.ui.isMultiSelectMode = false;
                this.node.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.node.core.nodes.find((n) => n.id === el.dataset.nodeId);
                if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
            }
        } else if (!this.node.ui.isMultiSelectMode && !shiftPressed && !hasMultipleSelected) {
            document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
            el.classList.add('selected');
            this.node.ui.isMultiSelectMode = false;
            this.node.core.selectNode(el.dataset.nodeId);
            const clickedNode = this.node.core.nodes.find((n) => n.id === el.dataset.nodeId);
            if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
        } else if (shiftPressed && (this.node.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (!isAlreadySelected) {
                el.classList.add('selected');
            }
            this.node.ui.isMultiSelectMode = true;
            this.node.ui.showSummaryPanel();
        } else {
            if (!isAlreadySelected && (hasMultipleSelected || this.node.ui.isMultiSelectMode)) {
                document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
                this.node.ui.isMultiSelectMode = false;
                this.node.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.node.core.nodes.find((n) => n.id === el.dataset.nodeId);
                if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
            }
            el.classList.add('selected');
        }

        this.node.ui.align.updateAlignToolbar();

        el.classList.add('dragging');
        el.style.zIndex = '1000';

        const guidesEl = document.getElementById('alignmentGuides');
        if (guidesEl) guidesEl.innerHTML = '';

        const nodeStartPositions = {};
        const selectedNodeEls = Array.from(document.querySelectorAll('.canvas-node.selected')).filter((nodeEl) => {
            const nodeData = this.node.core.nodes.find(
                (n) => n.id === /** @type {HTMLElement} */ (nodeEl).dataset.nodeId
            );
            return !nodeData || !nodeData.locked;
        });
        selectedNodeEls.forEach((nodeEl) => {
            const el = /** @type {HTMLElement} */ (nodeEl);
            nodeStartPositions[el.dataset.nodeId] = {
                x: parseFloat(el.dataset.x) || 0,
                y: parseFloat(el.dataset.y) || 0,
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
            const canvasRect = this.node.ui.canvas.canvas.getBoundingClientRect();
            const screenX = clientX - canvasRect.left;
            const screenY = clientY - canvasRect.top;
            const { canvasX, canvasY } = this.node.ui.canvas.screenToCanvas(screenX, screenY);

            const containers = this.node.core.nodes.filter((n) => this.node.core.isContainerNode(n.id));
            for (const c of containers) {
                if (selectedNodeEls.some((el) => /** @type {HTMLElement} */ (el).dataset.nodeId === c.id)) continue;
                const cx = c.x || 0;
                const cy = c.y || 0;
                const cInfo = this.node.core.nodeTypeInfo[c.type] || {};
                const cw = c.width || cInfo.containerMinWidth || 300;
                const ch = c.height || cInfo.containerMinHeight || 200;
                const headerH = 58;
                if (canvasX >= cx && canvasX <= cx + cw && canvasY >= cy + headerH && canvasY <= cy + ch) {
                    return /** @type {*} */ (this.node)._elMap.get(c.id) || null;
                }
            }
            return null;
        };

        const onMouseMove = (e) => {
            const dx = Math.abs(e.clientX - this.node.ui.dragStartX);
            const dy = Math.abs(e.clientY - this.node.ui.dragStartY);
            if (dx > 5 || dy > 5) {
                this.node.ui.hasDragged = true;
            }

            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                const ctrlHeld = e.ctrlKey || e.metaKey;
                const moveDx = (e.clientX - this.node.ui.dragStartX) / this.node.ui.canvas.canvasScale;
                const moveDy = (e.clientY - this.node.ui.dragStartY) / this.node.ui.canvas.canvasScale;

                if (!this.node.ui._pendingContainers) {
                    this.node.ui._pendingContainers = new Set();
                }
                const parentContainers = this.node.ui._pendingContainers;
                const detachedSet = this.node.ui._ctrlDetached || (this.node.ui._ctrlDetached = new Set());

                const LOOP_ONLY_NODES = new Set(['break', 'loop_set_variable', 'loop_continue']);

                const primaryEl = selectedNodeEls[0];
                const primaryStartPos = nodeStartPositions[/** @type {HTMLElement} */ (primaryEl).dataset.nodeId];
                const snapOffsets = /** @type {*} */ (this).computeAlignment(
                    /** @type {HTMLElement} */ (primaryEl),
                    primaryStartPos.x + moveDx,
                    primaryStartPos.y + moveDy,
                    selectedNodeEls
                );
                const snapDX = snapOffsets.snapX;
                const snapDY = snapOffsets.snapY;

                for (const nodeEl of selectedNodeEls) {
                    const el = /** @type {HTMLElement} */ (nodeEl);
                    const startPos = nodeStartPositions[el.dataset.nodeId];
                    let newX = startPos.x + moveDx + snapDX;
                    let newY = startPos.y + moveDy + snapDY;
                    const nodeId = el.dataset.nodeId;
                    const nodeData = this.node.core.nodes.find((n) => n.id === nodeId);

                    if (this.node.ui.canvas.snapEnabled) {
                        newX = this.node.ui.canvas.snapToGrid(newX);
                        newY = this.node.ui.canvas.snapToGrid(newY);
                    }

                    el.dataset.x = newX;
                    el.dataset.y = newY;
                    el.style.transform = `translate(${newX}px, ${newY}px)`;

                    if (ctrlHeld && nodeData && nodeData.parentId && !detachedSet.has(nodeId)) {
                        if (LOOP_ONLY_NODES.has(nodeData.type)) {
                            parentContainers.add(nodeData.parentId);
                            continue;
                        }
                        const parent = this.node.core.nodes.find((n) => n.id === nodeData.parentId);
                        if (parent) {
                            const absX = (parent.x || 0) + newX;
                            const absY = (parent.y || 0) + 58 + newY;

                            nodeEl.remove();
                            this.node.ui.canvas.canvasContent.appendChild(nodeEl);
                            const detachedEl = /** @type {HTMLElement} */ (nodeEl);
                            detachedEl.dataset.x = absX;
                            detachedEl.dataset.y = absY;
                            detachedEl.style.transform = `translate(${absX}px, ${absY}px)`;

                            nodeData.parentId = null;
                            nodeData.x = absX;
                            nodeData.y = absY;

                            nodeStartPositions[nodeId] = { x: absX, y: absY };
                            detachedSet.add(nodeId);

                            parentContainers.add(parent.id);

                            const oldChildren2 = this.node.core.getChildNodes(parent.id);
                            const childIds2 = new Set(oldChildren2.map((c) => c.id));
                            this.node.core.edges = this.node.core.edges.filter((edge) => {
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

                const target = findDropTarget(e.clientX, e.clientY);
                if (target !== dropTarget) {
                    if (dropTarget) {
                        dropTarget.classList.remove('drop-target');
                    }
                    dropTarget = target;
                    if (dropTarget) {
                        dropTarget.classList.add('drop-target');
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
            const draggedNodeIds = selectedNodeEls.map((el) => /** @type {HTMLElement} */ (el).dataset.nodeId);
            const affectedNodeIds = new Set(draggedNodeIds);
            selectedNodeEls.forEach((nodeEl) => {
                const el = /** @type {HTMLElement} */ (nodeEl);
                el.classList.remove('dragging');
                el.style.zIndex = '';

                const nodeId = el.dataset.nodeId;
                const nodeData = this.node.core.nodes.find((n) => n.id === nodeId);
                if (!nodeData) return;

                const newX = parseFloat(el.dataset.x) || 0;
                const newY = parseFloat(el.dataset.y) || 0;

                if (finalTarget && !ctrlHeld && finalTarget.dataset.nodeId !== nodeId) {
                    const containerId = finalTarget.dataset.nodeId;
                    const containerNode = this.node.core.nodes.find((n) => n.id === containerId);
                    const LOOP_ONLY_NODES = new Set(['break', 'loop_set_variable', 'loop_continue']);
                    if (LOOP_ONLY_NODES.has(nodeData.type) && nodeData.parentId !== containerId) {
                        if (nodeData.parentId) {
                            this.node.container.updateContainerSize(nodeData.parentId);
                            affectedNodeIds.add(nodeData.parentId);
                        }
                        return;
                    }
                    if (nodeData.parentId !== containerId) {
                        const oldParentId = nodeData.parentId;
                        const oldParent = oldParentId ? this.node.core.nodes.find((n) => n.id === oldParentId) : null;
                        const oldHeaderH = oldParent ? 58 : 0;
                        if (nodeData.parentId) {
                            nodeData.parentId = null;
                        }
                        const containerEl = /** @type {*} */ (this.node)._elMap.get(containerId);
                        const _body = containerEl.querySelector('.container-body');
                        const headerH = 36;
                        const descH = 20;
                        const containerAbsX = containerNode.x;
                        const containerAbsY = containerNode.y;
                        const canvasX = oldParent ? oldParent.x + newX : newX;
                        const canvasY = oldParent ? oldParent.y + oldHeaderH + newY : newY;
                        const relX = canvasX - containerAbsX;
                        const relY = canvasY - containerAbsY - headerH - descH;
                        nodeData.parentId = containerId;
                        nodeData.x = Math.max(5, Math.round(relX));
                        nodeData.y = Math.max(5, Math.round(relY));
                        nodeEl.remove();
                        this.node.container.renderContainerChildren(containerId);

                        if (oldParentId && oldParentId !== containerId) {
                            this.node.container.updateContainerSize(oldParentId);
                            affectedNodeIds.add(oldParentId);
                        }
                        affectedNodeIds.add(containerId);

                        const containerChildren = this.node.core.getChildNodes(containerId);
                        const childIds = new Set(containerChildren.map((c) => c.id));
                        this.node.core.edges = this.node.core.edges.filter((edge) => {
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
                        this.node.core.updateNodePosition(nodeId, newX, newY);
                        this.node.container.updateContainerSize(containerId);
                        affectedNodeIds.add(containerId);
                    }
                } else if (ctrlHeld && nodeData.parentId) {
                    const LOOP_ONLY_NODES = new Set(['break', 'loop_set_variable', 'loop_continue']);
                    if (LOOP_ONLY_NODES.has(nodeData.type)) {
                        if (nodeData.parentId) {
                            this.node.container.updateContainerSize(nodeData.parentId);
                            affectedNodeIds.add(nodeData.parentId);
                        }
                        return;
                    }
                    const oldParentId = nodeData.parentId;
                    const oldContainer = this.node.core.nodes.find((n) => n.id === oldParentId);
                    const headerH = 36;
                    const descH = 20;
                    const absX = (oldContainer.x || 0) + newX;
                    const absY = (oldContainer.y || 0) + (headerH + descH) + newY;
                    nodeData.parentId = null;
                    nodeData.x = Math.round(absX);
                    nodeData.y = Math.round(absY);
                    nodeEl.remove();
                    this.node.ui.canvas.canvasContent.appendChild(nodeEl);
                    const reattachedEl = /** @type {HTMLElement} */ (nodeEl);
                    reattachedEl.dataset.x = absX;
                    reattachedEl.dataset.y = absY;
                    reattachedEl.style.transform = `translate(${absX}px, ${absY}px)`;
                    this.node.container.renderContainerChildren(oldParentId);
                    affectedNodeIds.add(oldParentId);

                    const oldChildren = this.node.core.getChildNodes(oldParentId);
                    const childIds = new Set(oldChildren.map((c) => c.id));
                    this.node.core.edges = this.node.core.edges.filter((edge) => {
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
                    this.node.core.updateNodePosition(nodeId, newX, newY);
                    if (nodeData.parentId) {
                        this.node.container.updateContainerSize(nodeData.parentId);
                        affectedNodeIds.add(nodeData.parentId);
                    }
                }
            });

            el.classList.remove('dragging');
            el.style.zIndex = '';

            this.node.ui._ctrlDetached = null;

            if (this.node.ui._pendingContainers) {
                this.node.ui._pendingContainers.forEach((pid) => {
                    affectedNodeIds.add(pid);
                    this.node.container.updateContainerSize(pid);
                });
                this.node.ui._pendingContainers = null;
            }

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('keydown', onKeyDown);

            if (this.node.ui.hasDragged) {
                this.node.core.saveHistory('messages.moveNode');
            }

            this.node.ui.edge.updateAffectedEdges(Array.from(affectedNodeIds));
            this.node.ui.canvas.updateSvgSize();

            const guidesEl = document.getElementById('alignmentGuides');
            if (guidesEl) guidesEl.innerHTML = '';
        };

        const cleanupDrag = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            clearDropHighlight();
            selectedNodeEls.forEach((nodeEl) => {
                const el = /** @type {HTMLElement} */ (nodeEl);
                el.classList.remove('dragging');
                el.style.zIndex = '';
            });
            el.classList.remove('dragging');
            el.style.zIndex = '';

            this.node.ui._ctrlDetached = null;
            if (this.node.ui._pendingContainers) {
                this.node.ui._pendingContainers = null;
            }

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('keydown', onKeyDown);

            const guidesEl = document.getElementById('alignmentGuides');
            if (guidesEl) guidesEl.innerHTML = '';
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupDrag();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
    }

    /**
     * 计算智能对齐辅助线，返回需要吸附的偏移量
     * @param {HTMLElement} draggedEl - 拖拽的主节点元素
     * @param {number} dragX - 拖拽节点当前 X 坐标
     * @param {number} dragY - 拖拽节点当前 Y 坐标
     * @param {HTMLElement[]} selectedNodeEls - 所有被选中拖拽的节点元素
     * @returns {{ snapX: number, snapY: number }}
     */
    computeAlignment(draggedEl, dragX, dragY, selectedNodeEls) {
        const guidesEl = document.getElementById('alignmentGuides');
        if (!guidesEl) return { snapX: 0, snapY: 0 };

        guidesEl.innerHTML = '';

        const SNAP_THRESHOLD = 5;
        const selectedIds = new Set(selectedNodeEls.map((el) => /** @type {HTMLElement} */ (el).dataset.nodeId));

        const dw = /** @type {HTMLElement} */ (draggedEl).offsetWidth || 200;
        const dh = /** @type {HTMLElement} */ (draggedEl).offsetHeight || 100;

        let draggedCanvasX = dragX;
        let draggedCanvasY = dragY;
        const draggedContainer = draggedEl.closest('.container-body');
        if (draggedContainer) {
            const containerNode = draggedContainer.closest('.canvas-node.container');
            if (containerNode) {
                const containerData = this.node.core.nodes.find(
                    (n) => n.id === /** @type {HTMLElement} */ (containerNode).dataset.nodeId
                );
                if (containerData) {
                    draggedCanvasX = (containerData.x || 0) + dragX;
                    draggedCanvasY = (containerData.y || 0) + 58 + dragY;
                }
            }
        }

        const draggedEdges = {
            left: draggedCanvasX,
            centerX: draggedCanvasX + dw / 2,
            right: draggedCanvasX + dw,
            top: draggedCanvasY,
            centerY: draggedCanvasY + dh / 2,
            bottom: draggedCanvasY + dh,
        };

        let bestSnapX = null;
        let bestSnapY = null;
        let bestDistX = SNAP_THRESHOLD;
        let bestDistY = SNAP_THRESHOLD;
        const guideLines = [];

        const allNodeEls = document.querySelectorAll('#canvasContent .canvas-node');

        for (const otherEl of allNodeEls) {
            const oEl = /** @type {HTMLElement} */ (otherEl);
            if (selectedIds.has(oEl.dataset.nodeId)) continue;

            let ox = parseFloat(oEl.dataset.x) || 0;
            let oy = parseFloat(oEl.dataset.y) || 0;
            const otherContainer = otherEl.closest('.container-body');
            if (otherContainer) {
                const otherContainerNode = otherEl.closest('.canvas-node.container');
                if (otherContainerNode) {
                    const otherContainerData = this.node.core.nodes.find(
                        (n) => n.id === /** @type {HTMLElement} */ (otherContainerNode).dataset.nodeId
                    );
                    if (otherContainerData) {
                        ox = (otherContainerData.x || 0) + ox;
                        oy = (otherContainerData.y || 0) + 58 + oy;
                    }
                }
            }

            const ow = oEl.offsetWidth || 200;
            const oh = oEl.offsetHeight || 100;

            const otherEdges = {
                left: ox,
                centerX: ox + ow / 2,
                right: ox + ow,
                top: oy,
                centerY: oy + oh / 2,
                bottom: oy + oh,
            };

            const xChecks = [
                { d: 'left', o: 'left' },
                { d: 'centerX', o: 'centerX' },
                { d: 'right', o: 'right' },
                { d: 'left', o: 'right' },
                { d: 'right', o: 'left' },
            ];

            for (const c of xChecks) {
                const diff = Math.abs(draggedEdges[c.d] - otherEdges[c.o]);
                if (diff < bestDistX) {
                    bestDistX = diff;
                    bestSnapX = otherEdges[c.o] - (draggedEdges[c.d] - draggedCanvasX);
                    guideLines.push({ axis: 'x', pos: otherEdges[c.o] });
                }
            }

            const yChecks = [
                { d: 'top', o: 'top' },
                { d: 'centerY', o: 'centerY' },
                { d: 'bottom', o: 'bottom' },
                { d: 'top', o: 'bottom' },
                { d: 'bottom', o: 'top' },
            ];

            for (const c of yChecks) {
                const diff = Math.abs(draggedEdges[c.d] - otherEdges[c.o]);
                if (diff < bestDistY) {
                    bestDistY = diff;
                    bestSnapY = otherEdges[c.o] - (draggedEdges[c.d] - draggedCanvasY);
                    guideLines.push({ axis: 'y', pos: otherEdges[c.o] });
                }
            }
        }

        const uniqueXLines = [...new Set(guideLines.filter((g) => g.axis === 'x').map((g) => g.pos))];
        const uniqueYLines = [...new Set(guideLines.filter((g) => g.axis === 'y').map((g) => g.pos))];

        if (uniqueXLines.length > 0 || uniqueYLines.length > 0) {
            const svgW = guidesEl.getAttribute('width') || 5000;
            const svgH = guidesEl.getAttribute('height') || 5000;

            let svgContent = '';
            for (const x of uniqueXLines) {
                svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${svgH}" stroke="#ff3366" stroke-width="1" />`;
            }
            for (const y of uniqueYLines) {
                svgContent += `<line x1="0" y1="${y}" x2="${svgW}" y2="${y}" stroke="#ff3366" stroke-width="1" />`;
            }

            guidesEl.innerHTML = svgContent;
        }

        return {
            snapX: bestSnapX !== null ? bestSnapX - draggedCanvasX : 0,
            snapY: bestSnapY !== null ? bestSnapY - draggedCanvasY : 0,
        };
    }
}
