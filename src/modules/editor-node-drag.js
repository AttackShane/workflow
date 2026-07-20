/**
 * 工作流节点拖拽模块
 * 处理节点拖拽、多选拖拽、智能对齐吸附、容器拖入拖出
 */

import { APP_CONFIG } from '../config/constants.js';

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
        if (el.classList.contains('container') && /** @type {Element} */ (e.target).closest('.container-body')) return;

        const nodeId = el.dataset.nodeId;
        const nodeData = this.node.core.getNode(nodeId);

        // 锁定节点处理（Shift 多选/单选切换）
        if (nodeData && nodeData.locked) {
            this._handleLockedNodeClick(e, el);
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.node.ui.dragStartX = e.clientX;
        this.node.ui.dragStartY = e.clientY;
        this.node.ui.hasDragged = false;

        // 处理选择逻辑
        this._updateSelection(e, el);

        this.node.ui.align.updateAlignToolbar();

        el.classList.add('dragging');
        el.style.zIndex = '1000';

        this._clearAlignmentGuides();

        const selectedNodeEls = this._getDraggableSelectedEls();
        const nodeStartPositions = this._captureStartPositions(selectedNodeEls);

        // 开始拖拽交互 — 存引用以便正确移除监听器
        const dragCtx = { rafId: null, dropTarget: null };
        const onMouseMove = (e) => this._onDragMove(e, selectedNodeEls, nodeStartPositions, dragCtx);
        const onMouseUp = (e) => this._onDragEnd(e, selectedNodeEls, nodeStartPositions, dragCtx, el);
        const onKeyDown = this._makeEscapeHandler(dragCtx, selectedNodeEls, el, onMouseMove, onMouseUp);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);

        this.node._dragListeners = { onMouseMove, onMouseUp, onKeyDown };
    }

    // ====================================================================
    // 选择处理
    // ====================================================================

    /**
     * 处理锁定节点的点击
     * @param {MouseEvent} e
     * @param {HTMLElement} el
     */
    _handleLockedNodeClick(e, el) {
        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const isSelected = el.classList.contains('selected');
            if (isSelected) {
                el.classList.remove('selected');
            } else {
                el.classList.add('selected');
            }
            this._updatePanelForLatestSelected();
            this.node.ui.align.updateAlignToolbar();
        } else if (!el.classList.contains('selected')) {
            e.preventDefault();
            e.stopPropagation();
            this._deselectAll();
            el.classList.add('selected');
            this.node.ui.isMultiSelectMode = false;
            this.node.core.selectNode(el.dataset.nodeId);
            const clickedNode = this.node.core.getNode(el.dataset.nodeId);
            if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
            this.node.ui.align.updateAlignToolbar();
        }
    }

    /**
     * 根据 Shift 键和多选状态更新选择
     * @param {MouseEvent} e
     * @param {HTMLElement} el
     */
    _updateSelection(e, el) {
        const preSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = preSelectedNodes.length > 1;
        const shiftPressed = e.shiftKey;
        const isAlreadySelected = el.classList.contains('selected');

        if (shiftPressed && isAlreadySelected) {
            el.classList.remove('selected');
            this._updatePanelForLatestSelected();
        } else if (shiftPressed && !isAlreadySelected) {
            el.classList.add('selected');
            this._enterSingleSelectMode(el);
        } else if (!this.node.ui.isMultiSelectMode && !shiftPressed && !hasMultipleSelected) {
            this._deselectAll();
            el.classList.add('selected');
            this.node.ui.isMultiSelectMode = false;
            this.node.core.selectNode(el.dataset.nodeId);
            const clickedNode = this.node.core.getNode(el.dataset.nodeId);
            if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
        } else if (shiftPressed && (this.node.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (!isAlreadySelected) el.classList.add('selected');
            this.node.ui.isMultiSelectMode = true;
            this.node.ui.showSummaryPanel();
        } else {
            if (!isAlreadySelected && (hasMultipleSelected || this.node.ui.isMultiSelectMode)) {
                this._deselectAll();
                this.node.ui.isMultiSelectMode = false;
                this.node.core.selectNode(el.dataset.nodeId);
                const clickedNode = this.node.core.getNode(el.dataset.nodeId);
                if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
            }
            el.classList.add('selected');
        }
    }

    /**
     * 单选模式：选中当前节点并显示面板
     * @param {HTMLElement} el
     */
    _enterSingleSelectMode(el) {
        const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        if (newSelectedNodes.length > 1) {
            this.node.ui.isMultiSelectMode = true;
            this.node.ui.showSummaryPanel();
        } else {
            this.node.ui.isMultiSelectMode = false;
            this.node.core.selectNode(el.dataset.nodeId);
            const clickedNode = this.node.core.getNode(el.dataset.nodeId);
            if (clickedNode) this.node.panel.renderPropertyPanel(clickedNode);
        }
    }

    /**
     * 更新最新选中节点的面板
     */
    _updatePanelForLatestSelected() {
        const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        if (newSelectedNodes.length === 0) {
            this.node.ui.isMultiSelectMode = false;
            this.node.core.selectNode(null);
            this.node.ui.showSummaryPanel();
        } else {
            const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
            const lastEl = /** @type {HTMLElement} */ (lastSelected);
            this.node.core.selectNode(lastEl.dataset.nodeId);
            const node = this.node.core.getNode(lastEl.dataset.nodeId);
            if (node) this.node.panel.renderPropertyPanel(node);
        }
    }

    /**
     * 取消所有节点和边的选中
     */
    _deselectAll() {
        document.querySelectorAll('.canvas-node').forEach((n) => n.classList.remove('selected'));
        document.querySelectorAll('.workflow-edge').forEach((edge) => edge.classList.remove('selected'));
    }

    // ====================================================================
    // 拖拽准备
    // ====================================================================

    /**
     * 获取所有可拖拽的选中节点元素（排除锁定节点）
     * @returns {HTMLElement[]}
     */
    _getDraggableSelectedEls() {
        return Array.from(document.querySelectorAll('.canvas-node.selected')).filter((nodeEl) => {
            const nd = this.node.core.getNode(/** @type {HTMLElement} */ (nodeEl).dataset.nodeId);
            return !nd || !nd.locked;
        });
    }

    /**
     * 捕获拖拽起始位置
     * @param {HTMLElement[]} selectedNodeEls
     * @returns {object}
     */
    _captureStartPositions(selectedNodeEls) {
        const positions = {};
        selectedNodeEls.forEach((nodeEl) => {
            const el = /** @type {HTMLElement} */ (nodeEl);
            positions[el.dataset.nodeId] = {
                x: parseFloat(el.dataset.x) || 0,
                y: parseFloat(el.dataset.y) || 0,
            };
        });
        return positions;
    }

    /**
     * 清除对齐辅助线
     */
    _clearAlignmentGuides() {
        const guidesEl = document.getElementById('alignmentGuides');
        if (guidesEl) guidesEl.innerHTML = '';
    }

    // ====================================================================
    // 拖拽过程
    // ====================================================================

    /**
     * 拖拽移动处理
     * @param {MouseEvent} e
     * @param {HTMLElement[]} selectedNodeEls
     * @param {object} nodeStartPositions
     * @param {{ rafId: number|null, dropTarget: HTMLElement|null }} ctx
     */
    _onDragMove(e, selectedNodeEls, nodeStartPositions, ctx) {
        const dx = Math.abs(e.clientX - this.node.ui.dragStartX);
        const dy = Math.abs(e.clientY - this.node.ui.dragStartY);
        if (dx > 5 || dy > 5) this.node.ui.hasDragged = true;

        if (ctx.rafId) cancelAnimationFrame(ctx.rafId);

        ctx.rafId = requestAnimationFrame(() => {
            const ctrlHeld = e.ctrlKey || e.metaKey;
            const moveDx = (e.clientX - this.node.ui.dragStartX) / this.node.ui.canvas.canvasScale;
            const moveDy = (e.clientY - this.node.ui.dragStartY) / this.node.ui.canvas.canvasScale;

            this._ensureDetachState();

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
                const nodeData = this.node.core.getNode(nodeId);

                if (this.node.ui.canvas.snapEnabled) {
                    newX = this.node.ui.canvas.snapToGrid(newX);
                    newY = this.node.ui.canvas.snapToGrid(newY);
                }

                el.dataset.x = newX;
                el.dataset.y = newY;
                el.style.transform = `translate(${newX}px, ${newY}px)`;

                this._handleCtrlDetach(ctrlHeld, nodeData, nodeId, el, nodeStartPositions, newX, newY);
                this._markParentContainer(nodeData, nodeId);
            }

            // 拖放目标高亮
            const target = this._findDropTarget(e.clientX, e.clientY, selectedNodeEls);
            if (target !== ctx.dropTarget) {
                if (ctx.dropTarget) ctx.dropTarget.classList.remove('drop-target');
                ctx.dropTarget = target;
                if (ctx.dropTarget) ctx.dropTarget.classList.add('drop-target');
            }
        });
    }

    /**
     * Ctrl 拖拽：将子节点从容器中拖出
     */
    _handleCtrlDetach(ctrlHeld, nodeData, nodeId, el, nodeStartPositions, newX, newY) {
        const detachedSet = this.node.ui._ctrlDetached || (this.node.ui._ctrlDetached = new Set());
        const LOOP_ONLY = new Set(['break', 'loop_set_variable', 'loop_continue']);
        const parentContainers = this.node.ui._pendingContainers;

        if (ctrlHeld && nodeData && nodeData.parentId && !detachedSet.has(nodeId)) {
            if (LOOP_ONLY.has(nodeData.type)) {
                parentContainers.add(nodeData.parentId);
                return;
            }
            const parent = this.node.core.getNode(nodeData.parentId);
            if (parent) {
                const absX = (parent.x || 0) + newX;
                const absY = (parent.y || 0) + APP_CONFIG.NODE.CONTAINER_BODY_OFFSET + newY;

                el.remove();
                this.node.ui.canvas.canvasContent.appendChild(el);
                const detachedEl = /** @type {HTMLElement} */ (el);
                detachedEl.dataset.x = absX;
                detachedEl.dataset.y = absY;
                detachedEl.style.transform = `translate(${absX}px, ${absY}px)`;

                nodeData.parentId = null;
                nodeData.x = absX;
                nodeData.y = absY;
                nodeStartPositions[nodeId] = { x: absX, y: absY };
                detachedSet.add(nodeId);
                parentContainers.add(parent.id);

                this._filterEdgesOnDetach(nodeId, parent.id);
            }
        } else if (nodeData && nodeData.parentId && !detachedSet.has(nodeId)) {
            parentContainers.add(nodeData.parentId);
        }
    }

    /** 确保临时状态对象存在 */
    _ensureDetachState() {
        if (!this.node.ui._pendingContainers) {
            this.node.ui._pendingContainers = new Set();
        }
        if (!this.node.ui._ctrlDetached) {
            this.node.ui._ctrlDetached = new Set();
        }
    }

    /** 标记需要更新大小的父容器 */
    _markParentContainer(nodeData, nodeId) {
        if (nodeData && nodeData.parentId && !(this.node.ui._ctrlDetached || new Set()).has(nodeId)) {
            this.node.ui._pendingContainers.add(nodeData.parentId);
        }
    }

    /**
     * 找到拖放目标容器
     * @param {number} clientX / clientY
     * @param {HTMLElement[]} selectedNodeEls
     * @returns {HTMLElement|null}
     */
    _findDropTarget(clientX, clientY, selectedNodeEls) {
        const canvasRect = this.node.ui.canvas.canvas.getBoundingClientRect();
        const screenX = clientX - canvasRect.left;
        const screenY = clientY - canvasRect.top;
        const { canvasX, canvasY } = this.node.ui.canvas.screenToCanvas(screenX, screenY);

        const containers = this.node.core.nodes.filter((n) => this.node.core.container.isContainer(n.id));
        for (const c of containers) {
            if (selectedNodeEls.some((el) => /** @type {HTMLElement} */ (el).dataset.nodeId === c.id)) continue;
            const cx = c.x || 0;
            const cy = c.y || 0;
            const cInfo = this.node.core.nodeTypeInfo[c.type] || {};
            const cw = c.width || cInfo.containerMinWidth || 300;
            const ch = c.height || cInfo.containerMinHeight || 200;
            const headerH = APP_CONFIG.NODE.CONTAINER_BODY_OFFSET;
            if (canvasX >= cx && canvasX <= cx + cw && canvasY >= cy + headerH && canvasY <= cy + ch) {
                return /** @type {*} */ (this.node)._elMap.get(c.id) || null;
            }
        }
        return null;
    }

    /**
     * Ctrl 拖出时过滤容器内部边
     */
    _filterEdgesOnDetach(nodeId, parentId) {
        const oldChildren = this.node.core.container.getChildren(parentId);
        const childIds = new Set(oldChildren.map((c) => c.id));
        this.node.core.edges = this.node.core.edges.filter((edge) => {
            if (edge.source === nodeId) {
                if (childIds.has(edge.target)) return false;
                if (edge.target === parentId) return edge.targetPort !== 'container_end';
                return true;
            }
            if (edge.target === nodeId) {
                if (childIds.has(edge.source)) return false;
                if (edge.source === parentId) return edge.sourcePort !== 'container_start';
                return true;
            }
            return true;
        });
    }

    // ====================================================================
    // 拖拽结束
    // ====================================================================

    /**
     * 拖拽结束处理
     */
    _onDragEnd(e, selectedNodeEls, nodeStartPositions, ctx, el) {
        if (ctx.rafId) {
            cancelAnimationFrame(ctx.rafId);
            ctx.rafId = null;
        }

        const finalTarget = this._findDropTarget(e.clientX, e.clientY, selectedNodeEls);
        if (ctx.dropTarget) {
            ctx.dropTarget.classList.remove('drop-target');
            ctx.dropTarget = null;
        }

        const ctrlHeld = e.ctrlKey || e.metaKey;
        const draggedNodeIds = selectedNodeEls.map((el) => /** @type {HTMLElement} */ (el).dataset.nodeId);
        const affectedNodeIds = new Set(draggedNodeIds);

        const LOOP_ONLY = new Set(['break', 'loop_set_variable', 'loop_continue']);

        for (const nodeEl of selectedNodeEls) {
            const nel = /** @type {HTMLElement} */ (nodeEl);
            nel.classList.remove('dragging');
            nel.style.zIndex = '';

            const nodeId = nel.dataset.nodeId;
            const nodeData = this.node.core.getNode(nodeId);
            if (!nodeData) continue;

            const newX = parseFloat(nel.dataset.x) || 0;
            const newY = parseFloat(nel.dataset.y) || 0;

            if (finalTarget && !ctrlHeld && finalTarget.dataset.nodeId !== nodeId) {
                if (LOOP_ONLY.has(nodeData.type) && nodeData.parentId !== finalTarget.dataset.nodeId) {
                    this._markContainerForUpdate(nodeData.parentId, affectedNodeIds);
                    continue;
                }
                this._handleDropIntoContainer(finalTarget, nodeData, nodeId, newX, newY, nel, affectedNodeIds);
            } else if (ctrlHeld && nodeData.parentId) {
                if (LOOP_ONLY.has(nodeData.type)) {
                    this._markContainerForUpdate(nodeData.parentId, affectedNodeIds);
                    continue;
                }
                this._handleCtrlDropOut(nodeData, nodeId, newX, newY, nel, affectedNodeIds);
            } else {
                this.node.core.updateNodePosition(nodeId, newX, newY);
                this._markContainerForUpdate(nodeData.parentId, affectedNodeIds);
            }
        }

        el.classList.remove('dragging');
        el.style.zIndex = '';

        this._cleanupDragState(affectedNodeIds);
        this._finalizeDrag(affectedNodeIds, el);
    }

    /**
     * 处理节点放入容器
     */
    _handleDropIntoContainer(containerEl, nodeData, nodeId, newX, newY, domEl, affectedNodeIds) {
        const containerId = containerEl.dataset.nodeId;
        const containerNode = this.node.core.getNode(containerId);

        if (nodeData.parentId === containerId) {
            this.node.core.updateNodePosition(nodeId, newX, newY);
            this.node.container.updateContainerSize(containerId);
            affectedNodeIds.add(containerId);
            return;
        }

        const oldParentId = nodeData.parentId;
        const oldParent = oldParentId ? this.node.core.getNode(oldParentId) : null;
        const oldHeaderH = oldParent ? APP_CONFIG.NODE.CONTAINER_BODY_OFFSET : 0;

        if (nodeData.parentId) nodeData.parentId = null;

        const headerH = APP_CONFIG.NODE.CONTAINER_HEADER_H;
        const descH = APP_CONFIG.NODE.CONTAINER_DESC_H;
        const canvasX = oldParent ? oldParent.x + newX : newX;
        const canvasY = oldParent ? oldParent.y + oldHeaderH + newY : newY;

        nodeData.parentId = containerId;
        nodeData.x = Math.max(5, Math.round(canvasX - containerNode.x));
        nodeData.y = Math.max(5, Math.round(canvasY - containerNode.y - headerH - descH));

        domEl.remove();
        this.node.container.renderContainerChildren(containerId);

        if (oldParentId && oldParentId !== containerId) {
            this.node.container.updateContainerSize(oldParentId);
            affectedNodeIds.add(oldParentId);
        }
        affectedNodeIds.add(containerId);

        this._filterEdgesForContainer(nodeId, containerId);
    }

    /**
     * 处理 Ctrl 拖出容器
     */
    _handleCtrlDropOut(nodeData, nodeId, newX, newY, domEl, affectedNodeIds) {
        const oldParentId = nodeData.parentId;
        const oldContainer = this.node.core.getNode(oldParentId);
        const absX = (oldContainer.x || 0) + newX;
        const absY = (oldContainer.y || 0) + APP_CONFIG.NODE.CONTAINER_BODY_OFFSET + newY;

        nodeData.parentId = null;
        nodeData.x = Math.round(absX);
        nodeData.y = Math.round(absY);

        domEl.remove();
        this.node.ui.canvas.canvasContent.appendChild(domEl);
        const reEl = /** @type {HTMLElement} */ (domEl);
        reEl.dataset.x = absX;
        reEl.dataset.y = absY;
        reEl.style.transform = `translate(${absX}px, ${absY}px)`;

        this.node.container.renderContainerChildren(oldParentId);
        affectedNodeIds.add(oldParentId);
        this._filterEdgesOnDetach(nodeId, oldParentId);
    }

    /**
     * 过滤放入容器后的内部边
     */
    _filterEdgesForContainer(nodeId, containerId) {
        const containerChildren = this.node.core.container.getChildren(containerId);
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
    }

    /**
     * 标记容器需要更新
     */
    _markContainerForUpdate(parentId, affectedNodeIds) {
        if (parentId) {
            this.node.container.updateContainerSize(parentId);
            affectedNodeIds.add(parentId);
        }
    }

    /**
     * 创建 Escape 键处理器
     */
    _makeEscapeHandler(ctx, selectedNodeEls, el, onMouseMove, onMouseUp) {
        const self = this;
        return (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();

            if (ctx.rafId) {
                cancelAnimationFrame(ctx.rafId);
                ctx.rafId = null;
            }
            if (ctx.dropTarget) {
                ctx.dropTarget.classList.remove('drop-target');
                ctx.dropTarget = null;
            }

            for (const nodeEl of selectedNodeEls) {
                const nel = /** @type {HTMLElement} */ (nodeEl);
                nel.classList.remove('dragging');
                nel.style.zIndex = '';
            }
            el.classList.remove('dragging');
            el.style.zIndex = '';

            self.node.ui._ctrlDetached = null;
            self.node.ui._pendingContainers = null;

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('keydown', self.node._dragListeners.onKeyDown);

            const guidesEl = document.getElementById('alignmentGuides');
            if (guidesEl) guidesEl.innerHTML = '';
        };
    }

    /**
     * 清理拖拽临时状态
     */
    _cleanupDragState(affectedNodeIds) {
        this.node.ui._ctrlDetached = null;
        if (this.node.ui._pendingContainers) {
            this.node.ui._pendingContainers.forEach((pid) => {
                affectedNodeIds.add(pid);
                this.node.container.updateContainerSize(pid);
            });
            this.node.ui._pendingContainers = null;
        }
    }

    /**
     * 完成拖拽：移除监听器、保存历史、更新边和 SVG
     */
    _finalizeDrag(affectedNodeIds, el) {
        const listeners = this.node._dragListeners;
        if (listeners) {
            document.removeEventListener('mousemove', listeners.onMouseMove);
            document.removeEventListener('mouseup', listeners.onMouseUp);
            document.removeEventListener('keydown', listeners.onKeyDown);
            this.node._dragListeners = null;
        }

        if (this.node.ui.hasDragged) {
            this.node.core.saveHistory('messages.moveNode');
        }

        this.node.ui.edge.updateAffectedEdges(Array.from(affectedNodeIds));
        this.node.ui.canvas.updateSvgSize();

        const guidesEl = document.getElementById('alignmentGuides');
        if (guidesEl) guidesEl.innerHTML = '';
    }

    // ====================================================================
    // 智能对齐
    // ====================================================================

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
                const containerData = this.node.core.getNode(/** @type {HTMLElement} */ (containerNode).dataset.nodeId);
                if (containerData) {
                    draggedCanvasX = (containerData.x || 0) + dragX;
                    draggedCanvasY = (containerData.y || 0) + APP_CONFIG.NODE.CONTAINER_BODY_OFFSET + dragY;
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
                    const otherContainerData = this.node.core.getNode(
                        /** @type {HTMLElement} */ (otherContainerNode).dataset.nodeId
                    );
                    if (otherContainerData) {
                        ox = (otherContainerData.x || 0) + ox;
                        oy = (otherContainerData.y || 0) + APP_CONFIG.NODE.CONTAINER_BODY_OFFSET + oy;
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
