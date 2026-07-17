/**
 * 剪贴板粘贴模块
 * 负责从 Coze 格式、简单格式、简单节点格式粘贴工作流
 */
import { t } from '../i18n/i18n.js';
import { deepClone, extractSlateText } from '../utils/helpers.js';

function getDefaultSize(_type) {
    return { width: 200, height: 100 };
}

/**
 * 粘贴相关的 mixin 方法
 * @param {import('./editor-clipboard.js').WorkflowClipboard} clipboard - WorkflowClipboard 实例
 */
export class WorkflowClipboardPaste {
    /**
     * @param {import('./editor-clipboard.js').WorkflowClipboard} clipboard - WorkflowClipboard 实例
     */
    constructor(clipboard) {
        this.clipboard = clipboard;
    }
    pasteFromCozeFormat(data) {
        if (!data.json?.nodes?.length) {
            this.clipboard.ui.showMessage(t('actions.pasteInvalidData'), 'error');
            return;
        }

        const idMap = {};
        const portReverseMap = {
            'loop-function-inline-output': 'container_start',
            'loop-function-inline-input': 'container_end',
            'batch-function-inline-output': 'container_start',
            'batch-function-inline-input': 'container_end',
        };

        const convertCozePort = (port, nodeId) => {
            if (!port) return port;
            const node = this.clipboard.core.nodes.find((n) => n.id === nodeId);
            if (!node || node.type !== 'condition') return port;
            const branches = node.parameters?.branches;
            if (!Array.isArray(branches) || branches.length === 0) return port;
            if (port === 'true') return 'branch_0';
            if (port === 'false') return `branch_${branches.length - 1}`;
            if (port.startsWith('true_')) {
                const idx = parseInt(port.replace('true_', ''), 10);
                if (!isNaN(idx) && idx >= 0 && idx < branches.length) return `branch_${idx}`;
            }
            return port;
        };
        let nodeCount = 0;
        let edgeCount = 0;
        let skippedEdges = 0;

        const collectAllNodeIds = (nodes) => {
            for (const cozeNode of nodes) {
                if (!cozeNode || !cozeNode.id) continue;
                const originalId = String(cozeNode.id);
                const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                idMap[originalId] = newNodeId;
                if (cozeNode.blocks && Array.isArray(cozeNode.blocks)) {
                    collectAllNodeIds(cozeNode.blocks);
                }
            }
        };
        collectAllNodeIds(data.json.nodes);

        let minX = 0,
            minY = 0;
        if (Array.isArray(data.json.nodes) && data.json.nodes.length > 0) {
            minX = Infinity;
            minY = Infinity;
            data.json.nodes.forEach((cozeNode) => {
                const nodeX = (cozeNode.meta?.position?.x ?? cozeNode.x ?? 0) || 0;
                const nodeY = (cozeNode.meta?.position?.y ?? cozeNode.y ?? 0) || 0;
                minX = Math.min(minX, nodeX);
                minY = Math.min(minY, nodeY);
            });
        }

        const { canvasX: pasteX, canvasY: pasteY } = this.clipboard.ui.canvas.screenToCanvas(
            this.clipboard.ui.canvas.lastMouseX || 100,
            this.clipboard.ui.canvas.lastMouseY || 100
        );

        const createNodeFromCoze = (cozeNode, parentId = null, offsetX = 0, offsetY = 0) => {
            if (!cozeNode || !cozeNode.id) return null;
            const originalId = String(cozeNode.id);
            const newNodeId = idMap[originalId];
            if (!newNodeId) return null;

            let type = 'plugin';
            try {
                type = this.clipboard.core.getTypeFromNumber(cozeNode.type);
            } catch (err) {
                type = 'plugin';
            }

            const nodeX = (cozeNode.meta?.position?.x ?? cozeNode.x ?? 0) || 0;
            const nodeY = (cozeNode.meta?.position?.y ?? cozeNode.y ?? 0) || 0;

            const isChild = parentId !== null;
            const x = isChild ? nodeX : pasteX + (nodeX - minX) + offsetX;
            const y = isChild ? nodeY : pasteY + (nodeY - minY) + offsetY;

            const parameters = {};
            if (cozeNode.data?.outputs) {
                cozeNode.data.outputs.forEach((output) => {
                    if (output.defaultValue !== undefined) {
                        parameters[output.name] = output.defaultValue;
                    }
                });
                const nodeOutputs = {};
                cozeNode.data.outputs.forEach((output) => {
                    nodeOutputs[output.name] = {
                        type: output.type || 'string',
                        description: output.description || '',
                        required: output.required || false,
                    };
                    if (output.schema) {
                        if (Array.isArray(output.schema)) {
                            nodeOutputs[output.name].properties = output.schema;
                        } else {
                            nodeOutputs[output.name].schema = output.schema;
                        }
                    }
                    if (output.rawMeta) {
                        nodeOutputs[output.name].rawMeta = output.rawMeta;
                    }
                    if (output.assistType !== undefined) {
                        nodeOutputs[output.name].assistType = output.assistType;
                    }
                    if (output.input && typeof output.input === 'object') {
                        nodeOutputs[output.name].input = output.input;
                    }
                });
                if (Object.keys(nodeOutputs).length > 0) {
                    parameters.node_outputs = nodeOutputs;
                }
            }
            if (cozeNode.data?.inputs && typeof cozeNode.data.inputs === 'object') {
                Object.entries(cozeNode.data.inputs).forEach(([key, value]) => {
                    if (key !== 'inputParameters' && key !== 'schemaType') {
                        if (key === 'note' && typeof value === 'string') {
                            try {
                                const slate = JSON.parse(value);
                                const text = extractSlateText(slate);
                                parameters.content = text;
                            } catch (e) {
                                parameters.content = value;
                            }
                        } else if (key === 'llmParam' && Array.isArray(value)) {
                            parameters._llmParamRaw = deepClone(value);
                            value.forEach((p) => {
                                const v = p.input?.value?.content;
                                if (p.name && v !== undefined) {
                                    const keyName = p.name === 'modleName' ? 'modelName' : p.name;
                                    parameters[keyName] = v;
                                }
                            });
                        } else if (key === 'llmParam' && typeof value === 'object' && value !== null) {
                            parameters._llmParamRaw = deepClone(value);
                            Object.entries(value).forEach(([k, v]) => {
                                if (typeof v === 'object' && v !== null && v.name) {
                                    const content = v.input?.value?.content;
                                    if (content !== undefined) {
                                        const keyName = v.name === 'modleName' ? 'modelName' : v.name;
                                        parameters[keyName] = content;
                                    }
                                } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                                    parameters[k] = v;
                                }
                            });
                        } else if (key === 'code') {
                            parameters.code = value;
                        } else if (key === 'url' || key === 'method') {
                            parameters[key] = value;
                        } else if (key === 'headers' || key === 'body') {
                            parameters[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        } else if (key === 'content' && typeof value === 'object' && value.value?.type === 'literal') {
                            parameters.content = value.value.content ?? '';
                            parameters._contentRaw = value;
                        } else if (key === 'content' && typeof value === 'object' && value.value?.type === 'ref') {
                            parameters.content = JSON.stringify(value);
                            parameters._contentRaw = value;
                        } else if (key === 'content') {
                            parameters.content = value;
                        } else {
                            parameters[key] = value;
                        }
                    }
                });
            }

            if (type === 'loop_set_variable' && Array.isArray(cozeNode.data?.inputs?.inputParameters)) {
                parameters.variables = cozeNode.data.inputs.inputParameters;
            }

            const nodeMeta = cozeNode.data?.nodeMeta || cozeNode._temp?.externalData || {};
            const title = nodeMeta.title || cozeNode.title || t('nodeTypes.plugin');
            const description = nodeMeta.description || cozeNode.description || '';
            const icon = nodeMeta.icon || cozeNode.icon || '';

            const newNode = {
                id: newNodeId,
                type: type,
                x: x,
                y: y,
                title: title,
                description: description,
                icon: icon,
                parameters: parameters,
                parentId: parentId,
                inputParams: (cozeNode.data?.inputs?.inputParameters || []).map((p) => {
                    if (p.left && p.right) {
                        return {
                            name: p.left?.value?.content?.name || p.left?.value?.content || '',
                            type: p.left?.type || p.right?.type || 'string',
                            value:
                                p.right?.value?.type === 'ref'
                                    ? { type: 'ref', content: p.right.value.content }
                                    : (p.right?.value?.content ?? ''),
                            valueType: p.right?.value?.type || 'literal',
                            left: p.left,
                            right: p.right,
                        };
                    }
                    return {
                        name: p.name || '',
                        type: p.type || p.input?.type || 'string',
                        value:
                            p.input?.value?.type === 'ref'
                                ? { type: 'ref', content: p.input.value.content }
                                : (p.input?.value?.content ?? p.defaultValue ?? ''),
                        valueType: p.input?.value?.type || 'literal',
                        rawMeta: p.input?.value?.rawMeta || null,
                        schema: p.input?.schema || null,
                        required: p.required === true,
                        description: p.description || '',
                    };
                }),
                outputParams: (cozeNode.data?.outputs || []).map((o) => {
                    const isRef = o.input?.value?.type === 'ref';
                    return {
                        name: o.name || '',
                        type: o.type || 'string',
                        value: isRef ? { type: 'ref', content: o.input.value.content } : o.defaultValue || '',
                        valueType: isRef ? 'ref' : 'literal',
                        rawMeta: isRef ? o.input.value.rawMeta || null : null,
                        required: o.required === true,
                        description: o.description || '',
                    };
                }),
                ...getDefaultSize(type),
            };

            return newNode;
        };

        try {
            this.clipboard.core.batchChanges(() => {
                const containerNodes = [];

                data.json.nodes.forEach((cozeNode) => {
                    if (!cozeNode || !cozeNode.id) return;
                    const newNode = createNodeFromCoze(cozeNode);
                    if (!newNode) return;

                    this.clipboard.core.addNode(newNode);
                    nodeCount++;

                    if (cozeNode.blocks && Array.isArray(cozeNode.blocks) && cozeNode.blocks.length > 0) {
                        containerNodes.push({ containerId: newNode.id, cozeNode: cozeNode });
                        newNode.width = newNode.width || 300;
                        newNode.height = newNode.height || 200;
                        // 不要设置 _skipLayout，让 updateContainerSize 自动对齐子节点到左上角并居中
                        // Coze 给子节点坐标可能有负值，需要自动调整才能正确包裹

                        cozeNode.blocks.forEach((blockNode) => {
                            if (!blockNode || !blockNode.id) return;
                            const childNode = createNodeFromCoze(blockNode, newNode.id);
                            if (!childNode) return;
                            // 子节点在容器体内的位置需要相对容器体左上角
                            childNode.x = blockNode.meta?.position?.x || 0;
                            childNode.y = blockNode.meta?.position?.y || 0;
                            this.clipboard.core.addNode(childNode);
                            nodeCount++;
                        });
                    }
                });

                Object.values(this.clipboard.core.nodes).forEach((node) => {
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach((param) => {
                            if (
                                param.valueType === 'ref' &&
                                typeof param.value === 'object' &&
                                param.value.content?.blockID
                            ) {
                                const newBlockId = idMap[String(param.value.content.blockID)];
                                if (newBlockId) {
                                    param.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                    if (
                        node.parameters &&
                        node.parameters._contentRaw &&
                        typeof node.parameters._contentRaw === 'object'
                    ) {
                        const raw = node.parameters._contentRaw;
                        if (raw.value?.type === 'ref' && raw.value.content?.blockID) {
                            const newBlockId = idMap[String(raw.value.content.blockID)];
                            if (newBlockId) {
                                raw.value.content.blockID = newBlockId;
                            }
                        }
                    }
                    if (
                        node.parameters &&
                        node.parameters.dynamic_option &&
                        typeof node.parameters.dynamic_option === 'object'
                    ) {
                        const opt = node.parameters.dynamic_option;
                        if (opt.value?.type === 'ref' && opt.value.content?.blockID) {
                            const newBlockId = idMap[String(opt.value.content.blockID)];
                            if (newBlockId) {
                                opt.value.content.blockID = newBlockId;
                            }
                        }
                    }
                    if (node.parameters && node.parameters.mergeGroups && Array.isArray(node.parameters.mergeGroups)) {
                        node.parameters.mergeGroups.forEach((group) => {
                            if (group.variables && Array.isArray(group.variables)) {
                                group.variables.forEach((v) => {
                                    if (v.value?.type === 'ref' && v.value.content?.blockID) {
                                        const newBlockId = idMap[String(v.value.content.blockID)];
                                        if (newBlockId) {
                                            v.value.content.blockID = newBlockId;
                                        }
                                    }
                                });
                            }
                        });
                    }
                    if (
                        node.parameters &&
                        node.parameters.node_outputs &&
                        typeof node.parameters.node_outputs === 'object'
                    ) {
                        Object.values(node.parameters.node_outputs).forEach((output) => {
                            if (
                                output.input &&
                                typeof output.input === 'object' &&
                                output.input.value?.type === 'ref' &&
                                output.input.value.content?.blockID
                            ) {
                                const newBlockId = idMap[String(output.input.value.content.blockID)];
                                if (newBlockId) {
                                    output.input.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                    if (node.outputParams && Array.isArray(node.outputParams)) {
                        node.outputParams.forEach((p) => {
                            if (
                                p.value &&
                                typeof p.value === 'object' &&
                                p.value.type === 'ref' &&
                                p.value.content?.blockID
                            ) {
                                const newBlockId = idMap[String(p.value.content.blockID)];
                                if (newBlockId) {
                                    p.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach((p) => {
                            if (
                                p.value &&
                                typeof p.value === 'object' &&
                                p.value.type === 'ref' &&
                                p.value.content?.blockID
                            ) {
                                const newBlockId = idMap[String(p.value.content.blockID)];
                                if (newBlockId) {
                                    p.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                    if (node.parameters && node.parameters.branches && Array.isArray(node.parameters.branches)) {
                        const updateBlockIds = (obj) => {
                            if (!obj || typeof obj !== 'object') return;
                            if (Array.isArray(obj)) {
                                obj.forEach((item) => updateBlockIds(item));
                                return;
                            }
                            for (const key of Object.keys(obj)) {
                                if (key === 'blockID' && typeof obj[key] === 'string') {
                                    const newId = idMap[obj[key]];
                                    if (newId) obj[key] = newId;
                                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                    updateBlockIds(obj[key]);
                                }
                            }
                        };
                        updateBlockIds(node.parameters.branches);
                        node.parameters.branches.forEach((branch, i) => {
                            if (!branch.name) {
                                let name = '';
                                if (
                                    branch.condition &&
                                    Array.isArray(branch.condition.conditions) &&
                                    branch.condition.conditions.length > 0
                                ) {
                                    const firstCond = branch.condition.conditions[0];
                                    const rightVal = firstCond.right?.input?.value?.content;
                                    const leftVal = firstCond.left?.input?.value?.content;
                                    if (rightVal && typeof rightVal === 'string') {
                                        name = rightVal;
                                    } else if (leftVal && typeof leftVal === 'string') {
                                        name = leftVal;
                                    }
                                }
                                branch.name = name || `Branch ${i + 1}`;
                            }
                        });
                    }
                    if (node.type === 'loop_set_variable' && Array.isArray(node.parameters.variables)) {
                        node.parameters.variables.forEach((v) => {
                            if (v.left?.value?.content?.blockID && typeof v.left.value.content.blockID === 'string') {
                                const newBlockId = idMap[String(v.left.value.content.blockID)];
                                if (newBlockId) {
                                    v.left.value.content.blockID = newBlockId;
                                }
                            }
                            if (v.right?.value?.content?.blockID && typeof v.right.value.content.blockID === 'string') {
                                const newBlockId = idMap[String(v.right.value.content.blockID)];
                                if (newBlockId) {
                                    v.right.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                });

                if (data.json.edges) {
                    data.json.edges.forEach((edge) => {
                        const sourceId = idMap[String(edge.sourceNodeID)];
                        const targetId = idMap[String(edge.targetNodeID)];

                        if (sourceId && targetId) {
                            const newEdge = {
                                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                source: sourceId,
                                target: targetId,
                                ...(edge.sourcePortID && { sourcePort: convertCozePort(edge.sourcePortID, sourceId) }),
                                ...(edge.targetPortID && { targetPort: convertCozePort(edge.targetPortID, targetId) }),
                            };
                            const result = this.clipboard.core.addEdge(newEdge);
                            if (result) {
                                edgeCount++;
                            } else {
                                skippedEdges++;
                            }
                        }
                    });
                }

                containerNodes.forEach(({ cozeNode }) => {
                    if (cozeNode.edges && Array.isArray(cozeNode.edges)) {
                        cozeNode.edges.forEach((edge) => {
                            const sourceId = idMap[String(edge.sourceNodeID)];
                            const targetId = idMap[String(edge.targetNodeID)];

                            if (sourceId && targetId) {
                                const rawSourcePort = portReverseMap[edge.sourcePortID] || edge.sourcePortID;
                                const rawTargetPort = portReverseMap[edge.targetPortID] || edge.targetPortID;
                                const newEdge = {
                                    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    source: sourceId,
                                    target: targetId,
                                    ...(rawSourcePort && { sourcePort: convertCozePort(rawSourcePort, sourceId) }),
                                    ...(rawTargetPort && { targetPort: convertCozePort(rawTargetPort, targetId) }),
                                };
                                const result = this.clipboard.core.addEdge(newEdge);
                                if (result) {
                                    edgeCount++;
                                } else {
                                    skippedEdges++;
                                }
                            }
                        });
                    }
                });
            });

            // 清除旧的选择状态，避免粘贴后旧边仍显示为选中
            this.clipboard.ui.selection.deselectAll();

            // 选中新粘贴的顶层节点
            const newPastedIds = Object.values(idMap);
            const pastedTopNodes = newPastedIds.filter((id) => {
                const node = this.clipboard.core.nodes.find((n) => n.id === id);
                return node && !node.parentId;
            });
            pastedTopNodes.forEach((nodeId) => {
                const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
                if (nodeEl) nodeEl.classList.add('selected');
            });
            if (pastedTopNodes.length > 0) {
                this.clipboard.ui.isMultiSelectMode = pastedTopNodes.length > 1;
                this.clipboard.core.selectedNode = pastedTopNodes[0];
                this.clipboard.core.selectedEdge = null;
            }

            let message;
            if (edgeCount > 0 && skippedEdges > 0) {
                message =
                    t('actions.pasteSuccessWithEdges', { nodeCount, edgeCount }) +
                    ' ' +
                    t('actions.pasteSkipped', { skipped: skippedEdges });
            } else if (edgeCount > 0) {
                message = t('actions.pasteSuccessWithEdges', { nodeCount, edgeCount });
            } else {
                message = t('actions.pasteSuccess', { nodeCount });
            }
            this.clipboard.ui.showMessage(message, 'success');

            this.clipboard.core.saveHistory('actions.pasteSuccess', { nodeCount });
        } catch (err) {
            this.clipboard.ui.showMessage(t('actions.pasteFailed', { message: err.message }), 'error');
        }
    }

    pasteFromSimpleFormat(data) {
        const { node, edges } = data;

        const newNodeId = `node_${Date.now()}`;
        const offset = 50;

        // node.x / node.y 已经是从剪贴板数据中读取的 canvas 坐标
        // 不需要 screenToCanvas 转换，直接加偏移即可
        const x = node.x + offset;
        const y = node.y + offset;

        const newNode = {
            ...node,
            id: newNodeId,
            x: x,
            y: y,
        };

        let el;
        this.clipboard.core.batchChanges(() => {
            this.clipboard.core.addNode(newNode);
            el = this.clipboard.ui.node.createElement(newNode);
            this.clipboard.ui.canvas.canvasContent.appendChild(el);
            this.clipboard.ui.canvas.setEmptyState(false);

            edges.forEach((edge) => {
                const newEdge = {
                    ...edge,
                    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                };

                if (edge.source === node.id) {
                    newEdge.source = newNodeId;
                }
                if (edge.target === node.id) {
                    newEdge.target = newNodeId;
                }

                const sourceExists = this.clipboard.core.nodes.find((n) => n.id === newEdge.source);
                const targetExists = this.clipboard.core.nodes.find((n) => n.id === newEdge.target);

                if (sourceExists && targetExists) {
                    this.clipboard.core.addEdge(newEdge);
                }
            });
        });

        this.clipboard.ui.node.select(el);
    }

    pasteFromSimpleNodes(data) {
        if (!data.nodes?.length) return;

        const offset = 50;

        this.clipboard.core.batchChanges(() => {
            const elements = [];
            data.nodes.forEach((node) => {
                const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const x = (node.position?.x || node.x || 0) + offset;
                const y = (node.position?.y || node.y || 0) + offset;

                const newNode = {
                    id: newNodeId,
                    type: node.type,
                    x: x,
                    y: y,
                    title: node.title || t('nodes.node'),
                    description: node.description || '',
                    parameters: node.parameters || {},
                };

                this.clipboard.core.addNode(newNode);
                const el = this.clipboard.ui.node.createElement(newNode, { skipMeasure: true });
                elements.push({ el, nodeData: newNode });
                this.clipboard.ui.canvas.canvasContent.appendChild(el);
                this.clipboard.ui.canvas.setEmptyState(false);
            });
            this.clipboard.ui.node.batchMeasureElements(elements);

            data.edges?.forEach((edge) => {
                const newEdge = {
                    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    source: `node_${edge.source || edge.sourceNodeID}`,
                    target: `node_${edge.target || edge.targetNodeID}`,
                };

                const sourceExists = this.clipboard.core.nodes.find((n) => n.id === newEdge.source);
                const targetExists = this.clipboard.core.nodes.find((n) => n.id === newEdge.target);

                if (sourceExists && targetExists) {
                    this.clipboard.core.addEdge(newEdge);
                }
            });
        });
    }
}
