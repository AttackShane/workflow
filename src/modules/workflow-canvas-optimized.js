/**
 * 优化的工作流画布模块
 * 实现视口剔除（Viewport Culling）技术，提升大规模节点渲染性能
 */

import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';

export class WorkflowCanvasOptimized {
    constructor(ui, prefix = '') {
        this.ui = ui;
        this.core = ui.core;
        this.prefix = prefix;
        
        // 状态管理
        this.canvasScale = 1;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isMarqueeSelectionActive = false;
        this.hasDraggedCanvas = false;
        
        // 性能优化相关
        this.isRendering = false;
        this.renderDebounceTimer = null;
        this.visibleNodes = new Set();
        this.renderBatchSize = 50;
        this.renderThreshold = 50; // 像素边界阈值
        
        // 视口信息
        this.viewport = {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0
        };
    }

    /**
     * 初始化画布
     */
    init() {
        // 获取 DOM 元素
        this.canvas = DOM.get(this.prefix + SELECTORS.EDITOR.CANVAS);
        this.canvasContent = DOM.get(this.prefix + SELECTORS.EDITOR.CANVAS_CONTENT);
        this.svgLayer = DOM.get(this.prefix + SELECTORS.EDITOR.SVG_LAYER);
        this.svgHitLayer = DOM.get(this.prefix + SELECTORS.EDITOR.SVG_HIT_LAYER);
        this.emptyState = DOM.get(this.prefix + SELECTORS.EDITOR.EMPTY_STATE);
        
        // 绑定事件
        this.setupEventListeners();
        
        // 初始化 SVG 尺寸
        this.updateSvgSize();
        
        // 初始化可见节点追踪
        this.updateViewport();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(this.canvas, 'mousemove', (e) => this.onMouseMove(e));
        DOM.on(this.canvas, 'wheel', (e) => this.onCanvasWheel(e));
        DOM.on(this.canvas, 'mousedown', (e) => this.onCanvasMouseDown(e));
        DOM.on(this.canvas, 'click', (e) => this.onCanvasClick(e));
        
        // 窗口大小变化时更新 SVG 尺寸和视口
        DOM.on(window, 'resize', () => {
            this.updateSvgSize();
            this.scheduleRenderUpdate();
        });
        
        // 监听滚动（如果画布可滚动）
        DOM.on(this.canvas, 'scroll', () => this.scheduleRenderUpdate());
    }

    /**
     * 更新视口信息
     */
    updateViewport() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const { translateX, translateY, scale } = this.getCurrentTransform();
        
