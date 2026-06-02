import { TYPE_MAP, getMainColor, getSubTitle } from "../utils/types.js";
import { ClipboardUtils } from "../utils/helpers.js";

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
                title: node.title || '节点',
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
                        x: node.x - 90,
                        y: node.y - 40,
                        width: node.width || 180,
                        height: node.height || 80
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
                    cozeNode.data.outputs.push({
                        name: name,
                        type: output.type || 'string',
                        required: output.required === true,
                        description: output.description || '',
                        defaultValue: output.value,
                        rawMeta: output.rawMeta || { type: 1 },
                        ...(output.properties && { schema: Object.entries(output.properties).map(([propName, prop]) => ({
                            name: propName,
                            type: prop.type || 'string',
                            required: prop.required === true,
                            description: prop.description || ''
                        }))})
                    });
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
            
            if (node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters)) {
                if (type === 'variable_merge' && node.parameters.mergeGroups) {
                    cozeNode.data.inputs.mergeGroups = node.parameters.mergeGroups;
                } else if (type === 'output' && node.parameters.content) {
                    cozeNode.data.inputs.content = node.parameters.content;
                    cozeNode.data.inputs.streamingOutput = node.parameters.streamingOutput === true;
                    cozeNode.data.inputs.callTransferVoice = node.parameters.callTransferVoice === true;
                    cozeNode.data.inputs.chatHistoryWriting = node.parameters.chatHistoryWriting || 'historyWrite';
                } else if (type === 'input' && node.parameters.outputSchema) {
                    cozeNode.data.inputs.outputSchema = typeof node.parameters.outputSchema === 'string' 
                        ? JSON.parse(node.parameters.outputSchema) 
                        : node.parameters.outputSchema;
                } else if (type === 'question') {
                    cozeNode.data.inputs.answer_type = node.parameters.answer_type || 'text';
                    cozeNode.data.inputs.option_type = node.parameters.option_type || 'static';
                    cozeNode.data.inputs.options = node.parameters.options || [];
                    cozeNode.data.inputs.limit = node.parameters.limit || 3;
                    cozeNode.data.inputs.extra_output = node.parameters.extra_output === true;
                    cozeNode.data.inputs.question = node.parameters.question || '';
                    
                    if (node.parameters.llmParam) {
                        const llmParam = {};
                        if (Array.isArray(node.parameters.llmParam)) {
                            node.parameters.llmParam.forEach((param, index) => {
                                llmParam[String(index)] = {
                                    name: param.name,
                                    input: {
                                        type: param.input?.type || 'string',
                                        value: param.input?.value || { type: 'literal', content: '' }
                                    }
                                };
                            });
                            llmParam.systemPrompt = node.parameters.llmParam.find(p => p.name === 'systemPrompt')?.input?.value?.content || '';
                        } else if (typeof node.parameters.llmParam === 'object') {
                            Object.entries(node.parameters.llmParam).forEach(([key, value]) => {
                                if (!isNaN(key)) {
                                    llmParam[key] = {
                                        name: value.name || key,
                                        input: {
                                            type: value.input?.type || 'string',
                                            value: value.input?.value || { type: 'literal', content: '' }
                                        }
                                    };
                                }
                            });
                            llmParam.systemPrompt = node.parameters.llmParam.systemPrompt || '';
                        }
                        cozeNode.data.inputs.llmParam = llmParam;
                    }
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
                    type: param.type || 'string',
                    required: param.required === true,
                    description: param.description || '',
                    defaultValue: param.defaultValue,
                    rawMeta: param.rawMeta || { type: 1 }
                }));
            }
            
            if (node.inputs && typeof node.inputs === 'object') {
                cozeNode.data.inputs = { ...cozeNode.data.inputs, ...node.inputs };
            }
            
            if (cozeNode.data.outputs.length === 0 && type === 'input') {
                const schema = cozeNode.data.inputs.outputSchema || [];
                schema.forEach(field => {
                    cozeNode.data.outputs.push({
                        name: field.name || 'output',
                        type: field.type || 'string',
                        required: field.required === true,
                        description: field.description || '',
                        rawMeta: { type: 1 }
                    });
                });
            }
            
            cozeNodes.push(cozeNode);
            
            const nodeWidth = node.width || 180;
            const nodeHeight = node.height || 80;
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
                x: minX - 90,
                y: minY - 40,
                width: maxX - minX + 180,
                height: maxY - minY + 80
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
            this.ui.showMessage('粘贴失败：数据格式无效', 'error');
            return;
        }
        
        const offset = 50;
        const idMap = {};
        let nodeCount = 0;
        let edgeCount = 0;
        let skippedEdges = 0;
        
        let minX = Infinity, minY = Infinity;
        data.json.nodes.forEach(cozeNode => {
            const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
            const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;
            minX = Math.min(minX, nodeX);
            minY = Math.min(minY, nodeY);
        });
        
        const { canvasX: pasteX, canvasY: pasteY } = this.ui.canvas.screenToCanvas(
            this.ui.canvas.lastMouseX || 100, 
            this.ui.canvas.lastMouseY || 100
        );
        
        try {
            data.json.nodes.forEach(cozeNode => {
                const originalId = String(cozeNode.id);
                const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                idMap[originalId] = newNodeId;
                
                let type = 'plugin';
                try {
                    type = this.core.getTypeFromNumber(cozeNode.type);
                } catch (err) {
                    type = 'plugin';
                }
                
                const nodeX = cozeNode.meta?.position?.x || cozeNode.x || 0;
                const nodeY = cozeNode.meta?.position?.y || cozeNode.y || 0;
                
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
                
                const nodeMeta = cozeNode.data?.nodeMeta || {};
                const title = nodeMeta.title || cozeNode.title || '节点';
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
                    inputParameters: cozeNode.data?.inputs?.inputParameters || [],
                    inputs: cozeNode.data?.inputs || {},
                    width: cozeNode._temp?.bounds?.width || cozeNode.width || 180,
                    height: cozeNode._temp?.bounds?.height || cozeNode.height || 80
                };
                
                this.core.addNode(newNode);
                const el = this.ui.node.createElement(newNode);
                this.ui.canvas.canvasContent.appendChild(el);
                this.ui.canvas.setEmptyState(false);
                nodeCount++;
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
            
            this.ui.updateEdges();
            this.ui.updateSummary();
            
            let message = `粘贴成功：${nodeCount} 个节点`;
            if (edgeCount > 0) {
                message += `，${edgeCount} 条连接`;
            }
            if (skippedEdges > 0) {
                message += `（跳过 ${skippedEdges} 条重复连接）`;
            }
            this.ui.showMessage(message, 'success');
            
            this.core.saveHistory(`粘贴 ${nodeCount} 节点`);
            this.ui.updateHistoryPanel();
        } catch (err) {
            this.ui.showMessage(`粘贴失败：${err.message}`, 'error');
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
        
        this.ui.updateEdges();
        this.ui.updateSummary();
        
        this.ui.node.select(el);
    }

    pasteFromSimpleNodes(data) {
        if (!data.nodes?.length) return;
        
        const offset = 50;
        
        data.nodes.forEach(node => {
            const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const x = (node.position?.x || node.x || 0) + offset;
            const y = (node.position?.y || node.y || 0) + offset;
            
            const newNode = {
                id: newNodeId,
                type: node.type,
                x: x,
                y: y,
                title: node.title || '节点',
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
        
        this.ui.updateEdges();
        this.ui.updateSummary();
    }
}