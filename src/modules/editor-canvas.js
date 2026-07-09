// @ts-nocheck
/**
 * 工作流画布模块（含视口剔除优化）
 * 实现视口剔除（Viewport Culling）技术，提升大规模节点渲染性能
 */

import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, NodeUtils } from '../utils/helpers.js';
import { autoOptimizeLayout } from './editor-layout.js';

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
        
        // 性能优化相关
        this.renderDebounceTimer = null;
        this.visibleNodes = new Set();
        this.renderBatchSize = 50;
        this.renderThreshold = 50;
        
        // 网格吸附
        this.gridVisible = false;
        this.snapEnabled = false;
        this.gridSize = 20;
        this.gridSvg = null;
        this.gridPattern = null;
        
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
        this.canvas = DOM.get(this.prefix + SELECTORS.EDITOR.CANVAS);
        this.canvasContent = DOM.get(this.prefix + SELECTORS.EDITOR.CANVAS_CONTENT);
        this.svgLayer = DOM.get(this.prefix + SELECTORS.EDITOR.SVG_LAYER);
        this.svgHitLayer = DOM.get(this.prefix + SELECTORS.EDITOR.SVG_HIT_LAYER);
        this.alignmentGuides = this._createAlignmentGuides();
        this.emptyState = DOM.get(this.prefix + SELECTORS.EDITOR.EMPTY_STATE);
        
        this.setupEventListeners();
        this.setupZoomControls();
        this.initMinimap();
        this.updateSvgSize();
        this.updateViewport();
        this.updateZoomLevel();
    }

    /**
     * 创建对齐辅助线 SVG 层（始终在最顶层，不拦截点击）
     */
    _createAlignmentGuides() {
        if (!this.canvas || typeof this.canvas.appendChild !== 'function') return null;
        let svg;
        try {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        } catch (e) {
            svg = document.createElement('svg');
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        svg.setAttribute('class', 'alignment-guides');
        svg.setAttribute('id', 'alignmentGuides');
        this.canvas.appendChild(svg);
        return svg;
    }

    /**
     * 创建网格背景 SVG 层
     */
    _createGridLayer() {
        if (!this.canvas || typeof this.canvas.appendChild !== 'function') return null;
        let svg;
        try {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        } catch (e) {
            svg = document.createElement('svg');
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        svg.setAttribute('class', 'grid-layer');
        svg.setAttribute('id', 'gridLayer');
        svg.style.display = 'none';
        svg.style.pointerEvents = 'none';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'gridPattern');
        pattern.setAttribute('width', String(this.gridSize));
        pattern.setAttribute('height', String(this.gridSize));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--border, #e0e0e0)');
        path.setAttribute('stroke-width', '0.5');

        pattern.appendChild(path);
        defs.appendChild(pattern);
        svg.appendChild(defs);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'url(#gridPattern)');
        svg.appendChild(rect);

        this.canvas.insertBefore(svg, this.canvas.firstChild);
        this.gridSvg = svg;
        this.gridPattern = pattern;
        return svg;
    }

    /**
     * 切换网格显示
     */
    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        if (!this.gridSvg) {
            this._createGridLayer();
        }
        if (this.gridSvg) {
            this.gridSvg.style.display = this.gridVisible ? '' : 'none';
        }
        this.updateSvgSize();
    }

    /**
     * 切换吸附
     */
    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
    }

    /**
     * 设置网格大小
     * @param {number} size - 网格大小（像素）
     */
    setGridSize(size) {
        this.gridSize = Math.max(5, Math.min(100, size));
        if (this.gridPattern) {
            this.gridPattern.setAttribute('width', String(this.gridSize));
            this.gridPattern.setAttribute('height', String(this.gridSize));
            const path = this.gridPattern.querySelector('path');
            if (path) {
                path.setAttribute('d', `M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}`);
            }
        }
    }

    /**
     * 吸附坐标到网格
     * @param {number} value - 坐标值
     * @returns {number} 吸附后的坐标值
     */
    snapToGrid(value) {
        if (!this.snapEnabled) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(this.canvas, 'mousemove', (e) => this.onMouseMove(e));
        DOM.on(this.canvas, 'wheel', (e) => this.onCanvasWheel(e));
        DOM.on(this.canvas, 'mousedown', (e) => this.onCanvasMouseDown(e));
        DOM.on(this.canvas, 'click', (e) => this.onCanvasClick(e));
        DOM.on(this.canvas, 'touchstart', (e) => this.onTouchStart(e), { passive: false });
        DOM.on(this.canvas, 'touchmove', (e) => this.onTouchMove(e), { passive: false });
        DOM.on(this.canvas, 'touchend', (e) => this.onTouchEnd(e));
        
        DOM.on(window, 'resize', () => {
            this.updateSvgSize();
            this.scheduleRenderUpdate();
        });
        
        DOM.on(this.canvas, 'scroll', () => this.scheduleRenderUpdate());

        const themeObserver = new MutationObserver(() => {
            this.renderMinimap();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    /**
     * 设置缩放控件
     */
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomFitBtn = document.getElementById('zoomFitBtn');
        const zoomLevel = document.getElementById('zoomLevel');

        if (zoomInBtn) {
            DOM.on(zoomInBtn, 'click', () => this.zoomIn());
        }
        if (zoomOutBtn) {
            DOM.on(zoomOutBtn, 'click', () => this.zoomOut());
        }
        if (zoomFitBtn) {
            DOM.on(zoomFitBtn, 'click', () => this.centerView());
        }
        if (zoomLevel) {
            DOM.on(zoomLevel, 'click', () => this.resetView());
        }

        const toggleGridBtn = document.getElementById('toggleGridBtn');
        const toggleSnapBtn = document.getElementById('toggleSnapBtn');

        if (toggleGridBtn) {
            DOM.on(toggleGridBtn, 'click', () => {
                this.toggleGrid();
                toggleGridBtn.title = this.gridVisible ? '隐藏网格' : '显示网格';
                if (this.gridVisible) {
                    toggleGridBtn.classList.add('active');
                } else {
                    toggleGridBtn.classList.remove('active');
                }
            });
        }
        if (toggleSnapBtn) {
            DOM.on(toggleSnapBtn, 'click', () => {
                this.toggleSnap();
                toggleSnapBtn.title = this.snapEnabled ? '禁用吸附' : '启用吸附';
                if (this.snapEnabled) {
                    toggleSnapBtn.classList.add('active');
                } else {
                    toggleSnapBtn.classList.remove('active');
                }
            });
        }

        const toggleMinimapBtn = document.getElementById('toggleMinimapBtn');
        if (toggleMinimapBtn) {
            DOM.on(toggleMinimapBtn, 'click', () => this.toggleMinimap());
        }
    }

    initMinimap() {
        this.minimapEl = document.getElementById('minimap');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapViewport = document.getElementById('minimapViewport');
        if (!this.minimapEl || !this.minimapCanvas) return;

        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapVisible = false;
        this.minimapScale = 0.08;
        this.minimapWidth = 200;
        this.minimapHeight = 150;

        this.minimapCanvas.width = this.minimapWidth;
        this.minimapCanvas.height = this.minimapHeight;

        let isDraggingViewport = false;
        this.minimapViewport.addEventListener('mousedown', (e) => {
            isDraggingViewport = true;
            e.preventDefault();
            e.stopPropagation();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDraggingViewport || !this.minimapVisible) return;
            this.navigateMinimap(e);
        });
        document.addEventListener('mouseup', () => {
            isDraggingViewport = false;
        });
        this.minimapCanvas.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDraggingViewport = true;
            this.navigateMinimap(e);
        });
        this.minimapCanvas.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggleMinimap() {
        if (!this.minimapEl) {
            this.initMinimap();
        }
        this.minimapVisible = !this.minimapVisible;
        if (this.minimapEl) {
            this.minimapEl.style.display = this.minimapVisible ? '' : 'none';
        }
        if (this.minimapVisible) {
            this.renderMinimap();
        }
    }

    renderMinimap() {
        if (!this.minimapVisible || !this.minimapCtx || !this.core) return;

        const ctx = this.minimapCtx;
        const w = this.minimapWidth;
        const h = this.minimapHeight;

        ctx.clearRect(0, 0, w, h);
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#fafafa';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        if (!this.core.nodes || this.core.nodes.length === 0) return;

        const bounds = this.calculateNodesBounds();
        if (bounds.minX === Infinity) return;

        const padding = 100;
        const totalW = bounds.maxX - bounds.minX + padding * 2;
        const totalH = bounds.maxY - bounds.minY + padding * 2;
        const scale = Math.min(w / totalW, h / totalH);
        const offsetX = (w - totalW * scale) / 2;
        const offsetY = (h - totalH * scale) / 2;

        this._minimapTransform = { scale, offsetX, offsetY, boundsMinX: bounds.minX - padding, boundsMinY: bounds.minY - padding };

        const selectedNodeIds = new Set();
        document.querySelectorAll('.canvas-node.selected').forEach(el => {
            selectedNodeIds.add(el.dataset.nodeId);
        });

        const topLevelNodes = this.core.nodes.filter(n => !n.parentId);
        topLevelNodes.forEach(node => {
            const nx = (node.x - this._minimapTransform.boundsMinX) * scale + offsetX;
            const ny = (node.y - this._minimapTransform.boundsMinY) * scale + offsetY;
            const nw = (node.width || 200) * scale;
            const nh = (node.height || 100) * scale;

            ctx.fillStyle = selectedNodeIds.has(node.id) ? '#4a90d9' : '#888';
            ctx.fillRect(nx, ny, Math.max(nw, 2), Math.max(nh, 2));
        });

        this.updateMinimapViewport();
    }

    updateMinimapViewport() {
        if (!this.minimapVisible || !this.minimapViewport || !this._minimapTransform) return;

        const canvasRect = this.canvas.getBoundingClientRect();
        const { translateX, translateY, scale } = this.getCurrentTransform();

        const vx = (-translateX / scale - this._minimapTransform.boundsMinX) * this._minimapTransform.scale + this._minimapTransform.offsetX;
        const vy = (-translateY / scale - this._minimapTransform.boundsMinY) * this._minimapTransform.scale + this._minimapTransform.offsetY;
        const vw = canvasRect.width / scale * this._minimapTransform.scale;
        const vh = canvasRect.height / scale * this._minimapTransform.scale;

        this.minimapViewport.style.left = Math.max(0, vx) + 'px';
        this.minimapViewport.style.top = Math.max(0, vy) + 'px';
        this.minimapViewport.style.width = vw + 'px';
        this.minimapViewport.style.height = vh + 'px';
    }

    navigateMinimap(e) {
        if (!this._minimapTransform) return;

        const rect = this.minimapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const canvasX = (mx - this._minimapTransform.offsetX) / this._minimapTransform.scale + this._minimapTransform.boundsMinX;
        const canvasY = (my - this._minimapTransform.offsetY) / this._minimapTransform.scale + this._minimapTransform.boundsMinY;

        const canvasRect = this.canvas.getBoundingClientRect();
        const newTranslateX = canvasRect.width / 2 - canvasX * this.canvasScale;
        const newTranslateY = canvasRect.height / 2 - canvasY * this.canvasScale;

        this.applyTransform(newTranslateX, newTranslateY, this.canvasScale);
        this.updateSvgSize();
        this.scheduleRenderUpdate();
        this.updateMinimapViewport();
    }

    /**
     * 更新视口信息
     */
    updateViewport() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const { translateX, translateY, scale } = this.getCurrentTransform();
        
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
            this.renderMinimap();
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
        
        for (let i = 0; i < this.core.nodes.length; i += this.renderBatchSize) {
            const batch = this.core.nodes.slice(i, i + this.renderBatchSize);
            
            batch.forEach(node => {
                if (this.isNodeVisible(node)) {
                    newVisibleNodes.add(node.id);
                }
            });
        }
        
        this.updateNodeVisibility(newVisibleNodes);
        this.visibleNodes = newVisibleNodes;
        this.updateEdgeVisibility(newVisibleNodes);
    }

    /**
     * 检查节点是否在视口内
     * @param {object} node - 节点对象
     * @returns {boolean} 是否可见
     */
    isNodeVisible(node) {
        let x = node.x || 0;
        let y = node.y || 0;
        const width = node.width || 200;
        const height = node.height || 100;

        if (node.parentId) {
            const parent = this.core.nodes.find(n => n.id === node.parentId);
            if (parent) {
                x = (parent.x || 0) + x;
                y = (parent.y || 0) + 56 + y;
            }
        }

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
        const searchInput = document.getElementById('nodeSearchInput');
        if (searchInput && searchInput.value.trim()) return;

        document.querySelectorAll('.canvas-node').forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;
            const isVisible = visibleNodeIds.has(nodeId);
            
            DOM.setStyle(nodeEl, 'display', isVisible ? '' : 'none');
        });
    }

    /**
     * 更新边的可见性
     * @param {Set} visibleNodeIds - 可见节点ID集合
     */
    updateEdgeVisibility(visibleNodeIds) {
        const searchInput = document.getElementById('nodeSearchInput');
        if (searchInput && searchInput.value.trim()) return;

        document.querySelectorAll('[data-edge-id]').forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (!edgeId) return;
            
            const edge = this.core.edges.find(e => e.id === edgeId);
            if (!edge) return;
            
            const isVisible = visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target);
            
            DOM.setStyle(edgeEl, 'display', isVisible ? '' : 'none');
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
        this.scheduleRenderUpdate();
        this.updateZoomLevel();
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
        if (this.alignmentGuides) {
            DOM.setStyle(this.alignmentGuides, 'transform', transform);
        }
        if (this.gridSvg) {
            DOM.setStyle(this.gridSvg, 'transform', transform);
        }
        this.updateMinimapViewport();
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
     * 计算节点边界框
     * @returns {Object} - 包含 minX, minY, maxX, maxY 的边界框对象
     */
    calculateNodesBounds() {
        return NodeUtils.getBounds(this.core.nodes);
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
        
        const scaledWidth = contentWidth + padding * 2;
        const scaledHeight = contentHeight + padding * 2;
        
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
        if (this.alignmentGuides) {
            DOM.setAttr(this.alignmentGuides, 'width', width);
            DOM.setAttr(this.alignmentGuides, 'height', height);
        }
        if (this.gridSvg) {
            DOM.setAttr(this.gridSvg, 'width', width);
            DOM.setAttr(this.gridSvg, 'height', height);
        }
    }
    
    /**
     * 触摸开始 - 支持单指拖拽和双指缩放
     * @param {TouchEvent} e - 触摸事件
     */
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
            this._touchStartTranslateX = this.canvasTranslateX;
            this._touchStartTranslateY = this.canvasTranslateY;
            this._touchStartScale = this.canvasScale;
            this._touchMoved = false;
        } else if (e.touches.length === 2) {
            this._touchStartDistance = this._getTouchDistance(e.touches);
            this._touchStartScale = this.canvasScale;
            this._touchStartTranslateX = this.canvasTranslateX;
            this._touchStartTranslateY = this.canvasTranslateY;
            const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            this._touchCenterX = cx;
            this._touchCenterY = cy;
            this._touchMoved = false;
        }
    }

    /**
     * 触摸移动 - 处理拖拽和缩放
     * @param {TouchEvent} e - 触摸事件
     */
    onTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1 && this._touchStartX !== undefined) {
            const deltaX = e.touches[0].clientX - this._touchStartX;
            const deltaY = e.touches[0].clientY - this._touchStartY;
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                this._touchMoved = true;
            }
            const newX = this._touchStartTranslateX + deltaX;
            const newY = this._touchStartTranslateY + deltaY;
            this.applyTransform(newX, newY, this.canvasScale);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const newDist = this._getTouchDistance(e.touches);
            if (this._touchStartDistance && newDist > 0) {
                const scaleRatio = newDist / this._touchStartDistance;
                const newScale = Math.max(APP_CONFIG.ZOOM.MIN_SCALE, Math.min(APP_CONFIG.ZOOM.MAX_SCALE, this._touchStartScale * scaleRatio));
                const rect = this.canvas.getBoundingClientRect();
                const cx = this._touchCenterX - rect.left;
                const cy = this._touchCenterY - rect.top;
                const newX = cx - (cx - this._touchStartTranslateX) * (newScale / this._touchStartScale);
                const newY = cy - (cy - this._touchStartTranslateY) * (newScale / this._touchStartScale);
                this.applyTransform(newX, newY, newScale);
                this.updateSvgSize();
                this.scheduleRenderUpdate();
                this.updateZoomLevel();
            }
        }
    }

    /**
     * 触摸结束
     */
    onTouchEnd() {
        this._touchStartX = undefined;
        this._touchStartY = undefined;
        this._touchStartDistance = undefined;
        this._touchStartScale = undefined;
        this._touchStartTranslateX = undefined;
        this._touchStartTranslateY = undefined;
        this._touchCenterX = undefined;
        this._touchCenterY = undefined;
    }

    _getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 处理画布鼠标按下
     * @param {MouseEvent} e - 鼠标事件
     */
    onCanvasMouseDown(e) {
        const isNode = e.target.closest('.canvas-node');
        const isEdge = e.target.tagName === 'path' && e.target.getAttribute('data-edge-id');
        const isContainerBody = e.target.closest('.container-body');

        let containerId = null;
        if (isContainerBody) {
            const containerNodeEl = isContainerBody.closest('.canvas-node.container');
            if (containerNodeEl) {
                containerId = containerNodeEl.dataset.nodeId;
            }
            const startX = e.clientX;
            const startY = e.clientY;
            const isMarqueeMode = e.shiftKey;

            if (isMarqueeMode) {
                this.handleMarqueeSelection(startX, startY, true, containerId);
            } else {
                this.handleCanvasDrag(startX, startY);
            }
            return;
        }

        if (isNode || isEdge) return;

        if (!isNode && !isEdge) {
            const containers = document.querySelectorAll('.canvas-node.container');
            for (const c of containers) {
                const body = c.querySelector('.container-body');
                if (body) {
                    const rect = body.getBoundingClientRect();
                    if (e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        containerId = c.dataset.nodeId;
                        break;
                    }
                }
            }
            if (containerId) {
                const startX = e.clientX;
                const startY = e.clientY;
                const isMarqueeMode = e.shiftKey;

                if (isMarqueeMode) {
                    this.handleMarqueeSelection(startX, startY, true, containerId);
                } else {
                    this.handleCanvasDrag(startX, startY);
                }
                return;
            }
        }
        
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.length > 0) {
            return;
        }
        
        const startX = e.clientX;
        const startY = e.clientY;
        const isMarqueeMode = e.shiftKey;
        
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
     * @param {boolean} accumulate - 是否追加选择
     * @param {string|null} containerId - 容器节点ID
     */
    handleMarqueeSelection(startX, startY, accumulate = false, containerId = null) {
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
                
                this.ui.selection.selectNodesInRect(left, top, width, height, accumulate, containerId);
            }
            
            document.body.removeChild(marquee);
            DOM.setStyle(this.canvas, 'cursor', 'default');
            DOM.off(document, 'mousemove', onMouseMove);
            DOM.off(document, 'mouseup', onMouseUp);
            DOM.off(document, 'keydown', onKeyDown);
            this.hasDraggedCanvas = false;
            
            setTimeout(() => {
                this.isMarqueeSelectionActive = false;
            }, 100);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                document.body.removeChild(marquee);
                DOM.setStyle(this.canvas, 'cursor', 'default');
                DOM.off(document, 'mousemove', onMouseMove);
                DOM.off(document, 'mouseup', onMouseUp);
                DOM.off(document, 'keydown', onKeyDown);
                this.hasDraggedCanvas = false;
                this.isMarqueeSelectionActive = false;
            }
        };
        
        DOM.on(document, 'mousemove', onMouseMove);
        DOM.on(document, 'mouseup', onMouseUp);
        DOM.on(document, 'keydown', onKeyDown);
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
            DOM.off(document, 'keydown', onKeyDown);
            
            this.scheduleRenderUpdate();
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                DOM.setStyle(this.canvas, 'cursor', 'default');
                DOM.off(document, 'mousemove', onMouseMove);
                DOM.off(document, 'mouseup', onMouseUp);
                DOM.off(document, 'keydown', onKeyDown);
            }
        };
        
        DOM.on(document, 'mousemove', onMouseMove);
        DOM.on(document, 'mouseup', onMouseUp);
        DOM.on(document, 'keydown', onKeyDown);
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

        const isOnMinimap = e.target.closest('#minimap, .minimap, #minimapCanvas, .minimap-viewport');
        const isOnToolbar = e.target.closest('.toolbar, .align-toolbar, .align-btn, .property-panel, .property-panel-content, .btn, .zoom-controls, .zoom-btn, .empty-state');
        const isOnDropdown = e.target.closest('.dropdown-menu');
        if (isOnMinimap || isOnToolbar || isOnDropdown) {
            return;
        }
        
        const isNode = e.target.closest('.canvas-node');
        const isEdge = e.target.tagName === 'path' && e.target.getAttribute('data-edge-id');
        
        if (!isNode && !isEdge) {
            this.ui.selection.deselectAll();
        }
        this.renderMinimap();
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
        this.updateZoomLevel();
    }

    /**
     * 放大
     */
    zoomIn() {
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        const { translateX, translateY, scale } = this.getCurrentTransform();
        const newScale = Math.min(APP_CONFIG.ZOOM.MAX_SCALE, scale * 1.1);
        if (newScale === scale) return;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newTranslateX = cx - (cx - translateX) * (newScale / scale);
        const newTranslateY = cy - (cy - translateY) * (newScale / scale);
        this.canvasScale = newScale;
        this.applyTransform(newTranslateX, newTranslateY, newScale);
        this.updateSvgSize();
        this.scheduleRenderUpdate();
        this.updateZoomLevel();
    }

    /**
     * 缩小
     */
    zoomOut() {
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        const { translateX, translateY, scale } = this.getCurrentTransform();
        const newScale = Math.max(APP_CONFIG.ZOOM.MIN_SCALE, scale * 0.9);
        if (newScale === scale) return;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newTranslateX = cx - (cx - translateX) * (newScale / scale);
        const newTranslateY = cy - (cy - translateY) * (newScale / scale);
        this.canvasScale = newScale;
        this.applyTransform(newTranslateX, newTranslateY, newScale);
        this.updateSvgSize();
        this.scheduleRenderUpdate();
        this.updateZoomLevel();
    }

    /**
     * 更新缩放级别显示
     */
    updateZoomLevel() {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.canvasScale * 100) + '%';
        }
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
        this.updateSvgSize();
        this.applyTransform(translateX, translateY, newScale);
        this.scheduleRenderUpdate();
        this.updateZoomLevel();
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
        autoOptimizeLayout(this.core, this);
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

    /**
     * 导出画布为图片
     * @param {'png'|'svg'} [format='png'] 导出格式
     */
    async exportAsImage(format = 'png') {
        if (!this.svgLayer || !this.canvasContent) return;

        const allNodeEls = this.canvasContent.querySelectorAll('.canvas-node');
        if (allNodeEls.length === 0) return;

        const { translateX: panX, translateY: panY, scale: canvasScale } = this.getCurrentTransform();
        const invScale = 1 / canvasScale;
        const canvasRect = this.canvas.getBoundingClientRect();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        allNodeEls.forEach(el => {
            const rect = el.getBoundingClientRect();
            const screenX = rect.left - canvasRect.left;
            const screenY = rect.top - canvasRect.top;
            const x = (screenX - panX) * invScale;
            const y = (screenY - panY) * invScale;
            const w = rect.width * invScale;
            const h = rect.height * invScale;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });

        const edgeElems = this.svgLayer.querySelectorAll('path[data-edge-id], polygon[data-edge-id], text[data-edge-id]');
        edgeElems.forEach(el => {
            if (el.getBBox) {
                const bbox = el.getBBox();
                minX = Math.min(minX, bbox.x);
                minY = Math.min(minY, bbox.y);
                maxX = Math.max(maxX, bbox.x + bbox.width);
                maxY = Math.max(maxY, bbox.y + bbox.height);
            }
        });

        const padding = 40;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;

        const bgColor = getComputedStyle(document.body).getPropertyValue('--bg-primary').trim() || '#1a1a2e';
        const svgParts = [];

        if (edgeElems.length > 0) {
            svgParts.push(`<g transform="translate(${offsetX},${offsetY})">`);
            edgeElems.forEach(el => {
                svgParts.push(el.outerHTML);
            });
            svgParts.push('</g>');
        }

        const renderNode = (el) => {
            const rect = el.getBoundingClientRect();
            const screenX = rect.left - canvasRect.left;
            const screenY = rect.top - canvasRect.top;
            const x = (screenX - panX) * invScale + offsetX;
            const y = (screenY - panY) * invScale + offsetY;
            const w = rect.width * invScale;
            const h = rect.height * invScale;

            const isContainer = el.classList.contains('container');
            const isLoop = el.classList.contains('loop');
            const _isBatch = el.classList.contains('batch');

            const titleEl = el.querySelector('.node-title');
            const title = titleEl ? titleEl.textContent : '';
            const typeEl = el.querySelector('.node-type');
            const typeText = typeEl ? typeEl.textContent : '';
            const iconEl = el.querySelector('.node-icon');
            const iconText = iconEl ? iconEl.textContent : '';
            const descEl = el.querySelector('.node-description');
            const descText = descEl ? descEl.textContent : '';

            const cs = window.getComputedStyle(el);
            const nodeBg = this._rgb(cs.backgroundColor) || '#2a2a3e';
            const nodeBorder = this._rgb(cs.borderColor) || '#444';
            const titleColor = this._rgb(cs.color) || '#e0e0e0';
            const headerH = isContainer ? 36 : 32;
            const headerBg = isContainer ? (isLoop ? '#00B2B2' : '#8B5CF6') : 'rgba(255,255,255,0.05)';

            const parts = [`<g transform="translate(${x},${y})">`];

            if (isContainer) {
                const descH = descText ? 20 : 0;
                const bodyH = h - headerH - descH;

                parts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`);
                parts.push(`<rect x="0" y="0" width="${w}" height="${headerH}" rx="12" fill="${headerBg}" opacity="0.3"/>`);
                parts.push(`<rect x="0" y="${headerH - 12}" width="${w}" height="12" fill="${headerBg}" opacity="0.3"/>`);
                if (iconText) {
                    parts.push(`<text x="10" y="${headerH / 2 + 5}" font-size="14" dominant-baseline="middle">${this._escapeXml(iconText)}</text>`);
                }
                parts.push(`<text x="${iconText ? 30 : 10}" y="${headerH / 2 + 5}" font-size="13" fill="${titleColor}" font-weight="600" font-family="system-ui, -apple-system, sans-serif" dominant-baseline="middle">${this._escapeXml(title)}</text>`);
                if (descText) {
                    parts.push(`<text x="10" y="${headerH + descH - 4}" font-size="11" fill="#888" font-family="system-ui, -apple-system, sans-serif">${this._escapeXml(descText)}</text>`);
                }
                if (bodyH > 0) {
                    parts.push(`<rect x="0" y="${headerH + descH}" width="${w}" height="${bodyH}" rx="0" fill="rgba(0,0,0,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="4,4"/>`);
                }
            } else {
                parts.push(`<rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`);
                parts.push(`<rect x="0" y="0" width="${w}" height="${headerH}" rx="8" fill="${headerBg}"/>`);
                parts.push(`<rect x="0" y="${headerH - 8}" width="${w}" height="8" fill="${headerBg}"/>`);

                if (iconText) {
                    parts.push(`<text x="10" y="${headerH / 2 + 5}" font-size="14" dominant-baseline="middle">${this._escapeXml(iconText)}</text>`);
                }
                parts.push(`<text x="${iconText ? 30 : 10}" y="${headerH / 2 + 5}" font-size="12" fill="${titleColor}" font-weight="600" font-family="system-ui, -apple-system, sans-serif" dominant-baseline="middle">${this._escapeXml(title)}</text>`);

                if (typeText) {
                    const typeTextEl = el.querySelector('.node-type');
                    const typeBg = typeTextEl ? this._rgb(window.getComputedStyle(typeTextEl).backgroundColor) || 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.1)';
                    const typeColor = typeTextEl ? this._rgb(window.getComputedStyle(typeTextEl).color) || '#94a3b8' : '#94a3b8';
                    const typeW = typeText.length * 7 + 12;
                    const typeH = 16;
                    const typeX = w - typeW - 6;
                    const typeY = (headerH - typeH) / 2;
                    parts.push(`<rect x="${typeX}" y="${typeY}" width="${typeW}" height="${typeH}" rx="4" fill="${typeBg}"/>`);
                    parts.push(`<text x="${typeX + typeW / 2}" y="${headerH / 2 + 5}" font-size="10" fill="${typeColor}" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" dominant-baseline="middle">${this._escapeXml(typeText)}</text>`);
                }
                if (descText) {
                    parts.push(`<text x="10" y="${headerH + 16}" font-size="10" fill="#666" font-family="system-ui, -apple-system, sans-serif">${this._escapeXml(descText)}</text>`);
                }
            }

            const points = el.querySelectorAll('.connection-point');
            points.forEach(pt => {
                const pr = pt.getBoundingClientRect();
                const cx = (pr.left - rect.left) * invScale;
                const cy = (pr.top - rect.top) * invScale;
                const r = (pr.width / 2) * invScale;
                const isInput = pt.classList.contains('input');
                const isOutput = pt.classList.contains('output');
                parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${isInput ? '#4CAF50' : isOutput ? '#2196F3' : '#FF9800'}" stroke="#fff" stroke-width="1.5"/>`);
            });

            parts.push('</g>');
            return parts.join('\n');
        };

        // 所有节点平铺到顶层，每个节点用 getBoundingClientRect 独立计算绝对位置
        allNodeEls.forEach(el => {
            svgParts.push(renderNode(el));
        });

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <style>
                    .workflow-edge { fill: #64748b; stroke: #64748b; stroke-width: 2.5; }
                    path[data-edge-id] { fill: none; stroke: #64748b; stroke-width: 2.5; }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="${bgColor}"/>
            ${svgParts.join('\n')}
        </svg>`;

        if (format === 'svg') {
            this._downloadBlob(svgString, 'workflow.svg', 'image/svg+xml');
            return;
        }

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) {
                    this._downloadBlob(blob, 'workflow.png', 'image/png');
                }
            }, 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            this._downloadBlob(svgString, 'workflow.svg', 'image/svg+xml');
        };
        img.src = url;
    }

    _rgb(color) {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
        return color;
    }

    _escapeXml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * 下载 Blob 文件
     * @private
     */
    _downloadBlob(data, filename, mimeType) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}