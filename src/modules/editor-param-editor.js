/**
 * 工作流参数编辑器模块
 * 负责输入输出参数、合并组变量的编辑、保存逻辑
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 参数编辑相关的 mixin 方法
 * @param {object} node - WorkflowNode 实例
 */
export class WorkflowParamEditor {
    constructor(node) {
        this.node = node;
    }
    renderInputOutputParams(paramsList, prefix, nodeId) {
        if (!paramsList || paramsList.length === 0) {
            return `<p style="color: var(--text-secondary); font-size: 0.8rem; padding: 0.5rem 0;">${t('properties.noParams')}</p>`;
        }
        const isInput = prefix === 'input';
        return paramsList
            .map((p, i) => {
                const types = ['string', 'number', 'boolean', 'object', 'array'];
                const typeOpts = types
                    .map((t) => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`)
                    .join('');
                const requiredCheck = isInput
                    ? `
                <div class="param-field">
                    <label class="param-label">${t('properties.required')}</label>
                    <input type="checkbox" id="${prefix}Required_${i}" ${p.required ? 'checked' : ''}>
                </div>
            `
                    : '';

                const isRef =
                    p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
                const refJson = isRef ? encodeURIComponent(JSON.stringify(p.value)) : '';
                const refBlockId = isRef ? p.value.content?.blockID || '' : '';
                const refName = isRef ? p.value.content?.name || '' : '';
                const refDisplay = isRef ? this._getRefDisplayText(refBlockId, refName) : '';
                const literalValue = isRef ? '' : StringUtils.escapeHtml(String(p.value ?? ''));

                const valueFieldHtml = isInput
                    ? `
                <div class="param-field" style="flex: 1;">
                    <label class="param-label">${t('nodes.defaultValue')}</label>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <input class="param-input" id="${prefix}Value_${i}" type="text" 
                               placeholder="${t('properties.defaultValue')}" 
                               value="${literalValue}"
                               style="flex:1; ${isRef ? 'display:none;' : ''}"
                               ${isRef ? 'disabled' : ''}>
                        <span id="${prefix}RefDisplay_${i}" 
                              style="flex:1; display:${isRef ? 'block' : 'none'}; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                              onclick="workflowUI.openInputParamRefSelector('${prefix}', ${i})"
                              title="${StringUtils.escapeHtml(refDisplay)}">${StringUtils.escapeHtml(refDisplay)}</span>
                        <input type="hidden" id="${prefix}Ref_${i}" value="${refJson}">
                        <button class="btn btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.openInputParamRefSelector('${prefix}', ${i})" 
                                title="选择引用">🔗</button>
                        ${
                            isRef
                                ? `<button class="btn btn-sm btn-danger" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.clearInputParamRef('${prefix}', ${i})" 
                                title="清除引用">×</button>`
                                : ''
                        }
                    </div>
                </div>
            `
                    : `
                <div class="param-field" style="flex: 1;">
                    <label class="param-label">${t('nodes.defaultValue')}</label>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <input class="param-input" id="${prefix}Value_${i}" type="text" 
                               placeholder="${t('properties.defaultValue')}" 
                               value="${literalValue}"
                               style="flex:1; ${isRef ? 'display:none;' : ''}"
                               ${isRef ? 'disabled' : ''}>
                        <span id="${prefix}RefDisplay_${i}" 
                              style="flex:1; display:${isRef ? 'block' : 'none'}; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                              onclick="workflowUI.openInputParamRefSelector('${prefix}', ${i})"
                              title="${StringUtils.escapeHtml(refDisplay)}">${StringUtils.escapeHtml(refDisplay)}</span>
                        <input type="hidden" id="${prefix}Ref_${i}" value="${refJson}">
                        <button class="btn btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.openInputParamRefSelector('${prefix}', ${i})" 
                                title="选择引用">🔗</button>
                        ${
                            isRef
                                ? `<button class="btn btn-sm btn-danger" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                onclick="workflowUI.clearInputParamRef('${prefix}', ${i})" 
                                title="清除引用">×</button>`
                                : ''
                        }
                    </div>
                </div>`;

                return `<div class="param-card" id="${prefix}Card_${i}">
                <div class="param-card-header">
                    <span class="param-card-title">${t('nodes.parameter', { index: i + 1 })}</span>
                    <button class="btn btn-danger btn-sm" onclick="workflowUI.removeParam('${StringUtils.escapeHtml(nodeId)}', '${prefix}', ${i})">${t('nodes.remove')}</button>
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
            })
            .join('');
    }

    _getRefDisplayText(blockId, name) {
        if (!blockId) return name || 'output';
        const resolveNode = (id) => {
            let target = this.node.core.nodes.find((n) => n.id === id);
            if (target) return target;
            const shortId = id.replace('node_', '');
            target = this.node.core.nodes.find((n) => n.id === shortId || n.id.replace('node_', '') === shortId);
            return target;
        };
        const srcNode = resolveNode(blockId);
        if (!srcNode) return `${blockId} → ${name || 'output'}`;
        return `${srcNode.title || srcNode.id} → ${name || 'output'}`;
    }

    _paramsFromNodeOutputs(outputsMap) {
        return Object.entries(outputsMap).map(([name, def]) => {
            const directRef = def.value && typeof def.value === 'object' && def.value.type === 'ref';
            const inputRef =
                !directRef && def.input?.value && typeof def.input.value === 'object' && def.input.value.type === 'ref';
            return {
                name,
                type: def.type || 'string',
                description: def.description || '',
                required: def.required || false,
                value: directRef ? def.value : inputRef ? def.input.value : def.value || '',
                valueType: directRef || inputRef ? 'ref' : def.valueType || '',
                rawMeta: directRef
                    ? def.rawMeta || undefined
                    : inputRef
                      ? def.input.value.rawMeta || undefined
                      : undefined,
            };
        });
    }

    _paramsToNodeOutputs(paramsArr) {
        const result = {};
        paramsArr.forEach((p) => {
            if (p.name) {
                const entry = {
                    type: p.type || 'string',
                    description: p.description || '',
                    required: p.required || false,
                };
                if (p.value && typeof p.value === 'object' && p.value.type === 'ref') {
                    entry.value = p.value;
                    entry.input = {
                        type: p.type || 'string',
                        value: { ...p.value, ...(p.rawMeta && { rawMeta: p.rawMeta }) },
                    };
                }
                if (p.valueType) {
                    entry.valueType = p.valueType;
                }
                if (p.rawMeta) {
                    entry.rawMeta = p.rawMeta;
                }
                result[p.name] = entry;
            }
        });
        return result;
    }

    renderMergeGroups(targetNode) {
        const mergeGroups = targetNode.parameters?.mergeGroups;
        if (
            targetNode.type !== 'variable_merge' ||
            !mergeGroups ||
            !Array.isArray(mergeGroups) ||
            mergeGroups.length === 0
        ) {
            return '';
        }

        const resolveNode = (blockId) => {
            let target = this.node.core.nodes.find((n) => n.id === blockId);
            if (target) return target;
            const shortId = blockId.replace('node_', '');
            target = this.node.core.nodes.find((n) => n.id === shortId || n.id.replace('node_', '') === shortId);
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
                    <button class="btn btn-sm" onclick="workflowUI.addMergeVariable('${targetNode.id}', ${gi})">+ ${t('nodes.add')}</button>
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
                                    onclick="workflowUI.openVariableSelector('${targetNode.id}', ${gi}, ${vi})">
                                ${StringUtils.escapeHtml(display)}
                            </button>
                            <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem;" 
                                    onclick="workflowUI.removeMergeVariable('${targetNode.id}', ${gi}, ${vi})">×</button>
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
        const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
        if (!targetNode) return;
        if (!targetNode.inputParams) targetNode.inputParams = [];
        this.saveDynamicParams(targetNode, 'input');
        this.saveDynamicParams(targetNode, 'output');
        targetNode.inputParams.push({ name: '', type: 'string', value: '', required: false, description: '' });
        this.node.panel.renderPropertyPanel(targetNode);
    }

    addOutputParam(nodeId) {
        const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
        if (!targetNode) return;
        if (!targetNode.outputParams) targetNode.outputParams = [];
        this.saveDynamicParams(targetNode, 'input');
        this.saveDynamicParams(targetNode, 'output');
        targetNode.outputParams.push({ name: '', type: 'string', value: '', description: '' });
        this.node.panel.renderPropertyPanel(targetNode);
    }

    removeParam(nodeId, prefix, index) {
        const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
        if (!targetNode) return;
        this.saveDynamicParams(targetNode, 'input');
        this.saveDynamicParams(targetNode, 'output');
        if (prefix === 'input' && targetNode.inputParams) {
            targetNode.inputParams.splice(index, 1);
        } else if (prefix === 'output' && targetNode.outputParams) {
            targetNode.outputParams.splice(index, 1);
        }
        this.saveDynamicParams(targetNode, 'input');
        this.saveDynamicParams(targetNode, 'output');
        this.node.panel.renderPropertyPanel(targetNode);
        this.node.panel._scheduleAutoSave(nodeId);
    }

    saveDynamicParams(targetNode, prefix) {
        const key = prefix === 'input' ? 'inputParams' : 'outputParams';
        const params = (targetNode[key] || []).map((p, i) => {
            const nameEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`${prefix}Name_${i}`));
            const typeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(`${prefix}Type_${i}`));
            const valueEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`${prefix}Value_${i}`));
            const descEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`${prefix}Desc_${i}`));
            const reqEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`${prefix}Required_${i}`));
            const refEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`${prefix}Ref_${i}`));

            let value;
            if (refEl && refEl.value) {
                try {
                    value = JSON.parse(decodeURIComponent(refEl.value));
                } catch (e) {
                    try {
                        value = JSON.parse(refEl.value);
                    } catch (e2) {
                        value = valueEl ? valueEl.value : p.value || '';
                    }
                }
            } else {
                value = valueEl ? valueEl.value : p.value || '';
            }

            const valueIsRef = value && typeof value === 'object' && value.type === 'ref';
            const result = {
                name: nameEl ? nameEl.value.trim() : p.name,
                type: typeEl ? typeEl.value : p.type,
                value,
                description: descEl ? descEl.value : p.description || '',
                valueType: valueIsRef ? 'ref' : '',
                rawMeta: valueIsRef ? value.rawMeta || undefined : undefined,
            };
            if (prefix === 'input' && reqEl) {
                result.required = reqEl.checked;
            } else if (prefix === 'input') {
                result.required = p.required || false;
            }
            return result;
        });
        targetNode[key] = params;
        const paramKey = prefix === 'input' ? 'node_inputs' : 'node_outputs';
        targetNode.parameters = targetNode.parameters || {};
        const namedParams = params.filter((p) => p.name);
        if (namedParams.length > 0) {
            targetNode.parameters[paramKey] = this._paramsToNodeOutputs(namedParams);
        } else {
            delete targetNode.parameters[paramKey];
        }
    }

    saveMergeGroupVars(targetNode) {
        const mergeGroups = targetNode.parameters?.mergeGroups;
        if (!mergeGroups || !Array.isArray(mergeGroups)) return;

        let changed = false;
        mergeGroups.forEach((group, gi) => {
            if (group.variables && Array.isArray(group.variables)) {
                group.variables.forEach((v, vi) => {
                    const selectEl = /** @type {HTMLSelectElement|null} */ (
                        document.getElementById(`mergeVar_${gi}_${vi}`)
                    );
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
                            const edge = this.node.core.edges.find(
                                (e) => e.target === targetNode.id && e.source === blockId
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

    renderLoopVariables(targetNode) {
        const variables = targetNode.parameters?.variables;
        if (targetNode.type !== 'loop_set_variable' || !variables || !Array.isArray(variables)) {
            return '';
        }

        const resolveNode = (blockId) => {
            let target = this.node.core.nodes.find((n) => n.id === blockId);
            if (target) return target;
            const shortId = blockId.replace('node_', '');
            target = this.node.core.nodes.find((n) => n.id === shortId || n.id.replace('node_', '') === shortId);
            return target;
        };

        const getDisplayRef = (ref) => {
            const refBlockId = ref?.value?.content?.blockID || '';
            const refName = ref?.value?.content?.name || '';
            const isRef = ref?.value?.type === 'ref';
            if (isRef && refBlockId) {
                const srcNode = resolveNode(refBlockId);
                if (!srcNode) return `${refBlockId} → ${refName}`;
                return `${srcNode.title || srcNode.id} → ${refName || 'output'}`;
            }
            if (!isRef && ref?.value?.content !== undefined && ref?.value?.content !== null) {
                return String(ref.value.content);
            }
            return t('nodes.clickToSelect') || '点击选择';
        };

        let html = '<hr style="margin: 0.75rem 0; border-color: var(--border);">';
        html += `<h4 style="display: flex; justify-content: space-between; align-items: center;">
            ${t('nodes.variables') || '变量设置'}
            <button class="btn btn-sm" onclick="workflowUI.addLoopVariable('${targetNode.id}')">+ ${t('nodes.add')}</button>
        </h4>`;

        if (variables.length === 0) {
            html += `<p style="color: var(--text-secondary); font-size: 0.8rem; padding: 0.5rem 0;">${t('properties.noParams')}</p>`;
        } else {
            variables.forEach((v, vi) => {
                const leftDisplay = getDisplayRef(v.left);
                const rightIsRef = v.right?.value?.type === 'ref';
                const rightDisplay = getDisplayRef(v.right);
                const rightLiteral = !rightIsRef && v.right?.value?.content !== undefined ? v.right.value.content : '';
                html += `<div class="property-group" style="margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">${t('nodes.parameter', { index: vi + 1 }) || `变量 ${vi + 1}`}</span>
                        <button class="btn btn-danger btn-sm" onclick="workflowUI.removeLoopVariable('${targetNode.id}', ${vi})">×</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <div class="cond-row">
                            <span class="cond-label">${t('nodes.leftVariable') || '目标变量'}</span>
                            <div class="cond-side">
                                <span style="flex:1; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                      onclick="workflowUI.openLoopVariableSelector('${targetNode.id}', ${vi}, 'left')"
                                      title="${StringUtils.escapeHtml(leftDisplay)}">${StringUtils.escapeHtml(leftDisplay)}</span>
                                <button class="btn btn-sm" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                                        onclick="workflowUI.openLoopVariableSelector('${targetNode.id}', ${vi}, 'left')" 
                                        title="${t('nodes.selectReference') || '选择引用'}">🔗</button>
                                <button class="btn btn-sm btn-danger" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                                        onclick="workflowUI.clearLoopVarRef('${targetNode.id}', ${vi}, 'left')" 
                                        title="${t('nodes.clearReference') || '清除引用'}">×</button>
                            </div>
                        </div>
                        <div class="cond-row">
                            <span class="cond-label">${t('nodes.rightValue') || '新值'}</span>
                            <div class="cond-side">
                                <input class="property-input" id="loopVarRight_${vi}" type="text" 
                                       value="${StringUtils.escapeHtml(String(rightLiteral))}" 
                                       placeholder="引用或值"
                                       style="flex:1; ${rightIsRef ? 'display:none;' : ''}"
                                       ${rightIsRef ? 'disabled' : ''}>
                                <span id="loopVarRightDisplay_${vi}" 
                                      style="display:${rightIsRef ? 'block' : 'none'}; flex:1; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                      onclick="workflowUI.openLoopVariableSelector('${targetNode.id}', ${vi}, 'right')"
                                      title="${StringUtils.escapeHtml(rightDisplay)}">${StringUtils.escapeHtml(rightDisplay)}</span>
                                <button class="btn btn-sm" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                                        onclick="workflowUI.openLoopVariableSelector('${targetNode.id}', ${vi}, 'right')" 
                                        title="${t('nodes.selectReference') || '选择引用'}">🔗</button>
                                ${
                                    rightIsRef
                                        ? `<button class="btn btn-sm btn-danger" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                                        onclick="workflowUI.clearLoopVarRef('${targetNode.id}', ${vi}, 'right')" 
                                        title="${t('nodes.clearReference') || '清除引用'}">×</button>`
                                        : ''
                                }
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        }

        html += '</div>';

        return html;
    }

    saveLoopVariables(targetNode) {
        if (targetNode.type !== 'loop_set_variable') return;
        if (!Array.isArray(targetNode.parameters.variables)) {
            targetNode.parameters.variables = [];
            return;
        }

        targetNode.parameters.variables.forEach((v, vi) => {
            const rightInput = /** @type {HTMLInputElement|null} */ (document.getElementById(`loopVarRight_${vi}`));
            if (rightInput && !rightInput.disabled && !rightInput.hidden) {
                const val = rightInput.value;
                if (!v.right) {
                    v.right = { type: 'string', value: { type: 'literal', content: '' } };
                }
                v.right.type = 'string';
                v.right.value = { type: 'literal', content: val };
            }
        });
    }

    renderLoopIntermediateVariables(targetNode) {
        if (targetNode.type !== 'loop') {
            return '';
        }

        const variableParameters = targetNode.parameters?.variableParameters;
        if (!Array.isArray(variableParameters)) {
            if (!targetNode.parameters) targetNode.parameters = {};
            targetNode.parameters.variableParameters = [];
            return '';
        }

        let html = '<hr style="margin: 0.75rem 0; border-color: var(--border);">';
        html += `<h4 style="display: flex; justify-content: space-between; align-items: center;">
            ${t('nodes.intermediateVariables') || '中间变量'}
            <button class="btn btn-sm" onclick="workflowUI.addLoopIntermediateVariable('${targetNode.id}')">+ ${t('nodes.add')}</button>
        </h4>`;

        if (variableParameters.length === 0) {
            html += `<p style="color: var(--text-secondary); font-size: 0.8rem; padding: 0.5rem 0;">${t('properties.noParams')}</p>`;
        } else {
            variableParameters.forEach((v, vi) => {
                const isRef = v.input?.value?.type === 'ref';
                const refBlockId = isRef ? v.input.value.content?.blockID || '' : '';
                const refName = isRef ? v.input.value.content?.name || '' : '';
                const refDisplay = isRef ? this._getRefDisplayText(refBlockId, refName) : '';
                const literalValue = isRef ? '' : StringUtils.escapeHtml(String(v.input?.value?.content ?? ''));

                html += `<div class="property-group" style="margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">${t('nodes.parameter', { index: vi + 1 }) || `变量 ${vi + 1}`}</span>
                        <button class="btn btn-danger btn-sm" onclick="workflowUI.removeLoopIntermediateVariable('${targetNode.id}', ${vi})">×</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <div class="param-field">
                            <label class="param-label">${t('nodes.paramName')}</label>
                            <input class="param-input" id="loopVarName_${vi}" type="text" value="${StringUtils.escapeHtml(v.name || '')}" placeholder="${t('common.paramName')}">
                        </div>
                        <div class="param-field">
                            <label class="param-label">${t('nodes.paramType')}</label>
                            <select class="param-select" id="loopVarType_${vi}">
                                ${['string', 'number', 'boolean', 'object', 'array'].map((t) => `<option value="${t}" ${(v.input?.type || 'string') === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="param-field" style="margin-top: 0.4rem;">
                        <label class="param-label">${t('nodes.defaultValue')}</label>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <input class="param-input" id="loopVarValue_${vi}" type="text" 
                                   placeholder="${t('properties.defaultValue')}" 
                                   value="${literalValue}"
                                   style="flex:1; ${isRef ? 'display:none;' : ''}"
                                   ${isRef ? 'disabled' : ''}>
                            <span id="loopVarRefDisplay_${vi}" 
                                  style="flex:1; display:${isRef ? 'block' : 'none'}; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                  onclick="workflowUI.openLoopIntermediateVarSelector('${targetNode.id}', ${vi})"
                                  title="${StringUtils.escapeHtml(refDisplay)}">${StringUtils.escapeHtml(refDisplay)}</span>
                            <input type="hidden" id="loopVarRef_${vi}" value="${isRef ? encodeURIComponent(JSON.stringify(v.input.value)) : ''}">
                            <button class="btn btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                    onclick="workflowUI.openLoopIntermediateVarSelector('${targetNode.id}', ${vi})" 
                                    title="选择引用">🔗</button>
                            ${
                                isRef
                                    ? `<button class="btn btn-sm btn-danger" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; flex-shrink: 0;" 
                                    onclick="workflowUI.clearLoopIntermediateVarRef('${targetNode.id}', ${vi})" 
                                    title="清除引用">×</button>`
                                    : ''
                            }
                        </div>
                    </div>
                </div>`;
            });
        }

        html += '</div>';
        return html;
    }

    addLoopIntermediateVariable(nodeId) {
        try {
            const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
            if (!targetNode) return;
            if (!targetNode.parameters) targetNode.parameters = {};
            if (!Array.isArray(targetNode.parameters.variableParameters)) {
                targetNode.parameters.variableParameters = [];
            }
            targetNode.parameters.variableParameters.push({
                name: '',
                input: {
                    type: 'string',
                    value: { type: 'literal', content: '' },
                },
            });
            this.node.panel.renderPropertyPanel(targetNode);
            this.node.panel._scheduleAutoSave(nodeId);
        } catch (e) {}
    }

    removeLoopIntermediateVariable(nodeId, vi) {
        try {
            const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
            if (!targetNode || !Array.isArray(targetNode.parameters?.variableParameters)) return;
            targetNode.parameters.variableParameters.splice(vi, 1);
            this.node.panel.renderPropertyPanel(targetNode);
            this.node.panel._scheduleAutoSave(nodeId);
        } catch (e) {}
    }

    openLoopIntermediateVarSelector(nodeId, vi) {
        const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
        if (!targetNode || !Array.isArray(targetNode.parameters?.variableParameters)) return;
        const variable = targetNode.parameters.variableParameters[vi];
        if (!variable) return;

        const currentBlockId = variable.input?.value?.content?.blockID || '';
        const currentName = variable.input?.value?.content?.name || '';

        /** @type {*} */ (this)._openGenericVariableSelector(
            nodeId,
            currentBlockId,
            currentName,
            (blockId, outputPath) => {
                variable.input = {
                    type: variable.input?.type || 'string',
                    value: {
                        type: 'ref',
                        content: {
                            source: 'block-output',
                            blockID: blockId,
                            name: outputPath,
                        },
                        rawMeta: { type: 1 },
                    },
                };
                this.node.panel.renderPropertyPanel(targetNode);
                this.node.panel._scheduleAutoSave(nodeId);
            }
        );
    }

    clearLoopIntermediateVarRef(nodeId, vi) {
        const targetNode = this.node.core.nodes.find((n) => n.id === nodeId);
        if (!targetNode || !Array.isArray(targetNode.parameters?.variableParameters)) return;
        const variable = targetNode.parameters.variableParameters[vi];
        if (!variable) return;

        variable.input = {
            type: variable.input?.type || 'string',
            value: { type: 'literal', content: '' },
        };
        this.node.render.renderPropertyPanel(targetNode);
        this.node.panel._scheduleAutoSave(nodeId);
    }

    saveLoopIntermediateVariables(targetNode) {
        if (targetNode.type !== 'loop') return;
        const variableParameters = targetNode.parameters?.variableParameters;
        if (!Array.isArray(variableParameters)) return;

        variableParameters.forEach((v, vi) => {
            const nameEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`loopVarName_${vi}`));
            const typeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(`loopVarType_${vi}`));
            const valueEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`loopVarValue_${vi}`));
            const refEl = /** @type {HTMLInputElement|null} */ (document.getElementById(`loopVarRef_${vi}`));

            if (nameEl) v.name = nameEl.value.trim();
            if (typeEl) v.input = v.input || {};
            if (typeEl) v.input.type = typeEl.value;

            if (refEl && refEl.value) {
                try {
                    v.input.value = JSON.parse(decodeURIComponent(refEl.value));
                } catch (e) {
                    try {
                        v.input.value = JSON.parse(refEl.value);
                    } catch (e2) {
                        v.input.value = { type: 'literal', content: valueEl ? valueEl.value : '' };
                    }
                }
            } else if (valueEl && !valueEl.disabled && valueEl.style.display !== 'none') {
                v.input.value = { type: 'literal', content: valueEl.value };
            }
        });
    }
}
