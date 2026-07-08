// @ts-nocheck
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

    const NEW_BRANCH_ITEM_HTML = '<div class="branch-name-row">' +
        '<input type="text" class="property-input branch-name" placeholder="分支名称">' +
        '<button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentBranchItem">×</button>' +
        '</div>' +
        '<div class="branch-conditions">' +
        '<div class="cond-list"></div>' +
        '<button type="button" class="btn btn-sm btn-add-cond" data-action="wfAddCondItem">+ 条件</button>' +
        '</div>';

    node._wfAddBranchItem = function(listId) {
        const list = document.getElementById(listId);
        if (!list) return;
        const item = document.createElement('div');
        item.className = 'branch-item';
        item.dataset.index = list.children.length;
        item.innerHTML = NEW_BRANCH_ITEM_HTML;
        list.appendChild(item);
    };

    node._wfAddCondItem = function(btn) {
        const list = btn.previousElementSibling;
        if (!list || !list.classList.contains('cond-list')) return;
        const branchItem = btn.closest('.branch-item');
        const branchIndex = branchItem ? parseInt(branchItem.dataset.index, 10) : 0;
        const selectedEl = document.querySelector('.canvas-node.selected');
        const nodeId = selectedEl ? selectedEl.dataset.nodeId : '';
        const condIndex = list.children.length;
        const item = document.createElement('div');
        item.className = 'cond-item';
        item.dataset.condIndex = condIndex;
        item.innerHTML = '<div class="cond-item-header">' +
            '<span class="cond-item-title">条件 ' + (condIndex + 1) + '</span>' +
            '<button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentCondItem">×</button>' +
            '</div>' +
            '<div class="cond-row"><span class="cond-label">左值</span><div class="cond-side">' +
            '<input type="text" class="property-input cond-left" placeholder="引用或值">' +
            '<button class="btn btn-sm" style="padding:0.15rem 0.3rem;font-size:0.7rem;flex-shrink:0" ' +
            'data-action="openConditionRef" data-node-id="' + nodeId + '" data-branch-index="' + branchIndex + '" data-cond-index="' + condIndex + '" data-side="left" title="选择引用">🔗</button>' +
            '</div></div>' +
            '<div class="cond-row"><span class="cond-label">运算符</span><select class="property-input cond-operator">' + OPS_OPTIONS_HTML + '</select></div>' +
            '<div class="cond-row"><span class="cond-label">右值</span><div class="cond-side">' +
            '<input type="text" class="property-input cond-right" placeholder="引用或值">' +
            '<button class="btn btn-sm" style="padding:0.15rem 0.3rem;font-size:0.7rem;flex-shrink:0" ' +
            'data-action="openConditionRef" data-node-id="' + nodeId + '" data-branch-index="' + branchIndex + '" data-cond-index="' + condIndex + '" data-side="right" title="选择引用">🔗</button>' +
            '</div></div>';
        list.appendChild(item);
        node._updateCondLogicVisibility(list);
    };

    node._updateCondLogicVisibility = function(condList) {
        const branchConditions = condList.parentElement;
        if (!branchConditions || !branchConditions.classList.contains('branch-conditions')) return;
        let condLogic = branchConditions.querySelector('.cond-logic');
        const count = condList.children.length;
        if (count > 1) {
            if (!condLogic) {
                condLogic = document.createElement('div');
                condLogic.className = 'cond-logic';
                condLogic.innerHTML = '<label class="cond-label">逻辑</label><select class="property-input cond-logic-select">' + LOGIC_OPTIONS_HTML + '</select>';
                branchConditions.insertBefore(condLogic, condList);
            }
            condLogic.style.display = '';
        } else {
            if (condLogic) {
                condLogic.style.display = 'none';
            }
        }
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
        if (!text) return { input: { type: 'string', value: { type: 'literal', content: '' } } };
        const refMatch = text.match(/^\{\{(.+?)\.(.+?)\}\}$/);
        if (refMatch) {
            return {
                input: {
                    type: 'string',
                    value: {
                        type: 'ref',
                        content: {
                            blockID: refMatch[1],
                            name: refMatch[2]
                        }
                    }
                }
            };
        }
        return {
            input: { type: 'string', value: { type: 'literal', content: text } }
        };
    };

    node._conditionRefDisplay = function(valueObj) {
        if (!valueObj || !valueObj.input || !valueObj.input.value) return '';
        const v = valueObj.input.value;
        if (v.type === 'ref' && v.content && v.content.blockID) {
            const srcNode = this.core.nodes.find(n => n.id === v.content.blockID);
            const nodeName = srcNode ? (srcNode.title || srcNode.id) : v.content.blockID;
            return `${nodeName} → ${v.content.name || 'output'}`;
        }
        return '';
    };

    node._renderConditionItem = function(cond, i, branchIndex, nodeId) {
        const leftText = node._conditionValueToText(cond.left);
        const rightText = node._conditionValueToText(cond.right);
        const leftIsRef = cond.left?.input?.value?.type === 'ref';
        const rightIsRef = cond.right?.input?.value?.type === 'ref';
        const leftRefDisplay = leftIsRef ? node._conditionRefDisplay(cond.left) : '';
        const rightRefDisplay = rightIsRef ? node._conditionRefDisplay(cond.right) : '';
        const op = cond.operator !== undefined ? cond.operator : 1;
        let opsHtml = OPERATORS.map(o => {
            const sel = o.value === op ? ' selected' : '';
            return `<option value="${o.value}"${sel}>${o.label}</option>`;
        }).join('');

        const renderSide = (side, text, isRef, refDisplay, label) => {
            const escNodeId = StringUtils.escapeHtml(nodeId);
            const escRefDisplay = StringUtils.escapeHtml(refDisplay);
            return `<div class="cond-row">
                <span class="cond-label">${label}</span>
                <div class="cond-side">
                    <input type="text" class="property-input cond-${side}" value="${StringUtils.escapeHtml(text)}" 
                           placeholder="引用或值" ${isRef ? 'disabled style="display:none;"' : ''}>
                    <span class="cond-${side}-ref-display" 
                          style="display:${isRef ? 'block' : 'none'}; flex:1; padding: 0.45rem 0.5rem; font-size: 0.85rem; color: var(--accent); background: var(--accent-light); border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                          data-action="openConditionRef" data-node-id="${escNodeId}" data-branch-index="${branchIndex}" data-cond-index="${i}" data-side="${side}"
                          title="${escRefDisplay}">${escRefDisplay}</span>
                    <button class="btn btn-sm" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                            data-action="openConditionRef" data-node-id="${escNodeId}" data-branch-index="${branchIndex}" data-cond-index="${i}" data-side="${side}"
                            title="选择引用">🔗</button>
                    ${isRef ? `<button class="btn btn-sm btn-danger" style="padding: 0.15rem 0.3rem; font-size: 0.7rem; flex-shrink: 0;" 
                            data-action="clearConditionRef" data-node-id="${escNodeId}" data-branch-index="${branchIndex}" data-cond-index="${i}" data-side="${side}"
                            title="清除引用">×</button>` : ''}
                </div>
            </div>`;
        };

        return `<div class="cond-item" data-cond-index="${i}">
            <div class="cond-item-header">
                <span class="cond-item-title">条件 ${i + 1}</span>
                <button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentCondItem">×</button>
            </div>
            ${renderSide('left', leftText, leftIsRef, leftRefDisplay, '左值')}
            <div class="cond-row">
                <span class="cond-label">运算符</span>
                <select class="property-input cond-operator">${opsHtml}</select>
            </div>
            ${renderSide('right', rightText, rightIsRef, rightRefDisplay, '右值')}
        </div>`;
    };

    node.renderPropertyPanel = function(targetNode) {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        const selectedCount = selectedNodes.length + selectedEdges.length;

        if (selectedCount > 1 && selectedNodes.length > 1) {
            this.renderBatchEditPanel(selectedNodes);
            return;
        }

        if (selectedCount !== 1 || !targetNode) {
            this.ui.showSummaryPanel();
            return;
        }

        if (targetNode.outputParams === undefined) {
            targetNode.outputParams = [];
            if (targetNode.parameters?.node_outputs && typeof targetNode.parameters.node_outputs === 'object') {
                targetNode.outputParams = this._paramsFromNodeOutputs(targetNode.parameters.node_outputs);
            }
        } else if (targetNode.parameters?.node_outputs && typeof targetNode.parameters.node_outputs === 'object') {
            // 同步 node_outputs 中的引用信息到 outputParams（outputParams 的 value 可能为空）
            targetNode.outputParams.forEach(p => {
                const isRef = p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
                if (!isRef && p.name && targetNode.parameters.node_outputs[p.name]?.input?.value?.type === 'ref') {
                    const od = targetNode.parameters.node_outputs[p.name];
                    p.value = { type: 'ref', content: od.input.value.content };
                    p.valueType = 'ref';
                    if (od.input.value.rawMeta) {
                        p.rawMeta = od.input.value.rawMeta;
                    }
                }
            });
        }
        if (targetNode.inputParams === undefined) {
            targetNode.inputParams = [];
            if (targetNode.parameters?.node_inputs && typeof targetNode.parameters.node_inputs === 'object') {
                targetNode.inputParams = this._paramsFromNodeOutputs(targetNode.parameters.node_inputs);
            }
        }

        const info = this.core.nodeTypeInfo[targetNode.type] || {};
        const params = info.parameters || [];

        let paramsHtml = '';
        params.forEach(param => {
            if (param.name === 'variables' && targetNode.type === 'loop_set_variable') {
                return;
            }
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
                    let condsHtml = conds.map((c, ci) => node._renderConditionItem(c, ci, i, targetNode.id)).join('');
                    const condLogicHtml = conds.length > 1 ? `
                                <div class="cond-logic">
                                    <label class="cond-label">逻辑</label>
                                    <select class="property-input cond-logic-select">${logicOptions}</select>
                                </div>` : '';
                    inputHtml += `
                        <div class="branch-item" data-index="${i}">
                            <div class="branch-name-row">
                                <input type="text" class="property-input branch-name" value="${StringUtils.escapeHtml(name)}" placeholder="分支名称">
                                <button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentBranchItem">×</button>
                            </div>
                            <div class="branch-conditions">
                                ${condLogicHtml}
                                <div class="cond-list">${condsHtml}</div>
                                <button type="button" class="btn btn-sm btn-add-cond" data-action="wfAddCondItem">+ 条件</button>
                            </div>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm btn-add-branch" style="margin-top:0.25rem" data-action="wfAddBranchItem" data-prop="prop_${param.name}">+ 添加分支</button>`;
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
                            <button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentBranchItem">×</button>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm" style="margin-top:0.25rem" data-action="wfAddSimpleItem" data-prop="prop_${param.name}" data-placeholder="选项名称">+ 添加选项</button>`;
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
                            <button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentBranchItem">×</button>
                        </div>`;
                });
                inputHtml += `</div>
                    <button type="button" class="btn btn-sm" style="margin-top:0.25rem" data-action="wfAddSimpleItem" data-prop="prop_${param.name}" data-placeholder="分类名称">+ 添加分类</button>`;
            } else {
                switch (param.type) {
                case 'string':
                case 'number':
                    inputHtml = `<input class="property-input" id="prop_${param.name}" type="${param.type}" value="${safeValue}">`;
                    break;
                case 'textarea':
                    const commentRows = targetNode.type === 'comment' ? '8' : '3';
                    inputHtml = `<textarea class="property-textarea" id="prop_${param.name}" rows="${commentRows}" style="height: auto; min-height: ${commentRows * 20}px; white-space: pre-wrap; overflow: auto;">${safeValue}</textarea>`;
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
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${info.icon || '📦'} ${StringUtils.escapeHtml(targetNode.title)}</span>
                    <button class="btn btn-sm lock-toggle-btn" data-action="toggleLock" data-node-id="${StringUtils.escapeHtml(targetNode.id)}" title="${targetNode.locked ? '解锁节点' : '锁定节点'}">
                        ${targetNode.locked ? '🔒 解锁' : '🔓 锁定'}
                    </button>
                </h4>
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
                ${paramsHtml && targetNode.type !== 'start' && targetNode.type !== 'input' && targetNode.type !== 'end' ? `
                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4>${t('nodes.nodeConfig')}</h4>
                ${paramsHtml}` : ''}

                ${this.renderMergeGroups(targetNode)}

                ${this.renderLoopVariables(targetNode)}

                ${this.renderLoopIntermediateVariables(targetNode)}

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.input')}
                    <button class="btn btn-sm" data-action="addInputParam" data-node-id="${StringUtils.escapeHtml(targetNode.id)}">+ ${t('nodes.add')}</button>
                </h4>
                <div id="inputParamsList">
                    ${this.renderInputOutputParams(targetNode.inputParams || [], 'input', targetNode.id)}
                </div>

                <hr style="margin: 0.75rem 0; border-color: var(--border);">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    ${t('nodes.output')}
                    <button class="btn btn-sm" data-action="addOutputParam" data-node-id="${StringUtils.escapeHtml(targetNode.id)}">+ ${t('nodes.add')}</button>
                </h4>
                <div id="outputParamsList">
                    ${this.renderInputOutputParams(targetNode.outputParams || [], 'output', targetNode.id)}
                </div>

                
            </div>
        `;

        this._setupAutoSave(targetNode.id);
    };

    node.renderBatchEditPanel = function(selectedNodes) {
        const detailContainer = document.getElementById('detailContainer');
        if (!detailContainer) return;

        const nodeCount = selectedNodes.length;
        const nodeTypes = new Set();
        const nodeIds = [];

        selectedNodes.forEach(el => {
            const nodeId = el.dataset.nodeId;
            if (nodeId) {
                nodeIds.push(nodeId);
                const nodeData = this.core.nodes.find(n => n.id === nodeId);
                if (nodeData) nodeTypes.add(nodeData.type);
            }
        });

        const uniqueTypes = Array.from(nodeTypes);

        const commonParams = new Map();
        uniqueTypes.forEach(type => {
            const info = this.core.nodeTypeInfo[type] || {};
            const params = info.parameters || [];
            params.forEach(p => {
                if (p.name === 'branches' || p.name === 'options' || p.name === 'categories' || p.name === 'variables') return;
                const key = p.name;
                if (!commonParams.has(key)) {
                    commonParams.set(key, { ...p, types: [type] });
                } else {
                    commonParams.get(key).types.push(type);
                }
            });
        });

        const sharedParams = [];
        commonParams.forEach((param, _key) => {
            if (param.types.length >= uniqueTypes.length) {
                sharedParams.push(param);
            }
        });

        let paramsHtml = '';
        if (sharedParams.length === 0) {
            paramsHtml = '<p style="color:var(--text-secondary);padding:1rem;text-align:center;">所选节点没有公共参数可批量修改</p>';
        } else {
            paramsHtml = sharedParams.map(param => {
                const label = param.label || param.name;
                const hint = param.description ? `<div class="hint">${StringUtils.escapeHtml(param.description)}</div>` : '';
                let inputHtml = '';
                if (param.type === 'string' || param.type === 'textarea') {
                    inputHtml = `<textarea class="property-input batch-param-input" data-param="${param.name}" rows="2" placeholder="留空则不修改"></textarea>`;
                } else if (param.type === 'number') {
                    inputHtml = `<input type="number" class="property-input batch-param-input" data-param="${param.name}" value="" placeholder="留空则不修改">`;
                } else {
                    inputHtml = `<input type="text" class="property-input batch-param-input" data-param="${param.name}" value="" placeholder="留空则不修改">`;
                }
                return `<div class="property-group">
                    <label class="property-label">${StringUtils.escapeHtml(label)}${hint}</label>
                    ${inputHtml}
                </div>`;
            }).join('');
        }

        detailContainer.innerHTML = `
            <div class="property-panel-section">
                <h4 style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 批量编辑 (${nodeCount} 个节点)</span>
                </h4>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.75rem;">
                    类型: ${uniqueTypes.join(', ')}
                </div>
                ${paramsHtml}
                ${sharedParams.length > 0 ? `
                <div style="margin-top:1rem;display:flex;gap:0.5rem;">
                    <button class="btn btn-primary btn-sm" id="btnBatchApply">应用修改</button>
                    <button class="btn btn-secondary btn-sm" id="btnBatchCancel">取消</button>
                </div>` : ''}
            </div>
        `;

        const btnApply = document.getElementById('btnBatchApply');
        const btnCancel = document.getElementById('btnBatchCancel');

        if (btnApply) {
            btnApply.addEventListener('click', () => {
                const inputs = detailContainer.querySelectorAll('.batch-param-input');
                const changes = {};
                let hasChanges = false;
                inputs.forEach(input => {
                    const val = input.value.trim();
                    if (val !== '') {
                        changes[input.dataset.param] = val;
                        hasChanges = true;
                    }
                });

                if (!hasChanges) {
                    return;
                }

                nodeIds.forEach(nodeId => {
                    const nodeData = this.core.nodes.find(n => n.id === nodeId);
                    if (nodeData) {
                        if (!nodeData.parameters) nodeData.parameters = {};
                        for (const [key, val] of Object.entries(changes)) {
                            nodeData.parameters[key] = val;
                        }
                    }
                });

                this.core.saveHistory('messages.batchEditParams');
                this.ui.showMessage(`已批量修改 ${nodeCount} 个节点的参数`, 'success');
                this.ui.showSummaryPanel();
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                this.ui.showSummaryPanel();
            });
        }
    };

    node.saveNodeDetail = function(nodeId, silent) {
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
                        const existingBranches = targetNode.parameters.branches || [];
                        values = Array.from(branchItems).map((item, branchIdx) => {
                            const nameInput = item.querySelector('.branch-name');
                            const name = nameInput ? nameInput.value.trim() : '';
                            if (!name) return null;
                            const logicSelect = item.querySelector('.cond-logic-select');
                            const logic = logicSelect ? parseInt(logicSelect.value) || 1 : 1;
                            const condItems = item.querySelectorAll('.cond-item');
                            const existingBranch = existingBranches[branchIdx] || {};
                            const existingConds = existingBranch.condition?.conditions || [];
                            const conditions = Array.from(condItems).map((ci, condIdx) => {
                                const leftInput = ci.querySelector('.cond-left');
                                const rightInput = ci.querySelector('.cond-right');
                                const opSelect = ci.querySelector('.cond-operator');
                                const existingCond = existingConds[condIdx] || {};
                                const left = (leftInput && !leftInput.disabled && leftInput.style.display !== 'none')
                                    ? node._textToConditionValue(leftInput.value)
                                    : (existingCond.left || { input: { type: 'string', value: { type: 'literal', content: '' } } });
                                const right = (rightInput && !rightInput.disabled && rightInput.style.display !== 'none')
                                    ? node._textToConditionValue(rightInput.value)
                                    : (existingCond.right || { input: { type: 'string', value: { type: 'literal', content: '' } } });
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
        this.saveLoopVariables(targetNode);
        this.saveLoopIntermediateVariables(targetNode);

        this._reRenderNode(nodeId);
        this.ui.updateEdges();
        this.core.saveHistory('actions.editNode');
        if (!silent) {
            this.ui.showMessage(t('actions.nodeSaved'), 'success');
        }
    };

    node._autoSaveTimer = null;
    node._autoSaveNodeId = null;

    node._setupAutoSave = function(nodeId) {
        if (this._autoSaveNodeId && this._autoSaveNodeId !== nodeId && this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
            this._autoSaveTimer = null;
            this._autoSavePropertyPanel(this._autoSaveNodeId);
        }

        this._autoSaveNodeId = nodeId;
        const detail = document.getElementById('nodeDetail');
        if (!detail) return;

        const handler = () => {
            this._scheduleAutoSave(nodeId);
        };

        if (this._autoSaveHandler) {
            detail.removeEventListener('input', this._autoSaveHandler);
            detail.removeEventListener('change', this._autoSaveHandler);
        }

        this._autoSaveHandler = handler;
        detail.addEventListener('input', handler);
        detail.addEventListener('change', handler);
    };

    node._scheduleAutoSave = function(nodeId) {
        if (this._autoSaveTimer) {
            clearTimeout(this._autoSaveTimer);
        }
        this._autoSaveTimer = setTimeout(() => {
            this._autoSavePropertyPanel(nodeId);
            this._autoSaveTimer = null;
        }, 500);
    };

    node._autoSavePropertyPanel = function(nodeId) {
        const targetNode = this.core.nodes.find(n => n.id === nodeId);
        if (!targetNode) return;
        this.saveNodeDetail(nodeId, true);
    };

    node._handleAction = function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const nodeId = btn.dataset.nodeId;
        const prop = btn.dataset.prop;

        const activeNodeId = nodeId || this.core.selectedNode;

        switch (action) {
            case 'addInputParam':
                this.addInputParam(nodeId);
                this._scheduleAutoSave(nodeId);
                break;
            case 'addOutputParam':
                this.addOutputParam(nodeId);
                this._scheduleAutoSave(nodeId);
                break;
            case 'wfAddCondItem':
                this._wfAddCondItem(btn);
                this._scheduleAutoSave(activeNodeId);
                break;
            case 'wfAddBranchItem':
                this._wfAddBranchItem(prop);
                this._scheduleAutoSave(activeNodeId);
                break;
            case 'wfAddSimpleItem': {
                const list = document.getElementById(btn.dataset.prop);
                if (list) {
                    const placeholder = btn.dataset.placeholder || '';
                    const i = list.children.length;
                    const item = document.createElement('div');
                    item.className = 'branch-item';
                    item.dataset.index = i;
                    item.innerHTML = '<input type="text" class="property-input branch-name" placeholder="' + StringUtils.escapeHtml(placeholder) + '"><button type="button" class="btn btn-sm btn-danger" data-action="wfRemoveParentBranchItem">×</button>';
                    list.appendChild(item);
                }
                this._scheduleAutoSave(activeNodeId);
                break;
            }
            case 'wfRemoveParentBranchItem': {
                const branchItem = btn.closest('.branch-item');
                if (branchItem) branchItem.remove();
                this._scheduleAutoSave(activeNodeId);
                break;
            }
            case 'wfRemoveParentCondItem': {
                const condItem = btn.closest('.cond-item');
                if (condItem) {
                    const condList = condItem.parentElement;
                    condItem.remove();
                    if (condList && condList.classList.contains('cond-list')) {
                        node._updateCondLogicVisibility(condList);
                    }
                }
                this._scheduleAutoSave(activeNodeId);
                break;
            }
            case 'openConditionRef': {
                const { nodeId, branchIndex, condIndex, side } = btn.dataset;
                this.openConditionRefSelector(nodeId, parseInt(branchIndex, 10), parseInt(condIndex, 10), side);
                break;
            }
            case 'clearConditionRef': {
                const { nodeId, branchIndex, condIndex, side } = btn.dataset;
                this.clearConditionRef(nodeId, parseInt(branchIndex, 10), parseInt(condIndex, 10), side);
                this._scheduleAutoSave(nodeId);
                break;
            }
            case 'toggleLock': {
                const targetNode = this.core.nodes.find(n => n.id === nodeId);
                if (targetNode) {
                    targetNode.locked = !targetNode.locked;
                    this.core.saveHistory('messages.toggleLock');
                    this._reRenderNode(nodeId);
                    this.renderPropertyPanel(targetNode);
                }
                break;
            }
        }
    };

    document.addEventListener('click', node._handleAction.bind(node));

    mixinParamEditor(node);
}