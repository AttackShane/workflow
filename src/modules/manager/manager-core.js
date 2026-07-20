import { Dialog } from '../shared/shared-dialog.js';
import { goToConverter, goToEditor } from '../shared/shared-navigator.js';
import { StringUtils, Storage, deepClone } from '../../utils/helpers.js';
import { t, i18n } from '../../i18n/i18n.js';
import { Logger } from '../../utils/logger.js';
import { WORKFLOW_TEMPLATES, resolveTemplateI18n } from './manager-templates.js';
import { saveWorkflowVersion, getWorkflowVersions, showVersionCompare } from './manager-version.js';
import { handleFileSelect, importWorkflow } from './manager-import.js';
import { exportWorkflow } from './manager-export.js';

export class WorkflowManager {
    constructor() {
        this.workflows = [];
        this.currentEditingId = null;
        this.batchMode = false;
        this.selectedIds = new Set();

        this.elements = {
            workflowList: null,
            emptyState: null,
            btnNewWorkflow: null,
            btnImport: null,
            modalOverlay: null,
            modalTitle: null,
            modalClose: null,
            workflowName: null,
            workflowDescription: null,
            btnCancel: null,
            btnSave: null,
            importModalOverlay: null,
            importModalClose: null,
            importFile: null,
            btnImportCancel: null,
            btnImportConfirm: null,
            btnTemplates: null,
            templateModalOverlay: null,
            templateModalClose: null,
            templateGrid: null,
        };
    }

    init() {
        this._hasRendered = false;
        this.loadElements();
        this.loadWorkflows();
        this.loadSavedWorkflow();
        this.bindEvents();
        if (!this._hasRendered) {
            this.renderWorkflowList();
        }

        // 监听语言切换，重新渲染列表
        i18n.addListener(() => this.handleLanguageChange());
    }

    handleLanguageChange() {
        this.renderWorkflowList();
        this.renderTemplateGrid();
    }

    loadSavedWorkflow() {
        const workflow = Storage.session.get('savedWorkflow');

        if (workflow) {
            try {
                Storage.session.remove('savedWorkflow');

                const editingWorkflowId = Storage.session.get('editingWorkflowId');

                if (editingWorkflowId) {
                    Storage.session.remove('editingWorkflowId');

                    const index = this.workflows.findIndex((w) => w.id === editingWorkflowId);

                    if (index !== -1) {
                        this.workflows[index] = {
                            ...this.workflows[index],
                            nodes: Array.isArray(workflow.nodes) ? workflow.nodes : [],
                            edges: Array.isArray(workflow.edges) ? workflow.edges : [],
                            selectedNode: workflow.selectedNode,
                            selectedEdge: workflow.selectedEdge,
                            updatedAt: workflow.updatedAt,
                        };
                        this.saveWorkflowVersion(editingWorkflowId, this.workflows[index]);
                        this.saveWorkflows();
                        this.renderWorkflowList();
                    }
                } else if (workflow.id && workflow.name) {
                    const name = Storage.session.get('savedWorkflowName') || workflow.name;
                    const description = Storage.session.get('savedWorkflowDesc') || workflow.description || '';
                    Storage.session.remove('savedWorkflowName');
                    Storage.session.remove('savedWorkflowDesc');

                    const existingIndex = this.workflows.findIndex((w) => w.id === workflow.id);
                    if (existingIndex !== -1) {
                        this.workflows[existingIndex] = {
                            ...this.workflows[existingIndex],
                            nodes: workflow.nodes || [],
                            edges: workflow.edges || [],
                            selectedNode: workflow.selectedNode,
                            selectedEdge: workflow.selectedEdge,
                            updatedAt: workflow.updatedAt || Date.now(),
                        };
                        this.saveWorkflowVersion(workflow.id, this.workflows[existingIndex]);
                    } else {
                        const newWorkflow = {
                            id: workflow.id,
                            name: name,
                            description: description,
                            nodes: workflow.nodes || [],
                            edges: workflow.edges || [],
                            createdAt: workflow.createdAt || Date.now(),
                            updatedAt: workflow.updatedAt || Date.now(),
                        };
                        this.workflows.push(newWorkflow);
                        this.saveWorkflowVersion(workflow.id, newWorkflow);
                    }
                    this.saveWorkflows();
                    this.renderWorkflowList();
                }
            } catch (error) {
                Logger.error(t('manager.loadFailed'), error);
            }
        }
    }

