/**
 * 工作流节点属性面板模块
 * 负责属性面板渲染、节点编辑器、参数表单等
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { mixinParamEditor } from './workflow-param-editor.js';

/**
 * 属性面板相关的 mixin 方法
 * @param {import('./workflow-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export function mixinNodePanel(node) {

    const OPERATORS = [
        { value: 1, label: '==' },
        { value: 2, label: '!=' },
        { value: 5, label: '>' },
        { value: 6, label: '<' },
        { value: 7, label: '>=' },
        { value: 8, label: '<=' },
        { value: 3, label: '包含' },
        { value: 4, label: '不包含' },
        { value: 9, label: '为空' },
        { value: 10, label: '非空' }
    ];

    const LOGIC_OPTIONS = [
        { value: 1, label: 'AND' },
        { value: 2, label: 'OR' }
    ];

    const OPS_OPTIONS_HTML = OPERATORS.map(o => '<option value=' + o.value + '>' + o.label + '</option>').join('');
    const LOGIC_OPTIONS_HTML = LOGIC_OPTIONS.map(o => '<option value=' + o.value + '>' + o.label + '</option>').join('');

    const NEW_COND_ITEM_HTML = '<input type=text class=property-input cond-left placeholder="引用或值">' +
        '<select class=property-input cond-operator>' + OPS_OPTIONS_HTML + '</select>' +
        '<input type=text class=property-input cond-right placeholder="引用或值">' +
        '<button type=button class=btn btn-sm btn-danger onclick="this.closest(\'.cond-item\').remove()">×</button>';

    const NEW_BRANCH_ITEM_HTML = '<div class=branch-name-row>' +
        '<input type=text class=property-input branch-name placeholder="分支名称">' +
        '<button type=button class=btn btn-sm btn-danger onclick="this.closest(\'.branch-item\').remove()">×</button>' +
        '</div>' +
        '<div class=branch-conditions>' +
        '<div class=cond-logic><label class=cond-label>逻辑</label><select class=property-input cond-logic-select>' + LOGIC_OPTIONS_HTML + '</select></div>' +
        '<div class=cond-list></div>' +
        '<button type=button class=btn btn-sm btn-add-cond onclick="window._wfAddCondItem(this)">+ 条件</button>' +
        '</div>';

    window._wfAddBranchItem = function(listId) {
        const list = document.getElementById(listId);
        if (!list) return;
        const item = document.createElement('div');
        item.className = 'branch-item';
        item.dataset.index = list.children.length;
        item.innerHTML = NEW_BRANCH_ITEM_HTML;
        list.appendChild(item);
    };

    window._wfAddCondItem = function(btn) {
        const list = btn.previousElementSibling;
        if (!list || !list.classList.contains('cond-list')) return;
        const item = document.createElement('div');
        item.className = 'cond-item';
        item.dataset.condIndex = list.children.length;
        item.innerHTML = NEW_COND_ITEM_HTML;
        list.appendChild(item);
    };

    node._conditionValueToText = function(valueObj) {
        if (!valueObj || !valueObj.input || !valueObj.input.value) return '';
        const v = valueObj.input.value;
        if (v.type === 'ref' && v.content && v.content.blockID) {
            return '{{' + (v.content.blockID || '') + '.' + (v.content.name || '') + '}}';
        }
        if (v.type === 'literal') {
            return v.content !== undefined ? String(v.content) : '';
        }
        return '';
    };

    node._textToConditionValue = function(text) {
        const trimmed = text.trim();
        const match = trimmed.match(/^\{\{([^.}]+)\.([^}]+)\}\}$/);
        if (match) {
            return {
                input: {
                    type: 'string',
                    value: {
                        type: 'ref',
                        content: {
                            source: 'block-output',
                            blockID: match[1],
                            name: match[2]
                        }
                    }
                }
            };
        }
        return {
            input: {
                type: 'string',
                value: {
                    type: 'literal',
                    content: trimmed
                }
            }
        };
    };

    node._renderConditionItem = function(cond, i) {
        const leftText = node._conditionValueToText(cond.left);
        const rightText = node._conditionValueToText(cond.right);
        const op = cond.operator !== undefined ? cond.operator : 1;
        let opsHtml = OPERATORS.map(o => {
            const sel = o.value === op ? ' selected' : '';
            return `<option value="${o.value}"${sel}>${o.label}</option>`;
        }).join('');

        return `<div class="cond-item" data-cond-index="${i}">
            <input type="text" class="property-input cond-left" value="${StringUtils.escapeHtml(leftText)}" placeholder="引用或值">
            <select class="property-input cond-operator">${opsHtml}</select>
            <input type="text" class="property-input cond-right" value="${StringUtils.escapeHtml(rightText)}" placeholder="引用或值">
            <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.cond-item').remove()">×</button>
        </div>`;
    };

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
            if (param.name === 'branches' && targetNode.type === 'condition') {
                let branches = [];
                if (Array.isArray(value)) {
                    branches = value;
                } else if (typeof value === 'string') {
                    try { branches = JSON.parse(value); } catch {}
                }
                if (!Array.isArray(branches)) branches = [];
                if (branches.length === 0) {
                    branches = [{ name: '是', condition: { logic: 1, conditions: [] } }, { name: '否', condition: { logic: 1, conditions: [] } }];
                }
                inputHtml = `<div class="branch-list" id="prop_${param.name}">`;
                branches.forEach((branch, i) => {
                    const name = (branch && branch.name) ? branch.name : (i === 0 ? 'True' : (i === 1 ? 'False' : `Branch ${i}`));
                    const cond = (branch && branch.condition) ? branch.condition : { logic: 1, conditions: [] };
                    const logic = cond.logic !== undefined ? cond.logic : 1;
                    const conds = Array.isArray(cond.conditions) ? cond.conditions : [];
                    let logicOptions = LOGIC_OPTIONS.map(o => {
                        const sel = o.value === logic ? ' selected' : '';
                        return `<option value="${o.value}"${sel}>${o.label}</option>`;
                    }).join('');
                    let condsHtml = conds.map((c, ci) => node._renderConditionItem(c, ci)).join('');
                    inputHtml += `
                        <div class="branch-item" data-index="${i}">
                            <div class="branch-name-row">
                                <input type="text" class="property-input branch-name" value="${StringUtils.escapeHtml(name)}" placeholder="分支名称">
                                <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.branch-item').remove()">×</button>
                            </div>
                            <div class="branch-conditions">
                                <div class="cond-logic">
                                    <label class="cond-label">逻辑</label>
                                    <select class="property-input cond-logic-select">${logicOptions}</select>
                                </div>
                                <div class="cond-list">${condsHtml}</div>
                                <button type="button" class="btn btn-sm btn-add-cond" onclick="window._wfAddCondItem(this)">+ 条件</button>
                            </div>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm" style="margin-top:0.25rem" onclick="window._wfAddBranchItem('prop_${param.name}')">+ 添加分支</button>`;
            } else if (param.name === 'options' && targetNode.type === 'question') {
                let options = [];
                if (Array.isArray(value)) {
                    options = value;
                } else if (typeof value === 'string') {
                    try { options = JSON.parse(value); } catch {}
                }
                if (!Array.isArray(options)) options = [];
                inputHtml = `<div class="branch-list" id="prop_${param.name}">`;
                options.forEach((opt, i) => {
                    const name = typeof opt === 'string' ? opt : (opt.name || opt);
                    inputHtml += `
                        <div class="branch-item" data-index="${i}">
                            <input type="text" class="property-input branch-name" value="${StringUtils.escapeHtml(name)}" placeholder="选项名称">
                            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm" style="margin-top:0.25rem" onclick="(()=>{const list=document.getElementById('prop_${param.name}');const i=list.children.length;const item=document.createElement('div');item.className='branch-item';item.dataset.index=i;item.innerHTML='<input type=text class=property-input branch-name placeholder=选项名称><button type=button class=btn btn-sm btn-danger onclick=this.parentElement.remove()>×</button>';list.appendChild(item)})()">+ 添加选项</button>`;
            } else if (param.name === 'categories' && targetNode.type === 'intent') {
                let categories = [];
                if (Array.isArray(value)) {
                    categories = value;
                } else if (typeof value === 'string') {
                    try { categories = JSON.parse(value); } catch {}
                }
                if (!Array.isArray(categories)) categories = [];
                inputHtml = `<div class="branch-list" id="prop_${param.name}">`;
                categories.forEach((cat, i) => {
                    const name = typeof cat === 'string' ? cat : (cat.name || cat);
                    inputHtml += `
                        <div class="branch-item" data-index="${i}">
                            <input type="text" class="property-input branch-name" value="${StringUtils.escapeHtml(name)}" placeholder="分类名称">
                            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm" style="margin-top:0.25rem" onclick="(()=>{const list=document.getElementById('prop_${param.name}');const i=list.children.length;const item=document.createElement('div');item.className='branch-item';item.dataset.index=i;item.innerHTML='<input type=text class=property-input branch-name placeholder=分类名称><button type=button class=btn btn-sm btn-danger onclick=this.parentElement.remove()>×</button>';list.appendChild(item)})()">+ 添加分类</button>`;
            } else {
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

        this._reRenderNode(nodeId);
        this.ui.updateEdges();

        document.querySelector('.node-editor-modal').remove();

        if (this.core.selectedNode === nodeId) {
            this.renderPropertyPanel(targetNode);
        }

        this.core.saveHistory(t('actions.editNode'));
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

            if ((param.name === 'branches' && targetNode.type === 'condition') ||
                (param.name === 'options' && targetNode.type === 'question') ||
                (param.name === 'categories' && targetNode.type === 'intent')) {
                const list = document.getElementById(`prop_${param.name}`);
                if (list) {
                    let values = [];
                    if (param.name === 'branches' && targetNode.type === 'condition') {
                        const branchItems = list.querySelectorAll('.branch-item');
                        values = Array.from(branchItems).map(item => {
                            const nameInput = item.querySelector('.branch-name');
                            const name = nameInput ? nameInput.value.trim() : '';
                            if (!name) return null;
                            const logicSelect = item.querySelector('.cond-logic-select');
                            const logic = logicSelect ? parseInt(logicSelect.value) || 1 : 1;
                            const condItems = item.querySelectorAll('.cond-item');
                            const conditions = Array.from(condItems).map(ci => {
                                const leftInput = ci.querySelector('.cond-left');
                                const rightInput = ci.querySelector('.cond-right');
                                const opSelect = ci.querySelector('.cond-operator');
                                const left = leftInput ? node._textToConditionValue(leftInput.value) : { input: { type: 'string', value: { type: 'literal', content: '' } } };
                                const right = rightInput ? node._textToConditionValue(rightInput.value) : { input: { type: 'string', value: { type: 'literal', content: '' } } };
                                const operator = opSelect ? parseInt(opSelect.value) || 1 : 1;
                                return { left, operator, right };
                            }).filter(c => c.left.input.value.content || c.right.input.value.content);
                            return { name, condition: { logic, conditions } };
                        }).filter(Boolean);
                    } else if (param.name === 'options' && targetNode.type === 'question') {
                        const items = list.querySelectorAll('.branch-name');
                        values = Array.from(items).map(input => {
                            const name = input.value.trim();
                            return name;
                        }).filter(Boolean);
                    } else if (param.name === 'categories' && targetNode.type === 'intent') {
                        const items = list.querySelectorAll('.branch-name');
                        values = Array.from(items).map(input => {
                            const name = input.value.trim();
                            return name;
                        }).filter(Boolean);
                    }
                    targetNode.parameters[param.name] = values;
                }
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

        this._reRenderNode(nodeId);
        this.ui.updateEdges();
        this.core.saveHistory(t('actions.editNode'));
        this.ui.showMessage(t('actions.nodeSaved'), 'success');
    };

    mixinParamEditor(node);
}