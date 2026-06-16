import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;
    }

    createElement(nodeData) {
        const info = this.core.nodeTypeInfo[nodeData.type] || { title: t('messages.unknownNode'), icon: '📦', description: '', hasInput: true, hasOutput: true };
        const el = document.createElement('div');
        el.className = `canvas-node ${nodeData.type}`;
        el.style.left = `${nodeData.x}px`;
        el.style.top = `${nodeData.y}px`;
        el.dataset.nodeId = nodeData.id;
        
        const inputPoint = info.hasInput ? '<div class="connection-point input"></div>' : '';
        const outputPoint = info.hasOutput ? '<div class="connection-point output"></div>' : '';
        
        el.innerHTML = `
            <div class="node-header">
                <div class="node-icon">${info.icon}</div>
                <div class="node-title">${StringUtils.escapeHtml(nodeData.title)}</div>
                <div class="node-type">${StringUtils.escapeHtml(nodeData.type)}</div>
            </div>
            <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
            ${inputPoint}
            ${outputPoint}
        `;
        
        el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener('dblclick', () => this.openEditor(nodeData.id));
        
        const outputPoints = el.querySelectorAll('.connection-point.output');
        outputPoints.forEach(point => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.ui.startConnection(nodeData.id, e);
            });
        });
        
        const inputPoints = el.querySelectorAll('.connection-point.input');
        inputPoints.forEach(point => {
            point.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (this.ui.connectingFrom && this.ui.connectingFrom !== nodeData.id) {
                    const edge = this.core.createEdge(this.ui.connectingFrom, nodeData.id);
                    if (edge) {
                        this.core.saveHistory(t('messages.createConnection'));
                    }
                    this.ui.cancelConnection();
                }
            });
        });
        
        const rect = el.getBoundingClientRect();
        nodeData.width = rect.width;
        nodeData.height = rect.height;
        
        return el;
    }

    addToCanvas(type, screenX, screenY, data = null) {
        // 校验节点类型，拒绝未知类型（如拖动选中文字误触）
        if (!type || !this.core.nodeTypeInfo[type]) return null;
        
        // 将屏幕坐标转换为画布坐标（考虑平移和缩放）
        const { canvasX, canvasY } = this.ui.canvas.screenToCanvas(screenX, screenY);
        
        // 节点尺寸约 200x100，偏移半宽半高使节点中心对齐鼠标
        const nodeData = this.core.createNode(type, canvasX - 100, canvasY - 50, data);
        const el = this.createElement(nodeData);
        this.ui.canvas.canvasContent.appendChild(el);
        this.ui.canvas.setEmptyState(false);
        
        this.core.saveHistory(t('actions.addNode', { type }));
        
        return el;
    }

    onMouseDown(e, el) {
        if (e.target.classList.contains('connection-point')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        this.ui.dragStartX = e.clientX;
        this.ui.dragStartY = e.clientY;
        this.ui.hasDragged = false;
        
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = selectedNodes.length > 1;
        const ctrlPressed = e.ctrlKey || e.metaKey;
        const isAlreadySelected = el.classList.contains('selected');
        
        if (ctrlPressed && isAlreadySelected) {
            el.classList.remove('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length === 0) {
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(null);
                this.ui.showSummaryPanel();
            } else {
                const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
                this.core.selectNode(lastSelected.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
            }
        } else if (ctrlPressed && !isAlreadySelected) {
            el.classList.add('selected');
            this.ui.isMultiSelectMode = true;
            this.ui.showSummaryPanel();
        } else if (!this.ui.isMultiSelectMode && !ctrlPressed && !hasMultipleSelected) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
            el.classList.add('selected');
            this.ui.isMultiSelectMode = false;
            this.core.selectNode(el.dataset.nodeId);
            const node = this.core.nodes.find(n => n.id === el.dataset.nodeId);
            if (node) this.renderPropertyPanel(node);
        } else if (this.ui.isMultiSelectMode || hasMultipleSelected) {
            if (!isAlreadySelected) {
                el.classList.add('selected');
            }
            this.ui.isMultiSelectMode = true;
            this.ui.showSummaryPanel();
        } else {
            el.classList.add('selected');
        }
        
        el.classList.add('dragging');
        el.style.zIndex = 1000;
        
        const nodeStartPositions = {};
        const selectedNodeEls = Array.from(document.querySelectorAll('.canvas-node.selected'));
        selectedNodeEls.forEach(nodeEl => {
            nodeStartPositions[nodeEl.dataset.nodeId] = {
                x: parseInt(nodeEl.style.left) || 0,
                y: parseInt(nodeEl.style.top) || 0
            };
        });
        
        let rafId = null;
        
        const onMouseMove = (e) => {
            const dx = Math.abs(e.clientX - this.ui.dragStartX);
            const dy = Math.abs(e.clientY - this.ui.dragStartY);
            if (dx > 5 || dy > 5) {
                this.ui.hasDragged = true;
            }
            
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            
            rafId = requestAnimationFrame(() => {
                const moveDx = (e.clientX - this.ui.dragStartX) / this.ui.canvas.canvasScale;
                const moveDy = (e.clientY - this.ui.dragStartY) / this.ui.canvas.canvasScale;
                
                for (const nodeEl of selectedNodes) {
                    const startPos = nodeStartPositions[nodeEl.dataset.nodeId];
                    const newX = startPos.x + moveDx;
                    const newY = startPos.y + moveDy;
                    nodeEl.style.left = `${newX}px`;
                    nodeEl.style.top = `${newY}px`;
                }
            });
        };
        
        const onMouseUp = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            selectedNodes.forEach(nodeEl => {
                nodeEl.classList.remove('dragging');
                nodeEl.style.zIndex = '';
                const newX = parseInt(nodeEl.style.left) || 0;
                const newY = parseInt(nodeEl.style.top) || 0;
                this.core.updateNodePosition(nodeEl.dataset.nodeId, newX, newY);
            });
            el.classList.remove('dragging');
            el.style.zIndex = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // 只有真正移动了才保存历史
            if (this.ui.hasDragged) {
                this.core.saveHistory(t('messages.moveNode'));
            }
            
            this.ui.updateEdges();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    onClick(e, el) {
        if (e.target.classList.contains('connection-point')) return;
        
        if (this.ui.hasDragged) {
            this.ui.hasDragged = false;
            return;
        }
        
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const clickedNode = e.target.closest('.canvas-node');
        
        if (!e.ctrlKey && !e.metaKey && this.ui.isMultiSelectMode) {
            if (clickedNode && clickedNode.classList.contains('selected')) {
                return;
            } else if (clickedNode) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
                clickedNode.classList.add('selected');
                this.ui.isMultiSelectMode = false;
                
                this.core.selectNode(clickedNode.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === clickedNode.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
                this.ui.updateEdges();
            }
        }
    }

    select(el, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(e => e.classList.remove('selected'));
            this.core.selectEdge(null);
            this.ui.isMultiSelectMode = false;
        }
        
        el.classList.toggle('selected');
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        
        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);
            const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (node) this.renderPropertyPanel(node);
            
            if (selectedNodes.length > 1) {
                this.ui.isMultiSelectMode = true;
            }
        } else {
            this.core.selectNode(null);
            this.ui.showSummaryPanel();
            this.ui.isMultiSelectMode = false;
        }
        
        this.ui.updateEdges();
    }

    delete(nodeId, saveHistory = true, updatePanel = true) {
        this.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
        
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        if (selectedEdges.length > 0) {
            const stillExists = Array.from(selectedEdges).some(edge => {
                const edgeId = edge.getAttribute('data-edge-id');
                return this.core.edges.find(e => e.id === edgeId);
            });
            if (!stillExists) {
                this.core.selectEdge(null);
            }
        }
        
        this.ui.showSummaryPanel();
        
        if (saveHistory) {
            this.core.saveHistory(t('messages.deleteNode'));
        }
    }

    renderPropertyPanel(node) {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        const selectedCount = selectedNodes.length + selectedEdges.length;
        
        // 多选或无选中 - 显示摘要
        if (selectedCount !== 1 || !node) {
            this.ui.showSummaryPanel();
            return;
        }
        
        // 单选 - 显示详情，按参数表生成可编辑表单
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        let paramsHtml = '';
        params.forEach(param => {
            const value = node.parameters?.[param.name] ?? param.defaultValue;
            const required = param.required ? '<span class="required">*</span>' : '';
            const hint = param.description ? `<div class="hint">${StringUtils.escapeHtml(param.description)}</div>` : '';
            const safeValue = StringUtils.escapeHtml(String(value ?? ''));
            
            let inputHtml = '';
            switch (param.type) {
                case 'string':
                case 'number':
                    inputHtml = `<input class="property-input" id="prop_${param.name}" type="${param.type}" value="${safeValue}">`;
                    break;
                case 'textarea':
                    inputHtml = `<textarea class="property-textarea" id="prop_${param.name}">${safeValue}</textarea>`;
                    break;
                case 'select':
                    let selectOptions = (param.options || []).map(opt => {
                        const optVal = typeof opt === 'object' ? (opt.value ?? opt) : opt;
                        const optLabel = typeof opt === 'object' ? (opt.label ?? opt.value ?? opt) : opt;
                        return { val: String(optVal), label: String(optLabel) };
                    });
                    const hasMatch = selectOptions.some(o => o.val === String(value ?? ''));
                    if (!hasMatch && value !== undefined && value !== null && String(value).trim() !== '') {
                        selectOptions.unshift({ val: String(value), label: String(value) });
                    }
                    const optionsHtml = selectOptions.map(o =>
                        `<option value="${StringUtils.escapeHtml(o.val)}" ${o.val === String(value ?? '') ? 'selected' : ''}>${StringUtils.escapeHtml(o.label)}</option>`
                    ).join('');
                    inputHtml = `<select class="property-input property-select" id="prop_${param.name}">${optionsHtml}</select>`;
                    break;
                case 'boolean':
                    inputHtml = `<input class="property-input" id="prop_${param.name}" type="checkbox" ${value ? 'checked' : ''}>
                    <label for="prop_${param.name}">启用</label>`;
                    break;
                case 'json':
                    const jsonStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '');
                    inputHtml = `<textarea class="property-textarea" id="prop_${param.name}">${StringUtils.escapeHtml(jsonStr)}</textarea>`;
                    break;
                default:
                    inputHtml = `<input class="property-input" id="prop_${param.name}" type="text" value="${safeValue}">`;
            }
            
            paramsHtml += `
                <div class="property-group">
                    <label class="property-label">${StringUtils.escapeHtml(param.label || param.name)} ${required}</label>
                    ${inputHtml}
                    ${hint}
                </div>
            `;
        });
        
        this.ui.showDetailPanel();
        const detailContainer = document.getElementById('nodeDetail');
        if (!detailContainer) return;
        
        detailContainer.innerHTML = `
            <div class="property-panel-section">
                <h4>${info.icon || '📦'} ${StringUtils.escapeHtml(node.title)}</h4>
                <div class="property-group">
                    <label class="property-label">${t('nodes.nodeName')}</label>
                    <input class="property-input" id="prop_nodeTitle" type="text" value="${StringUtils.escapeHtml(node.title || '')}">
                </div>
                <div class="property-group">
                    <label class="property-label">${t('nodes.nodeDescription')}</label>
                    <textarea class="property-textarea" id="prop_nodeDescription" title="${StringUtils.escapeHtml(node.description || '')}">${StringUtils.escapeHtml(node.description || '')}</textarea>
                </div>
                <div class="property-group">
                    <label class="property-label">${t('nodes.type')}</label>
                    <div class="property-tag">${StringUtils.escapeHtml(node.type)}</div>
                </div>
                ${paramsHtml ? `
                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4>${t('nodes.nodeConfig')}</h4>
                ${paramsHtml}` : ''}

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.input')}
                    <button class="btn btn-sm" onclick="workflowUI.node.addInputParam('${StringUtils.escapeHtml(node.id)}')">+ ${t('nodes.add')}</button>
                </h4>
                <div id="inputParamsList">
                    ${this.renderInputOutputParams(node.inputParams || [], 'input')}
                </div>

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.output')}
                    <button class="btn btn-sm" onclick="workflowUI.node.addOutputParam('${StringUtils.escapeHtml(node.id)}')">+ ${t('nodes.add')}</button>
                </h4>
                <div id="outputParamsList">
                    ${this.renderInputOutputParams(node.outputParams || [], 'output')}
                </div>

                <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="workflowUI.node.saveNodeDetail('${StringUtils.escapeHtml(node.id)}')">${t('nodes.saveChanges')}</button>
                    <button class="btn btn-danger" onclick="workflowUI.deleteNode('${StringUtils.escapeHtml(node.id)}')">${t('nodes.deleteNode')}</button>
                </div>
            </div>
        `;
    }

    openEditor(nodeId) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        let paramsHtml = '';
        params.forEach(param => {
            const value = node.parameters?.[param.name] ?? param.defaultValue;
            paramsHtml += this.renderParamInput(param, value);
        });
        
        const modal = document.createElement('div');
        modal.className = 'node-editor-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content node-editor-content">
                <div class="modal-header">
                    <h3>${info.icon || '📦'} ${t('nodes.editNode')}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <h4>${t('nodes.basicInfo')}</h4>
                        <div class="form-group">
                            <label>${t('nodes.nodeTitle')}</label>
                            <input type="text" class="form-input" id="editTitle" value="${StringUtils.escapeHtml(node.title)}">
                        </div>
                        <div class="form-group">
                            <label>${t('nodes.nodeDescription')}</label>
                            <textarea class="form-textarea" id="editDescription">${StringUtils.escapeHtml(node.description || '')}</textarea>
                        </div>
                    </div>
                    ${params.length > 0 ? `
                    <div class="form-section">
                        <h4>${t('nodes.paramsConfig')}</h4>
                        ${paramsHtml}
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">${t('nodes.cancel')}</button>
                    <button class="btn btn-primary" onclick="workflowUI.saveNodeEdit('${StringUtils.escapeHtml(nodeId)}')">${t('nodes.save')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    renderParamInput(param, value) {
        const required = param.required ? '<span class="required">*</span>' : '';
        let displayValue = value;
        if (param.type === 'json' && typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
        }
        const safeValue = StringUtils.escapeHtml(String(displayValue ?? ''));
        let inputHtml = '';
        
        switch (param.type) {
            case 'select':
                let dynSelectOptions = (param.options || []).map(opt => {
                    if (typeof opt === 'object') {
                        return { val: String(opt.value ?? opt), label: String(opt.label ?? opt.value ?? opt) };
                    }
                    return { val: String(opt), label: String(opt) };
                });
                const dynHasMatch = dynSelectOptions.some(o => o.val === String(value ?? ''));
                if (!dynHasMatch && value !== undefined && value !== null && String(value).trim() !== '') {
                    dynSelectOptions.unshift({ val: String(value), label: String(value) });
                }
                const dynOptionsHtml = dynSelectOptions.map(o => 
                    `<option value="${StringUtils.escapeHtml(o.val)}" ${o.val === String(value ?? '') ? 'selected' : ''}>${StringUtils.escapeHtml(o.label)}</option>`
                ).join('');
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <select class="form-select" id="param_${param.name}">${dynOptionsHtml}</select>
                    </div>
                `;
                break;
                
            case 'number':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <input type="number" class="form-input" id="param_${param.name}" 
                               value="${safeValue}" min="${param.min}" max="${param.max}" step="${param.step || 1}">
                    </div>
                `;
                break;
                
            case 'textarea':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea" id="param_${param.name}">${safeValue}</textarea>
                    </div>
                `;
                break;
                
            case 'json':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea form-textarea-code" id="param_${param.name}" placeholder="{}">${safeValue}</textarea>
                    </div>
                `;
                break;
                
            case 'code':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea form-textarea-code" rows="8" id="param_${param.name}">${safeValue}</textarea>
                    </div>
                `;
                break;
                
            default:
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <input type="text" class="form-input" id="param_${param.name}" value="${safeValue}">
                    </div>
                `;
        }
        
        return inputHtml;
    }

    saveEdit(nodeId) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const title = document.getElementById('editTitle').value;
        const description = document.getElementById('editDescription').value;
        
        if (title) {
            node.title = title;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-title`);
            if (el) el.textContent = title;
        }
        
        node.description = description;
        const descEl = document.querySelector(`[data-node-id="${nodeId}"] .node-description`);
        if (descEl) descEl.textContent = description;
        
        // 保存参数配置
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        if (!node.parameters) {
            node.parameters = {};
        }
        
        params.forEach(param => {
            const input = document.getElementById(`param_${param.name}`);
            if (input) {
                let value = input.value;
                
                if (param.type === 'number') {
                    value = parseFloat(value);
                } else if (param.type === 'json') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        value = input.value;
                    }
                }
                
                node.parameters[param.name] = value;
            }
        });
        
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            node.width = rect.width;
            node.height = rect.height;
        }
        
        this.ui.updateEdges();
        
        document.querySelector('.node-editor-modal').remove();
        
        if (this.core.selectedNode === nodeId) {
            this.renderPropertyPanel(node);
        }
        
        this.core.saveHistory(t('actions.editNode'));
    }

    renderInputOutputParams(paramsList, prefix) {
        if (!paramsList || paramsList.length === 0) {
            return `<p style="color: var(--text-secondary); font-size: 0.8rem; padding: 0.5rem 0;">${t('properties.noParams')}</p>`;
        }
        const isInput = prefix === 'input';
        return paramsList.map((p, i) => {
            const types = ['string', 'number', 'boolean', 'object', 'array'];
            const typeOpts = types.map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`).join('');
            const requiredCheck = isInput ? `
                <div class="param-field">
                    <label class="param-label">${t('properties.required')}</label>
                    <input type="checkbox" id="${prefix}Required_${i}" ${p.required ? 'checked' : ''}>
                </div>
            ` : '';
            return `<div class="param-card" id="${prefix}Card_${i}">
                <div class="param-card-header">
                    <span class="param-card-title">${t('nodes.parameter', { index: i + 1 })}</span>
                    <button class="btn btn-danger btn-sm" onclick="workflowUI.node.removeParam('${prefix}', ${i})">${t('nodes.remove')}</button>
                </div>
                <div class="param-card-row">
                    <div class="param-field">
                        <label class="param-label">${t('nodes.paramName')}</label>
                        <input class="param-input" id="${prefix}Name_${i}" type="text" placeholder="${t('common.paramName')}" value="${StringUtils.escapeHtml(p.name || '')}">
                    </div>
                    <div class="param-field">
                        <label class="param-label">${t('nodes.paramType')}</label>
                        <select class="param-select" id="${prefix}Type_${i}">${typeOpts}</select>
                    </div>
                </div>
                <div class="param-card-row">
                    <div class="param-field">
                        <label class="param-label">${t('nodes.defaultValue')}</label>
                        <input class="param-input" id="${prefix}Value_${i}" type="text" placeholder="${t('properties.defaultValue')}" value="${StringUtils.escapeHtml(String(p.value ?? ''))}">
                    </div>
                    ${requiredCheck}
                </div>
                <div class="param-field">
                    <label class="param-label">${t('nodes.paramDescription')}</label>
                    <textarea class="param-textarea" id="${prefix}Desc_${i}" placeholder="${t('nodes.paramDescription')}" title="${StringUtils.escapeHtml(p.description || '')}">${StringUtils.escapeHtml(p.description || '')}</textarea>
                </div>
            </div>`;
        }).join('');
    }

    addInputParam(nodeId) {
        try {
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;
            if (!node.inputParams) node.inputParams = [];
            node.inputParams.push({ name: '', type: 'string', value: '', required: false, description: '' });
            this.renderPropertyPanel(node);
        } catch (e) {}
    }

    addOutputParam(nodeId) {
        try {
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;
            if (!node.outputParams) node.outputParams = [];
            node.outputParams.push({ name: '', type: 'string', value: '', description: '' });
            this.renderPropertyPanel(node);
        } catch (e) {}
    }

    removeParam(prefix, index) {
        try {
            const selectedNode = this.core.selectedNode;
            if (!selectedNode) return;
            const node = this.core.nodes.find(n => n.id === selectedNode);
            if (!node) return;
            if (prefix === 'input' && node.inputParams) {
                node.inputParams.splice(index, 1);
            } else if (prefix === 'output' && node.outputParams) {
                node.outputParams.splice(index, 1);
            }
            this.renderPropertyPanel(node);
        } catch (e) {}
    }

    saveNodeDetail(nodeId) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const titleEl = document.getElementById('prop_nodeTitle');
        const descEl = document.getElementById('prop_nodeDescription');
        
        if (titleEl && titleEl.value) {
            node.title = titleEl.value;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-title`);
            if (el) el.textContent = titleEl.value;
        }
        
        if (descEl) {
            node.description = descEl.value;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-description`);
            if (el) el.textContent = descEl.value;
        }
        
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        if (!node.parameters) {
            node.parameters = {};
        }
        
        params.forEach(param => {
            const input = document.getElementById(`prop_${param.name}`);
            if (input) {
                let value;
                if (param.type === 'boolean') {
                    value = input.checked;
                } else if (param.type === 'number') {
                    value = parseFloat(input.value);
                } else if (param.type === 'json') {
                    try {
                        value = JSON.parse(input.value);
                    } catch {
                        value = input.value;
                    }
                } else {
                    value = input.value;
                }
                node.parameters[param.name] = value;
            }
        });

        // 保存入参
        this.saveDynamicParams(node, 'input');
        // 保存出参
        this.saveDynamicParams(node, 'output');
        
        this.ui.updateEdges();
        this.core.saveHistory(t('actions.editNode'));
        this.ui.showMessage(t('actions.nodeSaved'), 'success');
    }

    saveDynamicParams(node, prefix) {
        const key = prefix === 'input' ? 'inputParams' : 'outputParams';
        const params = (node[key] || []).map((p, i) => {
            const nameEl = document.getElementById(`${prefix}Name_${i}`);
            const typeEl = document.getElementById(`${prefix}Type_${i}`);
            const valueEl = document.getElementById(`${prefix}Value_${i}`);
            const descEl = document.getElementById(`${prefix}Desc_${i}`);
            const reqEl = document.getElementById(`${prefix}Required_${i}`);
            
            const result = {
                name: nameEl ? nameEl.value.trim() : p.name,
                type: typeEl ? typeEl.value : p.type,
                value: valueEl ? valueEl.value : (p.value || ''),
                description: descEl ? descEl.value : (p.description || '')
            };
            // 保留原始的 valueType 和 rawMeta，防止参数继承丢失
            if (p.valueType !== undefined) {
                result.valueType = p.valueType;
            }
            if (p.rawMeta !== undefined) {
                result.rawMeta = p.rawMeta;
            }
            if (prefix === 'input' && reqEl) {
                result.required = reqEl.checked;
            } else if (prefix === 'input') {
                result.required = p.required || false;
            }
            return result;
        }).filter(p => p.name); // 过滤掉空名称
        node[key] = params;
    }
}