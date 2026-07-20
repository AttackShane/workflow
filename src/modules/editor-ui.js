import { WorkflowCanvas } from './editor-canvas.js';
import { WorkflowNode } from './editor-node.js';
import { WorkflowEdge } from './editor-edge.js';
import { WorkflowHistory } from './editor-history.js';
import { WorkflowClipboard } from './editor-clipboard.js';
import { WorkflowAlign } from './editor-align.js';
import { WorkflowKeyboard } from './editor-keyboard.js';
import { WorkflowSelection } from './editor-selection.js';
import { Logger } from '../utils/logger.js';
import { Dialog } from './shared-dialog.js';
import { goToManager } from './shared-navigator.js';
import { SELECTORS } from '../config/constants.js';
import { DOM, deepClone, Storage } from '../utils/helpers.js';
import { t, i18n } from '../i18n/i18n.js';
import { WorkflowMessages } from './editor-messages.js';
import { WorkflowSearch, invalidateTypeNameMapCache } from './editor-search.js';
import { WorkflowAutoSave } from './editor-autosave.js';
import { WorkflowShare } from './editor-share.js';

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
        this._changeVersion = 0;
        this._lastSavedVersion = 0;
        this._confirmingExit = false;
        this.currentDescription = '';
        this._currentPanelNodeId = null;

        this.messages = new WorkflowMessages(this);
        this.search = new WorkflowSearch(this);
        this.autoSave = new WorkflowAutoSave(this);
        this.share = new WorkflowShare(this);
    }

    /**
     * 初始化 UI
     */
    init() {
        const isModal = DOM.get('workflowEditorModal') !== null;
        const prefix = isModal ? 'editor' : '';

        this.propertyContent = DOM.get(prefix + SELECTORS.EDITOR.PROPERTY_CONTENT);
        this.importedNodeInfo = DOM.get(prefix + SELECTORS.EDITOR.IMPORTED_NODE_INFO);

        this._initSubModules(prefix);
        this._initEventBindings();
        this._renderInitialNodes();

        this._lastSavedVersion = this._captureSnapshot();
        this.autoSave.startAutoSave();
        i18n.addListener(() => this.handleLanguageChange());
    }

    /**
     * 初始化子模块（画布、节点、边、历史、剪贴板、对齐、键盘、选择）
     * @param {string} prefix - DOM ID 前缀
     */
    _initSubModules(prefix) {
        this.canvas = new WorkflowCanvas(this, prefix);
        this.node = new WorkflowNode(this);
        this.edge = new WorkflowEdge(this);
        this.history = new WorkflowHistory(this, prefix);
        this.clipboard = new WorkflowClipboard(this);
        this.align = new WorkflowAlign(this);
        this.keyboard = new WorkflowKeyboard(this);
        this.selection = new WorkflowSelection(this);

        this.canvas.init();
        this.history.init();
        this.history.updatePanel();
    }

    /**
     * 绑定事件监听（数据变更、搜索、语言切换、键盘、导出、下拉菜单、导入、消息容器）
     */
    _initEventBindings() {
        this.core.onChange = (action) => {
            this._changeVersion++;
            this.core._clipboardData = null;
            if (
                action === 'undo' ||
                action === 'redo' ||
                action === 'clearAll' ||
                action === 'batch' ||
                action === 'jumpToHistory'
            ) {
                this.refreshCanvas();
                this.history.updatePanel();
                this.renderNodePalette();
            } else if (action === 'history') {
                this.history.updatePanel();
            } else if (action === 'selection') {
                this.renderNodePalette();
            } else {
                this.updateEdges();
                this.canvas.updateSvgSize();
                this.updateSummary();
                if (this.core.nodes.length === 0) {
                    this.canvas.setEmptyState(true);
                }
            }
        };

        this.setupWorkflowInfoClick();
        this.renderNodePalette();

        document.addEventListener('languagechange', () => {
            this.renderNodePalette();
        });

        this.search.setupSearchHandler();
        this.align.setupAlignToolbar();
        this.keyboard.setupEventListeners();
        this.keyboard.setupShortcutSettingsEvents();

        const btnExportSvg = document.getElementById('btnExportSvgMenu');
        if (btnExportSvg) {
            btnExportSvg.addEventListener('click', () => this.exportAsSvg());
        }

        this._setupDropdowns();
        this.checkImportedData();
        this.messages.createContainer();
    }

    /**
     * 渲染初始节点（从 core.nodes 恢复已加载的工作流）
     */
    _renderInitialNodes() {
        if (this.core.nodes.length === 0) return;

        const topLevelNodes = this.core.nodes.filter((n) => !n.parentId);
        const elements = [];
        const fragment = document.createDocumentFragment();
        topLevelNodes.forEach((node) => {
            const nodeCopy = deepClone(node);
            const el = this.node.render.createElement(nodeCopy, { skipMeasure: true });
            elements.push({ el, nodeData: nodeCopy });
            fragment.appendChild(el);
        });
        this.canvas.canvasContent?.appendChild(fragment);
        this.node.render.batchMeasureElements(elements);
        this.core.nodes.forEach((node) => {
            if (node.parentId) {
                this.node.container.renderContainerChildren(node.parentId);
            }
        });
        this.canvas.setEmptyState(false);
        this.updateEdges();
        this.canvas.updateSvgSize();
        this.updateSummary();
        this.canvas.centerView();
    }

    /**
     * 捕获当前状态版本号（用于判断是否有未保存变更）
     * @returns {number} 当前变更版本号
     */
    _captureSnapshot() {
        return this._changeVersion;
    }

    /**
     * 检查是否有未保存的变更
     * @returns {boolean} 是否有未保存变更
     */
    hasUnsavedChanges() {
        return this._changeVersion !== this._lastSavedVersion;
    }

    /**
     * 更新已保存快照（保存成功后调用）
     */
    markSaved() {
        this._lastSavedVersion = this._captureSnapshot();
    }

    /**
     * 处理语言切换
     */
    handleLanguageChange() {
        invalidateTypeNameMapCache();
        this.renderNodePalette();
        this.updateSummary();
        this.history.updatePanel();
    }

    setupWorkflowInfoClick() {
        const nameEl = document.getElementById('workflowName');
        if (nameEl) {
            nameEl.addEventListener('click', () => this.editWorkflowInfo());
        }
    }

    async editWorkflowInfo() {
        const nameEl = document.getElementById('workflowName');
        const currentName = nameEl ? nameEl.textContent.trim() : '';
        const currentDesc = this.currentDescription || '';

        const result = await Dialog.prompt(t('editor.editWorkflowInfo'), {
            nameValue: currentName,
            descValue: currentDesc,
        });

        if (result) {
            if (nameEl) {
                nameEl.textContent = result.name;
                nameEl.removeAttribute('data-i18n');
            }
            this.currentDescription = result.description;
            this._changeVersion++;
            this.updateSummary();

            const editingId = Storage.session.get('editingWorkflowId');
            if (editingId) {
                const workflows = Storage.get('workflows', []);
                const idx = workflows.findIndex((w) => w.id === editingId);
                if (idx !== -1) {
                    workflows[idx].name = result.name;
                    workflows[idx].description = result.description;
                    workflows[idx].updatedAt = Date.now();
                    Storage.set('workflows', workflows);
                }
            }
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

        const selectedNode = this.core.getNode(this.core.selectedNode);
        const isLoopSelected = selectedNode && selectedNode.type === 'loop';
        const loopInternalTypes = new Set(['break', 'loop_set_variable', 'loop_continue']);

        const render = (filter = '') => {
            const q = filter.toLowerCase();
            const filtered = allTypes.filter(([type, info]) => {
                if (info.hidden && !(isLoopSelected && loopInternalTypes.has(type))) {
                    return false;
                }
                return !q || info.title.includes(q) || info.description?.includes(q);
            });

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
            DOM.on(searchInput, 'input', () => render(/** @type {HTMLInputElement} */ (searchInput).value));
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
            if (nodeCountEl) nodeCountEl.textContent = String(selectedNodes.length);
            if (edgeCountEl) edgeCountEl.textContent = String(selectedEdges.length);
            if (startRowEl) startRowEl.style.display = 'none';
            if (endRowEl) endRowEl.style.display = 'none';
        } else {
            if (nodeLabelEl) nodeLabelEl.textContent = t('messages.nodeCount');
            if (edgeLabelEl) edgeLabelEl.textContent = t('messages.edgeCount');
            if (nodeCountEl) nodeCountEl.textContent = this.core.nodes.length;
            if (edgeCountEl) edgeCountEl.textContent = this.core.edges.length;
            if (startRowEl) startRowEl.style.display = 'flex';
            if (endRowEl) endRowEl.style.display = 'flex';
            if (startCountEl) startCountEl.textContent = this.core.nodes.filter((n) => n.type === 'start').length;
            if (endCountEl) endCountEl.textContent = this.core.nodes.filter((n) => n.type === 'end').length;
        }
    }

    showSummaryPanel() {
        if (this._currentPanelNodeId) {
            const prevNode = this.core.getNode(this._currentPanelNodeId);
            if (prevNode && this.node && this.node.paramEditor) {
                this.node.paramEditor.saveDynamicParams(prevNode, 'input');
                this.node.paramEditor.saveDynamicParams(prevNode, 'output');
            }
            this._currentPanelNodeId = null;
        }
        const summary = DOM.get('workflowSummary');
        const detail = DOM.get('nodeDetail');
        const hint = DOM.get('propertyHint');
        DOM.show(summary);
        DOM.hide(detail);
        DOM.show(hint);
        this.updateSummary();
    }

    showDetailPanel() {
        const summary = DOM.get('workflowSummary');
        const detail = DOM.get('nodeDetail');
        const hint = DOM.get('propertyHint');
        DOM.hide(summary);
        DOM.show(detail);
        DOM.hide(hint);
    }

    /**
     * 重置视图到初始位置和缩放
     */
    resetView() {
        this.canvas.autoOptimizeLayout();
        this.showMessage(t('messages.viewReset'), 'success');
    }

    /**
     * 在画布上添加节点（供外部调用）
     * @param {string} type - 节点类型
     * @param {number} screenX - 屏幕 X 坐标
     * @param {number} screenY - 屏幕 Y 坐标
     */
    addNodeToCanvas(type, screenX, screenY) {
        this.node.render.addToCanvas(type, screenX, screenY);
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
        this.canvas.canvasContent.replaceChildren();

        const elements = [];
        const fragment = document.createDocumentFragment();
        this.core.nodes.forEach((node) => {
            if (node.parentId) return;
            const nodeCopy = deepClone(node);
            const el = this.node.render.createElement(nodeCopy, { skipMeasure: true });
            elements.push({ el, nodeData: nodeCopy });
            fragment.appendChild(el);
        });
        this.canvas.canvasContent.appendChild(fragment);
        this.node.render.batchMeasureElements(elements);

        this.canvas.updateSvgSize();

        // 更新摘要
        this.updateSummary();

        // 等容器子节点渲染完后再更新边，确保连线坐标正确
        requestAnimationFrame(() => {
            this.updateEdges();
        });

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
        this.node.render.delete(nodeId);
    }

    toggleSelectedNodesLock() {
        const selectedEls = document.querySelectorAll('.canvas-node.selected');
        if (selectedEls.length === 0) return;

        const allLocked = Array.from(selectedEls).every((el) => {
            const node = this.core.getNode(/** @type {HTMLElement} */ (el).dataset.nodeId);
            return node && node.locked;
        });

        const newLockState = !allLocked;

        selectedEls.forEach((el) => {
            const node = this.core.getNode(/** @type {HTMLElement} */ (el).dataset.nodeId);
            if (node) {
                node.locked = newLockState;
                this.node.render._reRenderNode(node.id);
            }
        });

        this.core.saveHistory('messages.toggleLock');
        this.showMessage(newLockState ? t('messages.nodeLocked') : t('messages.nodeUnlocked'), 'success');
    }

    /**
     * 保存节点详情面板编辑（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    saveNodeDetail(nodeId) {
        this.node.panel.saveNodeDetail(nodeId);
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
     * 清空画布（供外部调用）
     */
    async clearCanvas() {
        const confirmed = await Dialog.confirm(t('messages.clearCanvasConfirm'), t('messages.clearCanvasTitle'), {
            danger: true,
        });
        if (!confirmed) {
            return;
        }
        this.core.clearAll();
        this.core.clearSavedWorkflow();
        this.clearPropertyPanel();
        this.showMessage(t('messages.canvasCleared'), 'info');
    }

    /**
     * 导出画布为图片
     */
    exportAsImage() {
        if (!this.canvas || !this.canvas.exportAsImage) return;
        this.canvas.exportAsImage('png');
        this.showMessage(t('editor.exportImageSuccess'), 'success');
    }

    exportAsSvg() {
        if (!this.canvas || !this.canvas.exportAsImage) return;
        this.canvas.exportAsImage('svg');
        this.showMessage('SVG 已导出', 'success');
    }

    /**
     * 保存工作流并返回管理页面
     */
    async saveAndReturn() {
        const workflow = {
            nodes: deepClone(this.core.nodes),
            edges: deepClone(this.core.edges),
            selectedNode: this.core.selectedNode,
            selectedEdge: this.core.selectedEdge,
            updatedAt: Date.now(),
        };

        const editingId = Storage.session.get('editingWorkflowId');

        if (!editingId) {
            const result = await Dialog.prompt(t('editor.saveWorkflow'));
            if (!result) return;

            workflow.id = `wf_${Date.now()}`;
            workflow.name = result.name;
            workflow.description = result.description;
            workflow.createdAt = Date.now();
            Storage.session.set('savedWorkflowName', result.name);
            Storage.session.set('savedWorkflowDesc', result.description);
        } else {
            workflow.id = editingId;
            const nameEl = document.getElementById('workflowName');
            if (nameEl) {
                workflow.name = nameEl.textContent.trim();
            }
            workflow.description = this.currentDescription;
        }

        // 保存到 sessionStorage，供工作流管理页面读取
        Storage.session.set('savedWorkflow', workflow);
        this.markSaved();

        // 同时保存到 localStorage，防止页面刷新丢失
        this.core.saveToLocalStorage();

        // 只清除 editingWorkflow，保留 editingWorkflowId 供管理页面更新使用
        Storage.session.remove('editingWorkflow');

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
        if (this._confirmingExit) return;
        this._confirmingExit = true;

        try {
            if (!this.hasUnsavedChanges()) {
                if (!Storage.session.get('savedWorkflow')) {
                    Storage.session.remove('editingWorkflowId');
                }
                goToManager();
                return;
            }

            const result = await Dialog.confirm(t('messages.exitConfirm'), t('messages.exitTitle'));

            if (result === null) return;

            if (result) {
                await this.saveAndReturn();
            } else {
                Storage.session.remove('editingWorkflowId');
                Storage.session.remove('savedWorkflow');
                Storage.session.remove('savedWorkflowName');
                Storage.session.remove('savedWorkflowDesc');
                goToManager();
            }
        } finally {
            this._confirmingExit = false;
        }
    }

    /**
     * 快速保存（不返回）
     */
    async quickSave() {
        try {
            const editingId = Storage.session.get('editingWorkflowId');

            const workflow = {
                nodes: deepClone(this.core.nodes),
                edges: deepClone(this.core.edges),
                selectedNode: this.core.selectedNode,
                selectedEdge: this.core.selectedEdge,
                updatedAt: Date.now(),
            };

            if (!editingId) {
                const result = await Dialog.prompt(t('editor.saveWorkflow'));
                if (!result) return;

                workflow.id = `wf_${Date.now()}`;
                workflow.name = result.name;
                workflow.description = result.description;
                workflow.createdAt = Date.now();
                Storage.session.set('savedWorkflowName', result.name);
                Storage.session.set('savedWorkflowDesc', result.description);
            } else {
                workflow.id = editingId;
                const nameEl = document.getElementById('workflowName');
                if (nameEl) {
                    workflow.name = nameEl.textContent.trim();
                }
                workflow.description = this.currentDescription;
            }

            Storage.session.set('savedWorkflow', workflow);
            this.markSaved();
            this.core.saveToLocalStorage();

            this.showMessage(t('messages.workflowSaved'), 'success');
        } catch (error) {
            Logger.error('保存失败:', error);
            this.showMessage(t('messages.saveRetry'), 'error');
        }
    }

    _setupDropdowns() {
        const dropdowns = [
            { toggle: 'btnExportDropdown', menu: 'exportDropdownMenu' },
            { toggle: 'btnMoreDropdown', menu: 'moreDropdownMenu' },
        ];

        dropdowns.forEach(({ toggle, menu }) => {
            const toggleEl = document.getElementById(toggle);
            const menuEl = document.getElementById(menu);
            if (!toggleEl || !menuEl) return;

            const groupEl = toggleEl.closest('.dropdown-group') || toggleEl.closest('.dropdown');

            toggleEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menuEl.classList.contains('show');
                document.querySelectorAll('.dropdown-menu').forEach((m) => {
                    m.classList.remove('show');
                    const parentGroup = m.closest('.dropdown-group') || m.closest('.dropdown');
                    if (parentGroup) parentGroup.classList.remove('open');
                });
                if (!isOpen) {
                    menuEl.classList.add('show');
                    if (groupEl) groupEl.classList.add('open');
                }
            });

            menuEl.querySelectorAll('.dropdown-item').forEach((item) => {
                item.addEventListener('click', () => {
                    menuEl.classList.remove('show');
                    if (groupEl) groupEl.classList.remove('open');
                });
            });
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach((m) => {
                m.classList.remove('show');
                const parentGroup = m.closest('.dropdown-group') || m.closest('.dropdown');
                if (parentGroup) parentGroup.classList.remove('open');
            });
        });
    }

    /**
     * 显示消息提示（转发到 messages 模块）
     * @param {string} text
     * @param {string} type
     */
    showMessage(text, type) {
        this.messages.show(text, type);
    }

    /**
     * 导出工作流（转发到 share 模块）
     */
    exportWorkflow() {
        return this.share.exportWorkflow();
    }

    removeParam(nodeId, prefix, index) {
        if (!this.node || !this.node.paramEditor) return;
        this.node.paramEditor.removeParam(nodeId, prefix, index);
    }

    openInputParamRefSelector(prefix, index) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.openInputParamRefSelector(prefix, index);
    }

    clearInputParamRef(nodeId, prefix, index) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.clearInputParamRef(nodeId, prefix, index);
    }

    addMergeVariable(nodeId, gi) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.addMergeVariable(nodeId, gi);
    }

    removeMergeVariable(nodeId, gi, vi) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.removeMergeVariable(nodeId, gi, vi);
    }

    openVariableSelector(nodeId, gi, vi) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.openVariableSelector(nodeId, gi, vi);
    }

    addLoopVariable(nodeId) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.addLoopVariable(nodeId);
    }

    removeLoopVariable(nodeId, vi) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.removeLoopVariable(nodeId, vi);
    }

    openLoopVariableSelector(nodeId, vi, side) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.openLoopVariableSelector(nodeId, vi, side);
    }

    clearLoopVarRef(nodeId, vi, side) {
        if (!this.node || !this.node.selector) return;
        this.node.selector.clearLoopVarRef(nodeId, vi, side);
    }

    addLoopIntermediateVariable(nodeId) {
        if (!this.node || !this.node.paramEditor) return;
        this.node.paramEditor.addLoopIntermediateVariable(nodeId);
    }

    removeLoopIntermediateVariable(nodeId, vi) {
        if (!this.node || !this.node.paramEditor) return;
        this.node.paramEditor.removeLoopIntermediateVariable(nodeId, vi);
    }

    openLoopIntermediateVarSelector(nodeId, vi) {
        if (!this.node || !this.node.paramEditor) return;
        this.node.paramEditor.openLoopIntermediateVarSelector(nodeId, vi);
    }

    clearLoopIntermediateVarRef(nodeId, vi) {
        if (!this.node || !this.node.paramEditor) return;
        this.node.paramEditor.clearLoopIntermediateVarRef(nodeId, vi);
    }
}
