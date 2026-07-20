/**
 * 工作流序列化模块
 * 负责工作流的导入、导出和剪贴板加载
 */
import { t } from '../../i18n/i18n.js';
import { Logger } from '../../utils/logger.js';
import { deepClone } from '../../utils/helpers.js';
import { REV_TYPE_MAP, TYPE_MAP, getMainColor, getSubTitle } from '../../utils/types.js';

/**
 * 根据节点类型获取正确的默认尺寸（归一化到 Coze 标准）
 * @param {string} _type - 节点类型名称
 * @returns {{ width: number, height: number }}
 */
function getDefaultSize(_type) {
    return { width: 200, height: 100 };
}

// ====================================================================
// 共享 Coze 节点解析逻辑（消除 convertClipboardToInternal 和 loadFromClipboard 的重复）
// ====================================================================

/**
 * 解析单个 Coze 节点的 inputs，填充到 parameters 对象
 * @param {object} inputs - cozeNode.data.inputs
 * @param {object} parameters - 要填充的 parameters 对象
 * @param {string} type - 节点类型
 * @param {object} cozeNode - 原始 Coze 节点（用于 loop_set_variable 特殊处理）
 */
function _parseCozeInputs(inputs, parameters, type, cozeNode) {
    if (!inputs || typeof inputs !== 'object') return;

    Object.entries(inputs).forEach(([key, value]) => {
        if (key === 'schemaType') return;

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
        } else if (key === 'note') {
            // 保留原始 Slate JSON（comment/plugin 节点序列化需要原始结构）
            parameters._noteRaw = value;
            parameters[key] = value;
        } else {
            parameters[key] = value;
        }
    });

    // loop_set_variable 特殊处理
    if (type === 'loop_set_variable' && Array.isArray(cozeNode.data?.inputs?.inputParameters)) {
        parameters.variables = cozeNode.data.inputs.inputParameters;
    }
}

/**
 * 解析单个 Coze 节点的 outputs，填充到 parameters 对象
 * @param {object[]} outputs - cozeNode.data.outputs
 * @param {object} parameters - 要填充的 parameters 对象
 */
function _parseCozeOutputs(outputs, parameters) {
    if (!outputs) return;

    outputs.forEach((output) => {
        if (output.defaultValue !== undefined) {
            parameters[output.name] = output.defaultValue;
        }
    });
    const nodeOutputs = {};
    outputs.forEach((output) => {
        const entry = {
            type: output.type || 'string',
            description: output.description || '',
            required: output.required || false,
        };
        // 保留 Coze 原生元数据（zip 导入 → 编辑器 → 复制回 Coze 必须保留）
        if (output.assistType !== undefined) entry.assistType = output.assistType;
        if (output.rawMeta) entry.rawMeta = output.rawMeta;
        if (output.defaultValue !== undefined && output.defaultValue !== '') {
            entry.value = output.defaultValue;
        }
        if (output.schema) {
            if (Array.isArray(output.schema)) {
                entry.properties = output.schema;
            } else {
                entry.schema = output.schema;
            }
        }
        nodeOutputs[output.name] = entry;
    });
    if (Object.keys(nodeOutputs).length > 0) {
        parameters.node_outputs = nodeOutputs;
    }
}

/**
 * 从 Coze 节点创建内部节点对象
 * @param {object} cozeNode - 原始 Coze 节点数据
 * @param {function(string|number): string} resolveType - 类型解析函数
 * @param {string} newNodeId - 新分配的节点 ID
 * @returns {object} 内部格式的节点对象
 */