    loadElements() {
        this.elements.workflowList = document.getElementById('workflowList');
        this.elements.emptyState = document.getElementById('emptyState');
        this.elements.btnNewWorkflow = document.getElementById('btnNewWorkflow');
        this.elements.btnImport = document.getElementById('btnImport');
        this.elements.modalOverlay = document.getElementById('modalOverlay');
        this.elements.modalTitle = document.getElementById('modalTitle');
        this.elements.modalClose = document.getElementById('modalClose');
        this.elements.workflowName = document.getElementById('workflowName');
        this.elements.workflowDescription = document.getElementById('workflowDescription');
        this.elements.btnCancel = document.getElementById('btnCancel');
        this.elements.btnSave = document.getElementById('btnSave');
        this.elements.importModalOverlay = document.getElementById('importModalOverlay');
        this.elements.importModalClose = document.getElementById('importModalClose');
        this.elements.importFile = document.getElementById('importFile');
        this.elements.btnImportCancel = document.getElementById('btnImportCancel');
        this.elements.btnImportConfirm = document.getElementById('btnImportConfirm');
        this.elements.btnTemplates = document.getElementById('btnTemplates');
        this.elements.templateModalOverlay = document.getElementById('templateModalOverlay');
        this.elements.templateModalClose = document.getElementById('templateModalClose');
        this.elements.templateGrid = document.getElementById('templateGrid');
        this.elements.workflowSearch = document.getElementById('workflowSearch');
        this.elements.workflowSearchScope = document.getElementById('workflowSearchScope');
        this.elements.workflowSort = document.getElementById('workflowSort');
        this.elements.batchToolbar = document.getElementById('batchToolbar');
        this.elements.selectAllCheckbox = document.getElementById('selectAllCheckbox');
        this.elements.batchCount = document.getElementById('batchCount');
        this.elements.btnBatchDelete = document.getElementById('btnBatchDelete');
        this.elements.btnCancelBatch = document.getElementById('btnCancelBatch');
    }

    loadWorkflows() {
        const stored = Storage.get('workflows');

        if (stored && Array.isArray(stored)) {
            this.workflows = stored;
        } else {
            this.workflows = this.getDefaultWorkflows();
            this.saveWorkflows();
        }
    }

