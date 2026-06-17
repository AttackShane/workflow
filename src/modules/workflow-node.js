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
        
        let outputPointsHtml = '';
        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            options.forEach((opt, i) => {
                const name = typeof opt === 'string' ? opt : (opt.name || opt);
                outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="branch_${i}" title="${StringUtils.escapeHtml(name)}"></div>`;
            });
            outputPointsHtml += `<div class="connection-point output branch-port" data-port-id="default" title="其他"></div>`;
        } else if (info.hasOutput) {
            outputPointsHtml = '<div class="connection-point output"></div>';
        }
        
        el.innerHTML = `
            <div class="node-header">
                <div class="node-icon">${info.icon}</div>
                <div class="node-title">${StringUtils.escapeHtml(nodeData.title)}</div>
                <div class="node-type">${StringUtils.escapeHtml(nodeData.type)}</div>
            </div>
            <div class="node-description">${StringUtils.escapeHtml(nodeData.description)}</div>
            ${inputPoint}
            ${outputPointsHtml}
        `;
        
        el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener('dblclick', () => this.openEditor(nodeData.id));
        
        const outputPoints = el.querySelectorAll('.connection-point.output');
        outputPoints.forEach(point => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const portId = point.dataset.portId || '';
                this.ui.startConnection(nodeData.id, e, portId);
            });
        });
        
        const inputPoints = el.querySelectorAll('.connection-point.input');
        inputPoints.forEach(point => {
            point.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (this.ui.connectingFrom && this.ui.connectingFrom !== nodeData.id) {
                    const edge = this.core.createEdge(this.ui.connectingFrom, nodeData.id, this.ui.connectingFromPort);
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
        
        if (nodeData.type === 'question' && nodeData.parameters?.options) {
            const options = Array.isArray(nodeData.parameters.options) ? nodeData.parameters.options : [];
            const totalPorts = options.length + 1;
            const branchPorts = el.querySelectorAll('.branch-port');
            branchPorts.forEach((port, i) => {
                port.style.top = (nodeData.height * (i + 0.5) / totalPorts) + 'px';
                port.style.transform = 'translateY(-50%)';
            });
        }
        
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
        
        const preSelectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = preSelectedNodes.length > 1;
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
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length > 1) {
                this.ui.isMultiSelectMode = true;
                this.ui.showSummaryPanel();
            } else {
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(el.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === el.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
            }
        } else if (!this.ui.isMultiSelectMode && !ctrlPressed && !hasMultipleSelected) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
            el.classList.add('selected');
            this.ui.isMultiSelectMode = false;
            this.core.selectNode(el.dataset.nodeId);
            const node = this.core.nodes.find(n => n.id === el.dataset.nodeId);
            if (node) this.renderPropertyPanel(node);
        } else if (ctrlPressed && (this.ui.isMultiSelectMode || hasMultipleSelected)) {
            if (!isAlreadySelected) {
                el.classList.add('selected');
            }
            this.ui.isMultiSelectMode = true;
            this.ui.showSummaryPanel();
        } else {
            if (!isAlreadySelected && (hasMultipleSelected || this.ui.isMultiSelectMode)) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(el.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === el.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
            }
            el.classList.add('selected');
        }
        
        this.ui.align.updateAlignToolbar();
        
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
                
                for (const nodeEl of selectedNodeEls) {
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
            
            selectedNodeEls.forEach(nodeEl => {
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
        const hasMultipleSelected = selectedNodes.length > 1;
        const clickedNode = e.target.closest('.canvas-node');
        
        if (!e.ctrlKey && !e.metaKey && (this.ui.isMultiSelectMode || hasMultipleSelected)) {
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
                this.ui.align.updateAlignToolbar();
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
        this.ui.align.updateAlignToolbar();
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
        
        // 从 parameters.node_outputs 同步到 node.outputParams（兼容剪贴板导入）
        if (!node.outputParams || node.outputParams.length === 0) {
            if (node.parameters?.node_outputs && typeof node.parameters.node_outputs === 'object') {
                node.outputParams = this._paramsFromNodeOutputs(node.parameters.node_outputs);
            }
        }
        if (!node.inputParams || node.inputParams.length === 0) {
            if (node.parameters?.node_inputs && typeof node.parameters.node_inputs === 'object') {
                node.inputParams = this._paramsFromNodeOutputs(node.parameters.node_inputs);
            }
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

                ${this.renderMergeGroups(node)}

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

            const isRef = p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
            const refJson = isRef ? encodeURIComponent(JSON.stringify(p.value)) : '';
            const refBlockId = isRef ? (p.value.content?.blockID || '') : '';
            const refName = isRef ? (p.value.content?.name || '') : '';
            const refDisplay = isRef ? this._getRefDisplayText(refBlockId, refName) : '';
            const literalValue = isRef ? '' : StringUtils.escapeHtml(String(p.value ?? ''));

            const valueFieldHtml = isInput ? `
                <div class="param-field" style="flex: 1;">
                    <label class="param-label">${t('nodes.defaultValue')}</label>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <input class="param-input" id="${prefix}Value_${i}" type="text" 
                               placeholder="${t('properties.defaultValue')}" 
                               value="${literalValue}"
                               style="flex:1; ${isRef ? 'display:none;' : ''}"
                               ${isRef ? 'disabled' : ''}>
                        <span id="${prefix}RefDisplay_${i}" 
                              style="flex:1; display:${isRef ? 'block' : 'none'}; padding: 0.3rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 4px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                              onclick="workflowUI.node.openInputParamRefSelector('${prefix}', ${i})"
                              title="${StringUtils.escapeHtml(refDisplay)}">${StringUtils.escapeHtml(refDisplay)}</span>
                        <input type="hidden" id="${prefix}Ref_${i}" value="${refJson}">
                        <button class="btn btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.node.openInputParamRefSelector('${prefix}', ${i})" 
                                title="选择引用">🔗</button>
                        ${isRef ? `<button class="btn btn-sm btn-danger" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.node.clearInputParamRef('${prefix}', ${i})" 
                                title="清除引用">×</button>` : ''}
                    </div>
                </div>
            ` : `
                <div class="param-field">
                    <label class="param-label">${t('nodes.defaultValue')}</label>
                    <input class="param-input" id="${prefix}Value_${i}" type="text" placeholder="${t('properties.defaultValue')}" value="${StringUtils.escapeHtml(String(p.value ?? ''))}">
                </div>`;

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
                    ${valueFieldHtml}
                    ${requiredCheck}
                </div>
                <div class="param-field">
                    <label class="param-label">${t('nodes.paramDescription')}</label>
                    <textarea class="param-textarea" id="${prefix}Desc_${i}" placeholder="${t('nodes.paramDescription')}" title="${StringUtils.escapeHtml(p.description || '')}">${StringUtils.escapeHtml(p.description || '')}</textarea>
                </div>
            </div>`;
        }).join('');
    }

    _getRefDisplayText(blockId, name) {
        if (!blockId) return name || 'output';
        const resolveNode = (id) => {
            let target = this.core.nodes.find(n => n.id === id);
            if (target) return target;
            const shortId = id.replace('node_', '');
            target = this.core.nodes.find(n => n.id === shortId || n.id.replace('node_', '') === shortId);
            return target;
        };
        const srcNode = resolveNode(blockId);
        if (!srcNode) return `${blockId} → ${name || 'output'}`;
        return `${srcNode.title || srcNode.id} → ${name || 'output'}`;
    }

    /**
     * 将 {name: {type, description, required}} 格式转为 outputParams 数组格式
     */
    _paramsFromNodeOutputs(outputsMap) {
        return Object.entries(outputsMap).map(([name, def]) => ({
            name,
            type: def.type || 'string',
            description: def.description || '',
            required: def.required || false,
            value: ''
        }));
    }

    /**
     * 将 outputParams 数组格式转回 {name: {type, description, required}} 格式
     */
    _paramsToNodeOutputs(paramsArr) {
        const result = {};
        paramsArr.forEach(p => {
            if (p.name) {
                result[p.name] = {
                    type: p.type || 'string',
                    description: p.description || '',
                    required: p.required || false
                };
            }
        });
        return result;
    }

    openInputParamRefSelector(prefix, index) {
        const selectedNode = this.core.selectedNode;
        if (!selectedNode) return;
        const node = this.core.nodes.find(n => n.id === selectedNode);
        if (!node) return;

        const refEl = document.getElementById(`${prefix}Ref_${index}`);
        let currentBlockId = '';
        let currentName = '';

        if (refEl && refEl.value) {
            try {
                const ref = JSON.parse(decodeURIComponent(refEl.value));
                currentBlockId = ref.content?.blockID || '';
                currentName = ref.content?.name || '';
            } catch (e) {
                try {
                    const ref = JSON.parse(refEl.value);
                    currentBlockId = ref.content?.blockID || '';
                    currentName = ref.content?.name || '';
                } catch (e2) {}
            }
        }

        this._openGenericVariableSelector(selectedNode, currentBlockId, currentName, (blockId, outputPath) => {
            const valueEl = document.getElementById(`${prefix}Value_${index}`);
            const refDisplayEl = document.getElementById(`${prefix}RefDisplay_${index}`);
            const refHiddenEl = document.getElementById(`${prefix}Ref_${index}`);

            const refObj = {
                type: 'ref',
                content: {
                    source: 'block-output',
                    blockID: blockId,
                    name: outputPath
                },
                rawMeta: { type: 1 }
            };

            if (refHiddenEl) {
                refHiddenEl.value = encodeURIComponent(JSON.stringify(refObj));
            }
            if (valueEl) {
                valueEl.style.display = 'none';
                valueEl.disabled = true;
            }
            if (refDisplayEl) {
                const display = this._getRefDisplayText(blockId, outputPath);
                refDisplayEl.textContent = display;
                refDisplayEl.style.display = 'block';
                refDisplayEl.title = display;
            }
        });
    }

    clearInputParamRef(prefix, index) {
        const valueEl = document.getElementById(`${prefix}Value_${index}`);
        const refDisplayEl = document.getElementById(`${prefix}RefDisplay_${index}`);
        const refHiddenEl = document.getElementById(`${prefix}Ref_${index}`);

        if (refHiddenEl) refHiddenEl.value = '';
        if (valueEl) {
            valueEl.style.display = '';
            valueEl.disabled = false;
            valueEl.value = '';
        }
        if (refDisplayEl) {
            refDisplayEl.style.display = 'none';
            refDisplayEl.textContent = '';
        }
    }

    renderMergeGroups(node) {
        const mergeGroups = node.parameters?.mergeGroups;
        if (node.type !== 'variable_merge' || !mergeGroups || !Array.isArray(mergeGroups) || mergeGroups.length === 0) {
            return '';
        }

        const resolveNode = (blockId) => {
            let target = this.core.nodes.find(n => n.id === blockId);
            if (target) return target;
            const shortId = blockId.replace('node_', '');
            target = this.core.nodes.find(n => n.id === shortId || n.id.replace('node_', '') === shortId);
            return target;
        };

        const getDisplayRef = (v) => {
            const refBlockId = v.value?.content?.blockID || '';
            const refName = v.value?.content?.name || '';
            if (!refBlockId) return t('nodes.clickToSelect') || '点击选择';
            const srcNode = resolveNode(refBlockId);
            if (!srcNode) return `${refBlockId} → ${refName}`;
            return `${srcNode.title || srcNode.id} → ${refName || 'output'}`;
        };

        let html = '<hr style="margin: 0.75rem 0; border-color: var(--border);">';
        html += `<h4 style="display: flex; justify-content: space-between; align-items: center;">
            ${t('nodes.mergeGroups') || '聚合分组'}
        </h4>`;

        mergeGroups.forEach((group, gi) => {
            const groupName = group.name || `${t('nodes.group') || '分组'} ${gi + 1}`;
            html += `<div class="property-group" style="margin-bottom: 0.75rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">${StringUtils.escapeHtml(groupName)}</span>
                    <button class="btn btn-sm" onclick="workflowUI.node.addMergeVariable('${node.id}', ${gi})">+ ${t('nodes.add')}</button>
                </div>`;

            if (group.variables && Array.isArray(group.variables)) {
                if (group.variables.length === 0) {
                    html += `<p style="color: var(--text-secondary); font-size: 0.8rem;">${t('properties.noParams')}</p>`;
                } else {
                    group.variables.forEach((v, vi) => {
                        const display = getDisplayRef(v);
                        html += `<div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; font-size: 0.85rem;">
                            <span style="color: var(--text-secondary); min-width: 1.5rem;">${vi + 1}.</span>
                            <button class="btn" style="flex: 1; text-align: left; padding: 0.3rem 0.5rem; min-height: 28px;" 
                                    onclick="workflowUI.node.openVariableSelector('${node.id}', ${gi}, ${vi})">
                                ${StringUtils.escapeHtml(display)}
                            </button>
                            <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem;" 
                                    onclick="workflowUI.node.removeMergeVariable('${node.id}', ${gi}, ${vi})">×</button>
                            <span style="color: var(--text-secondary); font-size: 0.75rem; background: var(--bg-secondary); padding: 0.1rem 0.4rem; border-radius: 3px;">${StringUtils.escapeHtml(v.type || 'string')}</span>
                        </div>`;
                    });
                }
            }
            html += '</div>';
        });

        return html;
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

    addMergeVariable(nodeId, gi) {
        try {
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node || !node.parameters?.mergeGroups) return;
            const group = node.parameters.mergeGroups[gi];
            if (!group || !group.variables) return;
            group.variables.push({
                type: 'string',
                value: {
                    type: 'ref',
                    content: { source: 'block-output', blockID: '', name: 'output' },
                    rawMeta: { type: 1 }
                }
            });
            this.renderPropertyPanel(node);
        } catch (e) {}
    }

    removeMergeVariable(nodeId, gi, vi) {
        try {
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node || !node.parameters?.mergeGroups) return;
            const group = node.parameters.mergeGroups[gi];
            if (!group || !group.variables) return;
            group.variables.splice(vi, 1);
            this.renderPropertyPanel(node);
        } catch (e) {}
    }

    openVariableSelector(nodeId, gi, vi) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node || !node.parameters?.mergeGroups) return;
        const group = node.parameters.mergeGroups[gi];
        if (!group || !group.variables) return;
        const variable = group.variables[vi];
        if (!variable) return;

        const currentBlockId = variable.value?.content?.blockID || '';
        const currentName = variable.value?.content?.name || '';

        this._openGenericVariableSelector(nodeId, currentBlockId, currentName, (blockId, outputPath) => {
            variable.value.content.blockID = blockId;
            variable.value.content.name = outputPath;

            const edge = this.core.edges.find(e =>
                e.target === node.id && e.source === blockId
            );
            if (edge) {
                edge.sourcePort = outputPath;
            }

            this.renderPropertyPanel(node);
        });
    }

    _openGenericVariableSelector(excludeNodeId, currentBlockId, currentName, onConfirm) {
        const buildOutputTree = (outputs) => {
            const tree = [];
            if (!outputs || typeof outputs !== 'object') return tree;
            Object.entries(outputs).forEach(([name, meta]) => {
                const treeNode = {
                    name,
                    type: meta.type || 'string',
                    description: meta.description || '',
                    children: []
                };
                if (meta.properties && typeof meta.properties === 'object') {
                    if (Array.isArray(meta.properties)) {
                        treeNode.children = meta.properties.map(prop => ({
                            name: prop.name || prop,
                            type: prop.type || 'string',
                            description: prop.description || '',
                            children: []
                        }));
                    } else {
                        treeNode.children = buildOutputTree(meta.properties);
                    }
                }
                tree.push(treeNode);
            });
            return tree;
        };

        const renderTreeNode = (treeNode, path, depth) => {
            const fullPath = path ? `${path}.${treeNode.name}` : treeNode.name;
            const indent = '&nbsp;&nbsp;'.repeat(depth);
            const isSelected = (fullPath === currentName);
            const typeLabel = treeNode.type ? ` <span style="color:var(--text-secondary);font-size:0.75rem;">(${treeNode.type})</span>` : '';
            if (treeNode.children.length > 0) {
                let childHtml = treeNode.children.map(c => renderTreeNode(c, fullPath, depth + 1)).join('');
                return `<div class="tree-branch">
                    <div class="tree-item tree-folder ${isSelected ? 'tree-selected' : ''}" 
                         data-path="${StringUtils.escapeHtml(fullPath)}" 
                         style="padding-left:${depth * 16 + 8}px;">
                        <span class="tree-toggle">▶</span> ${indent}${StringUtils.escapeHtml(treeNode.name)}${typeLabel}
                    </div>
                    <div class="tree-children" style="display:none;">${childHtml}</div>
                </div>`;
            } else {
                return `<div class="tree-item tree-leaf ${isSelected ? 'tree-selected' : ''}" 
                         data-path="${StringUtils.escapeHtml(fullPath)}" 
                         style="padding-left:${depth * 16 + 8}px;">
                    ${indent}${StringUtils.escapeHtml(treeNode.name)}${typeLabel}
                </div>`;
            }
        };

        const availableNodes = this.core.nodes.filter(n => {
            if (n.id === excludeNodeId) return false;
            const outputs = n.parameters?.node_outputs;
            if (outputs && typeof outputs === 'object' && Object.keys(outputs).length > 0) return true;
            const outParams = n.outputParams || n.parameters?.outputParams;
            if (outParams && Array.isArray(outParams) && outParams.length > 0) return true;
            return false;
        });

        const modal = document.createElement('div');
        modal.className = 'variable-selector-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
            z-index: 1001; font-family: -apple-system, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-primary, #1e293b); border-radius: 12px; width: 700px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
                <div style="padding: 1rem; border-bottom: 1px solid var(--border, #334155); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; color: var(--text-primary); font-size: 1rem;">选择变量引用</h3>
                    <button onclick="this.closest('.variable-selector-modal').remove()" style="background:none;border:none;color:var(--text-secondary);font-size:1.5rem;cursor:pointer;">&times;</button>
                </div>
                <div style="display: flex; flex: 1; overflow: hidden;">
                    <div style="width: 240px; border-right: 1px solid var(--border); overflow-y: auto; padding: 0.5rem;">
                        <input type="text" id="varNodeSearch" placeholder="搜索节点..." style="width:100%;padding:0.4rem;margin-bottom:0.5rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
                        <div id="varNodeList">
                            ${availableNodes.map(n => {
                                const nId = n.id;
                                const nTitle = n.title || n.id;
                                const isCur = (nId === currentBlockId);
                                return `<div class="var-node-item ${isCur ? 'var-node-active' : ''}" 
                                    data-node-id="${StringUtils.escapeHtml(nId)}">
                                    <span class="var-node-title">${StringUtils.escapeHtml(nTitle)}</span>
                                    <span class="var-node-type">${StringUtils.escapeHtml(n.type)}</span>
                                </div>`;
                            }).join('')}
                            ${availableNodes.length === 0 ? '<p style="color:var(--text-secondary);font-size:0.8rem;padding:0.5rem;">没有可用的上游节点</p>' : ''}
                        </div>
                    </div>
                    <div style="flex:1; overflow-y: auto; padding: 0.5rem;">
                        <div style="color:var(--text-secondary);font-size:0.8rem;margin-bottom:0.5rem;">选择输出参数</div>
                        <div id="varOutputTree" style="font-size:0.85rem; color: var(--text-primary);">
                            <p style="color:var(--text-secondary);">请先选择左侧节点</p>
                        </div>
                    </div>
                </div>
                <div style="padding: 0.75rem; border-top: 1px solid var(--border); display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="this.closest('.variable-selector-modal').remove()">取消</button>
                    <button class="btn btn-primary" id="varConfirmBtn">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedNodeId = currentBlockId;
        let selectedPath = currentName;

        const nodeItems = modal.querySelectorAll('.var-node-item');
        const searchInput = modal.querySelector('#varNodeSearch');
        const outputTree = modal.querySelector('#varOutputTree');

        const updateOutputTree = (nId) => {
            const targetNode = this.core.nodes.find(n => n.id === nId);
            if (!targetNode) {
                outputTree.innerHTML = '<p style="color:var(--text-secondary);">该节点无输出参数</p>';
                return;
            }
            let outputs = targetNode.parameters?.node_outputs || {};
            let tree = buildOutputTree(outputs);
            if (tree.length === 0) {
                const outParams = targetNode.outputParams || targetNode.parameters?.outputParams;
                if (outParams && Array.isArray(outParams) && outParams.length > 0) {
                    tree = outParams.map(p => ({
                        name: p.name || p,
                        type: p.type || 'string',
                        description: p.description || '',
                        children: []
                    }));
                }
            }
            if (tree.length === 0) {
                outputTree.innerHTML = '<p style="color:var(--text-secondary);">该节点无输出参数</p>';
                return;
            }
            outputTree.innerHTML = tree.map(t => renderTreeNode(t, '', 0)).join('');

            outputTree.querySelectorAll('.tree-folder').forEach(folder => {
                folder.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const branch = folder.closest('.tree-branch');
                    const children = branch.querySelector('.tree-children');
                    const toggle = folder.querySelector('.tree-toggle');
                    if (children) {
                        const isOpen = children.style.display !== 'none';
                        children.style.display = isOpen ? 'none' : 'block';
                        toggle.textContent = isOpen ? '▶' : '▼';
                    }
                });
            });

            outputTree.querySelectorAll('.tree-leaf, .tree-folder').forEach(item => {
                item.addEventListener('click', (e) => {
                    const path = item.dataset.path;
                    if (path) {
                        selectedPath = path;
                        outputTree.querySelectorAll('.tree-selected').forEach(el => el.classList.remove('tree-selected'));
                        item.classList.add('tree-selected');
                    }
                });
            });
        };

        const selectNode = (nId) => {
            selectedNodeId = nId;
            nodeItems.forEach(item => {
                item.classList.toggle('var-node-active', item.dataset.nodeId === nId);
            });
            updateOutputTree(nId);
        };

        nodeItems.forEach(item => {
            item.addEventListener('click', () => selectNode(item.dataset.nodeId));
        });

        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            nodeItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(q) ? '' : 'none';
            });
        });

        if (currentBlockId) {
            updateOutputTree(currentBlockId);
        }

        modal.querySelector('#varConfirmBtn').addEventListener('click', () => {
            if (!selectedNodeId) {
                this.ui.showMessage('请选择一个节点', 'error');
                return;
            }
            if (!selectedPath) {
                this.ui.showMessage('请选择一个输出参数', 'error');
                return;
            }
            onConfirm(selectedNodeId, selectedPath);
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
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
            if (!Object.prototype.hasOwnProperty.call(node.parameters, param.name)) {
                return;
            }
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
        // 保存 mergeGroups 变量选择
        this.saveMergeGroupVars(node);
        
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
            const refEl = document.getElementById(`${prefix}Ref_${i}`);

            let value;
            if (refEl && refEl.value) {
                try {
                    value = JSON.parse(decodeURIComponent(refEl.value));
                } catch (e) {
                    try {
                        value = JSON.parse(refEl.value);
                    } catch (e2) {
                        value = valueEl ? valueEl.value : (p.value || '');
                    }
                }
            } else {
                value = valueEl ? valueEl.value : (p.value || '');
            }

            const result = {
                name: nameEl ? nameEl.value.trim() : p.name,
                type: typeEl ? typeEl.value : p.type,
                value,
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
        // 同步回 parameters.node_inputs / node_outputs 保持数据一致
        const paramKey = prefix === 'input' ? 'node_inputs' : 'node_outputs';
        node.parameters = node.parameters || {};
        if (params.length > 0) {
            node.parameters[paramKey] = this._paramsToNodeOutputs(params);
        } else {
            delete node.parameters[paramKey];
        }
    }

    saveMergeGroupVars(node) {
        const mergeGroups = node.parameters?.mergeGroups;
        if (!mergeGroups || !Array.isArray(mergeGroups)) return;

        let changed = false;
        mergeGroups.forEach((group, gi) => {
            if (group.variables && Array.isArray(group.variables)) {
                group.variables.forEach((v, vi) => {
                    const selectEl = document.getElementById(`mergeVar_${gi}_${vi}`);
                    if (selectEl && selectEl.value && v.value?.content) {
                        const newName = selectEl.value;
                        if (v.value.content.name !== newName) {
                            v.value.content.name = newName;
                            changed = true;
                        }
                    }
                });
            }
        });

        if (changed) {
            node.parameters.mergeGroups = mergeGroups;
            mergeGroups.forEach((group) => {
                if (group.variables && Array.isArray(group.variables)) {
                    group.variables.forEach((v) => {
                        const blockId = v.value?.content?.blockID;
                        const outputName = v.value?.content?.name;
                        if (blockId && outputName) {
                            const edge = this.core.edges.find(e =>
                                e.target === node.id && e.source === blockId
                            );
                            if (edge) {
                                edge.sourcePort = outputName;
                            }
                        }
                    });
                }
            });
        }
    }
}