function _buildNodeFromCoze(cozeNode, resolveType, newNodeId) {
    let type = 'plugin';
    try {
        type = resolveType(cozeNode.type);
    } catch (err) {
        type = 'plugin';
    }

    const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
    const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;

    const parameters = {};
    _parseCozeOutputs(cozeNode.data?.outputs, parameters);
    _parseCozeInputs(cozeNode.data?.inputs, parameters, type, cozeNode);

    const title = cozeNode.data?.nodeMeta?.title || cozeNode.title || t('messages.unknownNode');
    const description = cozeNode.data?.nodeMeta?.description || cozeNode.description || '';
    const icon = cozeNode.data?.nodeMeta?.icon || cozeNode.icon || '';
    const mainColor = cozeNode.data?.nodeMeta?.mainColor || '';

    const newNode = {
        id: newNodeId,
        type,
        x: nodeX,
        y: nodeY,
        title,
        description,
        parameters,
        ...getDefaultSize(type),
    };

    if (icon) newNode.icon = icon;
    if (mainColor) newNode.color = mainColor;

    if (cozeNode.inputParams && Array.isArray(cozeNode.inputParams)) {
        newNode.inputParams = deepClone(cozeNode.inputParams);
    }
    // 从 data.inputs.inputParameters 恢复 internal inputParams（zip 导入路径）
    if (!newNode.inputParams && parameters.inputParameters && Array.isArray(parameters.inputParameters)) {
        newNode.inputParams = parameters.inputParameters.map((p) => {
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
        });
    }

    return newNode;
}

/**
 * 递归处理 Coze 节点树，返回节点数组和 ID 映射
 * @param {object[]} cozeNodes - Coze 节点数组
 * @param {function(string|number): string} resolveType - 类型解析函数
 * @param {number} startCounter - 起始 ID 计数器值（可选，默认 0）
 * @returns {{ nodes: object[], idMap: object, nextCounter: number }}
 */
function _processCozeNodeTree(cozeNodes, resolveType, startCounter = 0) {
    const nodes = [];
    const idMap = {};
    let nodeIdCounter = startCounter;

    const walk = (cozeNode, parentId = null) => {
        const originalId = String(cozeNode.id);
        const newNodeId = `node_${++nodeIdCounter}`;
        idMap[originalId] = newNodeId;

        const newNode = _buildNodeFromCoze(cozeNode, resolveType, newNodeId);

        if (parentId) {
            newNode.parentId = parentId;
            newNode.x = cozeNode.meta?.position?.x || 0;
            newNode.y = cozeNode.meta?.position?.y || 0;
        }

        nodes.push(newNode);

        if (Array.isArray(cozeNode.blocks) && cozeNode.blocks.length > 0) {
            newNode.parameters.blocks = cozeNode.blocks;
            newNode._skipLayout = true;
            cozeNode.blocks.forEach((block) => {
                walk(block, newNodeId);
            });
        }
    };

    cozeNodes.forEach((n) => walk(n));

    return { nodes, idMap, nextCounter: nodeIdCounter };
}

/**
 * 构建 blockID 的反向映射
 * @param {object} idMap - 原始ID → 新ID 映射
 * @returns {object} 新ID → 原始ID 映射
 */
function _buildReverseIdMap(idMap) {
    const reverse = {};
    for (const [srcId, newId] of Object.entries(idMap)) {
        reverse[newId] = srcId;
    }
    return reverse;
}

/**
 * 为 variable_merge 节点构建边匹配映射
 * @param {object[]} nodes - 内部节点数组
 * @param {object} reverseIdMap - 新ID → 原始ID
 * @param {object[]} cozeEdges - Coze 边数组
 * @param {object[]} cozeNodes - Coze 节点数组
 * @returns {Map<string, object[]>} 节点ID → 匹配边的映射
 */
function _buildVariableMergeEdgeMap(nodes, reverseIdMap, cozeEdges, cozeNodes) {
    const edgeMap = new Map();

    nodes.forEach((node) => {
        if (node.type !== 'variable_merge' || !node.parameters?.mergeGroups) return;

        const sourceId = reverseIdMap[node.id];
        if (!sourceId) return;

        const targetEdges = (cozeEdges || []).filter((e) => e.targetNodeID === sourceId);
        const filteredEdges = targetEdges.filter((e) => e.sourcePortID !== 'default');

        const edgeTypes = [];
        filteredEdges.forEach((e) => {
            const sourceNode = cozeNodes.find((n) => String(n.id) === e.sourceNodeID);
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
                  const src = cozeNodes.find((n) => String(n.id) === e.sourceNodeID);
                  return src && String(src.type) === mostCommonType;
              })
            : filteredEdges;

        edgeMap.set(node.id, matchingEdges);
    });

    return edgeMap;
}

/**
 * 重映射节点中的 blockID 引用
 * @param {object[]} nodes - 内部节点数组
 * @param {object} idMap - 原始ID → 新ID 映射
 * @param {Map<string, object[]>} [variableMergeEdgeMap] - variable_merge 边映射
 */