    getDefaultWorkflows() {
        return [
            {
                id: 'wf_1',
                name: t('manager.defaultFlow1Name'),
                description: t('manager.defaultFlow1Desc'),
                nodes: [
                    {
                        id: 'node_100001',
                        type: 'start',
                        x: 400,
                        y: 80,
                        title: t('nodeTypes.start'),
                        description: t('nodeTypes.description.start'),
                    },
                    {
                        id: 'node_100002',
                        type: 'llm',
                        x: 400,
                        y: 200,
                        title: t('nodeTypes.llm'),
                        description: t('nodeTypes.description.llm'),
                        parameters: { prompt: t('manager.defaultFlow1Prompt') },
                    },
                    {
                        id: 'node_100003',
                        type: 'end',
                        x: 400,
                        y: 320,
                        title: t('nodeTypes.end'),
                        description: t('nodeTypes.description.end'),
                    },
                ],
                edges: [
                    { id: 'edge_1', source: 'node_100001', target: 'node_100002' },
                    { id: 'edge_2', source: 'node_100002', target: 'node_100003' },
                ],
                createdAt: Date.now() - 86400000,
                updatedAt: Date.now() - 86400000,
            },
            {
                id: 'wf_2',
                name: t('manager.defaultFlow2Name'),
                description: t('manager.defaultFlow2Desc'),
                nodes: [
                    {
                        id: 'node_200001',
                        type: 'start',
                        x: 400,
                        y: 80,
                        title: t('nodeTypes.start'),
                        description: t('nodeTypes.description.start'),
                    },
                    {
                        id: 'node_200002',
                        type: 'text',
                        x: 400,
                        y: 200,
                        title: t('nodeTypes.text'),
                        description: t('nodeTypes.description.text'),
                        parameters: { text: t('manager.defaultFlow2Prompt') },
                    },
                    {
                        id: 'node_200003',
                        type: 'image_generate',
                        x: 400,
                        y: 320,
                        title: t('nodeTypes.image_generate'),
                        description: t('nodeTypes.description.image_generate'),
                    },
                    {
                        id: 'node_200004',
                        type: 'end',
                        x: 400,
                        y: 440,
                        title: t('nodeTypes.end'),
                        description: t('nodeTypes.description.end'),
                    },
                ],
                edges: [
                    { id: 'edge_3', source: 'node_200001', target: 'node_200002' },
                    { id: 'edge_4', source: 'node_200002', target: 'node_200003' },
                    { id: 'edge_5', source: 'node_200003', target: 'node_200004' },
                ],
                createdAt: Date.now() - 172800000,
                updatedAt: Date.now() - 172800000,
            },
        ];
    }

    saveWorkflows() {
        if (typeof localStorage === 'undefined') return;

        const jsonStr = JSON.stringify(this.workflows);
        const sizeBytes = new Blob([jsonStr]).size;
        const SIZE_THRESHOLD = 4 * 1024 * 1024; // 4MB

        // 预估数据大小，超过阈值时警告用户
        if (sizeBytes > SIZE_THRESHOLD) {
            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
            Logger.warn(t('manager.storageLargeData', { size: sizeMB }));
        }

        try {
            localStorage.setItem('workflows', jsonStr);
        } catch (error) {
            if (error && (error.name === 'QuotaExceededError' || error.code === 22)) {
                Dialog.error(t('manager.storageQuotaExceeded'));
            } else {
                Logger.error('Failed to save workflows:', error);
            }
        }
    }

    // ===== 版本管理（委托给 manager-version.js）=====

    saveWorkflowVersion(workflowId, workflowData) {
        saveWorkflowVersion(workflowId, workflowData);
    }

    getWorkflowVersions(workflowId) {
        return getWorkflowVersions(workflowId);
    }

    showVersionCompare(workflowId) {
        showVersionCompare(workflowId, this.workflows);
    }

    // ===== 导入（委托给 manager-import.js）=====

    openImportModal() {
        this.elements.importFile.value = '';
        this.elements.importModalOverlay.style.display = 'flex';
    }

    closeImportModal() {
        this.elements.importModalOverlay.style.display = 'none';
        this.elements.importFile.value = '';
        this._pendingZipFile = null;
    }

    handleFileSelect(event) {
        handleFileSelect(event, this);
    }

    async importWorkflow() {
        await importWorkflow(this);
    }

    // ===== 导出（委托给 manager-export.js）=====

    async exportWorkflow(workflow) {
        await exportWorkflow(workflow);
    }

    // ===== 核心 CRUD =====