        // 计算视口边界（考虑缩放和平移）
        this.viewport.left = -translateX / scale - this.renderThreshold;
        this.viewport.top = -translateY / scale - this.renderThreshold;
        this.viewport.right = (rect.width - translateX) / scale + this.renderThreshold;
        this.viewport.bottom = (rect.height - translateY) / scale + this.renderThreshold;
    }

    /**
     * 调度渲染更新（防抖）
     */
    scheduleRenderUpdate() {
        if (this.renderDebounceTimer) {
            clearTimeout(this.renderDebounceTimer);
        }
        
        this.renderDebounceTimer = setTimeout(() => {
            this.updateViewport();
            this.updateVisibleNodes();
        }, 50);
    }

    /**
     * 更新可见节点
     */
    updateVisibleNodes() {
        if (!this.core || !this.core.nodes || this.core.nodes.length === 0) {
            return;
        }
        
        const newVisibleNodes = new Set();
        
        // 批量检查节点可见性
        for (let i = 0; i < this.core.nodes.length; i += this.renderBatchSize) {
            const batch = this.core.nodes.slice(i, i + this.renderBatchSize);
            
            batch.forEach(node => {
                if (this.isNodeVisible(node)) {
                    newVisibleNodes.add(node.id);
                }
            });
        }
        
        // 更新节点显示状态
        this.updateNodeVisibility(newVisibleNodes);
        this.visibleNodes = newVisibleNodes;
        
        // 更新边的可见性
        this.updateEdgeVisibility(newVisibleNodes);
    }

    /**
     * 检查节点是否在视口内
     * @param {object} node - 节点对象
     * @returns {boolean} 是否可见
     */
    isNodeVisible(node) {
        const x = node.x || 0;
        const y = node.y || 0;
        const width = node.width || 200;
        const height = node.height || 100;
        
        // 检查节点是否与视口重叠
        return !(
            x + width < this.viewport.left ||
            x > this.viewport.right ||
            y + height < this.viewport.top ||
            y > this.viewport.bottom
        );
    }

    /**
     * 更新节点显示状态
     * @param {Set} visibleNodeIds - 可见节点ID集合
     */
    updateNodeVisibility(visibleNodeIds) {
        document.querySelectorAll('.canvas-node').forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;
            const isVisible = visibleNodeIds.has(nodeId);
            
            // 使用 opacity 而不是 display，保持布局稳定
            DOM.setStyle(nodeEl, 'opacity', isVisible ? '1' : '0');
            DOM.setStyle(nodeEl, 'pointerEvents', isVisible ? 'auto' : 'none');
            DOM.setStyle(nodeEl, 'visibility', isVisible ? 'visible' : 'hidden');
        });
    }

    /**
     * 更新边的可见性
     * @param {Set} visibleNodeIds - 可见节点ID集合
     */
    updateEdgeVisibility(visibleNodeIds) {
        document.querySelectorAll('.workflow-edge').forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (!edgeId) return;
            
            const edge = this.core.edges.find(e => e.id === edgeId);
            if (!edge) return;
            
            // 只有当边的两个端点都可见时才显示边
            const isVisible = visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
            
            DOM.setStyle(edgeEl, 'opacity', isVisible ? '1' : '0');
            DOM.setStyle(edgeEl, 'pointerEvents', isVisible ? 'auto' : 'none');
        });
    }

    /**
     * 处理鼠标移动
     * @param {MouseEvent} e - 鼠标事件
     */
    onMouseMove(e) {
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
    }

    /**
     * 处理滚轮缩放
     * @param {WheelEvent} e - 滚轮事件
     */
    onCanvasWheel(e) {
        if (!e.ctrlKey && !e.metaKey) return;
        
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const transform = this.canvasContent?.style.transform || '';
        
        const currentScale = parseFloat(transform.match(/scale\(([\d.]+)\)/)?.[1]) || 1;
        const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        const currentTranslateX = match ? parseFloat(match[1]) : 0;
        const currentTranslateY = match ? parseFloat(match[2]) : 0;
        
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newScale = Math.max(APP_CONFIG.ZOOM.MIN_SCALE, Math.min(APP_CONFIG.ZOOM.MAX_SCALE, currentScale * zoomFactor));
        this.canvasScale = newScale;
        
        const newTranslateX = mouseX - (mouseX - currentTranslateX) * (newScale / currentScale);
        const newTranslateY = mouseY - (mouseY - currentTranslateY) * (newScale / currentScale);
        
        this.applyTransform(newTranslateX, newTranslateY, newScale);
        this.updateSvgSize();
        
        // 缩放后更新可见节点
        this.scheduleRenderUpdate();
    }
    
    /**
     * 应用变换到画布元素
     * @param {number} translateX - X 轴平移
     * @param {number} translateY - Y 轴平移
     * @param {number} scale - 缩放比例
     */
    applyTransform(translateX, translateY, scale) {
        const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        
        DOM.setStyle(this.canvasContent, 'transform', transform);
        DOM.setStyle(this.svgLayer, 'transform', transform);
        DOM.setStyle(this.svgHitLayer, 'transform', transform);
    }
    
    /**
     * 更新 SVG 尺寸
     */
    updateSvgSize() {
        if (!this.svgLayer || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        
        if (!this.core || !this.core.nodes || this.core.nodes.length === 0) {
            this.setFixedSvgSize(rect);
            return;
        }
        
        const bounds = this.calculateNodesBounds();
        
        if (bounds.minX === Infinity) {
            this.setFixedSvgSize(rect);
            return;
        }
        
        this.setContentSvgSize(rect, bounds);
    }
    
    /**
     * 计算节点边界框（优化版本，跳过不可见节点）
     * @returns {Object} - 包含 minX, minY, maxX, maxY 的边界框对象
     */
    calculateNodesBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        // 只考虑可见节点来计算边界
        this.core.nodes.forEach(node => {
            // 如果节点被标记为可见或者我们需要完整的边界计算
            const x = node.x || 0;
            const y = node.y || 0;
            const width = node.width || 200;
            const height = node.height || 100;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    /**
     * 设置固定 SVG 尺寸
     * @param {DOMRect} rect - 画布边界矩形
     */
    setFixedSvgSize(rect) {
        const size = Math.max(rect.width, rect.height) * 3;
        this.setSvgSize(size, size);
    }
    
    /**
     * 根据内容设置 SVG 尺寸
     * @param {DOMRect} rect - 画布边界矩形
     * @param {Object} bounds - 节点边界框
     */
    setContentSvgSize(rect, bounds) {
        const padding = 400;
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        
        const scaleFactor = 1 / this.canvasScale;
        const scaledWidth = contentWidth * scaleFactor + padding * 2;
        const scaledHeight = contentHeight * scaleFactor + padding * 2;
        
        const minSize = Math.max(rect.width, rect.height) * 2;
        const svgWidth = Math.max(scaledWidth, minSize, 2000);
        const svgHeight = Math.max(scaledHeight, minSize, 2000);
        
        this.setSvgSize(svgWidth, svgHeight);
    }
    
    /**
     * 设置 SVG 尺寸
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    setSvgSize(width, height) {
        DOM.setAttr(this.svgLayer, 'width', width);
        DOM.setAttr(this.svgLayer, 'height', height);
        DOM.setAttr(this.svgHitLayer, 'width', width);
        DOM.setAttr(this.svgHitLayer, 'height', height);
    }
    
    /**
     * 处理画布鼠标按下
     * @param {MouseEvent} e - 鼠标事件
     */
    onCanvasMouseDown(e) {
        const isNode = e.target.closest('.canvas-node');
        const isEdge = e.target.tagName === 'path' && e.target.getAttribute('data-edge-id');
        
        if (isNode || isEdge) return;
        
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.length > 0) {
            return;
        }
        
        const startX = e.clientX;
        const startY = e.clientY;
        const isMarqueeMode = e.ctrlKey || e.metaKey;
        
        if (isMarqueeMode) {
            this.handleMarqueeSelection(startX, startY);
        } else {
            this.handleCanvasDrag(startX, startY);
        }
    }

    /**
     * 处理框选选择（优化版本）
     * @param {number} startX - 起始 X 坐标
     * @param {number} startY - 起始 Y 坐标
     */
    handleMarqueeSelection(startX, startY) {
        this.isMarqueeSelectionActive = true;
        DOM.setStyle(this.canvas, 'cursor', 'crosshair');
        
        const marquee = DOM.create('div', {
            className: 'marquee-selection',
            style: {
                left: `${startX}px`,
                top: `${startY}px`,
                width: '0px',
                height: '0px'
            }
        });
        document.body.appendChild(marquee);
        
        const onMouseMove = (e) => {
            const width = Math.abs(e.clientX - startX);
            const height = Math.abs(e.clientY - startY);
            const left = Math.min(startX, e.clientX);
            const top = Math.min(startY, e.clientY);
            
            if (width > 3 || height > 3) {
                this.hasDraggedCanvas = true;
            }
            
            DOM.setStyle(marquee, 'left', `${left}px`);
            DOM.setStyle(marquee, 'top', `${top}px`);
            DOM.setStyle(marquee, 'width', `${width}px`);
            DOM.setStyle(marquee, 'height', `${height}px`);
        };
        
        const onMouseUp = (e) => {
            const width = Math.abs(e.clientX - startX);
            const height = Math.abs(e.clientY - startY);
            
            if (width > 10 && height > 10) {
                const left = Math.min(startX, e.clientX);
                const top = Math.min(startY, e.clientY);
                
                this.ui.selectNodesInRect(left, top, width, height);
            }
            
            document.body.removeChild(marquee);
            DOM.setStyle(this.canvas, 'cursor', 'default');
            DOM.off(document, 'mousemove', onMouseMove);
            DOM.off(document, 'mouseup', onMouseUp);
            
            setTimeout(() => {
                this.isMarqueeSelectionActive = false;
            }, 100);
        };
        
        DOM.on(document, 'mousemove', onMouseMove);
        DOM.on(document, 'mouseup', onMouseUp);
    }

    /**
     * 处理画布拖拽（优化版本）
     * @param {number} startX - 起始 X 坐标
     * @param {number} startY - 起始 Y 坐标
     */
    handleCanvasDrag(startX, startY) {
        DOM.setStyle(this.canvas, 'cursor', 'grabbing');
        
        const transform = this.canvasContent?.style.transform || '';
        
        const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        const startTranslateX = match ? parseFloat(match[1]) : 0;
        const startTranslateY = match ? parseFloat(match[2]) : 0;
        
        const onMouseMove = (e) => {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                this.hasDraggedCanvas = true;
            }
            
            const newTranslateX = startTranslateX + deltaX;
            const newTranslateY = startTranslateY + deltaY;
            
            this.applyTransform(newTranslateX, newTranslateY, this.canvasScale);
        };
        
        const onMouseUp = () => {
            DOM.setStyle(this.canvas, 'cursor', 'default');
            DOM.off(document, 'mousemove', onMouseMove);
            DOM.off(document, 'mouseup', onMouseUp);
            
            // 拖拽结束后更新可见节点
            this.scheduleRenderUpdate();
        };
        
        DOM.on(document, 'mousemove', onMouseMove);
        DOM.on(document, 'mouseup', onMouseUp);
    }

    /**
     * 处理画布点击
     * @param {MouseEvent} e - 鼠标事件
     */
    onCanvasClick(e) {
        if (this.isMarqueeSelectionActive) return;
        if (this.hasDraggedCanvas) {
            this.hasDraggedCanvas = false;
            return;
        }
        
        const isNode = e.target.closest('.canvas-node');
        const isEdge = e.target.tagName === 'path' && e.target.getAttribute('data-edge-id');
        
        if (!isNode && !isEdge) {
            this.ui.deselectAll();
        }
    }

    /**
     * 获取当前变换参数
     * @returns {Object} - 包含 translateX, translateY, scale 的对象
     */
    getCurrentTransform() {
        const transform = this.canvasContent?.style.transform || '';
        
        const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
        const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
        
        const translateMatch = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        const translateX = translateMatch ? parseFloat(translateMatch[1]) : 0;
        const translateY = translateMatch ? parseFloat(translateMatch[2]) : 0;
        
        return { translateX, translateY, scale };
    }
    
    /**
     * 将屏幕坐标转换为画布坐标（考虑平移和缩放）
     * @param {number} screenX - 屏幕 X 坐标（相对于 canvas 元素）
     * @param {number} screenY - 屏幕 Y 坐标（相对于 canvas 元素）
     * @returns {Object} - 包含 canvasX, canvasY 的对象
     */
    screenToCanvas(screenX, screenY) {
        const { translateX, translateY, scale } = this.getCurrentTransform();
        
        const canvasX = (screenX - translateX) / scale;
        const canvasY = (screenY - translateY) / scale;
        
        return { canvasX, canvasY };
    }
    
    /**
     * 重置视图
     */
    resetView() {
        this.canvasScale = 1;
        this.applyTransform(0, 0, 1);
        this.updateSvgSize();
        this.scheduleRenderUpdate();
    }

    /**
     * 居中视图
     */
    centerView() {
        if (!this.core || !this.core.nodes || this.core.nodes.length === 0) {
            this.resetView();
            return;
        }
        
        const bounds = this.calculateNodesBounds();
        const rect = this.canvas?.getBoundingClientRect();
        
        if (!rect || bounds.minX === Infinity) {
            this.resetView();
            return;
        }
        
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const scaleX = rect.width / (contentWidth + 200);
        const scaleY = rect.height / (contentHeight + 200);
        const newScale = Math.min(scaleX, scaleY, 1);
        
        const translateX = rect.width / 2 - centerX * newScale;
        const translateY = rect.height / 2 - centerY * newScale;
        
        this.canvasScale = newScale;
        this.applyTransform(translateX, translateY, newScale);
        this.scheduleRenderUpdate();
    }

    /**
     * 设置空状态显示
     * @param {boolean} show - 是否显示空状态
     */
    setEmptyState(show) {
        if (this.emptyState) {
            this.emptyState.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * 获取可见节点数量
     * @returns {number} 可见节点数量
     */
    getVisibleNodeCount() {
        return this.visibleNodes.size;
    }

    /**
     * 获取性能统计信息
     * @returns {object} 性能统计
     */
    getPerformanceStats() {
        const totalNodes = this.core?.nodes?.length || 0;
        const visibleNodes = this.visibleNodes.size;
        const hiddenNodes = totalNodes - visibleNodes;
        const visibilityRatio = totalNodes > 0 ? (visibleNodes / totalNodes * 100).toFixed(1) : '0';
        
        return {
            totalNodes,
            visibleNodes,
            hiddenNodes,
            visibilityRatio: `${visibilityRatio}%`,
            canvasScale: this.canvasScale.toFixed(2)
        };
    }

    /**
     * 强制刷新所有节点可见性
     */
    forceVisibilityUpdate() {
        this.updateViewport();
        this.updateVisibleNodes();
    }
}