function _remapBlockIDs(nodes, idMap, variableMergeEdgeMap) {
    /** 重映射 _contentRaw / dynamic_option 等对象的 blockID（需 value.type === 'ref'） */
    const remapRefObj = (obj) => {
        if (obj?.value?.type === 'ref' && obj.value.content?.blockID) {
            const newId = idMap[String(obj.value.content.blockID)];
            if (newId) obj.value.content.blockID = newId;
        }
    };

    nodes.forEach((node) => {
        // inputParams 中的 ref blockID（数据结构：{ valueType: 'ref', value: { content: { blockID } } }）
        // 注意：inputParam.value 内部没有 type 字段，直接检查 content.blockID
        if (node.inputParams && Array.isArray(node.inputParams)) {
            node.inputParams.forEach((param) => {
                if (param.valueType === 'ref' && typeof param.value === 'object' && param.value.content?.blockID) {
                    const newId = idMap[String(param.value.content.blockID)];
                    if (newId) param.value.content.blockID = newId;
                }
            });
        }

        const p = node.parameters;
        if (!p) return;

        // _contentRaw 中的 ref blockID
        if (p._contentRaw && typeof p._contentRaw === 'object') {
            remapRefObj(p._contentRaw);
        }

        // dynamic_option 中的 ref blockID
        if (p.dynamic_option && typeof p.dynamic_option === 'object') {
            remapRefObj(p.dynamic_option);
        }

        // mergeGroups 中的 ref blockID
        if (p.mergeGroups && Array.isArray(p.mergeGroups)) {
            const edgeMatches = variableMergeEdgeMap?.get(node.id);
            let edgeIndex = 0;
            p.mergeGroups.forEach((group) => {
                if (group.variables && Array.isArray(group.variables)) {
                    group.variables.forEach((v) => {
                        if (v.value?.type === 'ref' && v.value.content?.blockID) {
                            const blockIdStr = String(v.value.content.blockID);
                            const newBlockId = idMap[blockIdStr];
                            if (newBlockId) {
                                v.value.content.blockID = newBlockId;
                            } else if (edgeMatches && edgeIndex < edgeMatches.length) {
                                const mappedId = idMap[String(edgeMatches[edgeIndex].sourceNodeID)];
                                if (mappedId) v.value.content.blockID = mappedId;
                                edgeIndex++;
                            }
                        }
                    });
                }
            });
        }

        // loop_set_variable variables 中的 blockID
        if (node.type === 'loop_set_variable' && Array.isArray(p.variables)) {
            p.variables.forEach((v) => {
                ['left', 'right'].forEach((side) => {
                    if (v[side]?.value?.content?.blockID && typeof v[side].value.content.blockID === 'string') {
                        const newBlockId = idMap[String(v[side].value.content.blockID)];
                        if (newBlockId) v[side].value.content.blockID = newBlockId;
                    }
                });
            });
        }

        // firstFrame 中的 ref blockID（视频生成节点）
        if (p.firstFrame && typeof p.firstFrame === 'object') {
            remapRefObj(p.firstFrame);
        }

        // 条件节点 branches 中的 ref blockID
        if (p.branches && Array.isArray(p.branches)) {
            p.branches.forEach((branch) => {
                const conditions = branch.condition?.conditions;
                if (!Array.isArray(conditions)) return;
                conditions.forEach((cond) => {
                    ['left', 'right'].forEach((side) => {
                        remapRefObj(cond[side]?.input);
                    });
                });
            });
        }
    });
}

/**
 * 处理 Coze 边，生成内部边数组或直接创建边
 * @param {object[]} cozeEdges - Coze 边数组
 * @param {object} idMap - 原始ID → 新ID 映射
 * @param {object} [options] - 选项
 * @param {function} [options.createEdge] - 如果提供，直接创建边（loadFromClipboard 场景）
 * @returns {object[]} 内部边数组（仅当未提供 createEdge 时）
 */
