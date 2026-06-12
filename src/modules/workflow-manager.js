import { Dialog } from './dialog.js';
import { goToConverter, goToEditor, initNavigator } from './navigator.js';
import { StringUtils, Storage } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { WORKFLOW_TEMPLATES } from './templates.js';

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
                        
                        if (this.elements.workflowList) {
                            this.renderWorkflowList();
                        }
                    }
                }
            } catch (error) {
                Logger.error('加载保存的工作流失败:', error);
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
                name: '欢迎流程',
                description: '一个简单的欢迎工作流示例',
                nodes: [
                    { id: 'node_100001', type: 'start', x: 400, y: 80, title: '开始', description: '工作流起点' },
                    { id: 'node_100002', type: 'llm', x: 400, y: 200, title: '大模型', description: '生成欢迎消息', parameters: { prompt: '请生成一条友好的欢迎消息' } },
                    { id: 'node_100003', type: 'end', x: 400, y: 320, title: '结束', description: '工作流终点' }
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
                name: '图片生成流程',
                description: '使用文本描述生成图片',
                nodes: [
                    { id: 'node_200001', type: 'start', x: 400, y: 80, title: '开始', description: '工作流起点' },
                    { id: 'node_200002', type: 'text', x: 400, y: 200, title: '文本处理', description: '生成图片描述', parameters: { text: '一只可爱的小猫在草地上玩耍' } },
                    { id: 'node_200003', type: 'image_generate', x: 400, y: 320, title: '图片生成', description: '根据描述生成图片' },
                    { id: 'node_200004', type: 'end', x: 400, y: 440, title: '结束', description: '工作流终点' }
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
        
        // 导航按钮
        const navConverterBtn = document.getElementById('navConverterBtn');
        const navEditorBtn = document.getElementById('navEditorBtn');
        if (navConverterBtn) navConverterBtn.addEventListener('click', goToConverter);
        if (navEditorBtn) navEditorBtn.addEventListener('click', goToEditor);
        
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
        this.currentEditingId = null;
        this.elements.modalTitle.textContent = t('manager.createNew');
        this.elements.workflowName.value = '';
        this.elements.workflowDescription.value = '';
        this.elements.modalOverlay.style.display = 'flex';
        this.elements.workflowName.focus();
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
            await Dialog.alert('请输入工作流名称');
            return;
        }

        if (this.currentEditingId) {
            const index = this.workflows.findIndex(w => w.id === this.currentEditingId);
            if (index !== -1) {
                this.workflows[index].name = name;
                this.workflows[index].description = description;
                this.workflows[index].updatedAt = Date.now();
            }
        } else {
            const newWorkflow = {
                id: `wf_${Date.now()}`,
                name,
                description,
                nodes: [],
                edges: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            this.workflows.push(newWorkflow);
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
                await Dialog.error('JSON格式错误');
                return;
            }
        } else if (this.elements.importFile.files[0]) {
            await Dialog.alert('请先选择文件或粘贴JSON内容');
            return;
        } else {
            await Dialog.alert('请提供工作流数据');
            return;
        }

        if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
            await Dialog.error('无效的工作流数据');
            return;
        }

        const newWorkflow = {
            id: `wf_${Date.now()}`,
            name: workflowData.name || '导入的工作流',
            description: workflowData.description || '',
            nodes: JSON.parse(JSON.stringify(workflowData.nodes)),
            edges: JSON.parse(JSON.stringify(workflowData.edges || [])),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.workflows.push(newWorkflow);
        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeImportModal();
        await Dialog.success('工作流导入成功');
    }

    async deleteWorkflow(id) {
        const confirmed = await Dialog.confirm('确定要删除这个工作流吗？', '删除确认', { danger: true });
        if (!confirmed) {
            return;
        }

        this.workflows = this.workflows.filter(w => w.id !== id);
        this.saveWorkflows();
        this.renderWorkflowList();
    }

    exportWorkflow(workflow) {
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

        this.elements.emptyState.style.display = 'none';

        this.workflows.forEach(workflow => {
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
                    <button class="action-btn edit-btn" title="编辑">✏️</button>
                    <button class="action-btn export-btn" title="导出">📥</button>
                    <button class="action-btn delete-btn" title="删除">🗑️</button>
                </div>
            </div>
            <p class="workflow-card-description">${StringUtils.escapeHtml(workflow.description) || '暂无描述'}</p>
            <div class="workflow-card-meta">
                <span class="node-count">${nodeCount} 个节点</span>
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
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)} 分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)} 小时前`;
        } else if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)} 天前`;
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

        const categories = [...new Set(WORKFLOW_TEMPLATES.map(t => t.category))];

        categories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'template-category';
            section.innerHTML = `<h3 class="template-category-title">${category}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'template-category-grid';

            WORKFLOW_TEMPLATES.filter(t => t.category === category).forEach(tpl => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.dataset.templateId = tpl.id;
                card.innerHTML = `
                    <div class="template-card-icon">${tpl.icon}</div>
                    <div class="template-card-name">${StringUtils.escapeHtml(tpl.name)}</div>
                    <div class="template-card-desc">${StringUtils.escapeHtml(tpl.description)}</div>
                    <div class="template-card-nodes">${tpl.nodes.length} 个节点</div>
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
        const newWorkflow = {
            id: 'wf_' + Date.now(),
            name: template.name,
            description: template.description,
            nodes: JSON.parse(JSON.stringify(template.nodes)),
            edges: JSON.parse(JSON.stringify(template.edges)),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.workflows.push(newWorkflow);
        this.saveWorkflows();
        this.renderWorkflowList();
        this.closeTemplateModal();

        Dialog.success(`已从模板"${template.name}"创建工作流`);
    }
}

window.workflowManager = new WorkflowManager();