    bindEvents() {
        this.elements.btnNewWorkflow.addEventListener('click', () => this.openNewWorkflowModal());
        this.elements.btnImport.addEventListener('click', () => this.openImportModal());
        this.elements.modalClose.addEventListener('click', () => this.closeModal());
        this.elements.btnCancel.addEventListener('click', () => this.closeModal());
        this.elements.btnSave.addEventListener('click', () => this.saveWorkflow());
        this.elements.importModalClose.addEventListener('click', () => this.closeImportModal());
        this.elements.btnImportCancel.addEventListener('click', () => this.closeImportModal());
        this.elements.btnImportConfirm.addEventListener('click', () => this.importWorkflow());
        this.elements.importFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.btnTemplates.addEventListener('click', () => this.openTemplateModal());
        this.elements.templateModalClose.addEventListener('click', () => this.closeTemplateModal());
        this.elements.templateGrid.addEventListener('click', (e) => this.handleTemplateClick(e));

        // 搜索和排序
        if (this.elements.workflowSearch) {
            this.elements.workflowSearch.addEventListener('input', () => this.renderWorkflowList());
        }
        if (this.elements.workflowSearchScope) {
            this.elements.workflowSearchScope.addEventListener('change', () => this.renderWorkflowList());
        }
        if (this.elements.workflowSort) {
            this.elements.workflowSort.addEventListener('change', () => this.renderWorkflowList());
        }

        if (this.elements.btnBatchDelete) {
            this.elements.btnBatchDelete.addEventListener('click', () => this.batchDeleteWorkflows());
        }
        if (this.elements.btnCancelBatch) {
            this.elements.btnCancelBatch.addEventListener('click', () => this.exitBatchMode());
        }
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.addEventListener('change', () => this.toggleSelectAll());
        }

