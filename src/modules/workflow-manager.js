import { Dialog } from './dialog.js';
import { goToConverter, goToEditor, initNavigator } from './navigator.js';
import { StringUtils, Storage, deepClone, getJsyaml } from '../utils/helpers.js';
import { t, i18n } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { WORKFLOW_TEMPLATES, resolveTemplateI18n } from './templates.js';

export class WorkflowManager {
    constructor() {
        this.workflows = [];
        this.currentEditingId = null;
        
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
            importText: null,
            btnImportCancel: null,
            btnImportConfirm: null,
            btnTemplates: null,
            templateModalOverlay: null,
            templateModalClose: null,
            templateGrid: null
        };
    }

    init() {
        this.loadElements();
        this.loadWorkflows();
        this.loadSavedWorkflow();
        this.bindEvents();
        this.renderWorkflowList();
        
        // 监听语言切换，重新渲染列表
        i18n.addListener(() => this.handleLanguageChange());
    }
    
    handleLanguageChange() {
        this.renderWorkflowList();
        this.renderTemplateGrid();
    }
    
    loadSavedWorkflow() {
        const savedWorkflow = sessionStorage.getItem('savedWorkflow');
        
        if (savedWorkflow) {
            try {
                const workflow = JSON.parse(savedWorkflow);
                sessionStorage.removeItem('savedWorkflow');
                
                const editingWorkflowId = sessionStorage.getItem('editingWorkflowId');
                
                if (editingWorkflowId) {
                    sessionStorage.removeItem('editingWorkflowId');
                    
                    const index = this.workflows.findIndex(w => w.id === editingWorkflowId);
                    
                    if (index !== -1) {
                        this.workflows[index] = {
                            ...this.workflows[index],
                            nodes: workflow.nodes,
                            edges: workflow.edges,
                            selectedNode: workflow.selectedNode,
                            selectedEdge: workflow.selectedEdge,
                            updatedAt: workflow.updatedAt
                        };
                        this.saveWorkflows();
                        this.renderWorkflowList();
                    }
                } else if (workflow.id && workflow.name) {
                    const name = sessionStorage.getItem('savedWorkflowName') || workflow.name;
                    const description = sessionStorage.getItem('savedWorkflowDesc') || workflow.description || '';
                    sessionStorage.removeItem('savedWorkflowName');
                    sessionStorage.removeItem('savedWorkflowDesc');
                    
                    const existingIndex = this.workflows.findIndex(w => w.id === workflow.id);
                    if (existingIndex !== -1) {
                        this.workflows[existingIndex] = {
                            ...this.workflows[existingIndex],
                            nodes: workflow.nodes || [],
                            edges: workflow.edges || [],
                            selectedNode: workflow.selectedNode,
                            selectedEdge: workflow.selectedEdge,
                            updatedAt: workflow.updatedAt || Date.now()
                        };
                    } else {
                        const newWorkflow = {
                            id: workflow.id,
                            name: name,
                            description: description,
                            nodes: workflow.nodes || [],
                            edges: workflow.edges || [],
                            createdAt: workflow.createdAt || Date.now(),
                            updatedAt: workflow.updatedAt || Date.now()
                        };
                        this.workflows.push(newWorkflow);
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
        this.elements.importText = document.getElementById('importText');
        this.elements.btnImportCancel = document.getElementById('btnImportCancel');
        this.elements.btnImportConfirm = document.getElementById('btnImportConfirm');
        this.elements.btnTemplates = document.getElementById('btnTemplates');
        this.elements.templateModalOverlay = document.getElementById('templateModalOverlay');
        this.elements.templateModalClose = document.getElementById('templateModalClose');
        this.elements.templateGrid = document.getElementById('templateGrid');
        this.elements.workflowSearch = document.getElementById('workflowSearch');
        this.elements.workflowSort = document.getElementById('workflowSort');
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
                    { id: 'node_100001', type: 'start', x: 400, y: 80, title: t('nodeTypes.start'), description: t('nodeTypes.description.start') },
                    { id: 'node_100002', type: 'llm', x: 400, y: 200, title: t('nodeTypes.llm'), description: t('nodeTypes.description.llm'), parameters: { prompt: t('manager.defaultFlow1Prompt') } },
                    { id: 'node_100003', type: 'end', x: 400, y: 320, title: t('nodeTypes.end'), description: t('nodeTypes.description.end') }
                ],
                edges: [
                    { id: 'edge_1', source: 'node_100001', target: 'node_100002' },
                    { id: 'edge_2', source: 'node_100002', target: 'node_100003' }
                ],
                createdAt: Date.now() - 86400000,
                updatedAt: Date.now() - 86400000
            },
            {
                id: 'wf_2',
                name: t('manager.defaultFlow2Name'),
                description: t('manager.defaultFlow2Desc'),
                nodes: [
                    { id: 'node_200001', type: 'start', x: 400, y: 80, title: t('nodeTypes.start'), description: t('nodeTypes.description.start') },
                    { id: 'node_200002', type: 'text', x: 400, y: 200, title: t('nodeTypes.text'), description: t('nodeTypes.description.text'), parameters: { text: t('manager.defaultFlow2Prompt') } },
                    { id: 'node_200003', type: 'image_generate', x: 400, y: 320, title: t('nodeTypes.image_generate'), description: t('nodeTypes.description.image_generate') },
                    { id: 'node_200004', type: 'end', x: 400, y: 440, title: t('nodeTypes.end'), description: t('nodeTypes.description.end') }
                ],
                edges: [
                    { id: 'edge_3', source: 'node_200001', target: 'node_200002' },
                    { id: 'edge_4', source: 'node_200002', target: 'node_200003' },
                    { id: 'edge_5', source: 'node_200003', target: 'node_200004' }
                ],
                createdAt: Date.now() - 172800000,
                updatedAt: Date.now() - 172800000
            }
        ];
    }

    saveWorkflows() {
        Storage.set('workflows', this.workflows);
    }

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
        if (this.elements.workflowSort) {
            this.elements.workflowSort.addEventListener('change', () => this.renderWorkflowList());
        }
        
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
        const savedWorkflow = sessionStorage.getItem('savedWorkflow');
        if (savedWorkflow) {
            this.loadSavedWorkflow();
        } else {
            // 重新加载工作流列表，确保显示最新数据
            this.loadWorkflows();
            this.renderWorkflowList();
        }
    }

    openNewWorkflowModal() {
        Dialog.prompt(t('manager.createNew')).then(result => {
            if (!result) return;
            const newWorkflow = {
                id: `wf_${Date.now()}`,
                name: result.name,
                description: result.description,
                nodes: [],
                edges: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            this.workflows.push(newWorkflow);
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

    openImportModal() {
        this.elements.importText.value = '';
        this.elements.importFile.value = '';
        this.elements.importModalOverlay.style.display = 'flex';
    }

    closeImportModal() {
        this.elements.importModalOverlay.style.display = 'none';
        this.elements.importText.value = '';
        this.elements.importFile.value = '';
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.elements.importText.value = e.target.result;
            };
            reader.readAsText(file);
        }
    }

    async saveWorkflow() {
        const name = this.elements.workflowName.value.trim();
        const description = this.elements.workflowDescription.value.trim();

        if (!name) {
            await Dialog.alert(t('manager.nameRequired'));
            return;
        }

        if (this.currentEditingId) {
            const index = this.workflows.findIndex(w => w.id === this.currentEditingId);
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

    async importWorkflow() {
        let workflowData = null;
        
        if (this.elements.importText.value.trim()) {
            try {
                workflowData = JSON.parse(this.elements.importText.value);
            } catch (e) {
                await Dialog.error(t('manager.jsonParseError'));
                return;
            }
        } else if (this.elements.importFile.files[0]) {
            await Dialog.alert(t('manager.selectFileOrPaste'));
            return;
        } else {
            await Dialog.alert(t('manager.provideData'));
            return;
        }

        if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
            await Dialog.error(t('manager.invalidData'));
            return;
        }

        const newWorkflow = {
            id: `wf_${Date.now()}`,
            name: workflowData.name || t('manager.importedWorkflowName'),
            description: workflowData.description || '',
            nodes: deepClone(workflowData.nodes),
            edges: deepClone(workflowData.edges || []),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.workflows.push(newWorkflow);
        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeImportModal();
        await Dialog.success(t('manager.importSuccess'));
    }

    async deleteWorkflow(id) {
        const workflow = this.workflows.find(w => w.id === id);
        const confirmed = await Dialog.confirm(t('manager.deleteConfirm', { name: workflow?.name || t('manager.thisWorkflow') }), t('common.confirm'), { danger: true });
        if (!confirmed) {
            return;
        }

        this.workflows = this.workflows.filter(w => w.id !== id);
        this.saveWorkflows();
        this.renderWorkflowList();
    }

    exportWorkflow(workflow) {
        const exportData = {
            schema_version: "1.0.0",
            name: workflow.name || "my_workflow",
            id: workflow.id || `workflow_${Date.now()}`,
            description: workflow.description || "Created with workflow editor",
            mode: "workflow",
            icon: "plugin_icon/workflow.png",
            nodes: (workflow.nodes || []).map(n => {
                const node = {
                    id: String(n.id).replace('node_', ''),
                    type: n.type,
                    title: n.title,
                    description: n.description,
                    position: { x: n.x, y: n.y },
                    parameters: n.parameters
                };
                if (n.icon) node.icon = n.icon;
                return node;
            }),
            edges: (workflow.edges || []).map(e => {
                const edge = {
                    source_node: String(e.source).replace('node_', ''),
                    target_node: String(e.target).replace('node_', '')
                };
                if (e.sourcePort) edge.source_port = e.sourcePort;
                return edge;
            })
        };
        
        const yamlStr = getJsyaml().dump(exportData, { indent: 2, lineWidth: 120 });
        const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name}.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    openWorkflowEditor(workflow) {
        sessionStorage.setItem('editingWorkflow', JSON.stringify(workflow));
        goToEditor();
    }

    renderWorkflowList() {
        this.elements.workflowList.innerHTML = '';

        if (this.workflows.length === 0) {
            this.elements.emptyState.style.display = 'block';
            return;
        }

        // 搜索过滤
        const searchTerm = this.elements.workflowSearch?.value?.trim().toLowerCase() || '';
        let filtered = this.workflows;
        if (searchTerm) {
            filtered = this.workflows.filter(w => {
                const name = (w.name || '').toLowerCase();
                const desc = (w.description || '').toLowerCase();
                const id = (w.id || '').toLowerCase();
                return name.includes(searchTerm) || desc.includes(searchTerm) || id.includes(searchTerm);
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

        filtered.forEach(workflow => {
            const card = this.createWorkflowCard(workflow);
            this.elements.workflowList.appendChild(card);
        });
    }

    createWorkflowCard(workflow) {
        const card = document.createElement('div');
        card.className = 'workflow-card';
        
        const nodeCount = workflow.nodes?.length || 0;
        const edgeCount = workflow.edges?.length || 0;
        const updatedTime = this.formatDate(workflow.updatedAt);

        card.innerHTML = `
            <div class="workflow-card-header">
                <h3 class="workflow-card-title">${StringUtils.escapeHtml(workflow.name)}</h3>
                <div class="workflow-card-actions">
                    <button class="action-btn edit-btn" title="${t('manager.editTooltip')}">✏️</button>
                    <button class="action-btn export-btn" title="${t('manager.exportTooltip')}">📥</button>
                    <button class="action-btn delete-btn" title="${t('manager.deleteTooltip')}">🗑️</button>
                </div>
            </div>
            <p class="workflow-card-description">${StringUtils.escapeHtml(workflow.description) || t('manager.noDescription')}</p>
            <div class="workflow-card-meta">
                <span class="node-count">${t('manager.nodesCount', { count: nodeCount })}</span>
                <span>${updatedTime}</span>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => {
            this.openEditModal(workflow);
        });

        card.querySelector('.export-btn').addEventListener('click', () => {
            this.exportWorkflow(workflow);
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteWorkflow(workflow.id);
        });

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                this.openWorkflowEditor(workflow);
            }
        });

        return card;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

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

    openTemplateModal() {
        this.renderTemplateGrid();
        this.elements.templateModalOverlay.style.display = 'flex';
    }

    closeTemplateModal() {
        this.elements.templateModalOverlay.style.display = 'none';
    }

    renderTemplateGrid() {
        this.elements.templateGrid.innerHTML = '';

        const categories = [...new Set(WORKFLOW_TEMPLATES.map(tpl => t(tpl.category)))];

        categories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'template-category';
            section.innerHTML = `<h3 class="template-category-title">${StringUtils.escapeHtml(category)}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'template-category-grid';

            WORKFLOW_TEMPLATES.filter(tpl => t(tpl.category) === category).forEach(tpl => {
                const resolved = resolveTemplateI18n(tpl, t);
                const card = document.createElement('div');
                card.className = 'template-card';
                card.dataset.templateId = tpl.id;
                card.innerHTML = `
                    <div class="template-card-icon">${tpl.icon}</div>
                    <div class="template-card-name">${StringUtils.escapeHtml(resolved.name)}</div>
                    <div class="template-card-desc">${StringUtils.escapeHtml(resolved.description)}</div>
                    <div class="template-card-nodes">${t('manager.nodesCount', { count: tpl.nodes.length })}</div>
                `;
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
        const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;

        this.createFromTemplate(template);
    }

    createFromTemplate(template) {
        const resolved = resolveTemplateI18n(template, t);
        const newWorkflow = {
            id: 'wf_' + Date.now(),
            name: resolved.name,
            description: resolved.description,
            nodes: deepClone(template.nodes),
            edges: deepClone(template.edges),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.workflows.push(newWorkflow);
        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeTemplateModal();

        Dialog.success(t('manager.createdFromTemplate', { name: resolved.name }));
    }
}

window.workflowManager = new WorkflowManager();