/**
 * 工作流节点属性面板模块
 * 负责属性面板渲染、节点编辑器、参数表单等
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 属性面板相关的 mixin 方法
 * @param {import('./workflow-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export function mixinNodePanel(node) {
    node.renderPropertyPanel = function(targetNode) {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        const selectedCount = selectedNodes.length + selectedEdges.length;

        if (selectedCount !== 1 || !targetNode) {
            this.ui.showSummaryPanel();
            return;
        }

        if (!targetNode.outputParams || targetNode.outputParams.length === 0) {
            if (targetNode.parameters?.node_outputs && typeof targetNode.parameters.node_outputs === 'object') {
                targetNode.outputParams = this._paramsFromNodeOutputs(targetNode.parameters.node_outputs);
            }
        }
        if (!targetNode.inputParams || targetNode.inputParams.length === 0) {
            if (targetNode.parameters?.node_inputs && typeof targetNode.parameters.node_inputs === 'object') {
                targetNode.inputParams = this._paramsFromNodeOutputs(targetNode.parameters.node_inputs);
            }
        }

        const info = this.core.nodeTypeInfo[targetNode.type] || {};
        const params = info.parameters || [];

        let paramsHtml = '';
        params.forEach(param => {
            const value = targetNode.parameters?.[param.name] ?? param.defaultValue;
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
                <h4>${info.icon || '📦'} ${StringUtils.escapeHtml(targetNode.title)}</h4>
                <div class="property-group">
                    <label class="property-label">${t('nodes.nodeName')}</label>
                    <input class="property-input" id="prop_nodeTitle" type="text" value="${StringUtils.escapeHtml(targetNode.title || '')}">
                </div>
                <div class="property-group">
                    <label class="property-label">${t('nodes.nodeDescription')}</label>
                    <textarea class="property-textarea" id="prop_nodeDescription" title="${StringUtils.escapeHtml(targetNode.description || '')}">${StringUtils.escapeHtml(targetNode.description || '')}</textarea>
                </div>
                <div class="property-group">
                    <label class="property-label">${t('nodes.type')}</label>
                    <div class="property-tag">${StringUtils.escapeHtml(targetNode.type)}</div>
                </div>
                ${paramsHtml ? `
                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4>${t('nodes.nodeConfig')}</h4>
                ${paramsHtml}` : ''}

                ${this.renderMergeGroups(targetNode)}

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.input')}
                    <button class="btn btn-sm" onclick="workflowUI.node.addInputParam('${StringUtils.escapeHtml(targetNode.id)}')">+ ${t('nodes.add')}</button>
                </h4>
                <div id="inputParamsList">
                    ${this.renderInputOutputParams(targetNode.inputParams || [], 'input', targetNode.id)}
                </div>

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.output')}
                    <button class="btn btn-sm" onclick="workflowUI.node.addOutputParam('${StringUtils.escapeHtml(targetNode.id)}')">+ ${t('nodes.add')}</button>
                </h4>
                <div id="outputParamsList">
                    ${this.renderInputOutputParams(targetNode.outputParams || [], 'output', targetNode.id)}
                </div>

                <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="workflowUI.node.saveNodeDetail('${StringUtils.escapeHtml(targetNode.id)}')">${t('nodes.saveChanges')}</button>
                    <button class="btn btn-danger" onclick="workflowUI.deleteNode('${StringUtils.escapeHtml(targetNode.id)}')">${t('nodes.deleteNode')}</button>
                </div>
            </div>
        `;
    };

    node.openEditor = function(nodeId) {
        const targetNode = this.core.nodes.find(n => n.id === nodeId);
        if (!targetNode) return;

        const info = this.core.nodeTypeInfo[targetNode.type] || {};
        const params = info.parameters || [];

        let paramsHtml = '';
        params.forEach(param => {
            const value = targetNode.parameters?.[param.name] ?? param.defaultValue;
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
                            <input type="text" class="form-input" id="editTitle" value="${StringUtils.escapeHtml(targetNode.title)}">
                        </div>
                        <div class="form-group">
                            <label>${t('nodes.nodeDescription')}</label>
                            <textarea class="form-textarea" id="editDescription">${StringUtils.escapeHtml(targetNode.description || '')}</textarea>
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
    };

    node.renderParamInput = function(param, value) {
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
    };

    node.saveEdit = function(nodeId) {
        const targetNode = this.core.nodes.find(n => n.id === nodeId);
        if (!targetNode) return;

        const title = document.getElementById('editTitle').value;
        const description = document.getElementById('editDescription').value;

        if (title) {
            targetNode.title = title;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-title`);
            if (el) el.textContent = title;
        }

        targetNode.description = description;
        const descEl = document.querySelector(`[data-node-id="${nodeId}"] .node-description`);
        if (descEl) descEl.textContent = description;

        const info = this.core.nodeTypeInfo[targetNode.type] || {};
        const params = info.parameters || [];

        if (!targetNode.parameters) {
            targetNode.parameters = {};
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

                targetNode.parameters[param.name] = value;
            }
        });

        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            targetNode.width = rect.width;
            targetNode.height = rect.height;
        }

        this.ui.updateEdges();

        document.querySelector('.node-editor-modal').remove();

        if (this.core.selectedNode === nodeId) {
            this.renderPropertyPanel(targetNode);
        }

        this.core.saveHistory(t('actions.editNode'));
    };

    node.renderInputOutputParams = function(paramsList, prefix, nodeId) {
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
                    <button class="btn btn-danger btn-sm" onclick="workflowUI.node.removeParam('${StringUtils.escapeHtml(nodeId)}', '${prefix}', ${i})">${t('nodes.remove')}</button>
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
    };

    node._getRefDisplayText = function(blockId, name) {
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
    };

    node._paramsFromNodeOutputs = function(outputsMap) {
        return Object.entries(outputsMap).map(([name, def]) => ({
            name,
            type: def.type || 'string',
            description: def.description || '',
            required: def.required || false,
            value: ''
        }));
    };

    node._paramsToNodeOutputs = function(paramsArr) {
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
    };

    node.renderMergeGroups = function(targetNode) {
        const mergeGroups = targetNode.parameters?.mergeGroups;
        if (targetNode.type !== 'variable_merge' || !mergeGroups || !Array.isArray(mergeGroups) || mergeGroups.length === 0) {
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
                    <button class="btn btn-sm" onclick="workflowUI.node.addMergeVariable('${targetNode.id}', ${gi})">+ ${t('nodes.add')}</button>
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
                                    onclick="workflowUI.node.openVariableSelector('${targetNode.id}', ${gi}, ${vi})">
                                ${StringUtils.escapeHtml(display)}
                            </button>
                            <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem;" 
                                    onclick="workflowUI.node.removeMergeVariable('${targetNode.id}', ${gi}, ${vi})">×</button>
                            <span style="color: var(--text-secondary); font-size: 0.75rem; background: var(--bg-secondary); padding: 0.1rem 0.4rem; border-radius: 3px;">${StringUtils.escapeHtml(v.type || 'string')}</span>
                        </div>`;
                    });
                }
            }
            html += '</div>';
        });

        return html;
    };

    node.addInputParam = function(nodeId) {
        try {
            const targetNode = this.core.nodes.find(n => n.id === nodeId);
            if (!targetNode) return;
            if (!targetNode.inputParams) targetNode.inputParams = [];
            targetNode.inputParams.push({ name: '', type: 'string', value: '', required: false, description: '' });
            this.renderPropertyPanel(targetNode);
        } catch (e) {}
    };

    node.addOutputParam = function(nodeId) {
        try {
            const targetNode = this.core.nodes.find(n => n.id === nodeId);
            if (!targetNode) return;
            if (!targetNode.outputParams) targetNode.outputParams = [];
            targetNode.outputParams.push({ name: '', type: 'string', value: '', description: '' });
            this.renderPropertyPanel(targetNode);
        } catch (e) {}
    };

    node.removeParam = function(nodeId, prefix, index) {
        try {
            const targetNode = this.core.nodes.find(n => n.id === nodeId);
            if (!targetNode) return;
            if (prefix === 'input' && targetNode.inputParams) {
                targetNode.inputParams.splice(index, 1);
            } else if (prefix === 'output' && targetNode.outputParams) {
                targetNode.outputParams.splice(index, 1);
            }
            this.renderPropertyPanel(targetNode);
        } catch (e) {}
    };

    node.saveNodeDetail = function(nodeId) {
        const targetNode = this.core.nodes.find(n => n.id === nodeId);
        if (!targetNode) return;

        const titleEl = document.getElementById('prop_nodeTitle');
        const descEl = document.getElementById('prop_nodeDescription');

        if (titleEl && titleEl.value) {
            targetNode.title = titleEl.value;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-title`);
            if (el) el.textContent = titleEl.value;
        }

        if (descEl) {
            targetNode.description = descEl.value;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-description`);
            if (el) el.textContent = descEl.value;
        }

        const info = this.core.nodeTypeInfo[targetNode.type] || {};
        const params = info.parameters || [];

        if (!targetNode.parameters) {
            targetNode.parameters = {};
        }

        params.forEach(param => {
            if (!Object.prototype.hasOwnProperty.call(targetNode.parameters, param.name)) {
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
                targetNode.parameters[param.name] = value;
            }
        });

        this.saveDynamicParams(targetNode, 'input');
        this.saveDynamicParams(targetNode, 'output');
        this.saveMergeGroupVars(targetNode);

        this.ui.updateEdges();
        this.core.saveHistory(t('actions.editNode'));
        this.ui.showMessage(t('actions.nodeSaved'), 'success');
    };

    node.saveDynamicParams = function(targetNode, prefix) {
        const key = prefix === 'input' ? 'inputParams' : 'outputParams';
        const params = (targetNode[key] || []).map((p, i) => {
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
            if (p.valueType !== undefined) {
                result.valueType = p.valueType;
            } else if (value && typeof value === 'object' && value.type === 'ref') {
                result.valueType = 'ref';
            }
            if (p.rawMeta !== undefined) {
                result.rawMeta = p.rawMeta;
            } else if (value && typeof value === 'object' && value.type === 'ref' && value.rawMeta) {
                result.rawMeta = value.rawMeta;
            }
            if (prefix === 'input' && reqEl) {
                result.required = reqEl.checked;
            } else if (prefix === 'input') {
                result.required = p.required || false;
            }
            return result;
        }).filter(p => p.name);
        targetNode[key] = params;
        const paramKey = prefix === 'input' ? 'node_inputs' : 'node_outputs';
        targetNode.parameters = targetNode.parameters || {};
        if (params.length > 0) {
            targetNode.parameters[paramKey] = this._paramsToNodeOutputs(params);
        } else {
            delete targetNode.parameters[paramKey];
        }
    };

    node.saveMergeGroupVars = function(targetNode) {
        const mergeGroups = targetNode.parameters?.mergeGroups;
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
            targetNode.parameters.mergeGroups = mergeGroups;
            mergeGroups.forEach((group) => {
                if (group.variables && Array.isArray(group.variables)) {
                    group.variables.forEach((v) => {
                        const blockId = v.value?.content?.blockID;
                        const outputName = v.value?.content?.name;
                        if (blockId && outputName) {
                            const edge = this.core.edges.find(e =>
                                e.target === targetNode.id && e.source === blockId
                            );
                            if (edge) {
                                edge.sourcePort = outputName;
                            }
                        }
                    });
                }
            });
        }
    };
}