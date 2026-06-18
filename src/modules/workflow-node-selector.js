/**
 * 工作流节点变量选择器模块
 * 负责变量引用选择器、合并变量选择器等
 */
import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 变量选择器相关的 mixin 方法
 * @param {import('./workflow-node.js').WorkflowNode} node - WorkflowNode 实例
 */
export function mixinNodeSelector(node) {
    node.openInputParamRefSelector = function(prefix, index) {
        const selectedNode = this.core.selectedNode;
        if (!selectedNode) return;
        const targetNode = this.core.nodes.find(n => n.id === selectedNode);
        if (!targetNode) return;

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
    };

    node.clearInputParamRef = function(prefix, index) {
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
    };

    node.openVariableSelector = function(nodeId, gi, vi) {
        const targetNode = this.core.nodes.find(n => n.id === nodeId);
        if (!targetNode || !targetNode.parameters?.mergeGroups) return;
        const group = targetNode.parameters.mergeGroups[gi];
        if (!group || !group.variables) return;
        const variable = group.variables[vi];
        if (!variable) return;

        const currentBlockId = variable.value?.content?.blockID || '';
        const currentName = variable.value?.content?.name || '';

        this._openGenericVariableSelector(nodeId, currentBlockId, currentName, (blockId, outputPath) => {
            variable.value.content.blockID = blockId;
            variable.value.content.name = outputPath;

            const edge = this.core.edges.find(e =>
                e.target === targetNode.id && e.source === blockId
            );
            if (edge) {
                edge.sourcePort = outputPath;
            }

            this.renderPropertyPanel(targetNode);
        });
    };

    node.addMergeVariable = function(nodeId, gi) {
        try {
            const targetNode = this.core.nodes.find(n => n.id === nodeId);
            if (!targetNode || !targetNode.parameters?.mergeGroups) return;
            const group = targetNode.parameters.mergeGroups[gi];
            if (!group || !group.variables) return;
            group.variables.push({
                type: 'string',
                value: {
                    type: 'ref',
                    content: { source: 'block-output', blockID: '', name: 'output' },
                    rawMeta: { type: 1 }
                }
            });
            this.renderPropertyPanel(targetNode);
        } catch (e) {}
    };

    node.removeMergeVariable = function(nodeId, gi, vi) {
        try {
            const targetNode = this.core.nodes.find(n => n.id === nodeId);
            if (!targetNode || !targetNode.parameters?.mergeGroups) return;
            const group = targetNode.parameters.mergeGroups[gi];
            if (!group || !group.variables) return;
            group.variables.splice(vi, 1);
            this.renderPropertyPanel(targetNode);
        } catch (e) {}
    };

    node._openGenericVariableSelector = function(excludeNodeId, currentBlockId, currentName, onConfirm) {
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
    };
}