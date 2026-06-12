import { WorkflowCanvas } from './workflow-canvas.js';
import { WorkflowNode } from './workflow-node.js';
import { WorkflowEdge } from './workflow-edge.js';
import { WorkflowHistory } from './workflow-history.js';
import { WorkflowClipboard } from './workflow-clipboard.js';
import { Logger } from '../utils/logger.js';
import { Dialog } from './dialog.js';
import { goToConverter, goToManager, initNavigator } from './navigator.js';
import { SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';

export class WorkflowUI {
    constructor(core) {
        this.core = core;
        
        // 状态管理
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.hasDragged = false;
        this.isMultiSelectMode = false;
        this.connectingFrom = null;
        this.svgPath = null;
    }
    
    /**
     * 初始化 UI
     */
    init() {
        const isModal = DOM.get('workflowEditorModal') !== null;
        const prefix = isModal ? 'editor' : '';
        
        // 获取 DOM 元素
        this.propertyContent = DOM.get(prefix + SELECTORS.EDITOR.PROPERTY_CONTENT);
        this.importedNodeInfo = DOM.get(prefix + SELECTORS.EDITOR.IMPORTED_NODE_INFO);
        
        // 初始化子模块
        this.canvas = new WorkflowCanvas(this, prefix);
        this.node = new WorkflowNode(this);
        this.edge = new WorkflowEdge(this);
        this.history = new WorkflowHistory(this, prefix);
        this.clipboard = new WorkflowClipboard(this);
        
        // 启动子模块
        this.canvas.init();
        this.history.init();
        this.history.updatePanel();
        
        // 渲染动态节点面板
        this.renderNodePalette();
        
        // 设置搜索处理器
        this.setupSearchHandler();
        
        // 设置对齐工具栏
        this.setupAlignToolbar();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 检查导入数据（优先级更高）
        this.checkImportedData();
        
        // 创建消息容器
        this.createMessageContainer();
        
        // 如果有已加载的节点，渲染它们
        if (this.core.nodes.length > 0) {
            this.core.nodes.forEach(node => {
                const nodeCopy = JSON.parse(JSON.stringify(node));
                const el = this.node.createElement(nodeCopy);
                this.canvas.canvasContent.appendChild(el);
            });
            this.canvas.setEmptyState(false);
            this.updateEdges();
            this.updateSummary();
        }
        
        // 启动自动保存
        this.startAutoSave();
    }

    /**
     * 创建消息容器 
     */
    createMessageContainer() {
        this.messageContainer = DOM.create('div', {
            className: 'workflow-message-container',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }
        });
        document.body.appendChild(this.messageContainer);
    }

    /**
     * 显示消息提示
     * @param {string} text - 消息文本
     * @param {string} type - 消息类型 ('success', 'error', 'info', 'warning')
     */
    showMessage(text, type = 'info') {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        
        const messageEl = DOM.create('div', {
            className: `workflow-message workflow-message-${type}`,
            style: {
                padding: '12px 20px',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transform: 'translateX(100%)',
                animation: 'slideIn 0.3s ease-out forwards',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '320px',
                backgroundColor: colors[type] || colors.info
            },
            html: `<span>${icons[type] || icons.info}</span><span>${text}</span>`
        });
        
        this.messageContainer.appendChild(messageEl);
        
        setTimeout(() => {
            DOM.setStyle(messageEl, 'animation', 'slideOut 0.3s ease-out forwards');
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 设置节点搜索处理器
     */
    setupSearchHandler() {
        const searchInput = DOM.get('nodeSearchInput');
        const searchCount = DOM.get('nodeSearchCount');
        if (!searchInput) return;

        DOM.on(searchInput, 'input', () => {
            const term = searchInput.value.trim().toLowerCase();
            this.performSearch(term);
        });

        DOM.on(searchInput, 'keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.performSearch('');
                searchInput.blur();
            }
        });
    }

    /**
     * 执行节点搜索筛选
     * @param {string} term - 搜索关键词
     */
    performSearch(term) {
        const searchCount = DOM.get('nodeSearchCount');
        const nodeEls = document.querySelectorAll('.canvas-node');
        let matchCount = 0;

        if (!term) {
            nodeEls.forEach(el => {
                DOM.removeClass(el, 'search-dimmed');
                DOM.removeClass(el, 'search-highlight');
            });
            if (searchCount) DOM.setStyle(searchCount, 'display', 'none');
            return;
        }

        // 获取节点类型中文名映射
        const typeNameMap = {
            start: '开始', end: '结束', llm: '大模型', plugin: '插件',
            code: '代码', condition: '选择器', http: 'http', text: '文本',
            image_generate: '图片生成', knowledge: '知识库', question: '问答',
            loop: '循环', async_task: '异步任务', comment: '注释',
            output: '输出', input: '输入', variable_merge: '变量合并',
            intent: '意图', batch: '批处理', video_generation: '视频生成'
        };

        nodeEls.forEach(el => {
            const nodeId = el.dataset.nodeId;
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const name = (node.title || '').toLowerCase();
            const type = (node.type || '').toLowerCase();
            const typeName = (typeNameMap[type] || type).toLowerCase();
            const id = (node.id || '').toLowerCase();

            const matches = name.includes(term) || type.includes(term) || typeName.includes(term) || id.includes(term);

            if (matches) {
                DOM.removeClass(el, 'search-dimmed');
                DOM.addClass(el, 'search-highlight');
                matchCount++;
            } else {
                DOM.removeClass(el, 'search-highlight');
                DOM.addClass(el, 'search-dimmed');
            }
        });

        if (searchCount) {
            DOM.setStyle(searchCount, 'display', 'inline');
            DOM.setText(searchCount, `${matchCount}/${nodeEls.length}`);
        }
    }

    /**
     * 设置对齐工具栏
     */
    setupAlignToolbar() {
        const toolbar = DOM.get('alignToolbar');
        if (!toolbar) return;

        DOM.on(toolbar, 'click', (e) => {
            const btn = e.target.closest('.align-btn');
            if (!btn) return;
            const mode = btn.dataset.align;
            if (mode) this.alignNodes(mode);
        });
    }

    /**
     * 动态渲染节点面板
     */
    renderNodePalette() {
        const palette = DOM.get('nodePalette');
        const searchInput = DOM.get('nodePaletteSearch');
        if (!palette) return;

        const types = this.core.nodeTypeInfo;
        const allTypes = Object.entries(types);

        const render = (filter = '') => {
            const q = filter.toLowerCase();
            const filtered = allTypes.filter(([, info]) =>
                !q || info.title.includes(q) || info.description?.includes(q)
            );

            palette.innerHTML = '';
            for (const [type, info] of filtered) {
                const item = document.createElement('div');
                item.className = 'node-item';
                item.draggable = true;
                item.dataset.nodeType = type;
                item.title = info.description || '';
                item.innerHTML = `<div class="icon">${info.icon}</div><div class="label">${info.title}</div>`;

                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', type);
                    e.dataTransfer.effectAllowed = 'copy';
                });

                palette.appendChild(item);
            }
        };

        render();

        if (searchInput) {
            DOM.on(searchInput, 'input', () => render(searchInput.value));
        }
    }

    /**
     * 更新对齐工具栏位置和可见性
     */
    updateAlignToolbar() {
        const toolbar = DOM.get('alignToolbar');
        if (!toolbar) return;

        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodes.length < 2) {
            DOM.removeClass(toolbar, 'visible');
            return;
        }

        const canvas = DOM.get('canvas');
        const canvasRect = canvas.getBoundingClientRect();

        let minX = Infinity, minY = Infinity, maxY = -Infinity;
        selectedNodes.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.left < minX) minX = rect.left;
            if (rect.top < minY) minY = rect.top;
            if (rect.bottom > maxY) maxY = rect.bottom;
        });

        const toolbarLeft = minX - canvasRect.left;
        const toolbarTop = minY - canvasRect.top - 44;

        DOM.setStyle(toolbar, 'left', toolbarLeft + 'px');
        DOM.setStyle(toolbar, 'top', Math.max(4, toolbarTop) + 'px');
        DOM.addClass(toolbar, 'visible');
    }

    /**
     * 对齐选中的节点
     * @param {string} mode - 对齐模式
     */
    alignNodes(mode) {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length < 2) return;

        const nodes = [];
        selectedEls.forEach(el => {
            const nodeId = el.dataset.nodeId;
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (node) {
                const rect = el.getBoundingClientRect();
                const canvasRect = document.getElementById('canvas').getBoundingClientRect();
                const scale = this.canvas.canvasScale;
                nodes.push({
                    node,
                    el,
                    x: (rect.left - canvasRect.left) / scale,
                    y: (rect.top - canvasRect.top) / scale,
                    width: rect.width / scale,
                    height: rect.height / scale
                });
            }
        });

        if (nodes.length < 2) return;

        switch (mode) {
            case 'left':
                this.alignLeft(nodes);
                break;
            case 'centerH':
                this.alignCenterH(nodes);
                break;
            case 'right':
                this.alignRight(nodes);
                break;
            case 'top':
                this.alignTop(nodes);
                break;
            case 'centerV':
                this.alignCenterV(nodes);
                break;
            case 'bottom':
                this.alignBottom(nodes);
                break;
            case 'distH':
                this.distributeHorizontal(nodes);
                break;
            case 'distV':
                this.distributeVertical(nodes);
                break;
        }
        
        this.core.saveHistory('对齐节点');
    }

    alignLeft(nodes) {
        if (!nodes || nodes.length === 0) return;
        const minX = Math.min(...nodes.map(n => n.x));
        nodes.forEach(n => {
            this.core.updateNodePosition(n.node.id, minX, n.y);
            DOM.setStyle(n.el, 'left', minX + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    alignCenterH(nodes) {
        const centerX = nodes.reduce((s, n) => s + n.x + n.width / 2, 0) / nodes.length;
        nodes.forEach(n => {
            const newX = centerX - n.width / 2;
            this.core.updateNodePosition(n.node.id, newX, n.y);
            DOM.setStyle(n.el, 'left', newX + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    alignRight(nodes) {
        const maxX = Math.max(...nodes.map(n => n.x + n.width));
        nodes.forEach(n => {
            const newX = maxX - n.width;
            this.core.updateNodePosition(n.node.id, newX, n.y);
            DOM.setStyle(n.el, 'left', newX + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    alignTop(nodes) {
        const minY = Math.min(...nodes.map(n => n.y));
        nodes.forEach(n => {
            this.core.updateNodePosition(n.node.id, n.x, minY);
            DOM.setStyle(n.el, 'top', minY + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    alignCenterV(nodes) {
        const centerY = nodes.reduce((s, n) => s + n.y + n.height / 2, 0) / nodes.length;
        nodes.forEach(n => {
            const newY = centerY - n.height / 2;
            this.core.updateNodePosition(n.node.id, n.x, newY);
            DOM.setStyle(n.el, 'top', newY + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    alignBottom(nodes) {
        const maxY = Math.max(...nodes.map(n => n.y + n.height));
        nodes.forEach(n => {
            const newY = maxY - n.height;
            this.core.updateNodePosition(n.node.id, n.x, newY);
            DOM.setStyle(n.el, 'top', newY + 'px');
        });
        this.updateEdges();
        this.updateAlignToolbar();
    }

    distributeHorizontal(nodes) {
        if (nodes.length < 3) return;
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((s, n) => s + n.width, 0);
        const minX = sorted[0].x;
        const maxX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
        const gap = (maxX - minX - totalWidth) / (sorted.length - 1);

        let curX = sorted[0].x;
        sorted.forEach(n => {
            this.core.updateNodePosition(n.node.id, curX, n.y);
            DOM.setStyle(n.el, 'left', curX + 'px');
            curX += n.width + gap;
        });
        this.core.saveHistory('水平分布');
        this.updateEdges();
        this.updateAlignToolbar();
    }

    distributeVertical(nodes) {
        if (nodes.length < 3) return;
        const sorted = [...nodes].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((s, n) => s + n.height, 0);
        const minY = sorted[0].y;
        const maxY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
        const gap = (maxY - minY - totalHeight) / (sorted.length - 1);

        let curY = sorted[0].y;
        sorted.forEach(n => {
            this.core.updateNodePosition(n.node.id, n.x, curY);
            DOM.setStyle(n.el, 'top', curY + 'px');
            curY += n.height + gap;
        });
        this.core.saveHistory('垂直分布');
        this.updateEdges();
        this.updateAlignToolbar();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(document, 'keydown', (e) => this.handleKeydown(e));
        
        // 导航按钮
        DOM.on(DOM.get('navConverterBtn'), 'click', goToConverter);
        DOM.on(DOM.get('navManagerBtn'), 'click', goToManager);
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleKeydown(e) {
        const activeEl = document.activeElement;
        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        const isContentEditable = activeEl.isContentEditable;
        const isModalOpen = document.querySelector('.node-editor-modal') !== null;
        
        // 如果有模态框打开或在可编辑元素中，不处理快捷键
        if (isModalOpen || isInput || isContentEditable) {
            return;
        }
        
        // 删除选中项
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
        }
        
        // 复制
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            this.clipboard.copy();
        }
        
        // 粘贴
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            this.clipboard.paste();
        }
        
        // 复制并粘贴（Ctrl+D）
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            this.duplicateSelected();
        }
        
        // 全选
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }
        
        // 撤销
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            this.history.undo();
        }
        
        // 重做 (Ctrl+Y 或 Ctrl+Shift+Z)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            this.history.redo();
        }
        
        // Esc - 返回管理页面并询问保存
        if (e.key === 'Escape') {
            e.preventDefault();
            this.confirmExit();
        }
        
        // Ctrl+S - 快速保存（不返回）
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.quickSave();
        }
    }

    /**
     * 全选节点和边
     */
    selectAll() {
        // 选中所有节点
        document.querySelectorAll('.canvas-node').forEach(n => DOM.addClass(n, 'selected'));
        
        // 选中所有边
        document.querySelectorAll('.workflow-edge').forEach(e => DOM.addClass(e, 'selected'));
        
        // 更新边的显示
        if (this.core.edges.length > 0) {
            this.core.selectEdge(this.core.edges[0].id);
        }
        this.updateEdges();
        
        // 更新属性面板
        if (this.core.nodes.length > 0) {
            const firstNode = this.core.nodes[0];
            const node = this.core.nodes.find(n => n.id === firstNode.id);
            if (node) this.node.renderPropertyPanel(node);
        }
        
        // 设置多选模式
        if (this.core.nodes.length > 1) {
            this.isMultiSelectMode = true;
        }
    }

    /**
     * 更新选择状态
     */
    updateSelection() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        
        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);
            
            const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (node) this.node.renderPropertyPanel(node);
            
            if (selectedNodes.length > 1 || selectedEdges.length > 0) {
                this.isMultiSelectMode = true;
            }
        } else if (selectedEdges.length > 0) {
            const lastSelected = selectedEdges[selectedEdges.length - 1];
            const lastEdgeId = lastSelected.getAttribute('data-edge-id');
            this.core.selectEdge(lastEdgeId);
            
            const edge = this.core.edges.find(e => e.id === lastEdgeId);
            if (edge) this.edge.renderPropertyPanel(edge);
        }
        
        this.updateAlignToolbar();
    }

    /**
     * 删除选中项
     */
    deleteSelected() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        
        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
            return;
        }
        
        // 删除选中的边（不保存历史）
        selectedEdges.forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            this.edge.delete(edgeId, false, false);
        });
        
        // 删除选中的节点（不保存历史）
        selectedNodes.forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;
            this.node.delete(nodeId, false, false);
        });
        
        // 批量操作只保存一次历史记录（删除后保存，确保 redo 能正确恢复删除状态）
        this.core.saveHistory('删除选中项');
        
        this.updateHistoryPanel();
        this.showMessage('已删除选中项', 'success');
    }

    /**
     * 复制选中节点（Ctrl+D）
     */
    duplicateSelected() {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length === 0) return;
        
        const newIds = [];
        selectedEls.forEach(el => {
            const nodeId = el.dataset.nodeId;
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newNode = {
                ...JSON.parse(JSON.stringify(node)),
                id: newId,
                title: `${node.title} (副本)`,
                x: node.x + 30,
                y: node.y + 30
            };
            
            this.core.addNode(newNode);
            const newEl = this.node.createElement(newNode);
            this.canvas.canvasContent.appendChild(newEl);
            newEl.classList.add('selected');
            newIds.push(newId);
        });
        
        this.updateEdges();
        this.updateSummary();
        this.core.saveHistory('复制节点');
        this.updateHistoryPanel();
        this.showMessage(`已复制 ${selectedEls.length} 个节点`, 'success');
    }

    /**
     * 清除属性面板
     */
    clearPropertyPanel() {
        this.showSummaryPanel();
    }

    /**
     * 更新边的显示
     */
    updateEdges() {
        if (this.edge) {
            this.edge.updateAllEdges();
        }
    }

    /**
     * 取消全选
     */
    deselectAll() {
        document.querySelectorAll('.canvas-node.selected').forEach(n => DOM.removeClass(n, 'selected'));
        document.querySelectorAll('.workflow-edge.selected').forEach(e => DOM.removeClass(e, 'selected'));
        this.isMultiSelectMode = false;
        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.clearPropertyPanel();
        this.edge.update();
    }

    /**
     * 选择指定矩形区域内的节点和边（当边的两个端点都被选中时才选中边）
     * @param {number} left - 左侧坐标
     * @param {number} top - 顶部坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    selectNodesInRect(left, top, width, height) {
        this.deselectAll();
        
        const selectedNodeIds = new Set();
        
        document.querySelectorAll('.canvas-node').forEach(nodeEl => {
            const rect = nodeEl.getBoundingClientRect();
            const nodeLeft = rect.left;
            const nodeTop = rect.top;
            const nodeWidth = rect.width;
            const nodeHeight = rect.height;
            
            if (
                nodeLeft < left + width &&
                nodeLeft + nodeWidth > left &&
                nodeTop < top + height &&
                nodeTop + nodeHeight > top
            ) {
                DOM.addClass(nodeEl, 'selected');
                const nodeId = nodeEl.getAttribute('data-node-id');
                if (nodeId) {
                    selectedNodeIds.add(nodeId);
                }
            }
        });
        
        document.querySelectorAll('.workflow-edge').forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (edgeId) {
                const edge = this.core.edges.find(e => e.id === edgeId);
                if (edge && selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
                    DOM.addClass(edgeEl, 'selected');
                }
            }
        });
        
        this.updateSelection();
        this.edge.update();
    }

    /**
     * 检查导入数据
     */
    checkImportedData() {
        // 检查 URL 参数中的导入数据
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        
        if (data) {
            try {
                const workflowData = JSON.parse(decodeURIComponent(data));
                this.core.loadFromClipboard(workflowData);
                this.showMessage('工作流数据已导入', 'success');
            } catch (error) {
                this.showMessage('导入失败：无效的数据格式', 'error');
                Logger.error('Import error:', error);
            }
        }
    }

    /**
     * 更新面板
     */
    updatePanel() {
        this.history.updatePanel();
    }

    /**
     * 更新摘要信息
     */
    updateSummary() {
        const nodeCountEl = DOM.get('nodeCount');
        const edgeCountEl = DOM.get('edgeCount');
        const startCountEl = DOM.get('startCount');
        const endCountEl = DOM.get('endCount');
        const nodeLabelEl = DOM.get('summaryNodeLabel');
        const edgeLabelEl = DOM.get('summaryEdgeLabel');
        const startRowEl = DOM.get('summaryStartRow');
        const endRowEl = DOM.get('summaryEndRow');
        
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        const isMultiSelect = selectedNodes.length + selectedEdges.length > 1;
        
        if (isMultiSelect) {
            if (nodeLabelEl) nodeLabelEl.textContent = '已选节点';
            if (edgeLabelEl) edgeLabelEl.textContent = '已选边';
            if (nodeCountEl) nodeCountEl.textContent = selectedNodes.length;
            if (edgeCountEl) edgeCountEl.textContent = selectedEdges.length;
            if (startRowEl) startRowEl.style.display = 'none';
            if (endRowEl) endRowEl.style.display = 'none';
        } else {
            if (nodeLabelEl) nodeLabelEl.textContent = '节点数量';
            if (edgeLabelEl) edgeLabelEl.textContent = '连接数量';
            if (nodeCountEl) nodeCountEl.textContent = this.core.nodes.length;
            if (edgeCountEl) edgeCountEl.textContent = this.core.edges.length;
            if (startRowEl) startRowEl.style.display = 'flex';
            if (endRowEl) endRowEl.style.display = 'flex';
            if (startCountEl) startCountEl.textContent = this.core.nodes.filter(n => n.type === 'start').length;
            if (endCountEl) endCountEl.textContent = this.core.nodes.filter(n => n.type === 'end').length;
        }
    }

    showSummaryPanel() {
        const summary = DOM.get('workflowSummary');
        const detail = DOM.get('nodeDetail');
        if (summary) summary.style.display = 'block';
        if (detail) detail.style.display = 'none';
        this.updateSummary();
    }

    showDetailPanel() {
        const summary = DOM.get('workflowSummary');
        const detail = DOM.get('nodeDetail');
        if (summary) summary.style.display = 'none';
        if (detail) detail.style.display = 'block';
    }
    
    /**
     * 重置视图到初始位置和缩放
     */
    resetView() {
        this.canvas.resetView();
        this.showMessage('视图已重置', 'success');
    }

    /**
     * 启动自动保存
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
            }
        }, 5000); // 每5秒自动保存一次
        
        // 保存清理引用
        this.beforeUnloadHandler = () => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
    }

    destroy() {
        this.stopAutoSave();
    }
    
    /**
     * 手动保存工作流
     */
    saveWorkflow() {
        const success = this.core.saveToLocalStorage();
        if (success) {
            this.showMessage('工作流已保存', 'success');
        } else {
            this.showMessage('保存失败', 'error');
        }
    }
    
    /**
     * 清除保存的工作流
     */
    clearSavedWorkflow() {
        this.core.clearSavedWorkflow();
        this.showMessage('已清除保存的工作流', 'success');
    }

    /**
     * 在画布上添加节点（供外部调用）
     * @param {string} type - 节点类型
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     */
    addNodeToCanvas(type, screenX, screenY) {
        this.node.addToCanvas(type, screenX, screenY);
    }
    
    /**
     * 更新历史记录面板（供外部调用）
     */
    updateHistoryPanel() {
        this.history.updatePanel();
    }
    
    /**
     * 刷新画布显示
     */
    refreshCanvas() {
        // 清空画布内容
        while (this.canvas.canvasContent.firstChild) {
            this.canvas.canvasContent.removeChild(this.canvas.canvasContent.firstChild);
        }
        
        // 重新渲染所有节点（使用深拷贝避免污染历史记录）
        this.core.nodes.forEach(node => {
            const nodeCopy = JSON.parse(JSON.stringify(node));
            const el = this.node.createElement(nodeCopy);
            this.canvas.canvasContent.appendChild(el);
        });
        
        // 更新边和 SVG 大小
        this.updateEdges();
        this.canvas.updateSvgSize();
        
        // 更新摘要
        this.updateSummary();
        
        // 检查是否需要显示空状态
        if (this.core.nodes.length === 0) {
            this.canvas.setEmptyState(true);
        }
    }
    
    /**
     * 开始创建连接（委托给 edge 模块）
     * @param {string} nodeId - 源节点 ID
     * @param {MouseEvent} e - 鼠标事件
     */
    startConnection(nodeId, e) {
        if (this.edge) {
            this.edge.startConnection(nodeId, e);
        }
    }
    
    /**
     * 取消连接创建（委托给 edge 模块）
     */
    cancelConnection() {
        if (this.edge) {
            this.edge.cancelConnection();
        }
    }
    
    /**
     * 删除节点（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    deleteNode(nodeId) {
        this.node.delete(nodeId);
    }
    
    /**
     * 保存节点编辑（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    saveNodeEdit(nodeId) {
        this.node.saveEdit(nodeId);
    }
    
    /**
     * 保存节点详情面板编辑（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    saveNodeDetail(nodeId) {
        this.node.saveNodeDetail(nodeId);
    }
    
    /**
     * 删除边（供外部调用）
     * @param {string} edgeId - 边 ID
     */
    deleteEdge(edgeId) {
        this.edge.delete(edgeId);
    }
    
    /**
     * 验证工作流（供外部调用）
     */
    validate() {
        const result = this.core.validate();
        if (result.valid) {
            this.showMessage('工作流验证通过', 'success');
        } else {
            this.showMessage(`验证失败：<br>${result.message.replace(/\n/g, '<br>')}`, 'error');
        }
    }
    
    /**
     * 导出工作流（供外部调用）
     */
    exportWorkflow() {
        const workflow = this.core.exportWorkflow();
        const dataStr = JSON.stringify(workflow, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage('工作流导出成功', 'success');
    }
    
    /**
     * 生成分享链接
     */
    async shareLink() {
        const workflow = this.core.exportWorkflow();
        workflow.name = document.getElementById('workflowName')?.textContent || workflow.name;
        
        const json = JSON.stringify(workflow);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            this.showMessage('分享链接已复制到剪贴板', 'success');
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showMessage('分享链接已复制到剪贴板', 'success');
        }
    }
    
    /**
     * 从分享链接加载工作流
     * @param {string} encoded - Base64编码的工作流数据
     */
    static loadFromShareLink(encoded) {
        try {
            const json = decodeURIComponent(escape(atob(encoded)));
            const workflow = JSON.parse(json);
            if (workflow.nodes && Array.isArray(workflow.nodes)) {
                sessionStorage.setItem('editingWorkflow', JSON.stringify(workflow));
                sessionStorage.setItem('editingWorkflowId', workflow.id || '');
                return true;
            }
        } catch (e) {
            Logger.error('分享链接解析失败:', e);
        }
        return false;
    }
    
    /**
     * 清空画布（供外部调用）
     */
    async clearCanvas() {
        const confirmed = await Dialog.confirm('确定要清空画布吗？', '清空确认', { danger: true });
        if (!confirmed) {
            return;
        }
        this.core.clearAll();
        this.core.clearSavedWorkflow();
        document.querySelectorAll('.canvas-node').forEach(n => n.remove());
        this.edge.update();
        this.canvas.setEmptyState(true);
        this.clearPropertyPanel();
        this.showMessage('画布已清空', 'info');
    }
    
    /**
     * 保存工作流并返回管理页面
     */
    saveAndReturn() {
        const workflow = {
            nodes: this.core.nodes,
            edges: this.core.edges,
            selectedNode: this.core.selectedNode,
            selectedEdge: this.core.selectedEdge,
            updatedAt: Date.now()
        };
        
        // 获取当前编辑的工作流ID
        const editingId = sessionStorage.getItem('editingWorkflowId');
        if (editingId) {
            workflow.id = editingId;
        }
        
        // 保存到 sessionStorage，供工作流管理页面读取
        sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
        
        // 同时保存到 localStorage，防止页面刷新丢失
        this.core.saveToLocalStorage();
        
        // 只清除 editingWorkflow，保留 editingWorkflowId 供管理页面更新使用
        sessionStorage.removeItem('editingWorkflow');
        
        this.showMessage('工作流已保存', 'success');
        
        // 延迟跳转，让用户看到保存成功的提示
        setTimeout(() => {
            goToManager();
        }, 500);
    }
    
    /**
     * 确认退出并询问是否保存
     */
    async confirmExit() {
        const result = await Dialog.confirm('是否保存当前工作流后返回？', '退出确认');
        
        if (result) {
            // 用户选择保存
            this.saveAndReturn();
        } else {
            // 用户选择不保存，直接返回
            goToManager();
        }
    }
    
    /**
     * 快速保存（不返回）
     */
    quickSave() {
        try {
            const workflow = {
                nodes: JSON.parse(JSON.stringify(this.core.nodes)),
                edges: JSON.parse(JSON.stringify(this.core.edges)),
                selectedNode: this.core.selectedNode,
                selectedEdge: this.core.selectedEdge,
                updatedAt: Date.now()
            };
            
            // 保存到 sessionStorage，供工作流管理页面读取
            sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
            
            // 同时保存到 localStorage，防止页面刷新丢失
            this.core.saveToLocalStorage();
            
            this.showMessage('工作流已保存', 'success');
        } catch (error) {
            Logger.error('保存失败:', error);
            this.showMessage('保存失败，请重试', 'error');
        }
    }
}