function _processEdges(cozeEdges, idMap, options = {}) {
    if (!cozeEdges) return options.createEdge ? [] : [];
    let edgeIdCounter = 0;

    const edges = [];
    cozeEdges.forEach((edge) => {
        const sourceId = idMap[String(edge.sourceNodeID)];
        const targetId = idMap[String(edge.targetNodeID)];

        if (sourceId && targetId) {
            if (options.createEdge) {
                options.createEdge(sourceId, targetId, edge.sourcePortID || '', edge.targetPortID || '');
            } else {
                edges.push({
                    id: `edge_${++edgeIdCounter}`,
                    source: sourceId,
                    target: targetId,
                    sourcePort: edge.sourcePortID || '',
                    targetPort: edge.targetPortID || '',
                });
            }
        }
    });
    return edges;
}

// ====================================================================
// 内部节点 → Coze 节点序列化（统一路径，消除 clipboard 重复逻辑）
// ====================================================================

/**
 * 构建 Coze 节点基础结构
 * @param {object} node - 内部节点
 * @returns {object} Coze 格式节点（含 data.inputs/outputs 空壳）
 */
function _buildCozeNodeBase(node) {
    const type = node.type;
    const typeNum = TYPE_MAP[type] || '4';
    return {
        id: String(node.id).replace('node_', ''),
        type: typeNum,
        meta: { position: { x: node.x || 0, y: node.y || 0 } },
        data: {
            nodeMeta: {
                title: node.title || '',
                icon: node.icon || '',
                description: node.description || '',
                mainColor: node.color || getMainColor(type),
                subTitle: getSubTitle(type),
            },
            outputs: [],
            inputs: { inputParameters: [] },
        },
    };
}

/**
 * 序列化节点参数（按类型分发）
 * @param {object} node - 内部节点
 * @param {object} cozeNode - 要填充的 Coze 节点
 */
function _serializeNodeParameters(node, cozeNode) {
    _serializeOutputs(node, cozeNode);
    _serializeInputParams(node, cozeNode);
    _serializeOutputParams(node, cozeNode);
    _serializeTypeSpecific(node, cozeNode);

    // 补充 inputParameters (旧格式)
    if (node.inputParameters && Array.isArray(node.inputParameters)) {
        cozeNode.data.inputs.inputParameters = node.inputParameters.map((param) => ({
            name: param.name || '',
            input: {
                type: param.type || 'string',
                value: {
                    type: param.valueType || 'literal',
                    content: param.value || '',
                    ...(param.rawMeta && { rawMeta: param.rawMeta }),
                },
            },
        }));
    }

    // 合并外部 inputs
    if (node.inputs && typeof node.inputs === 'object') {
        cozeNode.data.inputs = { ...cozeNode.data.inputs, ...node.inputs };
    }

    // Input 节点补充 outputs
    if (cozeNode.data.outputs.length === 0 && node.type === 'input') {
        let schema = cozeNode.data.inputs.outputSchema || [];
        if (typeof schema === 'string') schema = JSON.parse(schema);
        schema.forEach((field) => {
            cozeNode.data.outputs.push({
                name: field.name || 'output',
                type: field.type || 'string',
                required: field.required === true,
                description: field.description || '',
            });
        });
    }

    if (node.type === 'code') cozeNode.data.version = 'v2';
}

/** 序列化 node_outputs */
function _serializeOutputs(node, cozeNode) {
    if (!node.parameters?.node_outputs || typeof node.parameters.node_outputs !== 'object') return;

    Object.entries(node.parameters.node_outputs).forEach(([name, output]) => {
        const outEntry = {
            name,
            type: output.type || 'string',
            required: output.required === true,
            description: output.description || '',
        };
        if (output.value && output.value !== '') outEntry.defaultValue = output.value;
        if (output.rawMeta) outEntry.rawMeta = output.rawMeta;
        if (output.assistType !== undefined) outEntry.assistType = output.assistType;
        if (output.schema && typeof output.schema === 'object') {
            outEntry.schema = output.schema;
        } else if (output.properties) {
            outEntry.schema = Array.isArray(output.properties)
                ? output.properties
                : Object.entries(output.properties).map(([propName, prop]) => ({
                      name: propName,
                      type: prop.type || 'string',
                      required: prop.required === true,
                      description: prop.description || '',
                  }));
        }
        if (output.input && typeof output.input === 'object') outEntry.input = output.input;
        cozeNode.data.outputs.push(outEntry);
    });

    // 合并 node.outputs
    if (node.outputs && Array.isArray(node.outputs)) {
        node.outputs.forEach((output) => {
            const existingIndex = cozeNode.data.outputs.findIndex((o) => o.name === output.name);
            if (existingIndex >= 0) {
                cozeNode.data.outputs[existingIndex] = { ...cozeNode.data.outputs[existingIndex], ...output };
            } else {
                cozeNode.data.outputs.push(output);
            }
        });
    }
}

