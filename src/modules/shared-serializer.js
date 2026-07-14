/**
 * 工作流序列化模块
 * 负责工作流的导入、导出和剪贴板加载
 */
import { t } from '../i18n/i18n.js';
import { Logger } from '../utils/logger.js';
import { deepClone } from '../utils/helpers.js';
import { REV_TYPE_MAP, TYPE_MAP } from '../utils/types.js';

/**
 * 根据节点类型获取正确的默认尺寸（归一化到 Coze 标准）
 * @param {string} _type - 节点类型名称
 * @returns {{ width: number, height: number }}
 */
function getDefaultSize(_type) {
    return { width: 200, height: 100 };
}

/**
 * 将Coze剪贴板格式转换为内部格式（独立函数，供管理页面导入使用）
 * @param {object} data - 剪贴板数据对象（convertYamlToClipboard 的输出）
 * @returns {{ nodes: Array, edges: Array }} 内部格式的节点和边
 */
export function convertClipboardToInternal(data) {
    if (!data || !data.json?.nodes?.length) {
        throw new Error('Invalid clipboard data');
    }

    const nodes = [];
    const edges = [];
    const idMap = {};
    let nodeIdCounter = 0;
    let edgeIdCounter = 0;
    const reverseIdMap = {};
    const variableMergeEdgeMap = new Map();

    const processNodeRecursive = (cozeNode, parentId = null) => {
        const originalId = String(cozeNode.id);
        const newNodeId = `node_${++nodeIdCounter}`;
        idMap[originalId] = newNodeId;

        let type = 'plugin';
        try {
            const typeStr = String(cozeNode.type);
            const typeName = REV_TYPE_MAP[typeStr];
            if (typeName) {
                type = typeName;
            }
        } catch (err) {
            type = 'plugin';
        }

        const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
        const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;

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
                if (output.schema && Array.isArray(output.schema)) {
                    nodeOutputs[output.name].properties = output.schema;
                }
            });
            if (Object.keys(nodeOutputs).length > 0) {
                parameters.node_outputs = nodeOutputs;
            }
        }
        if (cozeNode.data?.inputs && typeof cozeNode.data.inputs === 'object') {
            Object.entries(cozeNode.data.inputs).forEach(([key, value]) => {
                if (key !== 'inputParameters' && key !== 'schemaType') {
                    if (key === 'llmParam' && Array.isArray(value)) {
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

        const title = cozeNode.data?.nodeMeta?.title || cozeNode.title || 'Unknown';
        const description = cozeNode.data?.nodeMeta?.description || cozeNode.description || '';

        const newNode = {
            id: newNodeId,
            type: type,
            x: nodeX,
            y: nodeY,
            title: title,
            description: description,
            parameters: parameters,
            ...getDefaultSize(type),
        };

        if (parentId) {
            /** @type {*} */ (newNode).parentId = parentId;
            newNode.x = cozeNode.meta?.position?.x || 0;
            newNode.y = cozeNode.meta?.position?.y || 0;
        }

        if (cozeNode.inputParams && Array.isArray(cozeNode.inputParams)) {
            /** @type {*} */ (newNode).inputParams = deepClone(cozeNode.inputParams);
        }

        nodes.push(newNode);

        if (Array.isArray(cozeNode.blocks) && cozeNode.blocks.length > 0) {
            parameters.blocks = cozeNode.blocks;
            /** @type {*} */ (newNode)._skipLayout = true;
            cozeNode.blocks.forEach((block) => {
                processNodeRecursive(block, newNodeId);
            });
        }
    };

    data.json.nodes.forEach((cozeNode) => {
        processNodeRecursive(cozeNode);
    });

    for (const [srcId, newId] of Object.entries(idMap)) {
        reverseIdMap[newId] = srcId;
    }

    nodes.forEach((node) => {
        if (node.type === 'variable_merge' && node.parameters?.mergeGroups) {
            const sourceId = reverseIdMap[node.id];
            if (!sourceId) return;

            const targetEdges = (data.json.edges || []).filter((e) => e.targetNodeID === sourceId);
            const filteredEdges = targetEdges.filter((e) => e.sourcePortID !== 'default');

            const edgeTypes = [];
            filteredEdges.forEach((e) => {
                const sourceNode = data.json.nodes.find((n) => String(n.id) === e.sourceNodeID);
                if (sourceNode) edgeTypes.push(String(sourceNode.type));
            });

            const typeCount = {};
            edgeTypes.forEach((t) => {
                typeCount[t] = (typeCount[t] || 0) + 1;
            });
            let mostCommonType = null;
            let maxCount = 0;
            for (const [t, c] of Object.entries(typeCount)) {
                if (c > maxCount) {
                    maxCount = c;
                    mostCommonType = t;
                }
            }

            const matchingEdges = mostCommonType
                ? filteredEdges.filter((e) => {
                      const sourceNode = data.json.nodes.find((n) => String(n.id) === e.sourceNodeID);
                      return sourceNode && String(sourceNode.type) === mostCommonType;
                  })
                : filteredEdges;

            variableMergeEdgeMap.set(node.id, matchingEdges);
        }
    });

    nodes.forEach((node) => {
        if (node.inputParams && Array.isArray(node.inputParams)) {
            node.inputParams.forEach((param) => {
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
            const edgeMatches = variableMergeEdgeMap.get(node.id);
            let edgeIndex = 0;
            node.parameters.mergeGroups.forEach((group) => {
                if (group.variables && Array.isArray(group.variables)) {
                    group.variables.forEach((v) => {
                        if (v.value?.type === 'ref' && v.value.content?.blockID) {
                            const blockIdStr = String(v.value.content.blockID);
                            const newBlockId = idMap[blockIdStr];
                            if (newBlockId) {
                                v.value.content.blockID = newBlockId;
                            } else if (edgeMatches && edgeIndex < edgeMatches.length) {
                                const edgeSourceId = edgeMatches[edgeIndex].sourceNodeID;
                                const mappedId = idMap[String(edgeSourceId)];
                                if (mappedId) {
                                    v.value.content.blockID = mappedId;
                                }
                                edgeIndex++;
                            }
                        }
                    });
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
                edges.push({
                    id: `edge_${++edgeIdCounter}`,
                    source: sourceId,
                    target: targetId,
                    sourcePort: edge.sourcePortID || '',
                    targetPort: edge.targetPortID || '',
                });
            }
        });
    }

    return { nodes, edges };
}

/**
 * 将内部节点格式转换为 Coze 剪贴板格式（供 reverse.js 消费）
 * @param {object} node - 内部节点
 * @param {object[]} allNodes - 全部节点（用于查找子节点）
 * @returns {object} 剪贴板格式节点
 */
export function convertInternalToClipboardNode(node, allNodes) {
    const cozeType = TYPE_MAP[node.type] || '4';
    const params = node.parameters || {};

    const inputs = {};
    const outputs = [];

    Object.entries(params).forEach(([key, value]) => {
        if (key === '_llmParamRaw') {
            inputs.llmParam = value;
        } else if (key === '_contentRaw') {
            inputs.content = value;
        } else if (key === 'node_outputs') {
            const outObj = value || {};
            Object.entries(outObj).forEach(([name, def]) => {
                outputs.push({ name, ...def });
            });
        } else if (key === 'node_inputs') {
            inputs.inputParameters = value;
        } else {
            inputs[key] = value;
        }
    });

    const clipNode = {
        id: String(node.id).replace('node_', ''),
        type: cozeType,
        meta: { position: { x: node.x || 0, y: node.y || 0 } },
        data: {
            nodeMeta: {
                title: node.title || '',
                icon: node.icon || '',
                description: node.description || '',
            },
            inputs,
            outputs,
        },
    };

    if (node.color) clipNode.data.nodeMeta.mainColor = node.color;

    const children = allNodes.filter((n) => n.parentId === node.id);
    if (children.length > 0) {
        clipNode.blocks = children.map((c) => convertInternalToClipboardNode(c, allNodes));
    }

    return clipNode;
}

/**
 * 序列化相关的 mixin 方法
 * @param {import('./editor-core.js').WorkflowCore} core - WorkflowCore 实例
 */
export class WorkflowSerializer {
    /**
     * @param {import('./editor-core.js').WorkflowCore} core - WorkflowCore 实例
     */
    constructor(core) {
        this.core = core;
    }

    /**
     * 导入工作流数据
     * @param {object} workflow - 工作流数据对象
     */
    importWorkflow(workflow) {
        if (!workflow || !workflow.nodes) return;

        this.core.clearAll();

        const nodeIdMap = new Map();

        const processNode = (nodeData) => {
            const nodeId = `node_${nodeData.id}`;
            nodeIdMap.set(nodeData.id, nodeId);

            let type = nodeData.type;
            if (/^\d+$/.test(String(type))) {
                type = this.core.getTypeFromNumber(type);
            }

            const node = {
                id: nodeId,
                type: type,
                x: nodeData.position?.x || 0,
                y: nodeData.position?.y || 0,
                title: nodeData.title || '',
                description: nodeData.description || '',
                parameters: nodeData.parameters || {},
                parentId: nodeData.parentId || null,
            };
            if (nodeData.icon) node.icon = nodeData.icon;

            if (nodeData.nodes && Array.isArray(nodeData.nodes)) {
                nodeData.nodes.forEach((childNodeData) => {
                    const childNodeId = `node_${childNodeData.id}`;
                    nodeIdMap.set(childNodeData.id, childNodeId);
                    let childType = childNodeData.type;
                    if (/^\d+$/.test(String(childType))) {
                        childType = this.core.getTypeFromNumber(childType);
                    }
                    const child = {
                        id: childNodeId,
                        type: childType,
                        x: childNodeData.position?.x || 0,
                        y: childNodeData.position?.y || 0,
                        title: childNodeData.title || '',
                        description: childNodeData.description || '',
                        parameters: childNodeData.parameters || {},
                        parentId: nodeId,
                    };
                    if (childNodeData.icon) child.icon = childNodeData.icon;
                    this.core.nodes.push(child);

                    // Remap blockID for child loop_set_variable
                    if (child.type === 'loop_set_variable' && Array.isArray(child.parameters?.variables)) {
                        child.parameters.variables.forEach((v) => {
                            if (v.left?.value?.content?.blockID && typeof v.left.value.content.blockID === 'string') {
                                const newBlockId = nodeIdMap.get(Number(v.left.value.content.blockID));
                                if (newBlockId) {
                                    v.left.value.content.blockID = newBlockId;
                                }
                            }
                            if (v.right?.value?.content?.blockID && typeof v.right.value.content.blockID === 'string') {
                                const newBlockId = nodeIdMap.get(Number(v.right.value.content.blockID));
                                if (newBlockId) {
                                    v.right.value.content.blockID = newBlockId;
                                }
                            }
                        });
                    }
                });
            }

            // Remap blockID for loop_set_variable variables
            if (node.type === 'loop_set_variable' && Array.isArray(node.parameters.variables)) {
                node.parameters.variables.forEach((v) => {
                    if (v.left?.value?.content?.blockID && typeof v.left.value.content.blockID === 'string') {
                        const newBlockId = nodeIdMap.get(Number(v.left.value.content.blockID));
                        if (newBlockId) {
                            v.left.value.content.blockID = newBlockId;
                        }
                    }
                    if (v.right?.value?.content?.blockID && typeof v.right.value.content.blockID === 'string') {
                        const newBlockId = nodeIdMap.get(Number(v.right.value.content.blockID));
                        if (newBlockId) {
                            v.right.value.content.blockID = newBlockId;
                        }
                    }
                });
            }

            return node;
        };

        workflow.nodes.forEach((nodeData) => {
            this.core.nodes.push(processNode(nodeData));
        });

        if (workflow.edges) {
            workflow.edges.forEach((edgeData) => {
                const sourceId = nodeIdMap.get(edgeData.source_node);
                const targetId = nodeIdMap.get(edgeData.target_node);

                if (sourceId && targetId) {
                    if (edgeData.source_port) {
                        this.core.createEdge(sourceId, targetId, edgeData.source_port);
                    } else {
                        this.core.createEdge(sourceId, targetId);
                    }
                }
            });
        }
    }

    /**
     * 导出工作流数据
     * @param {object} [options] - 导出选项
     * @param {string} [options.name] - 工作流名称
     * @param {string} [options.id] - 工作流ID
     * @param {string} [options.description] - 工作流描述
     * @returns {object} 工作流数据对象
     */
    exportWorkflow(options = {}) {
        return {
            schema_version: '1.0.0',
            name: options.name || 'my_workflow',
            id: options.id || `workflow_${Date.now()}`,
            description: options.description || 'Created with workflow editor',
            mode: 'workflow',
            icon: 'plugin_icon/workflow.png',
            nodes: this.core.nodes
                .filter((n) => !n.parentId)
                .map((n) => {
                    const node = {
                        id: n.id.replace('node_', ''),
                        type: n.type,
                        title: n.title,
                        description: n.description,
                        position: { x: n.x, y: n.y },
                        parameters: n.parameters,
                    };
                    if (n.icon) node.icon = n.icon;
                    const blocks = this.core.nodes.filter((c) => c.parentId === n.id);
                    if (blocks.length > 0) {
                        node.nodes = blocks.map((b) => {
                            const child = {
                                id: b.id.replace('node_', ''),
                                type: b.type,
                                title: b.title,
                                description: b.description,
                                position: { x: b.x, y: b.y },
                                parameters: b.parameters,
                            };
                            if (b.icon) child.icon = b.icon;
                            return child;
                        });
                    }
                    return node;
                }),
            edges: this.core.edges.map((e) => {
                const edge = {
                    source_node: e.source.replace('node_', ''),
                    target_node: e.target.replace('node_', ''),
                };
                if (e.sourcePort) edge.source_port = e.sourcePort;
                return edge;
            }),
        };
    }

    /**
     * 从剪贴板数据加载工作流
     * @param {object} data - 剪贴板数据对象
     */
    loadFromClipboard(data) {
        if (!data || !data.json?.nodes?.length) {
            Logger.warn('无效的剪贴板数据');
            return;
        }

        this.core.clearAll();

        const idMap = {};

        const reverseIdMap = {};
        const variableMergeEdgeMap = new Map();

        const processNodeRecursive = (cozeNode, parentId = null) => {
            const originalId = String(cozeNode.id);
            const newNodeId = `node_${++this.core.nodeIdCounter}`;
            idMap[originalId] = newNodeId;

            let type = 'plugin';
            try {
                type = this.core.getTypeFromNumber(cozeNode.type);
            } catch (err) {
                type = 'plugin';
            }

            const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
            const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;

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
                    if (output.schema && Array.isArray(output.schema)) {
                        nodeOutputs[output.name].properties = output.schema;
                    }
                });
                if (Object.keys(nodeOutputs).length > 0) {
                    parameters.node_outputs = nodeOutputs;
                }
            }
            if (cozeNode.data?.inputs && typeof cozeNode.data.inputs === 'object') {
                Object.entries(cozeNode.data.inputs).forEach(([key, value]) => {
                    if (key !== 'inputParameters' && key !== 'schemaType') {
                        if (key === 'llmParam' && Array.isArray(value)) {
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

            const title = cozeNode.data?.nodeMeta?.title || cozeNode.title || t('messages.unknownNode');
            const description = cozeNode.data?.nodeMeta?.description || cozeNode.description || '';

            const newNode = {
                id: newNodeId,
                type: type,
                x: nodeX,
                y: nodeY,
                title: title,
                description: description,
                parameters: parameters,
                ...getDefaultSize(type),
            };

            if (parentId) {
                /** @type {*} */ (newNode).parentId = parentId;
                newNode.x = cozeNode.meta?.position?.x || 0;
                newNode.y = cozeNode.meta?.position?.y || 0;
            }

            if (cozeNode.inputParams && Array.isArray(cozeNode.inputParams)) {
                /** @type {*} */ (newNode).inputParams = deepClone(cozeNode.inputParams);
            }

            this.core.nodes.push(newNode);

            if (Array.isArray(cozeNode.blocks) && cozeNode.blocks.length > 0) {
                parameters.blocks = cozeNode.blocks;
                /** @type {*} */ (newNode)._skipLayout = true;
                cozeNode.blocks.forEach((block) => {
                    processNodeRecursive(block, newNodeId);
                });
            }
        };

        data.json.nodes.forEach((cozeNode) => {
            processNodeRecursive(cozeNode);
        });

        for (const [srcId, newId] of Object.entries(idMap)) {
            reverseIdMap[newId] = srcId;
        }

        this.core.nodes.forEach((node) => {
            if (node.type === 'variable_merge' && node.parameters?.mergeGroups) {
                const sourceId = reverseIdMap[node.id];
                if (!sourceId) return;

                const targetEdges = (data.json.edges || []).filter((e) => e.targetNodeID === sourceId);
                const filteredEdges = targetEdges.filter((e) => e.sourcePortID !== 'default');

                const edgeTypes = [];
                filteredEdges.forEach((e) => {
                    const sourceNode = data.json.nodes.find((n) => String(n.id) === e.sourceNodeID);
                    if (sourceNode) edgeTypes.push(String(sourceNode.type));
                });

                const typeCount = {};
                edgeTypes.forEach((t) => {
                    typeCount[t] = (typeCount[t] || 0) + 1;
                });
                let mostCommonType = null;
                let maxCount = 0;
                for (const [t, c] of Object.entries(typeCount)) {
                    if (c > maxCount) {
                        maxCount = c;
                        mostCommonType = t;
                    }
                }

                const matchingEdges = mostCommonType
                    ? filteredEdges.filter((e) => {
                          const sourceNode = data.json.nodes.find((n) => String(n.id) === e.sourceNodeID);
                          return sourceNode && String(sourceNode.type) === mostCommonType;
                      })
                    : filteredEdges;

                variableMergeEdgeMap.set(node.id, matchingEdges);
            }
        });

        this.core.nodes.forEach((node) => {
            if (node.inputParams && Array.isArray(node.inputParams)) {
                node.inputParams.forEach((param) => {
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
                const edgeMatches = variableMergeEdgeMap.get(node.id);
                let edgeIndex = 0;
                node.parameters.mergeGroups.forEach((group) => {
                    if (group.variables && Array.isArray(group.variables)) {
                        group.variables.forEach((v) => {
                            if (v.value?.type === 'ref' && v.value.content?.blockID) {
                                const blockIdStr = String(v.value.content.blockID);
                                const newBlockId = idMap[blockIdStr];
                                if (newBlockId) {
                                    v.value.content.blockID = newBlockId;
                                } else if (edgeMatches && edgeIndex < edgeMatches.length) {
                                    const edgeSourceId = edgeMatches[edgeIndex].sourceNodeID;
                                    const mappedId = idMap[String(edgeSourceId)];
                                    if (mappedId) {
                                        v.value.content.blockID = mappedId;
                                    }
                                    edgeIndex++;
                                }
                            }
                        });
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
                    this.core.createEdge(sourceId, targetId);
                }
            });
        }

        this.core.resetHistory('messages.importFromClipboard');
    }
}