        // 长按卡片进入批量模式
        let longPressTimer = null;
        this.elements.workflowList.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.workflow-card');
            if (
                !card ||
                e.target.closest('.action-btn') ||
                e.target.closest('.workflow-checkbox') ||
                e.target.closest('.drag-handle')
            )
                return;
            longPressTimer = setTimeout(() => {
                if (!this.batchMode) {
                    this.enterBatchMode();
                    const checkbox = card.querySelector('.workflow-checkbox');
                    if (checkbox) {
                        checkbox.checked = true;
                        this.selectedIds.add(checkbox.dataset.id);
                        this.updateBatchCount();
                    }
                }
            }, 600);
        });
        this.elements.workflowList.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });
        this.elements.workflowList.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });

        // 卡片内 checkbox 点击
        this.elements.workflowList.addEventListener('change', (e) => {
            if (!e.target.classList.contains('workflow-checkbox')) return;
            const id = e.target.dataset.id;
            if (e.target.checked) {
                this.selectedIds.add(id);
            } else {
                this.selectedIds.delete(id);
            }
            this.updateBatchCount();
            if (this.elements.selectAllCheckbox) {
                this.elements.selectAllCheckbox.checked = this.selectedIds.size === this.workflows.length;
            }
        });

        // 导航按钮
        const navConverterBtn = document.getElementById('navConverterBtn');
        const navEditorBtn = document.getElementById('navEditorBtn');
        if (navConverterBtn) navConverterBtn.addEventListener('click', goToConverter);
        if (navEditorBtn) navEditorBtn.addEventListener('click', () => goToEditor({ newWorkflow: true }));

        // 添加页面可见性监听，当页面重新获得焦点时自动刷新
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.handlePageVisible();
            }
        });

        // 添加焦点监听
        window.addEventListener('focus', () => {
            this.handlePageVisible();
        });
    }

    handlePageVisible() {
        // 检查是否有新保存的工作流需要加载
        const savedWorkflow = Storage.session.get('savedWorkflow');
        if (savedWorkflow) {
            this.loadSavedWorkflow();
        } else {
            // 重新加载工作流列表，确保显示最新数据
            this.loadWorkflows();
            this.renderWorkflowList();
        }
    }

    openNewWorkflowModal() {
        Dialog.prompt(t('manager.createNew')).then((result) => {
            if (!result) return;
            const newWorkflow = {
                id: `wf_${Date.now()}`,
                name: result.name,
                description: result.description,
                nodes: [],
                edges: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.workflows.push(newWorkflow);
            this.saveWorkflowVersion(newWorkflow.id, newWorkflow);
            this.saveWorkflows();
            this.renderWorkflowList();
        });
    }

    openEditModal(workflow) {
        this.currentEditingId = workflow.id;
        this.elements.modalTitle.textContent = t('manager.editWorkflow');
        this.elements.workflowName.value = workflow.name;
        this.elements.workflowDescription.value = workflow.description;
        this.elements.modalOverlay.style.display = 'flex';
        this.elements.workflowName.focus();
    }

    closeModal() {
        this.elements.modalOverlay.style.display = 'none';
        this.currentEditingId = null;
        this.elements.workflowName.value = '';
        this.elements.workflowDescription.value = '';
    }

    async saveWorkflow() {
        const name = this.elements.workflowName.value.trim();
        const description = this.elements.workflowDescription.value.trim();

        if (!name) {
            await Dialog.alert(t('manager.nameRequired'));
            return;
        }

        if (this.currentEditingId) {
            const index = this.workflows.findIndex((w) => w.id === this.currentEditingId);
            if (index !== -1) {
                this.workflows[index].name = name;
                this.workflows[index].description = description;
                this.workflows[index].updatedAt = Date.now();
            }
        }

        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeModal();
    }

    async deleteWorkflow(id) {
        const workflow = this.workflows.find((w) => w.id === id);
        const confirmed = await Dialog.confirm(
            t('manager.deleteConfirm', { name: workflow?.name || t('manager.thisWorkflow') }),
            t('common.confirm'),
            { danger: true }
        );
        if (!confirmed) {
            return;
        }

        this.workflows = this.workflows.filter((w) => w.id !== id);
        this.saveWorkflows();
        this.renderWorkflowList();
    }

    async duplicateWorkflow(id) {
        const original = this.workflows.find((w) => w.id === id);
        if (!original) return;

        const newId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const duplicated = {
            ...deepClone(original),
            id: newId,
            name: `${original.name} ${t('messages.duplicateNodeSuffix')}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        if (duplicated.nodes) {
            const idMap = new Map();
            duplicated.nodes = duplicated.nodes.map((n) => {
                const oldId = n.id;
                const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                idMap.set(oldId, newId);
                return { ...n, id: newId };
            });
            duplicated.edges = (duplicated.edges || []).map((e) => ({
                ...e,
                id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                source: idMap.get(e.source) || e.source,
                target: idMap.get(e.target) || e.target,
            }));
        }

        this.workflows.push(duplicated);
        this.saveWorkflows();
        this.renderWorkflowList();
        await Dialog.success(t('manager.duplicateSuccess'));
    }

    enterBatchMode() {
        this.batchMode = true;
        this.selectedIds.clear();
        if (this.elements.batchToolbar) {
            this.elements.batchToolbar.style.display = 'flex';
        }
        document.querySelectorAll('.workflow-checkbox').forEach((cb) => {
            /** @type {HTMLInputElement} */ (cb).style.display = '';
        });
        if (this.elements.selectAllCheckbox) {
            this.elements.selectAllCheckbox.checked = false;
        }
        this.updateBatchCount();
    }

    exitBatchMode() {
        this.batchMode = false;
        this.selectedIds.clear();
        if (this.elements.batchToolbar) {
            this.elements.batchToolbar.style.display = 'none';
        }
        document.querySelectorAll('.workflow-checkbox').forEach((cb) => {
            const input = /** @type {HTMLInputElement} */ (cb);
            input.style.display = 'none';
            input.checked = false;
        });
    }

    toggleSelectAll() {
        const checked = this.elements.selectAllCheckbox?.checked;
        document.querySelectorAll('.workflow-checkbox').forEach((cb) => {
            const input = /** @type {HTMLInputElement} */ (cb);
            input.checked = !!checked;
            if (checked) {
                this.selectedIds.add(input.dataset.id);
            } else {
                this.selectedIds.delete(input.dataset.id);
            }
        });
        this.updateBatchCount();
    }

    updateBatchCount() {
        if (this.elements.batchCount) {
            this.elements.batchCount.textContent = t('manager.batchCount', { count: this.selectedIds.size });
        }
    }

    async batchDeleteWorkflows() {
        if (this.selectedIds.size === 0) return;

        const confirmed = await Dialog.confirm(
            t('manager.batchDeleteConfirm', { count: this.selectedIds.size }),
            t('manager.batchDeleteTitle'),
            { danger: true }
        );
        if (!confirmed) return;

        this.workflows = this.workflows.filter((w) => !this.selectedIds.has(w.id));
        this.saveWorkflows();
        this.exitBatchMode();
        this.renderWorkflowList();
        await Dialog.success(t('manager.batchDeleteSuccess'));
    }

    openWorkflowEditor(workflow) {
        // 如果有缓存的原始 Coze 剪贴板数据，单独存储（避免 workflow 对象过大导致 sessionStorage 截断）
        if (workflow._clipboardData) {
            Storage.session.set('_rawCozeClipboard', workflow._clipboardData);
        }
        Storage.session.set('editingWorkflow', workflow);
        goToEditor();
    }

    // ===== 列表渲染 + 搜索排序 + 拖拽排序 =====

    renderWorkflowList() {
        this._hasRendered = true;

        if (this._renderPending) {
            cancelAnimationFrame(this._renderPending);
        }

        this._renderPending = requestAnimationFrame(() => {
            this._renderPending = null;
            this._doRenderWorkflowList();
        });
    }

    _doRenderWorkflowList() {
        this.elements.workflowList.innerHTML = '';

        if (this.workflows.length === 0) {
            this.elements.emptyState.style.display = 'block';
            return;
        }

        // 搜索过滤
        const searchTerm = this.elements.workflowSearch?.value?.trim().toLowerCase() || '';
        const searchScope = this.elements.workflowSearchScope?.value || 'all';
        let filtered = this.workflows;
        if (searchTerm) {
            const noDescText = t('manager.noDescription').toLowerCase();
            filtered = this.workflows.filter((w) => {
                const name = (w.name || '').toLowerCase();
                const desc = (w.description || '').toLowerCase();
                const id = (w.id || '').toLowerCase();
                const matchName = name.includes(searchTerm);
                const matchDesc = desc.includes(searchTerm) || (!desc && noDescText.includes(searchTerm));
                const matchId = id.includes(searchTerm);
                if (searchScope === 'name') return matchName;
                if (searchScope === 'description') return matchDesc;
                return matchName || matchDesc || matchId;
            });
        }

        // 排序
        const sortBy = this.elements.workflowSort?.value || 'updatedAt_desc';
        const [field, order] = sortBy.split('_');
        filtered = [...filtered].sort((a, b) => {
            if (field === 'name') {
                const cmp = String(a.name || '').localeCompare(String(b.name || ''));
                return order === 'desc' ? -cmp : cmp;
            }
            const aVal = a[field] || 0;
            const bVal = b[field] || 0;
            return order === 'desc' ? bVal - aVal : aVal - bVal;
        });

        if (filtered.length === 0 && searchTerm) {
            this.elements.emptyState.style.display = 'block';
            const h3 = this.elements.emptyState.querySelector('h3');
            const p = this.elements.emptyState.querySelector('p');
            if (h3) h3.textContent = t('manager.noSearchResults');
            if (p) p.textContent = t('manager.tryDifferentSearch');
            return;
        }

        this.elements.emptyState.style.display = 'none';

        const fragment = document.createDocumentFragment();
        filtered.forEach((workflow) => {
            const card = this.createWorkflowCard(workflow);
            fragment.appendChild(card);
        });
        this.elements.workflowList.appendChild(fragment);

        this._attachCardEvents();
    }

    _attachCardEvents() {
        const cards = this.elements.workflowList.querySelectorAll('.workflow-card');
        let draggedCard = null;

        cards.forEach((card) => {
            card.addEventListener('click', (e) => {
                if (
                    e.target.closest('.action-btn') ||
                    e.target.closest('.drag-handle') ||
                    e.target.closest('.workflow-checkbox')
                )
                    return;
                if (this.batchMode) return;
                const wf = this.workflows.find((w) => w.id === card.dataset.workflowId);
                if (wf) this.openWorkflowEditor(wf);
            });

            card.querySelector('.edit-btn')?.addEventListener('click', () => {
                const wf = this.workflows.find((w) => w.id === card.dataset.workflowId);
                if (wf) this.openEditModal(wf);
            });

            card.querySelector('.duplicate-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateWorkflow(card.dataset.workflowId);
            });

            card.querySelector('.export-btn')?.addEventListener('click', () => {
                const wf = this.workflows.find((w) => w.id === card.dataset.workflowId);
                if (wf) this.exportWorkflow(wf);
            });

            card.querySelector('.delete-btn')?.addEventListener('click', () => {
                this.deleteWorkflow(card.dataset.workflowId);
            });

            card.querySelector('.version-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showVersionCompare(card.dataset.workflowId);
            });

            const dragHandle = card.querySelector('.drag-handle');
            if (dragHandle) {
                dragHandle.addEventListener('dragstart', (e) => {
                    draggedCard = card;
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', card.dataset.workflowId);
                });

                dragHandle.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    cards.forEach((c) => c.classList.remove('drag-over'));
                    draggedCard = null;
                });
            }

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (card !== draggedCard) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (card === draggedCard || !draggedCard) return;

                const fromId = draggedCard.dataset.workflowId;
                const toId = card.dataset.workflowId;

                const fromIndex = this.workflows.findIndex((w) => w.id === fromId);
                const toIndex = this.workflows.findIndex((w) => w.id === toId);

                if (fromIndex !== -1 && toIndex !== -1) {
                    const [moved] = this.workflows.splice(fromIndex, 1);
                    this.workflows.splice(toIndex, 0, moved);
                    this.saveWorkflows();
                    this.renderWorkflowList();
                }
            });
        });
    }

    createWorkflowCard(workflow) {
        const card = document.createElement('div');
        card.className = 'workflow-card';
        card.dataset.workflowId = workflow.id;

        const nodeCount = workflow.nodes?.length || 0;
        const updatedTime = this.formatDate(workflow.updatedAt);
        const safeName = StringUtils.escapeHtml(workflow.name);
        const safeDesc = StringUtils.escapeHtml(workflow.description) || t('manager.noDescription');

        // Header
        const header = document.createElement('div');
        header.className = 'workflow-card-header';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.draggable = true;
        dragHandle.title = t('manager.dragHandle');
        dragHandle.textContent = '\u283F';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'workflow-checkbox';
        checkbox.dataset.id = workflow.id;
        checkbox.style.display = 'none';

        const title = document.createElement('h3');
        title.className = 'workflow-card-title';
        title.textContent = safeName;

        const actions = document.createElement('div');
        actions.className = 'workflow-card-actions';
        actions.append(
            this._createActionBtn('\uD83D\uDCCB', 'duplicate-btn', t('manager.duplicateWorkflowTip')),
            this._createActionBtn('\u270F\uFE0F', 'edit-btn', t('manager.editTooltip')),
            this._createActionBtn('\uD83D\uDCE5', 'export-btn', t('manager.exportTooltip')),
            this._createActionBtn('\uD83D\uDCCA', 'version-btn', t('manager.versionCompare')),
            this._createActionBtn('\uD83D\uDDD1\uFE0F', 'delete-btn', t('manager.deleteTooltip'))
        );

        header.append(dragHandle, checkbox, title, actions);
        card.appendChild(header);

        // Description
        const desc = document.createElement('p');
        desc.className = 'workflow-card-description';
        desc.textContent = safeDesc;
        card.appendChild(desc);

        // Meta
        const meta = document.createElement('div');
        meta.className = 'workflow-card-meta';

        const nodeCountSpan = document.createElement('span');
        nodeCountSpan.className = 'node-count';
        nodeCountSpan.textContent = t('manager.nodesCount', { count: nodeCount });

        const timeSpan = document.createElement('span');
        timeSpan.textContent = updatedTime;

        meta.append(nodeCountSpan, timeSpan);
        card.appendChild(meta);

        return card;
    }

    /**
     * 创建操作按钮
     * @private
     */
    _createActionBtn(icon, className, title) {
        const btn = document.createElement('button');
        btn.className = 'action-btn ' + className;
        btn.title = title;
        btn.textContent = icon;
        return btn;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) {
            return t('manager.justNow');
        } else if (diff < 3600000) {
            return t('manager.minutesAgo', { n: Math.floor(diff / 60000) });
        } else if (diff < 86400000) {
            return t('manager.hoursAgo', { n: Math.floor(diff / 3600000) });
        } else if (diff < 604800000) {
            return t('manager.daysAgo', { n: Math.floor(diff / 86400000) });
        } else {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }
    }

    // ===== 模板管理 =====

    openTemplateModal() {
        this.renderTemplateGrid();
        this.elements.templateModalOverlay.style.display = 'flex';
    }

    closeTemplateModal() {
        this.elements.templateModalOverlay.style.display = 'none';
    }

    renderTemplateGrid() {
        this.elements.templateGrid.innerHTML = '';

        const categories = [...new Set(WORKFLOW_TEMPLATES.map((tpl) => t(tpl.category)))];

        categories.forEach((category) => {
            const section = document.createElement('div');
            section.className = 'template-category';
            section.innerHTML = `<h3 class="template-category-title">${StringUtils.escapeHtml(category)}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'template-category-grid';

            WORKFLOW_TEMPLATES.filter((tpl) => t(tpl.category) === category).forEach((tpl) => {
                const resolved = resolveTemplateI18n(tpl, t);
                const card = document.createElement('div');
                card.className = 'template-card';
                card.dataset.templateId = tpl.id;

                const iconDiv = document.createElement('div');
                iconDiv.className = 'template-card-icon';
                iconDiv.textContent = tpl.icon;

                const nameDiv = document.createElement('div');
                nameDiv.className = 'template-card-name';
                nameDiv.textContent = resolved.name;

                const descDiv = document.createElement('div');
                descDiv.className = 'template-card-desc';
                descDiv.textContent = resolved.description;

                const nodesDiv = document.createElement('div');
                nodesDiv.className = 'template-card-nodes';
                nodesDiv.textContent = t('manager.nodesCount', { count: tpl.nodes.length });

                card.append(iconDiv, nameDiv, descDiv, nodesDiv);
                grid.appendChild(card);
            });

            section.appendChild(grid);
            this.elements.templateGrid.appendChild(section);
        });
    }

    handleTemplateClick(e) {
        const card = e.target.closest('.template-card');
        if (!card) return;

        const templateId = card.dataset.templateId;
        const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
        if (!template) return;

        this.createFromTemplate(template);
    }

    createFromTemplate(template) {
        const resolved = resolveTemplateI18n(template, t);
        const newWorkflow = {
            id: 'wf_' + Date.now(),
            name: resolved.name,
            description: resolved.description,
            nodes: deepClone(resolved.nodes),
            edges: deepClone(template.edges),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.workflows.push(newWorkflow);
        this.saveWorkflowVersion(newWorkflow.id, newWorkflow);
        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeTemplateModal();

        Dialog.success(t('manager.createdFromTemplate', { name: resolved.name }));
    }
}

// NOTE: window.workflowManager 是构建管线必需的全局引用（src/scripts/build.js 行564 使用），
// 该文件同时支持 ES Module（开发时）和 <script> 标签（构建后）两种加载方式。
// 在开发模式下，app.js 动态导入此模块。
// @ts-ignore
window.workflowManager = new WorkflowManager();