/** 序列化动态入参 */
function _serializeInputParams(node, cozeNode) {
    if (!node.inputParams || !Array.isArray(node.inputParams) || node.inputParams.length === 0) return;

    cozeNode.data.inputs.inputParameters = node.inputParams.map((p) => {
        const isRef = p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
        return {
            name: p.name,
            input: {
                type: p.type || 'string',
                value: isRef
                    ? { ...p.value, ...(p.rawMeta && { rawMeta: p.rawMeta }) }
                    : { type: 'literal', content: p.value || '', ...(p.rawMeta && { rawMeta: p.rawMeta }) },
                ...(p.schema && { schema: p.schema }),
            },
        };
    });
}

/** 序列化动态出参 */
function _serializeOutputParams(node, cozeNode) {
    if (!node.outputParams || !Array.isArray(node.outputParams)) return;

    node.outputParams.forEach((p) => {
        const isRef = p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
        const exists = cozeNode.data.outputs.find((o) => o.name === p.name);

        if (exists) {
            if (isRef && !exists.input) {
                exists.input = {
                    type: p.type || 'string',
                    value: { ...p.value, ...(p.rawMeta && { rawMeta: p.rawMeta }) },
                };
                delete exists.defaultValue;
            } else if (!isRef && p.value && p.value !== '') {
                exists.defaultValue = p.value;
            }
        } else {
            const outEntry = {
                name: p.name,
                type: p.type || 'string',
                description: p.description || '',
            };
            if (isRef) {
                outEntry.input = {
                    type: p.type || 'string',
                    value: { ...p.value, ...(p.rawMeta && { rawMeta: p.rawMeta }) },
                };
            } else if (p.value && p.value !== '') {
                outEntry.defaultValue = p.value;
            }
            cozeNode.data.outputs.push(outEntry);
        }
    });
}

/** 按节点类型分发序列化 */
function _serializeTypeSpecific(node, cozeNode) {
    const p = node.parameters;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return;

    const type = node.type;

    if (type === 'variable_merge') {
        if (p.mergeGroups) cozeNode.data.inputs.mergeGroups = p.mergeGroups;
    } else if (type === 'output' || type === 'end') {
        _serializeContentNode(p, cozeNode);
        if (type === 'end') {
            cozeNode.data.inputs.terminatePlan = p.terminatePlan || 'returnVariables';
        } else {
            cozeNode.data.inputs.streamingOutput = p.streamingOutput === true;
            cozeNode.data.inputs.callTransferVoice = p.callTransferVoice === true;
            cozeNode.data.inputs.chatHistoryWriting = p.chatHistoryWriting || 'historyWrite';
        }
    } else if (type === 'input') {
        if (p.outputSchema) {
            cozeNode.data.inputs.outputSchema =
                typeof p.outputSchema === 'string' ? p.outputSchema : JSON.stringify(p.outputSchema);
        }
    } else if (type === 'comment') {
        _serializeComment(p, cozeNode);
    } else if (type === 'llm') {
        _serializeLLM(p, cozeNode);
    } else if (type === 'question') {
        _serializeQuestion(p, cozeNode);
    } else if (type === 'loop_set_variable') {
        cozeNode.data.inputs.inputParameters = Array.isArray(p.variables) && p.variables.length > 0 ? p.variables : [];
    } else {
        _serializeDefaultParameters(p, cozeNode);
    }
}

/** output / end 类型的内容参数 */
function _serializeContentNode(p, cozeNode) {
    if (p._contentRaw) {
        cozeNode.data.inputs.content = p._contentRaw;
    } else if (p.content !== undefined) {
        cozeNode.data.inputs.content = {
            type: 'string',
            value: { type: 'literal', content: p.content },
        };
    }
    cozeNode.data.inputs.streamingOutput = p.streamingOutput === true;
}

