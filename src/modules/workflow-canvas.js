import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

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
            if (node.parentId) return; // 跳过子节点，子节点坐标是相对于容器的，不是画布坐标
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
        let contentWidth = bounds.maxX - bounds.minX;
        let contentHeight = bounds.maxY - bounds.minY;
        
        // 防止负坐标导致过大的尺寸
        contentWidth = Math.max(0, Math.min(contentWidth, 50000));
        contentHeight = Math.max(0, Math.min(contentHeight, 50000));
        
        // 根据缩放比例调整尺寸：缩得越小，需要的 SVG 越大
        const scaleFactor = 1 / this.canvasScale;
        const scaledWidth = contentWidth * scaleFactor + padding * 2;
        const scaledHeight = contentHeight * scaleFactor + padding * 2;
        
        // 确保最小尺寸，同时设置最大上限防止溢出
        const minSize = Math.max(rect.width, rect.height) * 2;
        const maxSize = 100000;
        const svgWidth = Math.min(Math.max(scaledWidth, minSize, 2000), maxSize);
        const svgHeight = Math.min(Math.max(scaledHeight, minSize, 2000), maxSize);
        
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
            this.handleMarqueeSelection(startX, startY, true);
        } else {
            this.handleCanvasDrag(startX, startY);
        }
    }

    /**
     * 处理框选选择
     * @param {number} startX - 起始 X 坐标
     * @param {number} startY - 起始 Y 坐标
     */
    handleMarqueeSelection(startX, startY, accumulate = false) {
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
                
                this.ui.selection.selectNodesInRect(left, top, width, height, accumulate);
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
        
        this.hasDraggedCanvas = false;
        
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
        if (this.ui.hasDragged) {
            this.ui.hasDragged = false;
            return;
        }
        
        const isNode = e.target.closest('.canvas-node');
        const isEdge = e.target.tagName === 'path' && e.target.getAttribute('data-edge-id');
        
        if (!isNode && !isEdge) {
            this.ui.selection.deselectAll();
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
        this.updateSvgSize();
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

    /**
     * 自动优化布局（按连接关系从左到右排列，紧凑不重叠，居中缩放适配画布）
     */
    autoOptimizeLayout() {
        if (!this.core || !this.core.nodes || this.core.nodes.length === 0) {
            this.resetView();
            return;
        }

        const hGap = 100;
        const vGap = 60;
        const PADDING = 20;
        const CONTAINER_H_GAP = 60;
        const CONTAINER_V_GAP = 40;
        const HEADER_H = 36;
        const DESC_H = 20;
        const BORDER = 4;

        const defaultW = 200;
        const defaultH = 100;

        const getNodeSize = (node) => {
            const info = this.core.nodeTypeInfo[node.type] || {};
            const isContainer = info.hasContainer === true;
            const w = node.width || (isContainer ? (info.containerMinWidth || 300) : 200);
            const h = node.height || (isContainer ? (info.containerMinHeight || 200) : 100);
            return { w, h };
        };

        // 通用布局函数：对一组节点按边关系分层排列
        const layoutNodeGroup = (groupNodes, startX, startY, gapH, gapV, centerY = true) => {
            if (groupNodes.length === 0) return;
            const groupSizes = new Map();
            const groupIds = new Set(groupNodes.map(n => n.id));
            groupNodes.forEach(n => groupSizes.set(n.id, getNodeSize(n)));

            const adj = new Map();
            const inDeg = new Map();
            const preds = new Map();
            groupNodes.forEach(n => {
                adj.set(n.id, []);
                inDeg.set(n.id, 0);
                preds.set(n.id, []);
            });

            this.core.edges.forEach(edge => {
                const s = edge.source;
                const t = edge.target;
                if (groupIds.has(s) && groupIds.has(t)) {
                    adj.get(s).push(t);
                    inDeg.set(t, (inDeg.get(t) || 0) + 1);
                    preds.get(t).push(s);
                }
            });

            const nodeLevel = new Map();
            const sources = groupNodes.filter(n => inDeg.get(n.id) === 0);
            const queue = sources.map(n => n.id);
            sources.forEach(n => nodeLevel.set(n.id, 0));

            while (queue.length > 0) {
                const id = queue.shift();
                adj.get(id).forEach(nextId => {
                    const predMax = Math.max(...preds.get(nextId).map(pid => nodeLevel.get(pid) ?? -1));
                    const newLevel = predMax + 1;
                    if (!nodeLevel.has(nextId) || nodeLevel.get(nextId) < newLevel) {
                        nodeLevel.set(nextId, newLevel);
                        if (!queue.includes(nextId)) queue.push(nextId);
                    }
                });
            }

            groupNodes.forEach(n => {
                if (!nodeLevel.has(n.id)) nodeLevel.set(n.id, 0);
            });

            const levels = [];
            const levelMaxW = [];
            nodeLevel.forEach((level, id) => {
                if (!levels[level]) levels[level] = [];
                const node = groupNodes.find(n => n.id === id);
                if (node) {
                    levels[level].push(node);
                    const sz = groupSizes.get(id) || { w: defaultW, h: defaultH };
                    levelMaxW[level] = Math.max(levelMaxW[level] || 0, sz.w);
                }
            });

            let xOff = startX;
            levels.forEach((level, col) => {
                const maxW = levelMaxW[col] || defaultW;
                const totalH = level.reduce((sum, node) => {
                    const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                    return sum + sz.h;
                }, 0) + (level.length - 1) * gapV;

                let yOff = centerY ? (startY - totalH / 2) : startY;
                level.forEach((node) => {
                    const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                    node.x = xOff;
                    node.y = yOff;
                    node.width = sz.w;
                    node.height = sz.h;
                    yOff += sz.h + gapV;
                });

                xOff += maxW + gapH;
            });
        };

        // 1. 先布局容器内部子节点，确定容器真实尺寸
        this.core.nodes.forEach(container => {
            const info = this.core.nodeTypeInfo[container.type] || {};
            if (!info.hasContainer) return;
            const children = this.core.getChildNodes(container.id);
            if (children.length === 0) return;

            layoutNodeGroup(children, PADDING, PADDING, CONTAINER_H_GAP, CONTAINER_V_GAP, false);

            const minW = info.containerMinWidth || 300;
            const minH = info.containerMinHeight || 200;
            let maxRight = 0;
            let maxBottom = 0;
            let minX = 0;
            let minY = 0;
            children.forEach(child => {
                const sz = getNodeSize(child);
                minX = Math.min(minX, child.x);
                minY = Math.min(minY, child.y);
                maxRight = Math.max(maxRight, child.x + sz.w);
                maxBottom = Math.max(maxBottom, child.y + sz.h);
            });
            const bodyW = Math.max(minW - BORDER, maxRight - minX + PADDING * 2);
            const bodyH = Math.max(minH - HEADER_H - DESC_H - BORDER, maxBottom - minY + PADDING * 2);
            container.width = Math.max(minW, bodyW + BORDER);
            container.height = HEADER_H + DESC_H + bodyH + BORDER;
        });

        // 2. 顶层节点布局（此时容器尺寸已确定）
        const nodes = this.core.nodes.filter(n => !n.parentId);
        layoutNodeGroup(nodes, 0, 0, hGap, vGap);

        // 3. 整体平移到正象限
        const bounds = this.calculateNodesBounds();
        const offsetX = -Math.min(0, bounds.minX);
        const offsetY = -Math.min(0, bounds.minY);
        nodes.forEach(node => {
            node.x += offsetX;
            node.y += offsetY;
        });

        this.core.saveHistory(t('messages.viewReset'));

        this.ui.refreshCanvas();
        this.updateSvgSize();
        this.centerView();
    }
}