/**
 * 剪贴板模块测试
 */
import { WorkflowClipboard } from '../src/modules/editor-clipboard.js';
import { WorkflowCore } from '../src/modules/editor-core.js';

// Mock DOM
global.document = {
    createElement: () => ({ style: {}, select: () => {}, focus: () => {} }),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    execCommand: () => true,
};

global.navigator = {
    clipboard: {
        writeText: async () => {},
        readText: async () => '{}',
    },
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
    setAttr: () => {},
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
                    appendChild: () => {},
                },
                setEmptyState: () => {},
            },
            node: {
                createElement: (node) => {
                    const el = { style: {}, dataset: {} };
                    el.dataset.nodeId = node.id;
                    return el;
                },
            },
            updateEdges: () => {},
            updateSummary: () => {},
            showMessage: () => {},
        };
        clipboard = new WorkflowClipboard(mockUI);
    });

    describe('copy', () => {
        it('should copy selected nodes to Coze format', async () => {
            const node = core.createNode('llm', 200, 300, { title: 'Test LLM' });
            core.selectNode(node.id);

            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];

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
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                    name: 'Test Workflow',
                },
            };

            const result = clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(result).toBeUndefined();
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].title).toBe('Test Node');
        });

        it('should handle Coze data without json field', () => {
            const result = clipboard.pasteHandler.pasteFromCozeFormat({ type: 'invalid' });
            expect(result).toBeUndefined();
        });

        it('should handle Coze data without nodes', () => {
            const result = clipboard.pasteHandler.pasteFromCozeFormat({
                type: 'coze-workflow-clipboard-data',
                json: { nodes: [] },
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
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '2',
                            meta: { position: { x: 400, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Node B', icon: '', description: '', mainColor: '#ef4444' },
                                inputs: { inputParameters: [], inputs: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 400, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                    name: 'Test',
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

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
                    getAttribute: (attr) => (attr === 'selected' ? 'selected' : null),
                },
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
                parameters: { content: '诶嘿' },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [
                {
                    dataset: { nodeId: node.id },
                    getAttribute: (attr) => (attr === 'selected' ? 'selected' : null),
                },
            ];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];

            expect(cozeNode.type).toBe('31');
            expect(cozeNode.data.inputs).toEqual({
                schemaType: 'slate',
                note: JSON.stringify([{ type: 'paragraph', children: [{ text: '诶嘿', type: 'text' }] }]),
            });
            expect(cozeNode.data.nodeMeta.title).toBe('注释');
        });

        it('should paste Coze-format comment node and preserve content', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '131527',
                            type: '31',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                size: { width: 240, height: 150 },
                                inputs: {
                                    schemaType: 'slate',
                                    note: '[{"type":"paragraph","children":[{"text":"诶嘿","type":"text"}]}]',
                                },
                            },
                            _temp: {
                                bounds: { x: 0, y: 200, width: 240, height: 150 },
                                externalData: { title: '注释', description: '', icon: '', mainColor: '' },
                            },
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(1);
            const pasted = core.nodes[0];
            expect(pasted.type).toBe('comment');
            expect(pasted.parameters.content).toBe('诶嘿');
            expect(pasted.title).toBe('注释');
        });

        it('should paste our-own copied comment node correctly', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '100026',
                            type: '31',
                            meta: { position: { x: 359, y: 831 } },
                            data: {
                                nodeMeta: { title: '注释', description: '添加说明注释' },
                                outputs: [],
                                inputs: {
                                    schemaType: 'slate',
                                    note: '[{"type":"paragraph","children":[{"text":"诶嘿","type":"text"}]}]',
                                },
                                size: { width: 200, height: 100 },
                            },
                            _temp: {
                                bounds: { x: 259, y: 781, width: 200, height: 100 },
                                externalData: {},
                            },
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

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
            {
                type: 'llm',
                title: '大模型',
                params: { modelName: 'gpt-4', systemPrompt: '你是助手', prompt: '你好', temperature: 0.7 },
                expectedType: 'llm',
            },
            { type: 'code', title: '代码', params: { code: 'print(1)' }, expectedType: 'code' },
            { type: 'http', title: 'HTTP', params: { url: 'https://api.com', method: 'POST' }, expectedType: 'http' },
            { type: 'text', title: '文本', params: { method: 'concat' }, expectedType: 'text' },
            { type: 'condition', title: '条件', params: {}, expectedType: 'condition' },
            {
                type: 'variable_merge',
                title: '变量聚合',
                params: { mergeGroups: [{ name: 'g1' }] },
                expectedType: 'variable_merge',
            },
            { type: 'plugin', title: '插件', params: { pluginName: 'test' }, expectedType: 'plugin' },
            { type: 'loop', title: '循环', params: { loopType: 'count', count: 3 }, expectedType: 'loop' },
            { type: 'batch', title: '批处理', params: {}, expectedType: 'batch' },
            { type: 'intent', title: '意图识别', params: {}, expectedType: 'intent' },
            { type: 'async_task', title: '异步任务', params: {}, expectedType: 'async_task' },
            {
                type: 'output',
                title: '输出',
                params: { content: '结果', streamingOutput: false },
                expectedType: 'output',
            },
            {
                type: 'input',
                title: '输入',
                params: { outputSchema: [{ name: 'field1', type: 'string' }] },
                expectedType: 'input',
            },
            {
                type: 'question',
                title: '问答',
                params: { question: '你好吗', answer_type: 'text' },
                expectedType: 'question',
            },
            { type: 'json_parse', title: 'JSON解析', params: {}, expectedType: 'json_parse' },
            { type: 'knowledge_query', title: '知识库检索', params: {}, expectedType: 'knowledge_query' },
            { type: 'variable_assign', title: '变量赋值', params: {}, expectedType: 'variable_assign' },
            { type: 'comment', title: '注释', params: { content: '测试注释' }, expectedType: 'comment' },
            { type: 'canvas', title: '画板', params: {}, expectedType: 'canvas' },
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
                        setEmptyState: () => {},
                    },
                    node: {
                        createElement: (node) => {
                            const el = { style: {}, dataset: {} };
                            el.dataset.nodeId = node.id;
                            return el;
                        },
                    },
                    updateEdges: () => {},
                    updateSummary: () => {},
                    showMessage: () => {},
                };
                clipboard = new WorkflowClipboard(mockUI);

                const node = core.createNode(type, 200, 300, { title, parameters: params });
                core.selectNode(node.id);

                let capturedText = '';
                document.querySelectorAll = () => [
                    { dataset: { nodeId: node.id }, getAttribute: (attr) => (attr === 'selected' ? 'selected' : null) },
                ];
                global.navigator.clipboard.writeText = async (text) => {
                    capturedText = text;
                };

                await clipboard.copy();

                const copyData = JSON.parse(capturedText);
                const cozeNode = copyData.json.nodes[0];

                // Verify type number
                const typeNum = {
                    start: '1',
                    end: '2',
                    llm: '3',
                    plugin: '4',
                    code: '5',
                    knowledge_query: '6',
                    condition: '8',
                    workflow: '9',
                    sql_exec: '12',
                    output: '13',
                    text: '15',
                    image_generate: '16',
                    question: '18',
                    break: '19',
                    loop_set_variable: '20',
                    loop: '21',
                    intent: '22',
                    canvas: '23',
                    knowledge_write: '27',
                    batch: '28',
                    loop_continue: '29',
                    input: '30',
                    variable_merge: '32',
                    json_parse: '37',
                    clear_conversation: '38',
                    create_conversation: '39',
                    variable_assign: '40',
                    db_update: '42',
                    db_select: '43',
                    db_delete: '44',
                    http: '45',
                    db_insert: '46',
                    update_conversation: '51',
                    delete_conversation: '52',
                    list_conversation: '53',
                    get_conversation_history: '54',
                    create_message: '55',
                    update_message: '56',
                    delete_message: '57',
                    json_serialize: '58',
                    json_deserialize: '59',
                    knowledge_delete: '60',
                    video_extract_audio: '63',
                    video_extract_frame: '64',
                    video_generation: '65',
                    memory_write: '66',
                    memory_read: '67',
                    comment: '31',
                    async_task: '72',
                }[type];
                expect(cozeNode.type).toBe(typeNum);

                // Paste back
                clipboard.pasteHandler.pasteFromCozeFormat(copyData);

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

    describe('container node copy-paste round-trip', () => {
        beforeEach(() => {
            core = new WorkflowCore();
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                },
                node: {
                    createElement: (node) => {
                        const el = { style: {}, dataset: {} };
                        el.dataset.nodeId = node.id;
                        return el;
                    },
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            clipboard = new WorkflowClipboard(mockUI);
        });

        it('should include child nodes in blocks when copying a container node', async () => {
            const containerNode = core.createNode('loop', 200, 300, { title: 'Loop' });
            const childNode = core.createNode('code', 50, 80, { title: 'Code' });
            childNode.parentId = containerNode.id;

            const edge = core.createEdge('container_start', containerNode.id, childNode.id);
            core.selectNode(containerNode.id);

            let capturedText = '';
            document.querySelectorAll = () => [
                {
                    dataset: { nodeId: containerNode.id },
                    getAttribute: (attr) => (attr === 'selected' ? 'selected' : null),
                },
            ];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const topNode = copyData.json.nodes[0];

            expect(topNode.blocks).toBeDefined();
            expect(topNode.blocks.length).toBe(1);
            expect(topNode.blocks[0].type).toBe('5');
        });

        it('should include internal edges in container edges when copying', async () => {
            const containerNode = core.createNode('loop', 200, 300, { title: 'Loop' });
            const childNode = core.createNode('code', 50, 80, { title: 'Code' });
            childNode.parentId = containerNode.id;

            const edge = core.createEdge(containerNode.id, childNode.id, 'container_start', 'container_end');
            core.selectNode(containerNode.id);

            let capturedText = '';
            document.querySelectorAll = () => [
                {
                    dataset: { nodeId: containerNode.id },
                    getAttribute: (attr) => (attr === 'selected' ? 'selected' : null),
                },
            ];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);

            expect(copyData.json.edges.length).toBe(0);
            const topNode = copyData.json.nodes[0];
            expect(topNode.edges).toBeDefined();
            expect(topNode.edges.length).toBe(1);
        });

        it('should paste container node with child nodes and proper parentId', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '21',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 300, height: 200 },
                            },
                            _temp: {
                                bounds: { x: 200, y: 300, width: 300, height: 200 },
                                externalData: {},
                            },
                            blocks: [
                                {
                                    id: '2',
                                    type: '5',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], code: 'print(1)' },
                                        outputs: [],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: {
                                        bounds: { x: 50, y: 80, width: 200, height: 100 },
                                        externalData: {},
                                    },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'loop-function-inline-output',
                                    targetPortID: 'loop-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(2);
            const containerNode = core.nodes[0];
            const childNode = core.nodes[1];

            expect(containerNode.type).toBe('loop');
            expect(childNode.type).toBe('code');
            expect(childNode.parentId).toBe(containerNode.id);
            expect(core.edges.length).toBe(1);
        });

        it('should handle container port mapping correctly', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '21',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 300, height: 200 },
                            },
                            _temp: {
                                bounds: { x: 200, y: 300, width: 300, height: 200 },
                                externalData: {},
                            },
                            blocks: [
                                {
                                    id: '2',
                                    type: '5',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], code: 'print(1)' },
                                        outputs: [],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: {
                                        bounds: { x: 50, y: 80, width: 200, height: 100 },
                                        externalData: {},
                                    },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'loop-function-inline-output',
                                    targetPortID: 'loop-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            const edge = core.edges[0];
            expect(edge.sourcePort).toBe('container_start');
            expect(edge.targetPort).toBe('container_end');
        });

        it('should handle batch container node with child nodes', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '28',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Batch', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 300, height: 200 },
                            },
                            _temp: {
                                bounds: { x: 200, y: 300, width: 300, height: 200 },
                                externalData: {},
                            },
                            blocks: [
                                {
                                    id: '2',
                                    type: '3',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], llmParam: [] },
                                        outputs: [],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: {
                                        bounds: { x: 50, y: 80, width: 200, height: 100 },
                                        externalData: {},
                                    },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'batch-function-inline-output',
                                    targetPortID: 'batch-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(2);
            const containerNode = core.nodes[0];
            const childNode = core.nodes[1];

            expect(containerNode.type).toBe('batch');
            expect(childNode.type).toBe('llm');
            expect(childNode.parentId).toBe(containerNode.id);

            const edge = core.edges[0];
            expect(edge.sourcePort).toBe('container_start');
            expect(edge.targetPort).toBe('container_end');
        });
    });

    describe('loop_set_variable node blockID remapping', () => {
        it('should remap blockID in left and right of variables array when pasting', () => {
            core = new WorkflowCore();
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                },
                node: {
                    createElement: (node) => {
                        const el = { style: {}, dataset: {} };
                        el.dataset.nodeId = node.id;
                        return el;
                    },
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            clipboard = new WorkflowClipboard(mockUI);

            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: 'loop_1',
                            type: '21',
                            meta: { position: { x: 100, y: 100 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 400, height: 300 },
                            },
                        },
                        {
                            id: 'item_2',
                            type: '30',
                            meta: { position: { x: 150, y: 150 } },
                            data: {
                                nodeMeta: { title: 'Item', icon: '', description: '', mainColor: '#666' },
                                inputs: { inputParameters: [] },
                                outputs: [{ name: 'item' }],
                            },
                        },
                        {
                            id: 'source_3',
                            type: '3',
                            meta: { position: { x: 150, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Source', icon: '', description: '', mainColor: '#333' },
                                inputs: { inputParameters: [] },
                                outputs: [{ name: 'output' }],
                            },
                        },
                        {
                            id: 'setvar_4',
                            type: '20',
                            meta: { position: { x: 150, y: 250 } },
                            data: {
                                nodeMeta: { title: 'Set Variable', icon: '', description: '', mainColor: '#888' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            left: {
                                                type: 'string',
                                                value: {
                                                    type: 'ref',
                                                    content: {
                                                        source: 'block-output',
                                                        blockID: 'item_2',
                                                        name: 'item',
                                                    },
                                                },
                                            },
                                            right: {
                                                type: 'string',
                                                value: {
                                                    type: 'ref',
                                                    content: {
                                                        source: 'block-output',
                                                        blockID: 'source_3',
                                                        name: 'output',
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                                outputs: [],
                            },
                        },
                    ],
                    edges: [],
                },
            };

            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            expect(core.nodes.length).toBe(4);
            const loopSetVarNode = core.nodes.find((n) => n.type === 'loop_set_variable');
            expect(loopSetVarNode).toBeDefined();
            expect(Array.isArray(loopSetVarNode.parameters.variables)).toBe(true);
            expect(loopSetVarNode.parameters.variables.length).toBe(1);

            const variable = loopSetVarNode.parameters.variables[0];
            expect(variable.left.value.content.blockID).not.toBe('item_2');
            expect(variable.right.value.content.blockID).not.toBe('source_3');

            const itemNode = core.nodes.find((n) => n.type === 'input');
            const sourceNode = core.nodes.find((n) => n.type === 'llm');
            expect(itemNode).toBeDefined();
            expect(sourceNode).toBeDefined();
            expect(variable.left.value.content.blockID).toBe(itemNode.id);
            expect(variable.right.value.content.blockID).toBe(sourceNode.id);
        });
    });

    describe('serializer importWorkflow loop_set_variable blockID remapping', () => {
        it('should remap blockID in variables array when importing from file', () => {
            core = new WorkflowCore();
            const workflow = {
                nodes: [
                    {
                        id: 100001,
                        type: 'loop',
                        title: 'Loop',
                        position: { x: 100, y: 100 },
                        nodes: [
                            {
                                id: 100002,
                                type: 'input',
                                title: 'Input',
                                position: { x: 150, y: 150 },
                                parameters: { outputSchema: [{ name: 'item' }] },
                            },
                            {
                                id: 100003,
                                type: 'llm',
                                title: 'LLM',
                                position: { x: 150, y: 200 },
                                parameters: { modelName: 'gpt-4' },
                            },
                            {
                                id: 100004,
                                type: 'loop_set_variable',
                                title: 'Set Variable',
                                position: { x: 150, y: 250 },
                                parameters: {
                                    variables: [
                                        {
                                            left: {
                                                type: 'string',
                                                value: { type: 'ref', content: { blockID: '100002', name: 'item' } },
                                            },
                                            right: {
                                                type: 'string',
                                                value: { type: 'ref', content: { blockID: '100003', name: 'output' } },
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
                edges: [],
            };

            core.importWorkflow(workflow);
            expect(core.nodes.length).toBe(4);

            const loopVarNode = core.nodes.find((n) => n.type === 'loop_set_variable');
            expect(loopVarNode).toBeDefined();
            expect(Array.isArray(loopVarNode.parameters.variables)).toBe(true);
            expect(loopVarNode.parameters.variables.length).toBe(1);

            const variable = loopVarNode.parameters.variables[0];
            const itemNode = core.nodes.find((n) => n.type === 'input');
            const sourceNode = core.nodes.find((n) => n.type === 'llm');

            expect(itemNode).toBeDefined();
            expect(sourceNode).toBeDefined();
            expect(variable.left.value.content.blockID).toBe(itemNode.id);
            expect(variable.right.value.content.blockID).toBe(sourceNode.id);
        });
    });

    describe('paste method', () => {
        it('should paste from empty clipboard with copiedNode fallback', async () => {
            const node = core.createNode('start', 100, 100, { title: 'Start' });
            core.selectNode(node.id);

            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async () => {
                throw new Error('copy failed');
            };
            await clipboard.copy();
            expect(clipboard.copiedNode).toBeDefined();

            global.navigator.clipboard.readText = async () => '';
            await clipboard.paste();
            expect(core.nodes.length).toBe(2);
        });

        it('should handle non-JSON clipboard text', async () => {
            global.navigator.clipboard.readText = async () => 'not json';
            global.navigator.clipboard.writeText = async () => {
                throw new Error('copy failed');
            };

            const node = core.createNode('start', 100, 100, { title: 'Start' });
            core.selectNode(node.id);
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            await clipboard.copy();
            expect(clipboard.copiedNode).toBeDefined();

            await clipboard.paste();
            // 新行为：非 JSON 剪贴板文本应报错而非静默回退
            expect(core.nodes.length).toBe(1);
        });

        it('should handle clipboard read error', async () => {
            global.navigator.clipboard.readText = async () => {
                throw new Error('denied');
            };
            global.navigator.clipboard.writeText = async () => {
                throw new Error('copy failed');
            };

            const node = core.createNode('start', 100, 100, { title: 'Start' });
            core.selectNode(node.id);
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            await clipboard.copy();
            expect(clipboard.copiedNode).toBeDefined();

            await clipboard.paste();
            expect(core.nodes.length).toBe(2);
        });

        it('should handle empty clipboard with no copiedNode', async () => {
            global.navigator.clipboard.readText = async () => '';
            clipboard.copiedNode = null;
            await clipboard.paste();
            expect(core.nodes.length).toBe(0);
        });

        it('should handle whitespace-only clipboard', async () => {
            global.navigator.clipboard.readText = async () => '   \n  ';
            const result = await clipboard.paste();
            expect(result).toBeUndefined();
        });
    });

    describe('copy with node_outputs', () => {
        it('should handle node with node_outputs in copy', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: {
                        output1: { type: 'string', description: 'desc1', required: true, value: 'default1' },
                        output2: {
                            type: 'number',
                            description: 'desc2',
                            schema: { type: 'object' },
                            rawMeta: { key: 'val' },
                            input: { type: 'ref', content: 'test' },
                        },
                    },
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs).toBeDefined();
            expect(cozeNode.data.outputs.length).toBe(2);
        });

        it('should handle node with outputs array in copy', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                outputs: [
                    { name: 'out1', type: 'string', defaultValue: 'val1' },
                    { name: 'out2', type: 'number' },
                ],
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs).toBeDefined();
        });

        it('should handle node with outputs array that augments existing outputs', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: { out1: { type: 'string', value: 'default' } },
                },
            });
            node.outputs = [{ name: 'out1', type: 'string', defaultValue: 'updated' }];
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            const out1 = cozeNode.data.outputs.find((o) => o.name === 'out1');
            expect(out1).toBeDefined();
            expect(out1.defaultValue).toBe('updated');
        });

        it('should handle node with inputParams in copy', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                inputParams: [
                    { name: 'param1', type: 'string', value: 'hello', valueType: 'literal' },
                    {
                        name: 'param2',
                        type: 'string',
                        value: { type: 'ref', content: { blockID: 'n1', name: 'out' } },
                        valueType: 'ref',
                        rawMeta: { key: 'val' },
                        schema: { type: 'object' },
                    },
                ],
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.inputParameters).toBeDefined();
            expect(cozeNode.data.inputs.inputParameters.length).toBe(2);
        });

        it('should handle node with outputParams in copy', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                outputParams: [
                    { name: 'out1', type: 'string', value: 'val1', description: 'desc1' },
                    { name: 'out2', type: 'number' },
                ],
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs).toBeDefined();
        });
    });

    describe('copy with specific node types', () => {
        let capturedText;

        function setupCopy(type, params) {
            core = new WorkflowCore();
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                },
                node: {
                    createElement: (node) => {
                        const el = { style: {}, dataset: {} };
                        el.dataset.nodeId = node.id;
                        return el;
                    },
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            clipboard = new WorkflowClipboard(mockUI);

            const node = core.createNode(type, 200, 300, {
                title: type,
                parameters: params,
            });
            core.selectNode(node.id);

            capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };
        }

        it('should handle variable_merge node with mergeGroups', async () => {
            setupCopy('variable_merge', { mergeGroups: [{ name: 'g1', variables: [] }] });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.mergeGroups).toBeDefined();
        });

        it('should handle output node with content and streaming options', async () => {
            setupCopy('output', {
                content: 'result',
                streamingOutput: true,
                callTransferVoice: true,
                chatHistoryWriting: 'historyWrite',
            });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.content).toBeDefined();
            expect(data.json.nodes[0].data.inputs.streamingOutput).toBe(true);
        });

        it('should handle output node with _contentRaw', async () => {
            setupCopy('output', {
                _contentRaw: { type: 'string', value: { type: 'literal', content: 'raw' } },
                streamingOutput: false,
            });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.content).toBeDefined();
        });

        it('should handle input node with outputSchema', async () => {
            setupCopy('input', { outputSchema: [{ name: 'field1', type: 'string' }] });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.outputSchema).toBeDefined();
        });

        it('should handle comment node with content', async () => {
            setupCopy('comment', { content: 'test comment' });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.schemaType).toBe('slate');
            expect(data.json.nodes[0].data.inputs.note).toBeDefined();
        });

        it('should handle end node with terminatePlan', async () => {
            setupCopy('end', { content: 'done', terminatePlan: 'returnVariables', streamingOutput: true });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.terminatePlan).toBe('returnVariables');
        });

        it('should handle loop_set_variable node with variables', async () => {
            setupCopy('loop_set_variable', { variables: [{ name: 'v1', type: 'string', value: 'test' }] });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].type).toBe('20');
        });

        it('should handle loop_set_variable node without variables', async () => {
            setupCopy('loop_set_variable', {});
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].type).toBe('20');
        });

        it('should handle code node with version', async () => {
            setupCopy('code', { code: 'print(1)' });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.version).toBe('v2');
        });

        it('should handle node with generic parameters', async () => {
            setupCopy('plugin', { pluginName: 'test', customParam: 'value' });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.customParam).toBe('value');
        });

        it('should handle node with old-format inputParameters', async () => {
            setupCopy('llm', {});
            const node = core.nodes[0];
            node.inputParameters = [
                { name: 'p1', type: 'string', value: 'hello', valueType: 'literal', rawMeta: { key: 'val' } },
            ];

            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            capturedText = '';
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.inputParameters).toBeDefined();
        });

        it('should handle node with inputs merging', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
            });
            node.inputs = { customField: 'customValue', extraField: 42 };
            core.selectNode(node.id);

            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            capturedText = '';
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.inputs.customField).toBe('customValue');
            expect(data.json.nodes[0].data.inputs.extraField).toBe(42);
        });

        it('should handle input node auto-outputs from string schema', async () => {
            setupCopy('input', { outputSchema: JSON.stringify([{ name: 'field1', type: 'string' }]) });
            await clipboard.copy();
            const data = JSON.parse(capturedText);
            expect(data.json.nodes[0].data.outputs).toBeDefined();
        });
    });

    describe('paste with additional scenarios', () => {
        it('should paste node with canvasPosition', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 }, canvasPosition: { x: 500, y: 600 } },
                            data: {
                                nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with output containing schema', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'object',
                                        schema: { type: 'object', properties: { name: { type: 'string' } } },
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.node_outputs).toBeDefined();
        });

        it('should paste node with output containing array schema', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'object',
                                        schema: [{ name: 'prop1', type: 'string' }],
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with output containing input reference', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'string',
                                        input: { type: 'ref', value: { content: { blockID: '1', name: 'output' } } },
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with outputs having defaultValue', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'string',
                                        defaultValue: 'default_value',
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.output).toBe('default_value');
        });

        it('should paste node with content ref value', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '13',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    content: {
                                        type: 'string',
                                        value: { type: 'ref', content: { blockID: '2', name: 'out' } },
                                    },
                                    streamingOutput: false,
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with inputParameters containing left/right', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '20',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'SetVar', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            left: { type: 'string', value: { content: { name: 'var1' } } },
                                            right: { type: 'string', value: { type: 'literal', content: 'value1' } },
                                        },
                                    ],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].inputParams).toBeDefined();
            expect(core.nodes[0].inputParams.length).toBe(1);
        });

        it('should paste node with content being plain string', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '13',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    content: 'plain text',
                                    streamingOutput: false,
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with headers and body as object', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '45',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'HTTP', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    url: 'https://api.com',
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: { key: 'value' },
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.url).toBe('https://api.com');
        });

        it('should paste node with unknown type', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '999',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Unknown', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste container node with blockID remapping in outputs', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '21',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 300, height: 200 },
                            },
                            _temp: { bounds: { x: 200, y: 300, width: 300, height: 200 }, externalData: {} },
                            blocks: [
                                {
                                    id: '2',
                                    type: '3',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], llmParam: [] },
                                        outputs: [{ name: 'output', type: 'string' }],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: { bounds: { x: 50, y: 80, width: 200, height: 100 }, externalData: {} },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'loop-function-inline-output',
                                    targetPortID: 'loop-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
        });

        it('should paste Coze data with no json field from pasteFromCozeFormat', () => {
            clipboard.pasteHandler.pasteFromCozeFormat({});
            expect(core.nodes.length).toBe(0);
        });

        it('should paste simple format node with transform', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x + 10, canvasY: y + 10 }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 10, scale: 2 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const simpleData = {
                type: 'workflow-node',
                node: {
                    id: '1',
                    type: 'start',
                    title: 'Simple Node',
                    description: 'desc',
                    x: 100,
                    y: 200,
                    icon: 'icon1',
                    parameters: {},
                },
                edges: [],
            };
            localClipboard.pasteHandler.pasteFromSimpleFormat(simpleData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste simple nodes format', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 0, scale: 1 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                    batchMeasureElements: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const simpleNodes = {
                nodes: [
                    { id: '1', type: 'start', title: 'Node1', x: 100, y: 200, parameters: {} },
                    { id: '2', type: 'end', title: 'Node2', x: 300, y: 200, parameters: {} },
                ],
            };
            localClipboard.pasteHandler.pasteFromSimpleNodes(simpleNodes);
            expect(core.nodes.length).toBe(2);
        });

        it('should paste simple nodes format with edges', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 0, scale: 1 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                    batchMeasureElements: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const simpleNodes = {
                nodes: [
                    { id: '1', type: 'start', title: 'Node1', x: 100, y: 200, parameters: {} },
                    { id: '2', type: 'end', title: 'Node2', x: 300, y: 200, parameters: {} },
                ],
                edges: [{ sourceNodeID: '1', targetNodeID: '2' }],
            };
            localClipboard.pasteHandler.pasteFromSimpleNodes(simpleNodes);
            expect(core.nodes.length).toBe(2);
        });
    });

    describe('copy with node_outputs properties', () => {
        it('should handle node_outputs with properties', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: {
                        output1: {
                            type: 'string',
                            properties: { prop1: { type: 'string', required: true, description: 'p1' } },
                        },
                    },
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();

            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs[0].schema).toBeDefined();
            expect(cozeNode.data.outputs[0].schema.length).toBe(1);
        });

        it('should handle node_outputs with null value', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: {
                        output1: { type: 'string', value: '' },
                    },
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs[0].defaultValue).toBeUndefined();
        });

        it('should handle node_outputs with assistType', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: {
                        output1: { type: 'string', assistType: 'text', value: 'test' },
                    },
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.outputs[0].assistType).toBe('text');
        });
    });

    describe('copy with outputParams', () => {
        it('should handle outputParams that matches existing outputs', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: { out1: { type: 'string', value: 'original' } },
                },
            });
            node.outputParams = [{ name: 'out1', type: 'string', value: 'updated', description: 'updated desc' }];
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            const out1 = cozeNode.data.outputs.find((o) => o.name === 'out1');
            expect(out1.defaultValue).toBe('updated');
        });

        it('should handle outputParams with empty value', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    node_outputs: { out1: { type: 'string', value: 'original' } },
                },
            });
            node.outputParams = [{ name: 'out1', type: 'string', value: '', description: 'desc' }];
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            const out1 = cozeNode.data.outputs.find((o) => o.name === 'out1');
            expect(out1.defaultValue).toBe('original');
        });
    });

    describe('paste llmParam object format', () => {
        it('should paste node with llmParam as object format', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '18',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Question', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    llmParam: {
                                        0: {
                                            name: 'model',
                                            input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } },
                                        },
                                        1: 'simpleValue',
                                    },
                                    question: 'What?',
                                    answer_type: 'text',
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with llmParam as object with ref values', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '18',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Question', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    llmParam: {
                                        0: {
                                            name: 'model',
                                            input: {
                                                type: 'string',
                                                value: { type: 'ref', content: { blockID: '1', name: 'output' } },
                                            },
                                        },
                                    },
                                    question: 'What?',
                                    answer_type: 'text',
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with more edge cases', () => {
        it('should paste node with rawMeta in output', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {},
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'string',
                                        rawMeta: { type: 'raw_string' },
                                        assistType: 'text',
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.node_outputs.output.rawMeta).toBeDefined();
        });

        it('should paste node with node_outputs input ref', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {},
                                outputs: [
                                    {
                                        name: 'output',
                                        type: 'list',
                                        input: { type: 'ref', value: { content: { blockID: '2', name: 'out' } } },
                                    },
                                ],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with content as literal object', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '13',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    content: { type: 'string', value: { type: 'literal', content: 'hello' } },
                                    streamingOutput: false,
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.content).toBe('hello');
        });

        it('should paste node with code input', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '5',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    code: 'print("hello")',
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.code).toBe('print("hello")');
        });

        it('should paste node with llmParam array', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '3',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    llmParam: [
                                        {
                                            name: 'modleName',
                                            input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } },
                                        },
                                        {
                                            name: 'prompt',
                                            input: { type: 'string', value: { type: 'literal', content: 'hello' } },
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.modelName).toBe('gpt-4');
        });

        it('should paste node with note as invalid JSON', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '31',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Comment', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    schemaType: 'slate',
                                    note: 'plain text note',
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.content).toBe('plain text note');
        });

        it('should paste node with variable_merge and mergeGroups', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '32',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Merge', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g1',
                                            variables: [
                                                {
                                                    name: 'v1',
                                                    value: { type: 'ref', content: { blockID: '2', name: 'out' } },
                                                },
                                            ],
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '3',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [{ name: 'out', type: 'string' }],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
        });
    });

    describe('container node with output ref remapping', () => {
        it('should remap container output refs for loop type', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '21',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [{ name: 'output', type: 'list' }],
                                size: { width: 300, height: 200 },
                            },
                            _temp: { bounds: { x: 200, y: 300, width: 300, height: 200 }, externalData: {} },
                            blocks: [
                                {
                                    id: '2',
                                    type: '3',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], llmParam: [] },
                                        outputs: [{ name: 'output', type: 'string' }],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: { bounds: { x: 50, y: 80, width: 200, height: 100 }, externalData: {} },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'loop-function-inline-output',
                                    targetPortID: 'loop-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
        });

        it('should remap container output refs for batch type', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '28',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Batch', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [{ name: 'output', type: 'list' }],
                                size: { width: 300, height: 200 },
                            },
                            _temp: { bounds: { x: 200, y: 300, width: 300, height: 200 }, externalData: {} },
                            blocks: [
                                {
                                    id: '2',
                                    type: '3',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], llmParam: [] },
                                        outputs: [{ name: 'output', type: 'string' }],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: { bounds: { x: 50, y: 80, width: 200, height: 100 }, externalData: {} },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'batch-function-inline-output',
                                    targetPortID: 'batch-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
        });
    });

    describe('copy question type with llmParam', () => {
        it('should handle question node with llmParamRaw array', async () => {
            const node = core.createNode('question', 200, 300, {
                title: 'Question',
                parameters: {
                    answer_type: 'text',
                    option_type: 'static',
                    options: [],
                    limit: 5,
                    extra_output: true,
                    question: 'What is your name?',
                    dynamic_option: { type: 'ref', content: { blockID: 'ref_1', name: 'options' } },
                    _llmParamRaw: [
                        { name: 'modleName', input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } } },
                        {
                            name: 'systemPrompt',
                            input: { type: 'string', value: { type: 'literal', content: 'You are helpful' } },
                        },
                    ],
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.llmParam).toBeDefined();
            expect(cozeNode.data.inputs.question).toBe('What is your name?');
            expect(cozeNode.data.inputs.extra_output).toBe(true);
        });

        it('should handle question node with llmParamRaw object', async () => {
            const node = core.createNode('question', 200, 300, {
                title: 'Question',
                parameters: {
                    answer_type: 'text',
                    question: 'Test?',
                    _llmParamRaw: {
                        0: {
                            name: 'modleName',
                            input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } },
                        },
                        1: 'simpleValue',
                    },
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.llmParam).toBeDefined();
            expect(cozeNode.data.inputs.question).toBe('Test?');
        });

        it('should handle question node with llmParamRaw having rawMeta', async () => {
            const node = core.createNode('question', 200, 300, {
                title: 'Question',
                parameters: {
                    question: 'Test?',
                    _llmParamRaw: [
                        {
                            name: 'modleName',
                            input: {
                                type: 'string',
                                value: { type: 'literal', content: 'gpt-4', rawMeta: { type: 'model' } },
                            },
                        },
                    ],
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.llmParam).toBeDefined();
            expect(cozeNode.data.inputs.llmParam[0].input.value.rawMeta).toBeDefined();
        });
    });

    describe('copy llm type with llmParamRaw', () => {
        it('should handle llm node with _llmParamRaw array', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    modelName: 'gpt-4',
                    prompt: 'Hello',
                    _llmParamRaw: [
                        { name: 'modleName', input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } } },
                        { name: 'prompt', input: { type: 'string', value: { type: 'literal', content: 'Hello' } } },
                    ],
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.llmParam).toBeDefined();
            expect(cozeNode.data.inputs.llmParam.length).toBe(2);
        });

        it('should handle llm node with _llmParamRaw having rawMeta', async () => {
            const node = core.createNode('llm', 200, 300, {
                title: 'LLM',
                parameters: {
                    modelName: 'gpt-4',
                    _llmParamRaw: [
                        {
                            name: 'modleName',
                            input: {
                                type: 'string',
                                value: { type: 'literal', content: 'gpt-4', rawMeta: { type: 'model' } },
                            },
                        },
                    ],
                },
            });
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.inputs.llmParam[0].input.value.rawMeta).toBeDefined();
        });
    });

    describe('copy with extra node properties', () => {
        it('should handle node with icon and description', async () => {
            const node = core.createNode('start', 200, 300, {
                title: 'Start',
                description: 'custom description',
            });
            node.icon = 'custom-icon';
            core.selectNode(node.id);

            let capturedText = '';
            document.querySelectorAll = () => [{ dataset: { nodeId: node.id }, getAttribute: () => 'selected' }];
            global.navigator.clipboard.writeText = async (text) => {
                capturedText = text;
            };

            await clipboard.copy();
            const copyData = JSON.parse(capturedText);
            const cozeNode = copyData.json.nodes[0];
            expect(cozeNode.data.nodeMeta.icon).toBe('custom-icon');
            expect(cozeNode.data.nodeMeta.description).toBe('custom description');
        });
    });

    describe('paste with branches', () => {
        it('should paste node with branches in pasteFromCozeFormat', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '19',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        {
                                            condition: {
                                                conditions: [
                                                    {
                                                        left: {
                                                            input: {
                                                                type: 'string',
                                                                value: { type: 'literal', content: 'left_name' },
                                                            },
                                                        },
                                                        right: {
                                                            input: {
                                                                type: 'string',
                                                                value: { type: 'literal', content: 'right_name' },
                                                            },
                                                        },
                                                        operator: 'eq',
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.branches[0].name).toBe('right_name');
        });

        it('should paste node with branches and left content', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '19',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        {
                                            condition: {
                                                conditions: [
                                                    {
                                                        left: {
                                                            input: {
                                                                type: 'string',
                                                                value: { type: 'literal', content: 'left_name' },
                                                            },
                                                        },
                                                        operator: 'eq',
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.branches[0].name).toBe('left_name');
        });

        it('should paste node with branches and no conditions fallback to Branch N', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '19',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [{ condition: { conditions: [] } }],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.branches[0].name).toBe('Branch 1');
        });

        it('should paste node with branches and blockID references', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '19',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        {
                                            name: 'existing_branch',
                                            condition: {
                                                conditions: [
                                                    {
                                                        left: {
                                                            input: {
                                                                type: 'string',
                                                                value: {
                                                                    type: 'ref',
                                                                    content: { blockID: '1', name: 'x' },
                                                                },
                                                            },
                                                        },
                                                        right: {
                                                            input: {
                                                                type: 'string',
                                                                value: { type: 'literal', content: 'test' },
                                                            },
                                                        },
                                                        operator: 'eq',
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
            expect(core.nodes[0].parameters.branches[0].name).toBe('existing_branch');
        });
    });

    describe('paste with condition node port conversion', () => {
        beforeEach(() => {
            core = new WorkflowCore();
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                },
                node: {
                    createElement: (node) => {
                        const el = { style: {}, dataset: {} };
                        el.dataset.nodeId = node.id;
                        return el;
                    },
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            clipboard = new WorkflowClipboard(mockUI);
        });

        it('should convert true port to branch_0 for condition node', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '8',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        { name: 'b1', condition: { conditions: [] } },
                                        { name: 'b2', condition: { conditions: [] } },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '3',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [{ sourceNodeID: '1', targetNodeID: '2', sourcePortID: 'true' }],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            const edge = core.edges.find((e) => e.sourcePort === 'branch_0');
            expect(edge).toBeDefined();
        });

        it('should convert false port to last branch for condition node', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '8',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        { name: 'b1', condition: { conditions: [] } },
                                        { name: 'b2', condition: { conditions: [] } },
                                        { name: 'b3', condition: { conditions: [] } },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '3',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [{ sourceNodeID: '1', targetNodeID: '2', sourcePortID: 'false' }],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            const edge = core.edges.find((e) => e.sourcePort === 'branch_2');
            expect(edge).toBeDefined();
        });

        it('should convert true_N port to branch_N for condition node', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '8',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [
                                        { name: 'b1', condition: { conditions: [] } },
                                        { name: 'b2', condition: { conditions: [] } },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '3',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [{ sourceNodeID: '1', targetNodeID: '2', sourcePortID: 'true_1' }],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            const edge = core.edges.find((e) => e.sourcePort === 'branch_1');
            expect(edge).toBeDefined();
        });
    });

    describe('paste with contentRaw and dynamic_option', () => {
        it('should paste node with _contentRaw ref blockID', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '13',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    content: { type: 'string', value: { type: 'literal', content: 'hello' } },
                                    streamingOutput: false,
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with dynamic_option ref blockID', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '18',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Question', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    question: 'Test?',
                                    llmParam: [],
                                    answer_type: 'text',
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with edge processing and skippedEdges', () => {
        it('should handle edges with duplicate targets', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '2',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'End', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [
                        { sourceNodeID: '1', targetNodeID: '2' },
                        { sourceNodeID: '1', targetNodeID: '2' },
                    ],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            expect(core.edges.length).toBe(1);
        });

        it('should handle edge with sourcePortID and targetPortID', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '2',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'End', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [
                        { sourceNodeID: '1', targetNodeID: '2', sourcePortID: 'output_1', targetPortID: 'input_1' },
                    ],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            expect(core.edges.length).toBe(1);
            expect(core.edges[0].sourcePort).toBe('output_1');
            expect(core.edges[0].targetPort).toBe('input_1');
        });
    });

    describe('paste with error handling', () => {
        it('should show error when paste throws', () => {
            const mockUI = {
                core: {
                    nodes: [],
                    edges: [],
                    addNode: () => {
                        throw new Error('Test error');
                    },
                    addEdge: () => {},
                    warn: () => {},
                    getTypeFromNumber: (n) => 'plugin',
                    batchChanges: (fn) => fn(),
                },
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                },
                node: {
                    createElement: (node) => {
                        const el = { style: {}, dataset: {} };
                        el.dataset.nodeId = node.id;
                        return el;
                    },
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: jest.fn(),
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            localClipboard.pasteHandler.pasteFromCozeFormat(cozeData);

            expect(mockUI.showMessage).toHaveBeenCalledWith(expect.stringContaining('Test error'), 'error');
        });
    });

    describe('paste with mergeGroups and variable references', () => {
        it('should paste node with mergeGroups and inputParams ref', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '32',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Merge', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g1',
                                            variables: [
                                                {
                                                    name: 'v1',
                                                    value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                                },
                                            ],
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste node with inputParams having ref values', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '20',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'SetVar', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            left: { value: { content: { name: 'var1' } } },
                                            right: { value: { type: 'ref', content: { blockID: '1', name: 'out' } } },
                                        },
                                    ],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with simple nodes format', () => {
        it('should skip pasteFromSimpleNodes when no nodes provided', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 0, scale: 1 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                    batchMeasureElements: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            localClipboard.pasteHandler.pasteFromSimpleNodes({});
            expect(core.nodes.length).toBe(0);

            localClipboard.pasteHandler.pasteFromSimpleNodes({ nodes: [] });
            expect(core.nodes.length).toBe(0);
        });

        it('should paste simple nodes with position from x/y', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 0, scale: 1 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                    batchMeasureElements: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const simpleNodes = {
                nodes: [{ id: '1', type: 'start', title: 'Node1', x: 100, y: 200, parameters: {} }],
            };
            localClipboard.pasteHandler.pasteFromSimpleNodes(simpleNodes);
            expect(core.nodes.length).toBe(1);
        });

        it('should paste simple nodes with edges using sourceNodeID', () => {
            const mockUI = {
                core,
                canvas: {
                    screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
                    lastMouseX: 100,
                    lastMouseY: 100,
                    canvasContent: { appendChild: () => {} },
                    setEmptyState: () => {},
                    getCurrentTransform: () => ({ translateX: 0, scale: 1 }),
                },
                node: {
                    createElement: () => ({ style: {}, dataset: {} }),
                    select: () => {},
                    batchMeasureElements: () => {},
                },
                updateEdges: () => {},
                updateSummary: () => {},
                showMessage: () => {},
            };
            const localClipboard = new WorkflowClipboard(mockUI);

            const simpleNodes = {
                nodes: [
                    { id: '1', type: 'start', title: 'Node1', x: 100, y: 200, parameters: {} },
                    { id: '2', type: 'end', title: 'Node2', x: 300, y: 200, parameters: {} },
                ],
                edges: [{ source: '1', target: '2' }],
            };
            localClipboard.pasteHandler.pasteFromSimpleNodes(simpleNodes);
            expect(core.nodes.length).toBe(2);
        });
    });

    describe('paste with condition node unknown port', () => {
        it('should keep original port name for unknown port on condition node', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '8',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'If', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    branches: [{ name: 'b1', condition: { conditions: [] } }],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                        {
                            id: '2',
                            type: '3',
                            meta: { position: { x: 300, y: 200 } },
                            data: {
                                nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 300, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [{ sourceNodeID: '1', targetNodeID: '2', sourcePortID: 'custom_port' }],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
            expect(core.edges[0].sourcePort).toBe('custom_port');
        });
    });

    describe('paste with _contentRaw and dynamic_option blockID remapping', () => {
        it('should remap blockID in _contentRaw', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '13',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    content: {
                                        type: 'string',
                                        value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                    },
                                    streamingOutput: false,
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should remap blockID in dynamic_option', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '18',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Question', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    question: 'Test?',
                                    llmParam: [],
                                    answer_type: 'text',
                                    dynamic_option: {
                                        value: { type: 'ref', content: { blockID: '1', name: 'options' } },
                                    },
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with mergeGroups and inputParams blockID remapping', () => {
        it('should remap blockID in mergeGroups variables', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '32',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Merge', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g1',
                                            variables: [
                                                {
                                                    name: 'v1',
                                                    value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                                },
                                            ],
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should remap blockID in mergeGroups variables with right blockID', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '32',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Merge', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g1',
                                            variables: [
                                                {
                                                    name: 'v1',
                                                    value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                                },
                                            ],
                                        },
                                    ],
                                    inputParameters: [],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });

        it('should remap blockID in inputParams', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '20',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'SetVar', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            name: 'v1',
                                            input: {
                                                type: 'string',
                                                value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                            },
                                        },
                                    ],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with loop_set_variable blockID remapping', () => {
        it('should remap blockID in loop_set_variable variables', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '20',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'SetVar', icon: '', description: '', mainColor: '#10b981' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            left: {
                                                type: 'string',
                                                value: { type: 'literal', content: { name: 'var1' } },
                                            },
                                            right: {
                                                type: 'string',
                                                value: { type: 'ref', content: { blockID: '1', name: 'out' } },
                                            },
                                        },
                                    ],
                                },
                                outputs: [],
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} },
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('paste with container block edge skippedEdges', () => {
        it('should handle block edges with skippedEdges', () => {
            const cozeData = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    nodes: [
                        {
                            id: '1',
                            type: '21',
                            meta: { position: { x: 200, y: 300 } },
                            data: {
                                nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [] },
                                outputs: [],
                                size: { width: 300, height: 200 },
                            },
                            _temp: { bounds: { x: 200, y: 300, width: 300, height: 200 }, externalData: {} },
                            blocks: [
                                {
                                    id: '2',
                                    type: '5',
                                    meta: { position: { x: 50, y: 80 } },
                                    data: {
                                        nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#10b981' },
                                        inputs: { inputParameters: [], code: 'print(1)' },
                                        outputs: [],
                                        size: { width: 200, height: 100 },
                                    },
                                    _temp: { bounds: { x: 50, y: 80, width: 200, height: 100 }, externalData: {} },
                                },
                            ],
                            edges: [
                                {
                                    sourceNodeID: '1',
                                    targetNodeID: '2',
                                    sourcePortID: 'loop-function-inline-output',
                                    targetPortID: 'loop-function-inline-input',
                                },
                            ],
                        },
                    ],
                    edges: [],
                },
            };
            clipboard.pasteHandler.pasteFromCozeFormat(cozeData);
            expect(core.nodes.length).toBe(2);
        });
    });
});