/** comment 类型 — 保留 _noteRaw 原始 Slate JSON */
function _serializeComment(p, cozeNode) {
    if (p._noteRaw) {
        cozeNode.data.inputs = {
            schemaType: 'slate',
            note: p._noteRaw,
        };
    } else {
        cozeNode.data.inputs = {
            schemaType: 'slate',
            note: JSON.stringify([{ type: 'paragraph', children: [{ text: p.content || '', type: 'text' }] }]),
        };
    }
}

/** LLM 类型 */
function _serializeLLM(p, cozeNode) {
    const flatParams = p;
    const structuralKeys = ['fcParamVar', 'settingOnError', 'node_outputs', 'node_inputs', '_llmParamRaw'];

    // 构建原始元数据查找表
    const metaMap = {};
    if (flatParams._llmParamRaw && Array.isArray(flatParams._llmParamRaw)) {
        flatParams._llmParamRaw.forEach((p) => {
            const key = p.name === 'modleName' ? 'modelName' : p.name;
            metaMap[key] = {
                inputType: p.input?.type || 'string',
                valueType: p.input?.value?.type || 'literal',
                rawMeta: p.input?.value?.rawMeta,
            };
        });
    }

    const llmParams = [];
    const handledKeys = new Set();
    const modelValue = flatParams.modelName || flatParams.modleName;
    if (modelValue !== undefined) {
        const meta = metaMap.modelName || metaMap.modleName || { inputType: 'string', valueType: 'literal' };
        const valObj = meta.rawMeta
            ? { type: meta.valueType, content: modelValue, rawMeta: meta.rawMeta }
            : { type: meta.valueType, content: modelValue };
        llmParams.push({ name: 'modleName', input: { type: meta.inputType, value: valObj } });
    }
    handledKeys.add('modelName');
    handledKeys.add('modleName');

    Object.entries(flatParams).forEach(([key, value]) => {
        if (structuralKeys.includes(key) || handledKeys.has(key) || value === undefined) return;
        const meta = metaMap[key] || { inputType: 'string', valueType: 'literal' };
        const valObj = meta.rawMeta
            ? { type: meta.valueType, content: value, rawMeta: meta.rawMeta }
            : { type: meta.valueType, content: value };
        llmParams.push({ name: key, input: { type: meta.inputType, value: valObj } });
        handledKeys.add(key);
    });

    if (flatParams._llmParamRaw && Array.isArray(flatParams._llmParamRaw)) {
        flatParams._llmParamRaw.forEach((p) => {
            const key = p.name === 'modleName' ? 'modelName' : p.name;
            if (!handledKeys.has(key) && !handledKeys.has(p.name)) {
                llmParams.push(deepClone(p));
                handledKeys.add(p.name);
            }
        });
    }

    cozeNode.data.inputs.llmParam = llmParams;
    cozeNode.data.inputs.fcParamVar = flatParams.fcParamVar || { knowledgeFCParam: {} };
    cozeNode.data.inputs.settingOnError = flatParams.settingOnError || {
        switch: false,
        processType: 1,
        timeoutMs: 600000,
        retryTimes: 0,
    };
    cozeNode.data.version = '3';
}

/** Question 类型 */
function _serializeQuestion(p, cozeNode) {
    const flatParams = p;
    cozeNode.data.inputs.answer_type = flatParams.answer_type || 'text';
    cozeNode.data.inputs.option_type = flatParams.option_type || 'static';
    cozeNode.data.inputs.options = flatParams.options || [];
    cozeNode.data.inputs.limit = flatParams.limit || 3;
    cozeNode.data.inputs.extra_output = flatParams.extra_output === true;
    cozeNode.data.inputs.question = flatParams.question || '';
    if (flatParams.dynamic_option !== undefined) {
        cozeNode.data.inputs.dynamic_option = flatParams.dynamic_option;
    }

    const structuralKeys = [
        'fcParamVar',
        'settingOnError',
        'node_outputs',
        'node_inputs',
        '_llmParamRaw',
        'answer_type',
        'option_type',
        'options',
        'limit',
        'extra_output',
        'question',
        'dynamic_option',
    ];
    const handledKeys = new Set();
    const llmParams = _buildQuestionLLMParams(flatParams, structuralKeys, handledKeys);

    Object.entries(flatParams).forEach(([key, value]) => {
        if (structuralKeys.includes(key) || handledKeys.has(key) || value === undefined) return;
        const idx = Object.keys(llmParams).length;
        llmParams[String(idx)] = {
            name: key,
            input: { type: 'string', value: { type: 'literal', content: value } },
        };
    });

    cozeNode.data.inputs.llmParam = llmParams;
    cozeNode.data.inputs.fcParamVar = flatParams.fcParamVar || { knowledgeFCParam: {} };
    cozeNode.data.inputs.settingOnError = flatParams.settingOnError || {
        switch: false,
        processType: 1,
        timeoutMs: 600000,
        retryTimes: 0,
    };
    if (flatParams.branches && Array.isArray(flatParams.branches)) {
        cozeNode.data.branches = deepClone(flatParams.branches);
    }
}

