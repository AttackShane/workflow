import { Dialog } from './shared-dialog.js';
import { goToConverter, goToEditor } from './shared-navigator.js';
import { StringUtils, Storage, deepClone, getJsyaml, getJSZip, NodeUtils } from '../utils/helpers.js';
import { t, i18n } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { convertYamlToClipboard } from './converter.js';
import { convertClipboardToInternal, convertInternalToClipboardNode } from './shared-serializer.js';
import { convertClipboardToYaml } from './converter-reverse.js';
import { WORKFLOW_TEMPLATES, resolveTemplateI18n } from './manager-templates.js';

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
                            nodes: Array.isArray(workflow.nodes) ? workflow.nodes : [],
                            edges: Array.isArray(workflow.edges) ? workflow.edges : [],
                            selectedNode: workflow.selectedNode,
                            selectedEdge: workflow.selectedEdge,
                            updatedAt: workflow.updatedAt
                        };
                        this.saveWorkflowVersion(editingWorkflowId, this.workflows[index]);
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
                        this.saveWorkflowVersion(workflow.id, this.workflows[existingIndex]);
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

    saveWorkflowVersion(workflowId, workflowData) {
        const versions = Storage.get('workflowVersions') || {};
        if (!versions[workflowId]) {
            versions[workflowId] = [];
        }
        versions[workflowId].push({
            versionId: `v_${Date.now()}`,
            nodes: deepClone(workflowData.nodes || []),
            edges: deepClone(workflowData.edges || []),
            timestamp: Date.now()
        });
        if (versions[workflowId].length > 50) {
            versions[workflowId] = versions[workflowId].slice(-50);
        }
        Storage.set('workflowVersions', versions);
    }

    getWorkflowVersions(workflowId) {
        const versions = Storage.get('workflowVersions') || {};
        return versions[workflowId] || [];
    }

    showVersionCompare(workflowId) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) return;
        const versions = this.getWorkflowVersions(workflowId);
        if (versions.length === 0) {
            alert(t('manager.versionCompareNoHistory'));
            return;
        }
        this.renderVersionCompareModal(workflow, versions);
    }

    renderVersionCompareModal(workflow, versions) {
        const existingOverlay = document.getElementById('versionCompareOverlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'versionCompareOverlay';

        const versionOptions = versions.map((v, i) => {
            const d = new Date(v.timestamp);
            const ts = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            const nodeCount = v.nodes ? v.nodes.length : 0;
            return `<option value="${i}">${t('manager.versionOption', { index: i + 1, time: ts, count: nodeCount })}</option>`;
        }).join('');

        overlay.innerHTML = `
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>📊 ${t('manager.versionCompareTitle', { name: StringUtils.escapeHtml(workflow.name) })}</h2>
                    <button class="modal-close" id="versionCompareClose">×</button>
                </div>
                <div class="modal-body" style="max-height: 65vh;">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-end;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem;color:var(--text-secondary);">${t('manager.versionAOld')}</label>
                            <select id="versionA" style="width:100%;padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);">${versionOptions}</select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem;color:var(--text-secondary);">${t('manager.versionBNew')}</label>
                            <select id="versionB" style="width:100%;padding:0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);">${versionOptions}</select>
                        </div>
                        <button class="btn btn-primary" id="btnCompareRun">${t('manager.versionCompareRun')}</button>
                    </div>
                    <div id="versionCompareResult" style="font-size:0.85rem;"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="btnVersionCompareClose">${t('manager.versionCompareClose')}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.style.display = 'flex';

        const closeBtn = overlay.querySelector('#versionCompareClose');
        const closeBtn2 = overlay.querySelector('#btnVersionCompareClose');
        const compareBtn = overlay.querySelector('#btnCompareRun');
        const closeFn = () => { overlay.style.display = 'none'; overlay.remove(); };

        closeBtn.addEventListener('click', closeFn);
        closeBtn2.addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });

        compareBtn.addEventListener('click', () => {
            const idxA = parseInt(/** @type {HTMLSelectElement} */ (overlay.querySelector('#versionA')).value);
            const idxB = parseInt(/** @type {HTMLSelectElement} */ (overlay.querySelector('#versionB')).value);
            const resultDiv = overlay.querySelector('#versionCompareResult');
            if (idxA === idxB) {
                resultDiv.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">' + t('manager.versionCompareSelect') + '</p>';
                return;
            }
            resultDiv.innerHTML = this._generateVersionDiff(versions[idxA], versions[idxB]);
        });

        if (versions.length >= 2) {
            /** @type {HTMLSelectElement} */ (overlay.querySelector('#versionB')).value = String(versions.length - 1);
            /** @type {HTMLSelectElement} */ (overlay.querySelector('#versionA')).value = String(Math.max(0, versions.length - 2));
        }
    }

    _generateVersionDiff(versionA, versionB) {
        const nodesA = versionA.nodes || [];
        const nodesB = versionB.nodes || [];
        const edgesA = versionA.edges || [];
        const edgesB = versionB.edges || [];

        const mapA = new Map(nodesA.map(n => [n.id, n]));
        const mapB = new Map(nodesB.map(n => [n.id, n]));

        const addedNodes = nodesB.filter(n => !mapA.has(n.id));
        const removedNodes = nodesA.filter(n => !mapB.has(n.id));
        const modifiedNodes = [];
        const unchangedNodes = [];

        nodesB.forEach(n => {
            if (mapA.has(n.id)) {
                const a = mapA.get(n.id);
                const changes = [];
                if (a.title !== n.title) changes.push(t('manager.versionChangeTitle', { old: a.title, new: n.title }));
                if (a.type !== n.type) changes.push(t('manager.versionChangeType', { old: a.type, new: n.type }));
                if (a.x !== n.x || a.y !== n.y) changes.push(t('manager.versionChangePosition', { x1: a.x, y1: a.y, x2: n.x, y2: n.y }));
                if (JSON.stringify(a.data) !== JSON.stringify(n.data)) changes.push(t('manager.versionChangeParams'));
                if (changes.length > 0) {
                    modifiedNodes.push({ id: n.id, title: n.title, changes });
                } else {
                    unchangedNodes.push(n);
                }
            }
        });

        const edgeIdsA = new Set(edgesA.map(e => `${e.source}-${e.target}`));
        const edgeIdsB = new Set(edgesB.map(e => `${e.source}-${e.target}`));
        const addedEdges = edgesB.filter(e => !edgeIdsA.has(`${e.source}-${e.target}`));
        const removedEdges = edgesA.filter(e => !edgeIdsB.has(`${e.source}-${e.target}`));

        let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';

        const summaryItems = [
            [t('editor.nodeCount'), nodesA.length, nodesB.length],
            [t('editor.edgeCount'), edgesA.length, edgesB.length],
            [t('manager.versionNewNodes').replace('{count}', '{0}').replace('{list}', ''), '-', addedNodes.length],
            [t('manager.versionDeletedNodes').replace('{count}', '{0}').replace('{list}', ''), removedNodes.length, '-'],
            [t('manager.versionModifiedNodes').replace('{count}', '{0}'), '-', modifiedNodes.length],
            [t('manager.versionNewEdges').replace('{count}', '{0}'), '-', addedEdges.length],
            [t('manager.versionDeletedEdges').replace('{count}', '{0}'), removedEdges.length, '-'],
        ];

        html += '<div><h4 style="margin:0 0 0.5rem;">📊 ' + t('manager.versionSummary') + '</h4>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
        html += '<tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border);">' + t('manager.versionItem') + '</th><th style="text-align:center;padding:4px;border-bottom:1px solid var(--border);">' + t('manager.versionAOld') + '</th><th style="text-align:center;padding:4px;border-bottom:1px solid var(--border);">' + t('manager.versionBNew') + '</th></tr>';
        for (const [label, a, b] of summaryItems) {
            const aClass = typeof a === 'number' && typeof b === 'number' && a !== b ? 'color:#F59E0B;' : '';
            const bClass = typeof a === 'number' && typeof b === 'number' && a !== b ? 'color:#F59E0B;' : '';
            html += `<tr><td style="padding:4px;border-bottom:1px solid var(--border);">${label}</td><td style="text-align:center;padding:4px;border-bottom:1px solid var(--border);${aClass}">${a}</td><td style="text-align:center;padding:4px;border-bottom:1px solid var(--border);${bClass}">${b}</td></tr>`;
        }
        html += '</table></div>';

        html += '<div>';
        html += '<h4 style="margin:0 0 0.5rem;">📝 ' + t('manager.versionDetail') + '</h4>';

        if (addedNodes.length > 0) {
            html += `<div style="margin-bottom:0.5rem;color:#4CAF50;">✅ ${t('manager.versionNewNodes', { count: addedNodes.length, list: addedNodes.map(n => StringUtils.escapeHtml(n.title)).join(', ') })}</div>`;
        }
        if (removedNodes.length > 0) {
            html += `<div style="margin-bottom:0.5rem;color:#EF4444;">❌ ${t('manager.versionDeletedNodes', { count: removedNodes.length, list: removedNodes.map(n => StringUtils.escapeHtml(n.title)).join(', ') })}</div>`;
        }
        if (modifiedNodes.length > 0) {
            html += `<div style="margin-bottom:0.5rem;color:#F59E0B;">✏️ ${t('manager.versionModifiedNodes', { count: modifiedNodes.length })}</div>`;
            modifiedNodes.forEach(n => {
                html += `<div style="margin-left:1rem;margin-bottom:0.3rem;font-size:0.8rem;">• <b>${StringUtils.escapeHtml(n.title)}</b>: ${n.changes.join('; ')}</div>`;
            });
        }
        if (addedEdges.length > 0) {
            html += `<div style="margin-bottom:0.5rem;color:#4CAF50;">🔗 ${t('manager.versionNewEdges', { count: addedEdges.length })}</div>`;
        }
        if (removedEdges.length > 0) {
            html += `<div style="margin-bottom:0.5rem;color:#EF4444;">🔗 ${t('manager.versionDeletedEdges', { count: removedEdges.length })}</div>`;
        }
        if (addedNodes.length === 0 && removedNodes.length === 0 && modifiedNodes.length === 0 && addedEdges.length === 0 && removedEdges.length === 0) {
            html += '<div style="color:var(--text-secondary);">' + t('manager.versionNoDiff') + '</div>';
        }

        html += '</div>';
        html += '</div>';

        return html;
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
            if (!card || e.target.closest('.action-btn') || e.target.closest('.workflow-checkbox') || e.target.closest('.drag-handle')) return;
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
        this.elements.importFile.value = '';
        this.elements.importModalOverlay.style.display = 'flex';
    }

    closeImportModal() {
        this.elements.importModalOverlay.style.display = 'none';
        this.elements.importFile.value = '';
        this._pendingZipFile = null;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this._pendingZipFile = file;
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

    async importFromZip(zipFile) {
        const JSZip = getJSZip();
        const zip = await JSZip.loadAsync(zipFile);

        const fileNames = Object.keys(zip.files).filter(f => !zip.files[f].dir);

        let manifestYaml = null;
        let workflowYamlStr = null;

        for (const filename of fileNames) {
            const basename = filename.split('/').pop();
            if (basename === 'MANIFEST.yml' || basename === 'MANIFEST.yaml') {
                const content = await zip.file(filename).async('string');
                manifestYaml = /** @type {{ main?: { name?: string, desc?: string } } | null} */ (getJsyaml().load(content));
            }
        }

        for (const filename of fileNames) {
            const basename = filename.split('/').pop();
            if ((basename.endsWith('.yaml') || basename.endsWith('.yml')) && basename !== 'MANIFEST.yml' && basename !== 'MANIFEST.yaml') {
                workflowYamlStr = await zip.file(filename).async('string');
                break;
            }
        }

        if (!workflowYamlStr) {
            throw new Error('No workflow YAML found in zip package');
        }

        const parsedYaml = /** @type {{ id: any, name?: string, description?: string, nodes: any[], edges?: any[] }} */ (getJsyaml().load(workflowYamlStr));

        if (!parsedYaml || !parsedYaml.nodes || !Array.isArray(parsedYaml.nodes)) {
            throw new Error('Invalid workflow YAML in zip package');
        }

        const MAX_NAME_LENGTH = 20;
        const rawName = manifestYaml?.main?.name || parsedYaml.name || t('manager.importedWorkflowName');
        const name = rawName.length > MAX_NAME_LENGTH ? rawName.substring(0, MAX_NAME_LENGTH) + '...' : rawName;
        const description = manifestYaml?.main?.desc || parsedYaml.description || '';

        const clipData = convertYamlToClipboard(parsedYaml, workflowYamlStr);
        const { nodes, edges } = convertClipboardToInternal(clipData);

        NodeUtils.translateToCanvasOrigin(nodes);

        return {
            name,
            description,
            nodes,
            edges
        };
    }

    async importWorkflow() {
        let zipResult = null;

        if (this._pendingZipFile) {
            try {
                zipResult = await this.importFromZip(this._pendingZipFile);
                this._pendingZipFile = null;
            } catch (e) {
                await Dialog.error(t('manager.fileReadError') + ': ' + (e.message || ''));
                return;
            }
        } else if (this.elements.importFile.files[0]) {
            const file = this.elements.importFile.files[0];
            try {
                zipResult = await this.importFromZip(file);
            } catch (e) {
                await Dialog.error(t('manager.fileReadError') + ': ' + (e.message || ''));
                return;
            }
        } else {
            await Dialog.alert(t('manager.provideData'));
            return;
        }

        if (zipResult) {
            const newWorkflow = {
                id: `wf_${Date.now()}`,
                name: zipResult.name,
                description: zipResult.description,
                nodes: zipResult.nodes,
                edges: zipResult.edges,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            this.workflows.push(newWorkflow);
            this.saveWorkflows();
            this.renderWorkflowList();
            this.closeImportModal();
            await Dialog.success(t('manager.importSuccess'));
            return;
        }
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

    async duplicateWorkflow(id) {
        const original = this.workflows.find(w => w.id === id);
        if (!original) return;

        const newId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const duplicated = {
            ...deepClone(original),
            id: newId,
            name: `${original.name} ${t('messages.duplicateNodeSuffix')}`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (duplicated.nodes) {
            const idMap = new Map();
            duplicated.nodes = duplicated.nodes.map(n => {
                const oldId = n.id;
                const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                idMap.set(oldId, newId);
                return { ...n, id: newId };
            });
            duplicated.edges = (duplicated.edges || []).map(e => ({
                ...e,
                id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                source: idMap.get(e.source) || e.source,
                target: idMap.get(e.target) || e.target
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
        document.querySelectorAll('.workflow-checkbox').forEach(cb => {
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
        document.querySelectorAll('.workflow-checkbox').forEach(cb => {
            const input = /** @type {HTMLInputElement} */ (cb);
            input.style.display = 'none';
            input.checked = false;
        });
    }

    toggleSelectAll() {
        const checked = this.elements.selectAllCheckbox?.checked;
        document.querySelectorAll('.workflow-checkbox').forEach(cb => {
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

        this.workflows = this.workflows.filter(w => !this.selectedIds.has(w.id));
        this.saveWorkflows();
        this.exitBatchMode();
        this.renderWorkflowList();
        await Dialog.success(t('manager.batchDeleteSuccess'));
    }

    async exportWorkflow(workflow) {
        const nodes = deepClone(workflow.nodes || []);
        const edges = deepClone(workflow.edges || []);

        const clipData = {
            type: 'coze-workflow-clipboard-data',
            source: { workflowId: workflow.id || String(Date.now()) },
            json: {
                name: workflow.name || 'my_workflow',
                nodes: nodes
                    .filter(n => !n.parentId)
                    .map(n => convertInternalToClipboardNode(n, nodes)),
                edges: edges.map(e => ({
                    sourceNodeID: String(e.source).replace('node_', ''),
                    targetNodeID: String(e.target).replace('node_', ''),
                    sourcePortID: e.sourcePort || ''
                }))
            }
        };

        const yamlObj = convertClipboardToYaml(clipData);
        const workflowYaml = getJsyaml().dump(yamlObj, {
            indent: 4,
            lineWidth: 120,
            schema: getJsyaml().JSON_SCHEMA
        });

        const safeName = (workflow.name || 'workflow').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');

        const manifest = {
            type: 'Workflow',
            version: '1.0.0',
            main: {
                id: workflow.id || String(Date.now()),
                name: workflow.name || 'my_workflow',
                desc: workflow.description || 'Created with workflow editor',
                icon: 'plugin_icon/workflow.png',
                version: '',
                flowMode: 0,
                commitId: ''
            },
            sub: []
        };
        const manifestYaml = getJsyaml().dump(manifest, {
            indent: 4,
            lineWidth: 120,
            schema: getJsyaml().JSON_SCHEMA
        });

        const JSZip = getJSZip();
        const zip = new JSZip();
        const root = zip.folder(safeName);
        root.file('MANIFEST.yml', manifestYaml);
        root.folder('workflow').file(`${safeName}.yaml`, workflowYaml);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
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
        const searchScope = this.elements.workflowSearchScope?.value || 'all';
        let filtered = this.workflows;
        if (searchTerm) {
            const noDescText = t('manager.noDescription').toLowerCase();
            filtered = this.workflows.filter(w => {
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

        filtered.forEach(workflow => {
            const card = this.createWorkflowCard(workflow);
            this.elements.workflowList.appendChild(card);
        });

        this._attachCardEvents();
    }

    _attachCardEvents() {
        const cards = this.elements.workflowList.querySelectorAll('.workflow-card');
        let draggedCard = null;

        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn') || e.target.closest('.drag-handle') || e.target.closest('.workflow-checkbox')) return;
                if (this.batchMode) return;
                const wf = this.workflows.find(w => w.id === card.dataset.workflowId);
                if (wf) this.openWorkflowEditor(wf);
            });

            card.querySelector('.edit-btn')?.addEventListener('click', () => {
                const wf = this.workflows.find(w => w.id === card.dataset.workflowId);
                if (wf) this.openEditModal(wf);
            });

            card.querySelector('.duplicate-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateWorkflow(card.dataset.workflowId);
            });

            card.querySelector('.export-btn')?.addEventListener('click', () => {
                const wf = this.workflows.find(w => w.id === card.dataset.workflowId);
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
                    cards.forEach(c => c.classList.remove('drag-over'));
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

                const fromIndex = this.workflows.findIndex(w => w.id === fromId);
                const toIndex = this.workflows.findIndex(w => w.id === toId);

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
        const edgeCount = workflow.edges?.length || 0;
        const updatedTime = this.formatDate(workflow.updatedAt);

        card.innerHTML = `
            <div class="workflow-card-header">
                <span class="drag-handle" draggable="true" title="${t('manager.dragHandle')}">⠿</span>
                <input type="checkbox" class="workflow-checkbox" data-id="${StringUtils.escapeHtml(workflow.id)}" style="display: none;">
                <h3 class="workflow-card-title">${StringUtils.escapeHtml(workflow.name)}</h3>
                <div class="workflow-card-actions">
                    <button class="action-btn duplicate-btn" title="${t('manager.duplicateWorkflowTip')}">📋</button>
                    <button class="action-btn edit-btn" title="${t('manager.editTooltip')}">✏️</button>
                    <button class="action-btn export-btn" title="${t('manager.exportTooltip')}">📥</button>
                    <button class="action-btn version-btn" title="${t('manager.versionCompare')}">📊</button>
                    <button class="action-btn delete-btn" title="${t('manager.deleteTooltip')}">🗑️</button>
                </div>
            </div>
            <p class="workflow-card-description">${StringUtils.escapeHtml(workflow.description) || t('manager.noDescription')}</p>
            <div class="workflow-card-meta">
                <span class="node-count">${t('manager.nodesCount', { count: nodeCount })}</span>
                <span>${updatedTime}</span>
            </div>
        `;

        return card;
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
            nodes: deepClone(resolved.nodes),
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

// @ts-ignore
window.workflowManager = new WorkflowManager();