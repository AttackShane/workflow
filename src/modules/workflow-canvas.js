import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';

export class WorkflowCanvas {
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
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(this.canvas, 'mousemove', (e) => this.onMouseMove(e));
        DOM.on(this.canvas, 'wheel', (e) => this.onCanvasWheel(e));
        DOM.on(this.canvas, 'mousedown', (e) => this.onCanvasMouseDown(e));
        DOM.on(this.canvas, 'click', (e) => this.onCanvasClick(e));
        
        // 窗口大小变化时更新 SVG 尺寸
        DOM.on(window, 'resize', () => this.updateSvgSize());
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
        
        // 解析当前变换参数
        const currentScale = parseFloat(transform.match(/scale\(([\d.]+)\)/)?.[1]) || 1;
        // 匹配 translate(x, y) 格式（支持负数）
        const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        const currentTranslateX = match ? parseFloat(match[1]) : 0;
        const currentTranslateY = match ? parseFloat(match[2]) : 0;
        
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 计算新的缩放比例（限制范围）
        const newScale = Math.max(APP_CONFIG.ZOOM.MIN_SCALE, Math.min(APP_CONFIG.ZOOM.MAX_SCALE, currentScale * zoomFactor));
        this.canvasScale = newScale;
        
        // 计算新的平移位置（以鼠标为中心缩放）
        const newTranslateX = mouseX - (mouseX - currentTranslateX) * (newScale / currentScale);
        const newTranslateY = mouseY - (mouseY - currentTranslateY) * (newScale / currentScale);
        
        // 应用变换
        this.applyTransform(newTranslateX, newTranslateY, newScale);
        
        // 缩放后更新 SVG 尺寸
        this.updateSvgSize();
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
        
        // 如果没有节点或节点系统不可用，使用固定大尺寸
        if (!this.core || !this.core.nodes || this.core.nodes.length === 0) {
            this.setFixedSvgSize(rect);
            return;
        }
        
        // 计算所有节点的边界框
        const bounds = this.calculateNodesBounds();
        
        // 处理所有节点在原点的情况
        if (bounds.minX === Infinity) {
            this.setFixedSvgSize(rect);
            return;
        }
        
        // 根据内容计算 SVG 尺寸
        this.setContentSvgSize(rect, bounds);
    }
    
    /**
     * 计算节点边界框
     * @returns {Object} - 包含 minX, minY, maxX, maxY 的边界框对象
     */
    calculateNodesBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.core.nodes.forEach(node => {
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
        // 添加边距（考虑连接线的弯曲和缩放）
        const padding = 400;
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        
        // 根据缩放比例调整尺寸：缩得越小，需要的 SVG 越大
        const scaleFactor = 1 / this.canvasScale;
        const scaledWidth = contentWidth * scaleFactor + padding * 2;
        const scaledHeight = contentHeight * scaleFactor + padding * 2;
        
        // 确保最小尺寸
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
     * 处理框选选择
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
     * 处理画布拖拽
     * @param {number} startX - 起始 X 坐标
     * @param {number} startY - 起始 Y 坐标
     */
    handleCanvasDrag(startX, startY) {
        DOM.setStyle(this.canvas, 'cursor', 'grabbing');
        
        const transform = this.canvasContent?.style.transform || '';
        
        // 匹配 translate(x, y) 格式（支持负数）
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
        
        // 逆变换：先减去平移，再除以缩放
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
        
        // 计算中心位置
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // 计算缩放比例以适应画布
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const scaleX = rect.width / (contentWidth + 200);
        const scaleY = rect.height / (contentHeight + 200);
        const newScale = Math.min(scaleX, scaleY, 1);
        
        // 计算平移位置使内容居中
        const translateX = rect.width / 2 - centerX * newScale;
        const translateY = rect.height / 2 - centerY * newScale;
        
        this.canvasScale = newScale;
        this.applyTransform(translateX, translateY, newScale);
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
}