function _buildQuestionLLMParams(flatParams, structuralKeys, handledKeys) {
    const llmParams = {};
    const raw = flatParams._llmParamRaw;
    if (!raw || typeof raw !== 'object' || raw === null) return llmParams;

    if (Array.isArray(raw)) {
        raw.forEach((p) => {
            if (p.name && typeof p.name === 'string') {
                const idx = String(Object.keys(llmParams).length);
                const key = p.name === 'modleName' ? 'modelName' : p.name;
                const value = flatParams[key] !== undefined ? flatParams[key] : p.input?.value?.content;
                const entry = {
                    name: p.name,
                    input: {
                        type: p.input?.type || 'string',
                        value: { type: p.input?.value?.type || 'literal', content: value },
                    },
                };
                if (p.input?.value?.rawMeta) entry.input.value.rawMeta = p.input.value.rawMeta;
                llmParams[idx] = entry;
                handledKeys.add(p.name);
                handledKeys.add(key);
            }
        });
    } else {
        Object.entries(raw).forEach(([idx, p]) => {
            if (p && typeof p === 'object' && p.name && typeof p.name === 'string') {
                const key = p.name === 'modleName' ? 'modelName' : p.name;
                const value = flatParams[key] !== undefined ? flatParams[key] : p.input?.value?.content;
                const entry = {
                    name: p.name,
                    input: {
                        type: p.input?.type || 'string',
                        value: { type: p.input?.value?.type || 'literal', content: value },
                    },
                };
                if (p.input?.value?.rawMeta) entry.input.value.rawMeta = p.input.value.rawMeta;
                llmParams[idx] = entry;
                handledKeys.add(p.name);
                handledKeys.add(key);
            } else if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') {
                llmParams[idx] = p;
                handledKeys.add(idx);
            }
        });
    }
    return llmParams;
}

/** 默认参数序列化 */
function _serializeDefaultParameters(p, cozeNode) {
    const outputKeys = new Set(Object.keys(p.node_outputs || {}));
    Object.entries(p).forEach(([key, value]) => {
        if (
            key !== 'node_outputs' &&
            key !== 'node_inputs' &&
            key !== '_contentRaw' &&
            key !== '_noteRaw' &&
            !outputKeys.has(key)
        ) {
            cozeNode.data.inputs[key] = value;
        }
    });
}

// ====================================================================
// 公共 API
// ====================================================================

/**
 * 将Coze剪贴板格式转换为内部格式（独立函数，供管理页面导入使用）
 * @param {object} data - 剪贴板数据对象（convertYamlToClipboard 的输出）
 * @returns {{ nodes: Array, edges: Array }} 内部格式的节点和边
 */
export function convertClipboardToInternal(data) {
    if (!data || !data.json?.nodes?.length) {
        throw new Error('Invalid clipboard data');
    }

    const { nodes, idMap } = _processCozeNodeTree(
        data.json.nodes,
        (typeNum) => REV_TYPE_MAP[String(typeNum)] || 'plugin'
    );

    const reverseIdMap = _buildReverseIdMap(idMap);
    const variableMergeEdgeMap = _buildVariableMergeEdgeMap(nodes, reverseIdMap, data.json.edges, data.json.nodes);

    _remapBlockIDs(nodes, idMap, variableMergeEdgeMap);

    const edges = _processEdges(data.json.edges, idMap);

    return { nodes, edges };
}

