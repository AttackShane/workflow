/**
 * 剪贴板模块测试
 */
import { WorkflowClipboard } from '../src/modules/workflow-clipboard.js';
import { WorkflowCore } from '../src/modules/workflow-core.js';

// Mock DOM
global.document = {
    createElement: () => ({}),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.navigator = {
    clipboard: {
        writeText: async () => {},
        readText: async () => '{}'
    }
};

global.DOM = {
    get: () => null,
    setStyle: () => {},
    addClass: () => {},
    removeClass: () => {},
    create: () => ({ style: {}, appendChild: () => {} }),
    on: () => {},
    off: () => {},
    setHtml: () => {},
    setText: () => {},
    setDisabled: () => {},
    setAttr: () => {}
};

describe('WorkflowClipboard', () => {
    let core, clipboard;

    beforeEach(() => {
        core = new WorkflowCore();
        const mockUI = {
            core,
            canvas: {
                screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                lastMouseX: 100,
                lastMouseY: 100,
                canvasContent: {
                    appendChild: () => {}
                },
                setEmptyState: () => {}
            },
            node: {
                createElement: (node) => {
                    const el = { style: {}, dataset: {} };
                    el.dataset.nodeId = node.id;
                    return el;
                }
            },
            updateEdges: () => {},
            updateSummary: () => {},
            showMessage: () => {}
        };
        clipboard = new WorkflowClipboard(mockUI);
    });

    describe('copy', () => {
        it('should copy selected nodes to Coze format', async () => {
            const node = core.createNode('llm', 200, 300, { title: 'Test LLM' });
            core.selectNode(node.id);

            document.querySelectorAll = () => [
                { dataset: { nodeId: node.id }, getAttribute: () => 'selected' }
            ];

            await clipboard.copy();
            expect(clipboard.copiedNode).toBeDefined();
        });

        it('should handle empty selection', async () => {
            document.querySelectorAll = () => [];

            await clipboard.copy();
            expect(clipboard.copiedNode).toBeNull();
        });
    });

    describe('pasteFromCozeFormat', () => {
        it('should paste nodes from Coze clipboard data', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Test Node', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [], inputs: [] },
                                outputs: []
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} }
                        }
                    ],
                    edges: [],
                    name: 'Test Workflow'
                }
            };

            const result = clipboard.pasteFromCozeFormat(cozeData);
            expect(result).toBeUndefined();
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].title).toBe('Test Node');
        });

        it('should handle Coze data without json field', () => {
            const result = clipboard.pasteFromCozeFormat({ type: 'invalid' });
            expect(result).toBeUndefined();
        });

        it('should handle Coze data without nodes', () => {
            const result = clipboard.pasteFromCozeFormat({
                type: 'coze-workflow-clipboard-data',
                json: { nodes: [] }
            });
            expect(result).toBeUndefined();
        });

        it('should preserve relative positions when pasting multiple nodes', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Node A', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [], inputs: [] },
                                outputs: []
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} }
                        },
                        {
                            id: '2',
                            type: '2',
                            meta: { position: { x: 400, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Node B', icon: '', description: '', mainColor: '#ef4444' },
                                inputs: { inputParameters: [], inputs: [] },
                                outputs: []
                            },
                            _temp: { bounds: { x: 400, y: 200, width: 200, height: 100 }, externalData: {} }
                        }
                    ],
                    edges: [],
                    name: 'Test'
                }
            };

            clipboard.pasteFromCozeFormat(cozeData);

            // Nodes should maintain relative horizontal distance from source
            const nodeA = core.nodes[0];
            const nodeB = core.nodes[1];
            expect(nodeB.x - nodeA.x).toBe(300);
        });
    });

    describe('copy (Coze format)', () => {
        it('should generate Coze clipboard format', async () => {
            const node = core.createNode('start', 100, 100, { title: 'Start' });
            core.selectNode(node.id);

            document.querySelectorAll = () => [
                {
                    dataset: { nodeId: node.id },
                    getAttribute: (attr) => attr === 'selected' ? 'selected' : null
                }
            ];

            global.navigator.clipboard.writeText = async (text) => {
                const parsed = JSON.parse(text);
                expect(parsed.type).toBe('coze-workflow-clipboard-data');
                expect(parsed.json.nodes).toBeDefined();
            };

            await clipboard.copy();
        });
    });

    describe('comment node round-trip', () => {
        it('should copy comment node content and paste back correctly', async () => {
            const node = core.createNode('comment', 200, 300, {
                title: '注释',
                parameters: { content: '诶嘿' }
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [
                {
                    dataset: { nodeId: node.id },
                    getAttribute: (attr) => attr === 'selected' ? 'selected' : null
                }
            ];
            global.navigator.clipboard.writeText = async (text) => { capturedText = text; };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];

            expect(cozeNode.type).toBe('31');
            expect(cozeNode.data.inputs).toEqual({
                schemaType: 'slate',
                note: JSON.stringify([{ type: 'paragraph', children: [{ text: '诶嘿', type: 'text' }] }])
            });
            expect(cozeNode.data.size).toEqual({ width: 200, height: 100 });
            expect(cozeNode.data.nodeMeta.title).toBe('注释');
        });

        it('should paste Coze-format comment node and preserve content', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [{
                        id: '131527',
                        type: '31',
                        meta: { position: { x: 100, y: 200 } },
                        data: {
                            size: { width: 240, height: 150 },
                            inputs: {
                                schemaType: 'slate',
                                note: '[{"type":"paragraph","children":[{"text":"诶嘿","type":"text"}]}]'
                            }
                        },
                        _temp: {
                            bounds: { x: 0, y: 200, width: 240, height: 150 },
                            externalData: { title: '注释', description: '', icon: '', mainColor: '' }
                        }
                    }],
                    edges: []
                }
            };

            clipboard.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(1);
            const pasted = core.nodes[0];
            expect(pasted.type).toBe('comment');
            expect(pasted.parameters.content).toBe('诶嘿');
            expect(pasted.title).toBe('注释');
            expect(pasted.width).toBe(240);
            expect(pasted.height).toBe(150);
        });

        it('should paste our-own copied comment node correctly', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [{
                        id: '100026',
                        type: '31',
                        meta: { position: { x: 359, y: 831 } },
                        data: {
                            nodeMeta: { title: '注释', description: '添加说明注释' },
                            outputs: [],
                            inputs: {
                                schemaType: 'slate',
                                note: '[{"type":"paragraph","children":[{"text":"诶嘿","type":"text"}]}]'
                            },
                            size: { width: 200, height: 100 }
                        },
                        _temp: {
                            bounds: { x: 259, y: 781, width: 200, height: 100 },
                            externalData: {}
                        }
                    }],
                    edges: []
                }
            };

            clipboard.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(1);
            const pasted = core.nodes[0];
            expect(pasted.type).toBe('comment');
            expect(pasted.parameters.content).toBe('诶嘿');
            expect(pasted.title).toBe('注释');
            expect(pasted.description).toBe('添加说明注释');
        });
    });

    describe('full round-trip: copy → paste for all node types', () => {
        const testCases = [
            { type: 'start', title: '开始', params: {}, expectedType: 'start' },
            { type: 'end', title: '结束', params: { content: '完成' }, expectedType: 'end' },
            { type: 'llm', title: '大模型', params: { modelName: 'gpt-4', systemPrompt: '你是助手', prompt: '你好', temperature: 0.7 }, expectedType: 'llm' },
            { type: 'code', title: '代码', params: { code: 'print(1)' }, expectedType: 'code' },
            { type: 'http', title: 'HTTP', params: { url: 'https://api.com', method: 'POST' }, expectedType: 'http' },
            { type: 'text', title: '文本', params: { method: 'concat' }, expectedType: 'text' },
            { type: 'condition', title: '条件', params: {}, expectedType: 'condition' },
            { type: 'variable_merge', title: '变量聚合', params: { mergeGroups: [{ name: 'g1' }] }, expectedType: 'variable_merge' },
            { type: 'plugin', title: '插件', params: { pluginName: 'test' }, expectedType: 'plugin' },
            { type: 'loop', title: '循环', params: { loopType: 'count', count: 3 }, expectedType: 'loop' },
            { type: 'batch', title: '批处理', params: {}, expectedType: 'batch' },
            { type: 'intent', title: '意图识别', params: {}, expectedType: 'intent' },
            { type: 'async_task', title: '异步任务', params: {}, expectedType: 'async_task' },
            { type: 'output', title: '输出', params: { content: '结果', streamingOutput: false }, expectedType: 'output' },
            { type: 'input', title: '输入', params: { outputSchema: [{ name: 'field1', type: 'string' }] }, expectedType: 'input' },
            { type: 'question', title: '问答', params: { question: '你好吗', answer_type: 'text' }, expectedType: 'question' },
            { type: 'delay', title: '延迟', params: { duration: 1000 }, expectedType: 'delay' },
            { type: 'database', title: '数据库', params: {}, expectedType: 'database' },
            { type: 'email', title: '邮件', params: {}, expectedType: 'email' },
            { type: 'webhook', title: 'Webhook', params: {}, expectedType: 'webhook' },
            { type: 'json_parse', title: 'JSON解析', params: {}, expectedType: 'json_parse' },
            { type: 'knowledge', title: '知识库', params: {}, expectedType: 'knowledge' },
            { type: 'variable_assign', title: '变量赋值', params: {}, expectedType: 'variable_assign' },
            { type: 'break', title: '跳出', params: {}, expectedType: 'break' },
        ];

        testCases.forEach(({ type, title, params, expectedType }) => {
            it(`should round-trip ${type} node`, async () => {
                core = new WorkflowCore();
                const mockUI = {
                    core,
                    canvas: {
                        screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                        lastMouseX: 100,
                        lastMouseY: 100,
                        canvasContent: { appendChild: () => {} },
                        setEmptyState: () => {}
                    },
                    node: {
                        createElement: (node) => {
                            const el = { style: {}, dataset: {} };
                            el.dataset.nodeId = node.id;
                            return el;
                        }
                    },
                    updateEdges: () => {},
                    updateSummary: () => {},
                    showMessage: () => {}
                };
                clipboard = new WorkflowClipboard(mockUI);

                const node = core.createNode(type, 200, 300, { title, parameters: params });
                core.selectNode(node.id);

                let capturedText = '';
                document.querySelectorAll = () => [
                    { dataset: { nodeId: node.id }, getAttribute: (attr) => attr === 'selected' ? 'selected' : null }
                ];
                global.navigator.clipboard.writeText = async (text) => { capturedText = text; };

                await clipboard.copy();

                const copyData = JSON.parse(capturedText);
                const cozeNode = copyData.json.nodes[0];

                // Verify type number
                const typeNum = {
                    start: '1', end: '2', llm: '3', plugin: '4', code: '5',
                    condition: '8', http: '45', text: '15', image_generate: '16',
                    knowledge: '17', question: '18', loop: '21', intent: '22', break: '23',
                    variable_assign: '24', batch: '28', comment: '31',
                    variable_merge: '32', video_generation: '65', async_task: '72',
                    output: '13', input: '30', delay: '33', database: '34', email: '35',
                    webhook: '36', json_parse: '37'
                }[type];
                expect(cozeNode.type).toBe(typeNum);

                // Paste back
                clipboard.pasteFromCozeFormat(copyData);

                // The original node is still in core.nodes, plus the pasted one
                const pasted = core.nodes[core.nodes.length - 1];
                expect(pasted.type).toBe(expectedType);
                expect(pasted.title).toBe(title);

                // Verify parameters preserved
                if (Object.keys(params).length > 0) {
                    Object.entries(params).forEach(([key, value]) => {
                        if (typeof value === 'string') {
                            expect(pasted.parameters[key]).toBe(value);
                        } else if (typeof value === 'number') {
                            expect(pasted.parameters[key]).toBe(value);
                        } else if (typeof value === 'boolean') {
                            expect(pasted.parameters[key]).toBe(value);
                        }
                        // For arrays/objects, just check existence
                        else if (value !== undefined) {
                            expect(pasted.parameters[key]).toBeDefined();
                        }
                    });
                }
            });
        });
    });
});