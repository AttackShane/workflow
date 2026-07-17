import { getMainColor, getSubTitle, resolveNodeType } from '../utils/types.js';
import { ClipboardUtils, deepClone } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { WorkflowClipboardPaste } from './editor-clipboard-paste.js';

export class WorkflowClipboard {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        /** @type {WorkflowClipboardPaste} */
        this.pasteHandler = new WorkflowClipboardPaste(this);
        this.copiedNode = null;
    }

    /**
     * 复制选中节点到剪贴板
     */
    async copy() {
        const selectedNodeElements = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodeElements.length === 0) return;

        // 如果有缓存的原始 Coze 剪贴板数据，直接使用（不走 Internal 往返，无数据损失）
        console.log(
            '[clipboard] _clipboardData 存在?',
            !!this.core._clipboardData,
            '节点数:',
            selectedNodeElements.length
        );
        if (this.core._clipboardData) {
            console.log('[clipboard] 使用缓存数据，json.nodes 数:', this.core._clipboardData?.json?.nodes?.length);
            await ClipboardUtils.copy(JSON.stringify(this.core._clipboardData, null, 2));
            return;
        }
        console.log('[clipboard] 走序列化路径');

        const selectedNodeIds = Array.from(selectedNodeElements).map(
            (el) => /** @type {HTMLElement} */ (el).dataset.nodeId
        );

        const expandedNodeIds = new Set(selectedNodeIds);
        for (const nodeId of selectedNodeIds) {
            if (this.core.isContainerNode(nodeId)) {
                const childNodes = this.core.getChildNodes(nodeId);
                for (const child of childNodes) expandedNodeIds.add(child.id);
            }
        }

        const selectedNodes = this.core.nodes.filter((n) => expandedNodeIds.has(n.id));
        if (selectedNodes.length === 0) return;

        const selectedEdges = this.core.edges.filter(
            (e) => expandedNodeIds.has(e.source) && expandedNodeIds.has(e.target)
        );

        // 构建所有节点的 Coze 格式
        const cozeNodes = [];
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const node of selectedNodes) {
            const cozeNode = this._buildBaseCozeNode(node);
            this._serializeNodeParameters(node, cozeNode);
            cozeNodes.push(cozeNode);

            if (!node.parentId) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + (node.width || 200));
                maxY = Math.max(maxY, node.y + (node.height || 100));
            }
        }

        // 处理容器节点
        const { globalEdges, containerEdges, containerNodeIds, childNodeIds } = this._classifyEdges(
            selectedEdges,
            selectedNodes
        );

        const topLevelCozeNodes = this._assembleContainerNodes(
            cozeNodes,
            containerEdges,
            containerNodeIds,
            childNodeIds
        );

        // 补充容器输出端口 blockID 引用
        this._patchContainerOutputRefs(topLevelCozeNodes, containerEdges);

        const copyData = this._buildClipboardData(topLevelCozeNodes, globalEdges, minX, minY, maxX, maxY);

        this.copiedNode = copyData;
        await ClipboardUtils.copy(JSON.stringify(copyData, null, 2));
    }

    // ====================================================================
    // 节点序列化助手
    // ====================================================================

    /**
     * 构建 Coze 节点基础结构
     */
    _buildBaseCozeNode(node) {
        const type = node.type.toLowerCase();
        const typeNum = resolveNodeType(type);
        return {
            id: node.id.replace('node_', ''),
            type: typeNum,
            meta: { position: { x: node.x, y: node.y } },
            data: {
                nodeMeta: {
                    title: node.title || t('nodes.node'),
                    icon: node.icon || '',
                    description: node.description || '',
                    mainColor: getMainColor(type),
                    subTitle: getSubTitle(type),
                },
                outputs: [],
                inputs: { inputParameters: [] },
            },
            _temp: {
                bounds: { x: node.x - 180, y: node.y, width: 360, height: 112 },
                externalData: {
                    icon: node.icon || '',
                    description: node.description || '',
                    title: node.title || '',
                    mainColor: getMainColor(type),
                },
            },
        };
    }

    /**
     * 序列化节点参数（按类型分发）
     */
    _serializeNodeParameters(node, cozeNode) {
        this._serializeOutputs(node, cozeNode);
        this._serializeInputParams(node, cozeNode);
        this._serializeOutputParams(node, cozeNode);
        this._serializeTypeSpecific(node, cozeNode);

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
    _serializeOutputs(node, cozeNode) {
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
    _serializeInputParams(node, cozeNode) {
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
    _serializeOutputParams(node, cozeNode) {
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
    _serializeTypeSpecific(node, cozeNode) {
        const p = node.parameters;
        if (!p || typeof p !== 'object' || Array.isArray(p)) return;

        const type = node.type;

        if (type === 'variable_merge') {
            if (p.mergeGroups) cozeNode.data.inputs.mergeGroups = p.mergeGroups;
        } else if (type === 'output' || type === 'end') {
            this._serializeContentNode(p, cozeNode);
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
            this._serializeComment(p, cozeNode);
        } else if (type === 'llm') {
            this._serializeLLM(p, cozeNode);
        } else if (type === 'question') {
            this._serializeQuestion(p, cozeNode);
        } else if (type === 'loop_set_variable') {
            cozeNode.data.inputs.inputParameters =
                Array.isArray(p.variables) && p.variables.length > 0 ? p.variables : [];
        } else {
            this._serializeDefaultParameters(p, cozeNode);
        }
    }

    /** output / end 类型的内容参数 */
    _serializeContentNode(p, cozeNode) {
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

    /** comment 类型 */
    _serializeComment(p, cozeNode) {
        if (p._noteRaw) {
            // 保留原始 Slate 结构（import 路径保留的多段落格式）
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
    _serializeLLM(p, cozeNode) {
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
    _serializeQuestion(p, cozeNode) {
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
        const llmParams = this._buildQuestionLLMParams(flatParams, structuralKeys, handledKeys);

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

    _buildQuestionLLMParams(flatParams, structuralKeys, handledKeys) {
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
    _serializeDefaultParameters(p, cozeNode) {
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
    // 容器边分类与组装
    // ====================================================================

    _classifyEdges(selectedEdges, selectedNodes) {
        const containerPortMap = {
            container_start: 'loop-function-inline-output',
            container_end: 'loop-function-inline-input',
        };
        const containerNodeIds = new Set();
        const childNodeIds = new Set();

        for (const node of selectedNodes) {
            if (this.core.isContainerNode(node.id)) {
                containerNodeIds.add(node.id);
                const children = this.core.getChildNodes(node.id);
                for (const child of children) childNodeIds.add(child.id);
            }
        }

        const globalEdges = [];
        const containerEdges = {};

        for (const e of selectedEdges) {
            const sourceInContainer = containerNodeIds.has(e.source);
            const targetInContainer = containerNodeIds.has(e.target);
            const sourceIsChild = childNodeIds.has(e.source);
            const targetIsChild = childNodeIds.has(e.target);

            let putInContainer = false;
            let containerId = null;

            if (sourceIsChild && targetIsChild) {
                const sourceNode = this.core.nodes.find((n) => n.id === e.source);
                containerId = sourceNode?.parentId;
                putInContainer = !!containerId;
            } else if ((sourceInContainer && targetIsChild) || (sourceIsChild && targetInContainer)) {
                if (sourceInContainer) {
                    containerId = e.source;
                    const targetNode = this.core.nodes.find((n) => n.id === e.target);
                    if (targetNode?.parentId === containerId) putInContainer = true;
                } else {
                    containerId = e.target;
                    const sourceNode = this.core.nodes.find((n) => n.id === e.source);
                    if (sourceNode?.parentId === containerId) putInContainer = true;
                }
            }

            if (putInContainer && containerId) {
                if (!containerEdges[containerId]) containerEdges[containerId] = [];
                const sourceNode = this.core.nodes.find((n) => n.id === e.source);
                const targetNode = this.core.nodes.find((n) => n.id === e.target);
                containerEdges[containerId].push({
                    sourceNodeID: e.source.replace('node_', ''),
                    targetNodeID: e.target.replace('node_', ''),
                    ...(e.sourcePort && {
                        sourcePortID: this._convertPortToCoze(
                            containerPortMap[e.sourcePort] || e.sourcePort,
                            sourceNode
                        ),
                    }),
                    ...(e.targetPort && {
                        targetPortID: this._convertPortToCoze(
                            containerPortMap[e.targetPort] || e.targetPort,
                            targetNode
                        ),
                    }),
                });
            } else {
                globalEdges.push(e);
            }
        }

        return { globalEdges, containerEdges, containerNodeIds, childNodeIds };
    }

    _assembleContainerNodes(cozeNodes, containerEdges, containerNodeIds, childNodeIds) {
        const topLevelCozeNodes = [];
        for (const cn of cozeNodes) {
            const originalId = 'node_' + cn.id;
            if (childNodeIds.has(originalId)) continue;
            if (containerNodeIds.has(originalId)) {
                if (containerEdges[originalId]) cn.edges = containerEdges[originalId];
                cn.blocks = [];
                for (const childCn of cozeNodes) {
                    const childOriginalId = 'node_' + childCn.id;
                    if (this.core.nodes.find((n) => n.id === childOriginalId && n.parentId === originalId)) {
                        cn.blocks.push(childCn);
                    }
                }
            }
            topLevelCozeNodes.push(cn);
        }

        // 移除 canvasPosition
        for (const cn of topLevelCozeNodes) {
            delete cn.meta.canvasPosition;
            if (cn.blocks && cn.blocks.length > 0) {
                cn.blocks.forEach((block) => {
                    delete block.meta.canvasPosition;
                });
            }
        }
        return topLevelCozeNodes;
    }

    _patchContainerOutputRefs(topLevelCozeNodes, containerEdges) {
        for (const cn of topLevelCozeNodes) {
            if (cn.type !== '21' && cn.type !== '22') continue;
            const containerId = 'node_' + cn.id;
            const edgeList = containerEdges[containerId] || cn.edges || [];

            const fromEdge = edgeList.find(
                (e) =>
                    e.sourcePortID === 'loop-function-inline-output' ||
                    e.sourcePortID === 'batch-function-inline-output'
            );
            const toEdge = edgeList.find(
                (e) =>
                    e.targetPortID === 'loop-function-inline-input' || e.targetPortID === 'batch-function-inline-input'
            );
            if (!fromEdge || !toEdge) continue;

            const childBlock = cn.blocks?.find((b) => b.id === fromEdge.targetNodeID);
            if (childBlock && childBlock.data?.outputs?.length > 0) {
                const outputName = childBlock.data.outputs[0].name;
                if (cn.data.outputs && cn.data.outputs.length > 0) {
                    cn.data.outputs.forEach((o) => {
                        if (!o.input) {
                            o.input = {
                                type: o.type || 'list',
                                value: {
                                    type: 'ref',
                                    content: {
                                        source: 'block-output',
                                        blockID: fromEdge.targetNodeID,
                                        name: outputName,
                                    },
                                },
                            };
                        }
                    });
                }
            }
        }
    }

    // ====================================================================
    // 剪贴板数据构建与复制
    // ====================================================================

    _buildClipboardData(topLevelCozeNodes, globalEdges, minX, minY, maxX, maxY) {
        const data = {
            type: 'coze-workflow-clipboard-data',
            source: {
                workflowId: 'workflow_' + Date.now(),
                flowMode: 0,
                spaceId: 'imported_space',
                isDouyin: false,
                host: 'www.coze.cn',
            },
            json: {
                nodes: topLevelCozeNodes,
                edges: globalEdges.map((e) => {
                    let sourcePortID = e.sourcePort;
                    let targetPortID = e.targetPort;
                    if (sourcePortID) {
                        const sourceNode = this.core.nodes.find((n) => n.id === e.source);
                        sourcePortID = this._convertPortToCoze(sourcePortID, sourceNode);
                    }
                    if (targetPortID) {
                        const targetNode = this.core.nodes.find((n) => n.id === e.target);
                        targetPortID = this._convertPortToCoze(targetPortID, targetNode);
                    }
                    return {
                        sourceNodeID: e.source.replace('node_', ''),
                        targetNodeID: e.target.replace('node_', ''),
                        ...(sourcePortID && { sourcePortID }),
                        ...(targetPortID && { targetPortID }),
                    };
                }),
            },
            bounds: {
                x: minX - 100,
                y: minY - 50,
                width: maxX - minX + 200,
                height: maxY - minY + 100,
            },
        };

        // 递归清理所有 blockID 值中的 "node_" 前缀
        this._stripNodePrefix(data.json);
        return data;
    }

    _stripNodePrefix(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach((item) => this._stripNodePrefix(item));
            return;
        }
        for (const key of Object.keys(obj)) {
            if (key === 'blockID' && typeof obj[key] === 'string' && obj[key].startsWith('node_')) {
                obj[key] = obj[key].replace('node_', '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this._stripNodePrefix(obj[key]);
            }
        }
    }

    // ====================================================================
    // 端口转换与粘贴
    // ====================================================================

    _convertPortToCoze(port, node) {
        if (!port || !node || node.type !== 'condition') return port;
        const branches = node.parameters?.branches;
        if (!Array.isArray(branches) || branches.length === 0) return port;
        if (port.startsWith('branch_')) {
            const idx = parseInt(port.replace('branch_', ''), 10);
            if (isNaN(idx) || idx < 0 || idx >= branches.length) return port;
            if (idx === branches.length - 1) return 'false';
            if (idx === 0) return 'true';
            return `true_${idx}`;
        }
        return port;
    }

    async paste() {
        let copyData = null;

        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                // 剪贴板为空，回退到上次复制的内部节点
                if (this.copiedNode) {
                    copyData = this.copiedNode;
                }
            } else {
                const trimmed = text.trim();
                if (!trimmed.startsWith('{')) {
                    // 剪贴板内容不是 JSON，报错而非静默回退
                    this.ui.showMessage(t('actions.pasteInvalidData'), 'error');
                    return;
                }
                copyData = JSON.parse(text);
            }
        } catch (err) {
            // 读取剪贴板失败（如权限问题），回退到内部复制数据
            if (this.copiedNode) {
                copyData = this.copiedNode;
            }
        }

        if (!copyData) {
            this.ui.showMessage(t('actions.pasteEmpty'), 'warning');
            return;
        }

        if (copyData.type === 'coze-workflow-clipboard-data' || copyData.json?.nodes?.length) {
            this.pasteHandler.pasteFromCozeFormat(copyData);
        } else if (copyData.type === 'workflow-node') {
            this.pasteHandler.pasteFromSimpleFormat(copyData);
        } else if (copyData.nodes?.length) {
            this.pasteHandler.pasteFromSimpleNodes(copyData);
        }
    }
}
