/**
 * 剪贴板粘贴模块
 * 负责从 Coze 格式、简单格式、简单节点格式粘贴工作流
 */
import { t } from '../i18n/i18n.js';

/**
 * Slate 格式文本提取（与 clipboard.js 共享）
 * @param {Array} slate - Slate JSON 节点数组
 * @returns {string} 纯文本
 */
function extractSlateText(slate) {
    if (!Array.isArray(slate)) return '';
    return slate.map(node => {
        if (node.text !== undefined) return node.text;
        if (node.children) return extractSlateText(node.children);
        return '';
    }).join('\n');
}

/**
 * 粘贴相关的 mixin 方法
 * @param {import('./workflow-clipboard.js').WorkflowClipboard} clipboard - WorkflowClipboard 实例
 */
export function mixinClipboardPaste(clipboard) {
    clipboard.pasteFromCozeFormat = function(data) {
        if (!data.json?.nodes?.length) {
            this.ui.showMessage(t('actions.pasteInvalidData'), 'error');
            return;
        }

        const idMap = {};
        let nodeCount = 0;
        let edgeCount = 0;
        let skippedEdges = 0;

        let minX = 0, minY = 0;
        if (Array.isArray(data.json.nodes) && data.json.nodes.length > 0) {
            minX = Infinity;
            minY = Infinity;
            data.json.nodes.forEach(cozeNode => {
                const nodeX = (cozeNode.meta?.position?.x ?? cozeNode.x ?? 0) || 0;
                const nodeY = (cozeNode.meta?.position?.y ?? cozeNode.y ?? 0) || 0;
                minX = Math.min(minX, nodeX);
                minY = Math.min(minY, nodeY);
            });
        }

        const { canvasX: pasteX, canvasY: pasteY } = this.ui.canvas.screenToCanvas(
            this.ui.canvas.lastMouseX || 100,
            this.ui.canvas.lastMouseY || 100
        );

        try {
            this.core.batchChanges(() => {
                data.json.nodes.forEach(cozeNode => {
                    if (!cozeNode || !cozeNode.id) return;
                    const originalId = String(cozeNode.id);
                    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    idMap[originalId] = newNodeId;

                    let type = 'plugin';
                    try {
                        type = this.core.getTypeFromNumber(cozeNode.type);
                    } catch (err) {
                        type = 'plugin';
                    }

                    const nodeX = (cozeNode.meta?.position?.x ?? cozeNode.x ?? 0) || 0;
                    const nodeY = (cozeNode.meta?.position?.y ?? cozeNode.y ?? 0) || 0;

                    const x = pasteX + (nodeX - minX);
                    const y = pasteY + (nodeY - minY);

                    const parameters = {};
                    if (cozeNode.data?.outputs) {
                        cozeNode.data.outputs.forEach(output => {
                            if (output.defaultValue !== undefined) {
                                parameters[output.name] = output.defaultValue;
                            }
                        });
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
                                    parameters._llmParamRaw = JSON.parse(JSON.stringify(value));
                                    value.forEach(p => {
                                        const v = p.input?.value?.content;
                                        if (p.name && v !== undefined) {
                                            const keyName = p.name === 'modleName' ? 'modelName' : p.name;
                                            parameters[keyName] = v;
                                        }
                                    });
                                } else if (key === 'llmParam' && typeof value === 'object' && value !== null) {
                                    parameters._llmParamRaw = JSON.parse(JSON.stringify(value));
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
                        inputParams: (cozeNode.data?.inputs?.inputParameters || []).map(p => ({
                            name: p.name || '',
                            type: p.type || p.input?.type || 'string',
                            value: p.input?.value?.type === 'ref'
                                ? { type: 'ref', content: p.input.value.content }
                                : (p.input?.value?.content ?? p.defaultValue ?? ''),
                            valueType: p.input?.value?.type || 'literal',
                            rawMeta: p.input?.value?.rawMeta || null,
                            required: p.required === true,
                            description: p.description || ''
                        })),
                        outputParams: (cozeNode.data?.outputs || []).map(o => ({
                            name: o.name || '',
                            type: o.type || 'string',
                            value: o.defaultValue || '',
                            description: o.description || ''
                        })),
                        width: cozeNode.data?.size?.width || cozeNode._temp?.bounds?.width || cozeNode.width || 200,
                        height: cozeNode.data?.size?.height || cozeNode._temp?.bounds?.height || cozeNode.height || 100
                    };

                    this.core.addNode(newNode);
                    const el = this.ui.node.createElement(newNode);
                    this.ui.canvas.canvasContent.appendChild(el);
                    this.ui.canvas.setEmptyState(false);
                    nodeCount++;
                });

                // 更新所有 ref 引用中的 blockID（节点 ID 映射）
                Object.values(this.core.nodes).forEach(node => {
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach(param => {
                            if (param.valueType === 'ref' && typeof param.value === 'object' && param.value.content?.blockID) {
                                const newBlockId = idMap[String(param.value.content.blockID)];
                                if (newBlockId) {
                                    param.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                    if (node.parameters && node.parameters._contentRaw && typeof node.parameters._contentRaw === 'object') {
                        const raw = node.parameters._contentRaw;
                        if (raw.value?.type === 'ref' && raw.value.content?.blockID) {
                            const newBlockId = idMap[String(raw.value.content.blockID)];
                            if (newBlockId) {
                                raw.value.content.blockID = newBlockId;
                            }
                        }
                    }
                    if (node.parameters && node.parameters.dynamic_option && typeof node.parameters.dynamic_option === 'object') {
                        const opt = node.parameters.dynamic_option;
                        if (opt.value?.type === 'ref' && opt.value.content?.blockID) {
                            const newBlockId = idMap[String(opt.value.content.blockID)];
                            if (newBlockId) {
                                opt.value.content.blockID = newBlockId;
                            }
                        }
                    }
                    if (node.parameters && node.parameters.mergeGroups && Array.isArray(node.parameters.mergeGroups)) {
                        node.parameters.mergeGroups.forEach(group => {
                            if (group.variables && Array.isArray(group.variables)) {
                                group.variables.forEach(v => {
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
                });

                if (data.json.edges) {
                    data.json.edges.forEach(edge => {
                        const sourceId = idMap[String(edge.sourceNodeID)];
                        const targetId = idMap[String(edge.targetNodeID)];

                        if (sourceId && targetId) {
                            const newEdge = {
                                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                source: sourceId,
                                target: targetId,
                                ...(edge.sourcePortID && { sourcePort: edge.sourcePortID }),
                                ...(edge.targetPortID && { targetPort: edge.targetPortID })
                            };
                            const result = this.core.addEdge(newEdge);
                            if (result) {
                                edgeCount++;
                            } else {
                                skippedEdges++;
                            }
                        }
                    });
                }
            }); // end batchChanges

            let message;
            if (edgeCount > 0 && skippedEdges > 0) {
                message = t('actions.pasteSuccessWithEdges', { nodeCount, edgeCount }) + ' ' + t('actions.pasteSkipped', { skipped: skippedEdges });
            } else if (edgeCount > 0) {
                message = t('actions.pasteSuccessWithEdges', { nodeCount, edgeCount });
            } else {
                message = t('actions.pasteSuccess', { nodeCount });
            }
            this.ui.showMessage(message, 'success');

            this.core.saveHistory(t('actions.pasteSuccess', { nodeCount }));
        } catch (err) {
            this.ui.showMessage(t('actions.pasteFailed', { message: err.message }), 'error');
        }
    };

    clipboard.pasteFromSimpleFormat = function(data) {
        const { node, edges } = data;

        const newNodeId = `node_${Date.now()}`;
        const offset = 50;

        let x = node.x + offset;
        let y = node.y + offset;

        const { translateX, scale } = this.ui.canvas.getCurrentTransform();
        if (translateX !== 0 || scale !== 1) {
            const { canvasX, canvasY } = this.ui.canvas.screenToCanvas(node.x, node.y);
            x = canvasX + offset;
            y = canvasY + offset;
        }

        const newNode = {
            ...node,
            id: newNodeId,
            x: x,
            y: y
        };

        this.core.batchChanges(() => {
            this.core.addNode(newNode);
            const el = this.ui.node.createElement(newNode);
            this.ui.canvas.canvasContent.appendChild(el);
            this.ui.canvas.setEmptyState(false);

            edges.forEach(edge => {
                const newEdge = {
                    ...edge,
                    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };

                if (edge.source === node.id) {
                    newEdge.source = newNodeId;
                }
                if (edge.target === node.id) {
                    newEdge.target = newNodeId;
                }

                const sourceExists = this.core.nodes.find(n => n.id === newEdge.source);
                const targetExists = this.core.nodes.find(n => n.id === newEdge.target);

                if (sourceExists && targetExists) {
                    this.core.addEdge(newEdge);
                }
            });
        });

        this.ui.node.select(el);
    };

    clipboard.pasteFromSimpleNodes = function(data) {
        if (!data.nodes?.length) return;

        const offset = 50;

        this.core.batchChanges(() => {
            data.nodes.forEach(node => {
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
                    parameters: node.parameters || {}
                };

                this.core.addNode(newNode);
                const el = this.ui.node.createElement(newNode);
                this.ui.canvas.canvasContent.appendChild(el);
                this.ui.canvas.setEmptyState(false);
            });

            data.edges?.forEach(edge => {
                const newEdge = {
                    id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    source: `node_${edge.source || edge.sourceNodeID}`,
                    target: `node_${edge.target || edge.targetNodeID}`
                };

                const sourceExists = this.core.nodes.find(n => n.id === newEdge.source);
                const targetExists = this.core.nodes.find(n => n.id === newEdge.target);

                if (sourceExists && targetExists) {
                    this.core.addEdge(newEdge);
                }
            });
        });
    };
}