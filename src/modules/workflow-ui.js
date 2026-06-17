import { WorkflowCanvas } from './workflow-canvas.js';
import { WorkflowNode } from './workflow-node.js';
import { WorkflowEdge } from './workflow-edge.js';
import { WorkflowHistory } from './workflow-history.js';
import { WorkflowClipboard } from './workflow-clipboard.js';
import { WorkflowAlign } from './workflow-align.js';
import { WorkflowKeyboard } from './workflow-keyboard.js';
import { WorkflowSelection } from './workflow-selection.js';
import { Logger } from '../utils/logger.js';
import { Dialog } from './dialog.js';
import { goToManager } from './navigator.js';
import { SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';
import { t, i18n } from '../i18n/i18n.js';

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
        this.align = new WorkflowAlign(this);
        this.keyboard = new WorkflowKeyboard(this);
        this.selection = new WorkflowSelection(this);
        
        // 启动子模块
        this.canvas.init();
        this.history.init();
        this.history.updatePanel();
        
        // 设置数据变更自动刷新
        this.core.onChange = (action) => {
            if (action === 'undo' || action === 'redo' || action === 'clearAll' || action === 'batch') {
                this.refreshCanvas();
                this.history.updatePanel();
            } else if (action === 'history') {
                this.history.updatePanel();
            } else {
                this.updateEdges();
                this.canvas.updateSvgSize();
                this.updateSummary();
                if (this.core.nodes.length === 0) {
                    this.canvas.setEmptyState(true);
                }
            }
        };
        
        // 渲染动态节点面板
        this.renderNodePalette();
        
        // 设置搜索处理器
        this.setupSearchHandler();
        
        // 设置对齐工具栏
        this.align.setupAlignToolbar();
        
        // 设置事件监听器
        this.keyboard.setupEventListeners();
        
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
            this.canvas.updateSvgSize();
            this.updateSummary();
            this.canvas.centerView();
        }

        // 记录初始快照，用于判断是否需要提示保存
        this._lastSavedSnapshot = this._captureSnapshot();
        
        // 启动自动保存
        this.startAutoSave();
        
        // 监听语言切换，更新动态内容
        i18n.addListener(() => this.handleLanguageChange());
    }

    /**
     * 捕获当前状态快照（用于判断是否有未保存变更）
     * @returns {string} JSON字符串快照
     */
    _captureSnapshot() {
        return JSON.stringify({
            nodes: this.core.nodes,
            edges: this.core.edges
        });
    }

    /**
     * 检查是否有未保存的变更
     * @returns {boolean} 是否有未保存变更
     */
    hasUnsavedChanges() {
        const current = this._captureSnapshot();
        return current !== this._lastSavedSnapshot;
    }

    /**
     * 更新已保存快照（保存成功后调用）
     */
    markSaved() {
        this._lastSavedSnapshot = this._captureSnapshot();
    }
    
    /**
     * 处理语言切换
     */
    handleLanguageChange() {
        this.renderNodePalette();
        this.updateSummary();
        this.history.updatePanel();
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
            start: t('nodeTypes.start'), end: t('nodeTypes.end'), llm: t('nodeTypes.llm'),
            plugin: t('nodeTypes.plugin'), code: t('nodeTypes.code'), condition: t('nodeTypes.condition'),
            http: t('nodeTypes.http'), text: t('nodeTypes.text'),
            image_generate: t('nodeTypes.image_generate'), knowledge: t('nodeTypes.knowledge'),
            question: t('nodeTypes.question'), loop: t('nodeTypes.loop'),
            async_task: t('nodeTypes.async_task'), comment: t('nodeTypes.comment'),
            output: t('nodeTypes.output'), input: t('nodeTypes.input'),
            variable_merge: t('nodeTypes.variable_merge'), intent: t('nodeTypes.intent'),
            batch: t('nodeTypes.batch'), video_generation: t('nodeTypes.video_generation')
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
                this.showMessage(t('messages.workflowImported'), 'success');
            } catch (error) {
                this.showMessage(t('messages.importInvalidFormat'), 'error');
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
            if (nodeLabelEl) nodeLabelEl.textContent = t('messages.selectedNodes');
            if (edgeLabelEl) edgeLabelEl.textContent = t('messages.selectedEdges');
            if (nodeCountEl) nodeCountEl.textContent = selectedNodes.length;
            if (edgeCountEl) edgeCountEl.textContent = selectedEdges.length;
            if (startRowEl) startRowEl.style.display = 'none';
            if (endRowEl) endRowEl.style.display = 'none';
        } else {
            if (nodeLabelEl) nodeLabelEl.textContent = t('messages.nodeCount');
            if (edgeLabelEl) edgeLabelEl.textContent = t('messages.edgeCount');
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
        this.canvas.autoOptimizeLayout();
        this.showMessage(t('messages.viewReset'), 'success');
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
        this.beforeUnloadCheckHandler = (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        window.addEventListener('beforeunload', this.beforeUnloadCheckHandler);
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
        if (this.beforeUnloadCheckHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadCheckHandler);
            this.beforeUnloadCheckHandler = null;
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
            this.showMessage(t('messages.workflowSaved'), 'success');
        } else {
            this.showMessage(t('messages.saveFailed'), 'error');
        }
    }
    
    /**
     * 清除保存的工作流
     */
    clearSavedWorkflow() {
        this.core.clearSavedWorkflow();
        this.showMessage(t('messages.savedWorkflowCleared'), 'success');
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
        } else {
            this.canvas.setEmptyState(false);
        }
    }
    
    /**
     * 开始创建连接（委托给 edge 模块）
     * @param {string} nodeId - 源节点 ID
     * @param {MouseEvent} e - 鼠标事件
     */
    startConnection(nodeId, e, portId = '') {
        if (this.edge) {
            this.edge.startConnection(nodeId, e, portId);
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
            this.showMessage(t('editor.validateSuccess'), 'success');
        } else {
            this.showMessage(t('editor.validateError') + '：<br>' + result.message.replace(/\n/g, '<br>'), 'error');
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
        this.showMessage(t('messages.workflowExported'), 'success');
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
            this.showMessage(t('messages.shareLinkCopied'), 'success');
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showMessage(t('messages.shareLinkCopied'), 'success');
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
        const confirmed = await Dialog.confirm(t('messages.clearCanvasConfirm'), t('messages.clearCanvasTitle'), { danger: true });
        if (!confirmed) {
            return;
        }
        this.core.clearAll();
        this.core.clearSavedWorkflow();
        this.clearPropertyPanel();
        this.showMessage(t('messages.canvasCleared'), 'info');
    }
    
    /**
     * 保存工作流并返回管理页面
     */
    async saveAndReturn() {
        const workflow = {
            nodes: this.core.nodes,
            edges: this.core.edges,
            selectedNode: this.core.selectedNode,
            selectedEdge: this.core.selectedEdge,
            updatedAt: Date.now()
        };
        
        const editingId = sessionStorage.getItem('editingWorkflowId');
        
        if (!editingId) {
            const result = await Dialog.prompt(t('editor.saveWorkflow'));
            if (!result) return;
            
            workflow.id = `wf_${Date.now()}`;
            workflow.name = result.name;
            workflow.description = result.description;
            workflow.createdAt = Date.now();
            sessionStorage.setItem('savedWorkflowName', result.name);
            sessionStorage.setItem('savedWorkflowDesc', result.description);
        } else {
            workflow.id = editingId;
        }
        
        // 保存到 sessionStorage，供工作流管理页面读取
        sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
        this.markSaved();
        
        // 同时保存到 localStorage，防止页面刷新丢失
        this.core.saveToLocalStorage();
        
        // 只清除 editingWorkflow，保留 editingWorkflowId 供管理页面更新使用
        sessionStorage.removeItem('editingWorkflow');
        
        this.showMessage(t('messages.workflowSaved'), 'success');
        
        // 延迟跳转，让用户看到保存成功的提示
        setTimeout(() => {
            goToManager();
        }, 500);
    }
    
    /**
     * 确认退出并询问是否保存
     */
    async confirmExit() {
        // 如果没有未保存的变更，直接退出不提问
        if (!this.hasUnsavedChanges()) {
            sessionStorage.removeItem('editingWorkflowId');
            goToManager();
            return;
        }

        const result = await Dialog.confirm(t('messages.exitConfirm'), t('messages.exitTitle'));
        
        if (result) {
            // 用户选择保存
            await this.saveAndReturn();
        } else {
            // 用户选择不保存，直接返回
            sessionStorage.removeItem('editingWorkflowId');
            goToManager();
        }
    }
    
    /**
     * 快速保存（不返回）
     */
    async quickSave() {
        try {
            const editingId = sessionStorage.getItem('editingWorkflowId');
            
            const workflow = {
                nodes: JSON.parse(JSON.stringify(this.core.nodes)),
                edges: JSON.parse(JSON.stringify(this.core.edges)),
                selectedNode: this.core.selectedNode,
                selectedEdge: this.core.selectedEdge,
                updatedAt: Date.now()
            };
            
            if (!editingId) {
                const result = await Dialog.prompt(t('editor.saveWorkflow'));
                if (!result) return;
                
                workflow.id = `wf_${Date.now()}`;
                workflow.name = result.name;
                workflow.description = result.description;
                workflow.createdAt = Date.now();
                sessionStorage.setItem('savedWorkflowName', result.name);
                sessionStorage.setItem('savedWorkflowDesc', result.description);
            } else {
                workflow.id = editingId;
            }
            
            sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
            this.markSaved();
            this.core.saveToLocalStorage();
            
            this.showMessage(t('messages.workflowSaved'), 'success');
        } catch (error) {
            Logger.error('保存失败:', error);
            this.showMessage(t('messages.saveRetry'), 'error');
        }
    }
}