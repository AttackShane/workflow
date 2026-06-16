import { TYPE_MAP, getMainColor, getSubTitle } from "../utils/types.js";
import { ClipboardUtils } from "../utils/helpers.js";
import { t } from "../i18n/i18n.js";

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
    }

    async copy() {
        const selectedNodeElements = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodeElements.length === 0) return;
        
        const selectedNodeIds = Array.from(selectedNodeElements).map(el => el.dataset.nodeId);
        const selectedNodes = this.core.nodes.filter(n => selectedNodeIds.includes(n.id));
        
        if (selectedNodes.length === 0) return;
        
        const cozeNodes = [];
        const selectedEdges = this.core.edges.filter(e => 
            selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
        );
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        selectedNodes.forEach(node => {
            const type = node.type.toLowerCase();
            const typeNum = TYPE_MAP[type] || this.core.getTypeNumber(node.type);
            
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
                    },
                    size: {
                        width: node.width || 200,
                        height: node.height || 100
                    }
                },
                _temp: {
                    bounds: {
                        x: node.x - 100,
                        y: node.y - 50,
                        width: node.width || 200,
                        height: node.height || 100
                    },
                    externalData: {
                        icon: node.icon || '',
                        description: node.description || '',
                        title: node.title || '',
                        mainColor: getMainColor(type)
                    }
                }
            };
            
            if (node.node_outputs && typeof node.node_outputs === 'object') {
                Object.entries(node.node_outputs).forEach(([name, output]) => {
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
                    if (output.properties) {
                        outEntry.schema = Object.entries(output.properties).map(([propName, prop]) => ({
                            name: propName,
                            type: prop.type || 'string',
                            required: prop.required === true,
                            description: prop.description || ''
                        }));
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
            if (node.inputParams && Array.isArray(node.inputParams)) {
                cozeNode.data.inputs.inputParameters = node.inputParams.map(p => ({
                    name: p.name,
                    input: { 
                        type: p.type || 'string', 
                        value: { 
                            type: p.valueType || 'literal', 
                            content: p.value || '',
                            ...(p.rawMeta && { rawMeta: p.rawMeta })
                        } 
                    }
                }));
            }

            // 写入动态出参
            if (node.outputParams && Array.isArray(node.outputParams)) {
                node.outputParams.forEach(p => {
                    const exists = cozeNode.data.outputs.find(o => o.name === p.name);
                    if (!exists) {
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
                                rawMeta: p.input?.value?.rawMeta || { type: 1 }
                            };
                        });
                    }

                    // 以 flatParams 为主遍历，从 metaMap 取类型元数据
                    // modelName 优先处理，输出为 modleName
                    const modelValue = flatParams.modelName || flatParams.modleName;
                    if (modelValue !== undefined) {
                        const meta = metaMap.modelName || metaMap.modleName || { inputType: 'string', valueType: 'literal', rawMeta: { type: 1 } };
                        llmParams.push({ name: 'modleName', input: { type: meta.inputType, value: { type: meta.valueType, content: modelValue, rawMeta: meta.rawMeta } } });
                    }
                    const handledKeys = new Set(['modelName', 'modleName']);

                    // 遍历 flatParams 输出所有参数（保留空字符串值，Coze 需要这些字段）
                    Object.entries(flatParams).forEach(([key, value]) => {
                        if (structuralKeys.includes(key) || handledKeys.has(key) || value === undefined) return;
                        const meta = metaMap[key] || { inputType: 'string', valueType: 'literal', rawMeta: { type: 1 } };
                        llmParams.push({ name: key, input: { type: meta.inputType, value: { type: meta.valueType, content: value, rawMeta: meta.rawMeta } } });
                        handledKeys.add(key);
                    });

                    // 补充 _llmParamRaw 中存在但 flatParams 中没有的条目（如 object_ref 类型的 parameters）
                    if (flatParams._llmParamRaw && Array.isArray(flatParams._llmParamRaw)) {
                        flatParams._llmParamRaw.forEach(p => {
                            const key = p.name === 'modleName' ? 'modelName' : p.name;
                            if (!handledKeys.has(key) && !handledKeys.has(p.name)) {
                                llmParams.push(JSON.parse(JSON.stringify(p)));
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
                } else {
                    Object.entries(node.parameters).forEach(([key, value]) => {
                        if (key !== 'node_outputs' && key !== 'node_inputs') {
                            cozeNode.data.inputs[key] = value;
                        }
                    });
                }
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
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + nodeWidth);
            maxY = Math.max(maxY, node.y + nodeHeight);
        });
        
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
                nodes: cozeNodes,
                edges: selectedEdges.map(e => ({
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

    pasteFromCozeFormat(data) {
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
                // 从 cozeNode.data.inputs 提取自定义参数
                if (cozeNode.data?.inputs && typeof cozeNode.data.inputs === 'object') {
                    Object.entries(cozeNode.data.inputs).forEach(([key, value]) => {
                        if (key !== 'inputParameters' && key !== 'schemaType') {
                            // Coze 注释节点使用 note (Slate 格式)，转为纯文本
                            if (key === 'note' && typeof value === 'string') {
                                try {
                                    const slate = JSON.parse(value);
                                    const text = extractSlateText(slate);
                                    parameters.content = text;
                                } catch (e) {
                                    parameters.content = value;
                                }
                            // LLM参数：llmParam 数组/对象转为扁平键值对，字段名与Coze一致
                            } else if (key === 'llmParam' && Array.isArray(value)) {
                                // 保留原始 llmParam 结构（含 input.type、value.type、rawMeta），用于精确还原
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
                            }
                            // 代码：code 直接存
                            else if (key === 'code') {
                                parameters.code = value;
                            // HTTP：url, method, headers, body 直接存
                            } else if (key === 'url' || key === 'method') {
                                parameters[key] = value;
                            } else if (key === 'headers' || key === 'body') {
                                parameters[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                            // 输出：content 可能是对象，提取 literal 内容，同时保存原始结构
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
                        value: p.input?.value?.content ?? p.defaultValue ?? '',
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
                // 1. inputParams 中的 ref 引用
                if (node.inputParams && Array.isArray(node.inputParams)) {
                    node.inputParams.forEach(param => {
                        if (param.valueType === 'ref' && typeof param.value === 'object' && param.value.blockID) {
                            const newBlockId = idMap[String(param.value.blockID)];
                            if (newBlockId) {
                                param.value.blockID = newBlockId;
                            }
                        }
                    });
                }
                // 2. parameters 中的 _contentRaw（输出节点 ref 内容）
                if (node.parameters && node.parameters._contentRaw && typeof node.parameters._contentRaw === 'object') {
                    const raw = node.parameters._contentRaw;
                    if (raw.value?.type === 'ref' && raw.value.content?.blockID) {
                        const newBlockId = idMap[String(raw.value.content.blockID)];
                        if (newBlockId) {
                            raw.value.content.blockID = newBlockId;
                        }
                    }
                }
                // 3. parameters 中的 dynamic_option（问答节点 ref 选项）
                if (node.parameters && node.parameters.dynamic_option && typeof node.parameters.dynamic_option === 'object') {
                    const opt = node.parameters.dynamic_option;
                    if (opt.value?.type === 'ref' && opt.value.content?.blockID) {
                        const newBlockId = idMap[String(opt.value.content.blockID)];
                        if (newBlockId) {
                            opt.value.content.blockID = newBlockId;
                        }
                    }
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
    }

    pasteFromSimpleFormat(data) {
        const { node, edges } = data;
        
        const newNodeId = `node_${Date.now()}`;
        const offset = 50;
        
        // 如果坐标是屏幕坐标，需要转换为画布坐标
        let x = node.x + offset;
        let y = node.y + offset;
        
        // 检查是否需要坐标转换（通过检查是否有变换）
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
    }

    pasteFromSimpleNodes(data) {
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
    }
}