/**
 * 将内部节点格式转换为 Coze 剪贴板格式（统一序列化路径）
 * @param {object} node - 内部节点
 * @param {object[]} allNodes - 全部节点（用于查找子节点）
 * @param {object} [options] - 选项
 * @param {boolean} [options.includeTemp=false] - 是否包含 _temp 字段（剪贴板复制需要）
 * @returns {object} 剪贴板格式节点
 */
export function convertInternalToClipboardNode(node, allNodes, options = {}) {
    const cozeNode = _buildCozeNodeBase(node);
    _serializeNodeParameters(node, cozeNode);

    if (options.includeTemp) {
        cozeNode._temp = {
            bounds: { x: (node.x || 0) - 180, y: node.y || 0, width: 360, height: 112 },
            externalData: {
                icon: node.icon || '',
                description: node.description || '',
                title: node.title || '',
                mainColor: node.color || getMainColor(node.type),
            },
        };
    }

    const children = allNodes.filter((n) => n.parentId === node.id);
    if (children.length > 0) {
        cozeNode.blocks = children.map((c) => convertInternalToClipboardNode(c, allNodes, options));
    }

    return cozeNode;
}

/**
 * 序列化相关的 mixin 方法
 * @param {import('../editor/editor-core.js').WorkflowCore} core - WorkflowCore 实例
 */
export class WorkflowSerializer {
    /**
     * @param {import('../editor/editor-core.js').WorkflowCore} core - WorkflowCore 实例
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
                        _remapBlockIDs_import(child, nodeIdMap);
                    }
                });
            }

            // Remap blockID for loop_set_variable variables
            if (node.type === 'loop_set_variable' && Array.isArray(node.parameters.variables)) {
                _remapBlockIDs_import(node, nodeIdMap);
            }

            return node;
        };

        workflow.nodes.forEach((nodeData) => {
            this.core.nodes.push(processNode(nodeData));
        });

        // 重建 Map 索引（节点通过 push 直接添加，未经过 addNode）
        this.core._rebuildMaps();

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
        const mapNode = (n) => {
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
        };

        return {
            schema_version: '1.0.0',
            name: options.name || 'my_workflow',
            id: options.id || `workflow_${Date.now()}`,
            description: options.description || 'Created with workflow editor',
            mode: 'workflow',
            icon: 'plugin_icon/workflow.png',
            nodes: this.core.nodes.filter((n) => !n.parentId).map(mapNode),
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

        const { nodes, idMap } = _processCozeNodeTree(
            data.json.nodes,
            (typeNum) => this.core.getTypeFromNumber(typeNum),
            this.core.nodeIdCounter
        );

        // 更新 core 状态
        this.core.nodeIdCounter += nodes.length;
        nodes.forEach((n) => this.core.nodes.push(n));
        this.core._rebuildMaps();

        const reverseIdMap = _buildReverseIdMap(idMap);
        const variableMergeEdgeMap = _buildVariableMergeEdgeMap(nodes, reverseIdMap, data.json.edges, data.json.nodes);

        _remapBlockIDs(nodes, idMap, variableMergeEdgeMap);

        _processEdges(data.json.edges, idMap, {
            createEdge: (src, tgt, srcPort, tgtPort) => {
                if (srcPort) {
                    this.core.createEdge(src, tgt, srcPort);
                } else {
                    this.core.createEdge(src, tgt);
                }
            },
        });

        this.core.resetHistory('messages.importFromClipboard');
    }
}

/**
 * importWorkflow 专用的 blockID 重映射（处理 Map<number, string> 格式）
 * @param {object} node - 内部节点
 * @param {Map<number, string>} nodeIdMap
 */
function _remapBlockIDs_import(node, nodeIdMap) {
    if (!Array.isArray(node.parameters?.variables)) return;
    node.parameters.variables.forEach((v) => {
        ['left', 'right'].forEach((side) => {
            if (v[side]?.value?.content?.blockID && typeof v[side].value.content.blockID === 'string') {
                const newBlockId = nodeIdMap.get(Number(v[side].value.content.blockID));
                if (newBlockId) v[side].value.content.blockID = newBlockId;
            }
        });
    });
}
