import { TYPE_MAP, getMainColor, getSubTitle, resolveNodeType } from "../utils/types.js";
import { ClipboardUtils, deepClone } from "../utils/helpers.js";
import { t } from "../i18n/i18n.js";
import { mixinClipboardPaste } from './workflow-clipboard-paste.js';

/**
 * 从 Slate 格式提取纯文本
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

export class WorkflowClipboard {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.copiedNode = null;

        mixinClipboardPaste(this);
    }

    async copy() {
        const selectedNodeElements = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodeElements.length === 0) return;
        
        const selectedNodeIds = Array.from(selectedNodeElements).map(el => el.dataset.nodeId);
        
        const expandedNodeIds = new Set(selectedNodeIds);
        for (const nodeId of selectedNodeIds) {
            if (this.core.isContainerNode(nodeId)) {
                const childNodes = this.core.getChildNodes(nodeId);
                for (const child of childNodes) {
                    expandedNodeIds.add(child.id);
                }
            }
        }
        
        const selectedNodes = this.core.nodes.filter(n => expandedNodeIds.has(n.id));
        
        if (selectedNodes.length === 0) return;
        
        const cozeNodes = [];
        const selectedEdges = this.core.edges.filter(e => 
            expandedNodeIds.has(e.source) && expandedNodeIds.has(e.target)
        );
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        selectedNodes.forEach(node => {
            const type = node.type.toLowerCase();
            const typeNum = resolveNodeType(type);
            
            const nodeMeta = {
                title: node.title || t('nodes.node'),
                icon: node.icon || '',
                description: node.description || '',
                mainColor: getMainColor(type),
                subTitle: getSubTitle(type)
            };
            
            const cozeNode = {
                id: node.id.replace('node_', ''),
                type: typeNum,
                meta: {
                    position: {
                        x: node.x,
                        y: node.y
                    }
                },
                data: {
                    nodeMeta: nodeMeta,
                    outputs: [],
                    inputs: {
                        inputParameters: []
                    }
                },
                _temp: {
                    bounds: {
                        x: node.x - 180,
                        y: node.y,
                        width: 360,
                        height: 112
                    },
                    externalData: {
                        icon: node.icon || '',
                        description: node.description || '',
                        title: node.title || '',
                        mainColor: getMainColor(type)
                    }
                }
            };
            
            if (node.parameters?.node_outputs && typeof node.parameters.node_outputs === 'object') {
                Object.entries(node.parameters.node_outputs).forEach(([name, output]) => {
                    const outEntry = {
                        name: name,
                        type: output.type || 'string',
                        required: output.required === true,
                        description: output.description || ''
                    };
                    if (output.value && output.value !== '') {
                        outEntry.defaultValue = output.value;
                    }
                    if (output.rawMeta) {
                        outEntry.rawMeta = output.rawMeta;
                    }
                    if (output.assistType !== undefined) {
                        outEntry.assistType = output.assistType;
                    }
                    if (output.schema && typeof output.schema === 'object') {
                        outEntry.schema = output.schema;
                    } else if (output.properties) {
                        outEntry.schema = Object.entries(output.properties).map(([propName, prop]) => ({
                            name: propName,
                            type: prop.type || 'string',
                            required: prop.required === true,
                            description: prop.description || ''
                        }));
                    }
                    if (output.input && typeof output.input === 'object') {
                        outEntry.input = output.input;
                    }
                    cozeNode.data.outputs.push(outEntry);
                });
            }
            
            if (node.outputs && Array.isArray(node.outputs)) {
                node.outputs.forEach(output => {
                    const existingIndex = cozeNode.data.outputs.findIndex(o => o.name === output.name);
                    if (existingIndex >= 0) {
                        cozeNode.data.outputs[existingIndex] = { ...cozeNode.data.outputs[existingIndex], ...output };
                    } else {
                        cozeNode.data.outputs.push(output);
                    }
                });
            }

            // 写入动态入参
            if (node.inputParams && Array.isArray(node.inputParams) && node.inputParams.length > 0) {
                cozeNode.data.inputs.inputParameters = node.inputParams.map(p => {
                    const isRef = p.valueType === 'ref' || (p.value && typeof p.value === 'object' && p.value.type === 'ref');
                    return {
                        name: p.name,
                        input: {
                            type: p.type || 'string',
                            value: isRef
                                ? { ...p.value, ...(p.rawMeta && { rawMeta: p.rawMeta }) }
                                : {
                                    type: 'literal',
                                    content: p.value || '',
                                    ...(p.rawMeta && { rawMeta: p.rawMeta })
                                },
                            ...(p.schema && { schema: p.schema })
                        }
                    };
                });
            }

            // 写入动态出参
            if (node.outputParams && Array.isArray(node.outputParams)) {
                node.outputParams.forEach(p => {
                    const exists = cozeNode.data.outputs.find(o => o.name === p.name);
                    if (exists) {
                        if (p.value && p.value !== '') {
                            exists.defaultValue = p.value;
                        }
                    } else {
                        const outEntry = {
                            name: p.name,
                            type: p.type || 'string',
                            description: p.description || ''
                        };
                        if (p.value && p.value !== '') {
                            outEntry.defaultValue = p.value;
                        }
                        cozeNode.data.outputs.push(outEntry);
                    }
                });
            }
            
            if (node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters)) {
                if (type === 'variable_merge' && node.parameters.mergeGroups) {
                    cozeNode.data.inputs.mergeGroups = node.parameters.mergeGroups;
                } else if (type === 'output' && (node.parameters.content !== undefined || node.parameters._contentRaw)) {
                    if (node.parameters._contentRaw) {
                        cozeNode.data.inputs.content = node.parameters._contentRaw;
                    } else {
                        cozeNode.data.inputs.content = {
                            type: 'string',
                            value: { type: 'literal', content: node.parameters.content }
                        };
                    }
                    cozeNode.data.inputs.streamingOutput = node.parameters.streamingOutput === true;
                    cozeNode.data.inputs.callTransferVoice = node.parameters.callTransferVoice === true;
                    cozeNode.data.inputs.chatHistoryWriting = node.parameters.chatHistoryWriting || 'historyWrite';
                } else if (type === 'input' && node.parameters.outputSchema) {
                    cozeNode.data.inputs.outputSchema = typeof node.parameters.outputSchema === 'string' 
                        ? node.parameters.outputSchema 
                        : JSON.stringify(node.parameters.outputSchema);
                } else if (type === 'comment' && node.parameters.content !== undefined) {
                    cozeNode.data.inputs = {
                        schemaType: 'slate',
                        note: JSON.stringify([{
                            type: 'paragraph',
                            children: [{ text: node.parameters.content, type: 'text' }]
                        }])
                    };
                // LLM节点：以当前参数为主，从原始数据中查找类型元数据
                } else if (type === 'llm') {
                    const flatParams = node.parameters;
                    const structuralKeys = ['fcParamVar', 'settingOnError', 'node_outputs', 'node_inputs', '_llmParamRaw'];
                    const llmParams = [];

                    // 构建原始元数据查找表（key → { inputType, valueType, rawMeta }）
                    const metaMap = {};
                    if (flatParams._llmParamRaw && Array.isArray(flatParams._llmParamRaw)) {
                        flatParams._llmParamRaw.forEach(p => {
                            const key = p.name === 'modleName' ? 'modelName' : p.name;
                            metaMap[key] = {
                                inputType: p.input?.type || 'string',
                                valueType: p.input?.value?.type || 'literal',
                                rawMeta: p.input?.value?.rawMeta
                            };
                        });
                    }

                    // 以 flatParams 为主遍历，从 metaMap 取类型元数据
                    // modelName 优先处理，输出为 modleName
                    const modelValue = flatParams.modelName || flatParams.modleName;
                    if (modelValue !== undefined) {
                        const meta = metaMap.modelName || metaMap.modleName || { inputType: 'string', valueType: 'literal' };
                        const valObj = meta.rawMeta
                            ? { type: meta.valueType, content: modelValue, rawMeta: meta.rawMeta }
                            : { type: meta.valueType, content: modelValue };
                        llmParams.push({ name: 'modleName', input: { type: meta.inputType, value: valObj } });
                    }
                    const handledKeys = new Set(['modelName', 'modleName']);

                    // 遍历 flatParams 输出所有参数（保留空字符串值，Coze 需要这些字段）
                    Object.entries(flatParams).forEach(([key, value]) => {
                        if (structuralKeys.includes(key) || handledKeys.has(key) || value === undefined) return;
                        const meta = metaMap[key] || { inputType: 'string', valueType: 'literal' };
                        const valObj = meta.rawMeta
                            ? { type: meta.valueType, content: value, rawMeta: meta.rawMeta }
                            : { type: meta.valueType, content: value };
                        llmParams.push({ name: key, input: { type: meta.inputType, value: valObj } });
                        handledKeys.add(key);
                    });

                    // 补充 _llmParamRaw 中存在但 flatParams 中没有的条目（如 object_ref 类型的 parameters）
                    if (flatParams._llmParamRaw && Array.isArray(flatParams._llmParamRaw)) {
                        flatParams._llmParamRaw.forEach(p => {
                            const key = p.name === 'modleName' ? 'modelName' : p.name;
                            if (!handledKeys.has(key) && !handledKeys.has(p.name)) {
                                llmParams.push(deepClone(p));
                                handledKeys.add(p.name);
                            }
                        });
                    }

                    cozeNode.data.inputs.llmParam = llmParams;
                    cozeNode.data.inputs.fcParamVar = flatParams.fcParamVar || { knowledgeFCParam: {} };
                    cozeNode.data.inputs.settingOnError = flatParams.settingOnError || { switch: false, processType: 1, timeoutMs: 600000, retryTimes: 0 };
                    cozeNode.data.version = '3';
                } else if (type === 'question') {
                    const flatParams = node.parameters;
                    cozeNode.data.inputs.answer_type = flatParams.answer_type || 'text';
                    cozeNode.data.inputs.option_type = flatParams.option_type || 'static';
                    cozeNode.data.inputs.options = flatParams.options || [];
                    cozeNode.data.inputs.limit = flatParams.limit || 3;
                    cozeNode.data.inputs.extra_output = flatParams.extra_output === true;
                    cozeNode.data.inputs.question = flatParams.question || '';
                    if (flatParams.dynamic_option !== undefined) {
                        cozeNode.data.inputs.dynamic_option = flatParams.dynamic_option;
                    }

                    const llmParams = {};
                    const structuralKeys = ['fcParamVar', 'settingOnError', 'node_outputs', 'node_inputs', '_llmParamRaw', 'answer_type', 'option_type', 'options', 'limit', 'extra_output', 'question', 'dynamic_option'];
                    const handledKeys = new Set();

                    // 优先从 _llmParamRaw 还原，保留原始索引和类型
                    if (flatParams._llmParamRaw && typeof flatParams._llmParamRaw === 'object' && flatParams._llmParamRaw !== null) {
                        if (Array.isArray(flatParams._llmParamRaw)) {
                            flatParams._llmParamRaw.forEach(p => {
                                if (p.name && typeof p.name === 'string') {
                                    const idx = Object.keys(llmParams).length;
                                    const key = p.name === 'modleName' ? 'modelName' : p.name;
                                    const value = flatParams[key] !== undefined ? flatParams[key] : p.input?.value?.content;
                                    const entry = { 
                                        name: p.name, 
                                        input: { 
                                            type: p.input?.type || 'string', 
                                            value: { 
                                                type: p.input?.value?.type || 'literal', 
                                                content: value
                                            } 
                                        } 
                                    };
                                    if (p.input?.value?.rawMeta) {
                                        entry.input.value.rawMeta = p.input.value.rawMeta;
                                    }
                                    llmParams[String(idx)] = entry;
                                    handledKeys.add(p.name);
                                    handledKeys.add(key);
                                }
                            });
                        } else {
                            Object.entries(flatParams._llmParamRaw).forEach(([idx, p]) => {
                                if (p && typeof p === 'object' && p.name && typeof p.name === 'string') {
                                    const key = p.name === 'modleName' ? 'modelName' : p.name;
                                    const value = flatParams[key] !== undefined ? flatParams[key] : p.input?.value?.content;
                                    const entry = { 
                                        name: p.name, 
                                        input: { 
                                            type: p.input?.type || 'string', 
                                            value: { 
                                                type: p.input?.value?.type || 'literal', 
                                                content: value
                                            } 
                                        } 
                                    };
                                    if (p.input?.value?.rawMeta) {
                                        entry.input.value.rawMeta = p.input.value.rawMeta;
                                    }
                                    llmParams[idx] = entry;
                                    handledKeys.add(p.name);
                                    handledKeys.add(key);
                                } else if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') {
                                    // 纯字符串值如 systemPrompt: ""
                                    llmParams[idx] = p;
                                    handledKeys.add(idx);
                                }
                            });
                        }
                    }

                    // 补充 _llmParamRaw 不存在时，从 flatParams 补全
                    Object.entries(flatParams).forEach(([key, value]) => {
                        if (structuralKeys.includes(key) || handledKeys.has(key) || value === undefined) return;
                        const idx = Object.keys(llmParams).length;
                        llmParams[String(idx)] = { name: key, input: { type: 'string', value: { type: 'literal', content: value } } };
                    });

                    // question类型llmParam是对象格式
                    cozeNode.data.inputs.llmParam = llmParams;
                    cozeNode.data.inputs.fcParamVar = flatParams.fcParamVar || { knowledgeFCParam: {} };
                    cozeNode.data.inputs.settingOnError = flatParams.settingOnError || { switch: false, processType: 1, timeoutMs: 600000, retryTimes: 0 };
                } else if (type === 'end') {
                    if (node.parameters._contentRaw) {
                        cozeNode.data.inputs.content = node.parameters._contentRaw;
                    } else if (node.parameters.content !== undefined) {
                        cozeNode.data.inputs.content = {
                            type: 'string',
                            value: { type: 'literal', content: node.parameters.content }
                        };
                    }
                    cozeNode.data.inputs.streamingOutput = node.parameters.streamingOutput === true;
                    cozeNode.data.inputs.terminatePlan = node.parameters.terminatePlan || 'returnVariables';
                } else {
                    const outputKeys = new Set(Object.keys(node.parameters?.node_outputs || {}));
                    Object.entries(node.parameters).forEach(([key, value]) => {
                        if (key !== 'node_outputs' && key !== 'node_inputs' && key !== '_contentRaw' && !outputKeys.has(key)) {
                            cozeNode.data.inputs[key] = value;
                        }
                    });
                }
            }

            if (type === 'code') {
                cozeNode.data.version = 'v2';
            }
            
            if (node.inputParameters && Array.isArray(node.inputParameters)) {
                cozeNode.data.inputs.inputParameters = node.inputParameters.map(param => ({
                    name: param.name || '',
                    input: { 
                        type: param.type || 'string', 
                        value: { 
                            type: param.valueType || 'literal', 
                            content: param.value || '',
                            ...(param.rawMeta && { rawMeta: param.rawMeta })
                        } 
                    }
                }));
            }
            
            if (node.inputs && typeof node.inputs === 'object') {
                cozeNode.data.inputs = { ...cozeNode.data.inputs, ...node.inputs };
            }
            
            if (cozeNode.data.outputs.length === 0 && type === 'input') {
                let schema = cozeNode.data.inputs.outputSchema || [];
                if (typeof schema === 'string') {
                    schema = JSON.parse(schema);
                }
                schema.forEach(field => {
                    cozeNode.data.outputs.push({
                        name: field.name || 'output',
                        type: field.type || 'string',
                        required: field.required === true,
                        description: field.description || ''
                    });
                });
            }
            
            cozeNodes.push(cozeNode);
            
            const nodeWidth = node.width || 200;
            const nodeHeight = node.height || 100;
            if (!node.parentId) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + nodeWidth);
                maxY = Math.max(maxY, node.y + nodeHeight);
            }
        });
        
        // 容器节点处理：将子节点移入 blocks，内部边移入容器 edges
        const containerPortMap = {
            'container_start': 'loop-function-inline-output',
            'container_end': 'loop-function-inline-input'
        };
        const containerNodeIds = new Set();
        const childNodeIds = new Set();
        
        for (const node of selectedNodes) {
            if (this.core.isContainerNode(node.id)) {
                containerNodeIds.add(node.id);
                const children = this.core.getChildNodes(node.id);
                for (const child of children) {
                    childNodeIds.add(child.id);
                }
            }
        }
        
        const globalEdges = [];
        const containerEdges = {};
        
        for (const e of selectedEdges) {
            const sourceInContainer = containerNodeIds.has(e.source);
            const targetInContainer = containerNodeIds.has(e.target);
            const sourceIsChild = childNodeIds.has(e.source);
            const targetIsChild = childNodeIds.has(e.target);
            
            if ((sourceInContainer && targetIsChild) || (sourceIsChild && targetInContainer) || (sourceIsChild && targetIsChild)) {
                let containerId = null;
                if (sourceInContainer) containerId = e.source;
                else if (targetInContainer) containerId = e.target;
                else {
                    const childNode = this.core.nodes.find(n => n.id === e.source);
                    containerId = childNode ? childNode.parentId : null;
                }
                
                if (containerId) {
                    if (!containerEdges[containerId]) containerEdges[containerId] = [];
                    const edgeData = {
                        sourceNodeID: e.source.replace('node_', ''),
                        targetNodeID: e.target.replace('node_', ''),
                        ...(e.sourcePort && { sourcePortID: containerPortMap[e.sourcePort] || e.sourcePort }),
                        ...(e.targetPort && { targetPortID: containerPortMap[e.targetPort] || e.targetPort })
                    };
                    containerEdges[containerId].push(edgeData);
                }
            } else {
                globalEdges.push(e);
            }
        }
        
        const topLevelCozeNodes = [];
        for (const cn of cozeNodes) {
            const originalId = 'node_' + cn.id;
            if (childNodeIds.has(originalId)) continue;
            if (containerNodeIds.has(originalId)) {
                if (containerEdges[originalId]) {
                    cn.edges = containerEdges[originalId];
                }
                cn.blocks = [];
                for (const childCn of cozeNodes) {
                    const childOriginalId = 'node_' + childCn.id;
                    if (this.core.nodes.find(n => n.id === childOriginalId && n.parentId === originalId)) {
                        cn.blocks.push(childCn);
                    }
                }
            }
            topLevelCozeNodes.push(cn);
        }

        for (const cn of topLevelCozeNodes) {
            // 移除 canvasPosition (Coze 原始格式不包含这个字段)
            delete cn.meta.canvasPosition;
            
            if (cn.blocks && cn.blocks.length > 0) {
                cn.blocks.forEach(block => {
                    delete block.meta.canvasPosition;
                });
            }
        }

        for (const cn of topLevelCozeNodes) {
            if (cn.type === '21' || cn.type === '22') {
                const containerId = 'node_' + cn.id;
                const containerEdgeList = containerEdges[containerId] || cn.edges || [];

                const fromContainerEdge = containerEdgeList.find(
                    e => e.sourcePortID === 'loop-function-inline-output' || e.sourcePortID === 'batch-function-inline-output'
                );
                const toContainerEdge = containerEdgeList.find(
                    e => e.targetPortID === 'loop-function-inline-input' || e.targetPortID === 'batch-function-inline-input'
                );

                if (fromContainerEdge && toContainerEdge) {
                    const childBlockId = fromContainerEdge.targetNodeID;
                    const childBlock = cn.blocks?.find(b => b.id === childBlockId);
                    if (childBlock && childBlock.data?.outputs?.length > 0) {
                        const outputName = childBlock.data.outputs[0].name;
                        cn.data.outputs = cn.data.outputs.map(o => ({
                            ...o,
                            input: {
                                type: o.type || 'list',
                                value: {
                                    type: 'ref',
                                    content: {
                                        source: 'block-output',
                                        blockID: childBlockId,
                                        name: outputName
                                    }
                                }
                            }
                        }));
                    }
                }
            }
        }

        const copyData = {
            type: 'coze-workflow-clipboard-data',
            source: {
                workflowId: 'workflow_' + Date.now(),
                flowMode: 0,
                spaceId: 'imported_space',
                isDouyin: false,
                host: 'www.coze.cn'
            },
            json: {
                nodes: topLevelCozeNodes,
                edges: globalEdges.map(e => ({
                    sourceNodeID: e.source.replace('node_', ''),
                    targetNodeID: e.target.replace('node_', ''),
                    ...(e.sourcePort && { sourcePortID: e.sourcePort }),
                    ...(e.targetPort && { targetPortID: e.targetPort })
                }))
            },
            bounds: {
                x: minX - 100,
                y: minY - 50,
                width: maxX - minX + 200,
                height: maxY - minY + 100
            }
        };

        // 递归清理所有 blockID 值中的 "node_" 前缀
        const stripNodePrefix = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach(item => stripNodePrefix(item));
                return;
            }
            for (const key of Object.keys(obj)) {
                if (key === 'blockID' && typeof obj[key] === 'string' && obj[key].startsWith('node_')) {
                    obj[key] = obj[key].replace('node_', '');
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    stripNodePrefix(obj[key]);
                }
            }
        };
        stripNodePrefix(copyData.json);
        
        if (!await ClipboardUtils.copy(JSON.stringify(copyData, null, 2))) {
            this.copiedNode = copyData;
        }
    }

    async paste() {
        let copyData = null;
        
        try {
            const text = await navigator.clipboard.readText();
            
            if (!text.trim()) {
                if (this.copiedNode) {
                    copyData = this.copiedNode;
                } else {
                    return;
                }
            } else {
                const trimmed = text.trim();
                if (!trimmed.startsWith('{')) {
                    if (this.copiedNode) {
                        copyData = this.copiedNode;
                    } else {
                        return;
                    }
                } else {
                    copyData = JSON.parse(text);
                }
            }
        } catch (err) {
            if (this.copiedNode) {
                copyData = this.copiedNode;
            } else {
                return;
            }
        }
        
        if (!copyData) return;
        
        if (copyData.type === 'coze-workflow-clipboard-data' || copyData.json?.nodes?.length) {
            this.pasteFromCozeFormat(copyData);
        } else if (copyData.type === 'workflow-node') {
            this.pasteFromSimpleFormat(copyData);
        } else if (copyData.nodes?.length) {
            this.pasteFromSimpleNodes(copyData);
        }
    }
}