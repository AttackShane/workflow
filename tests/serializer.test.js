/**
 * 工作流序列化模块测试
 */
import { WorkflowCore } from '../src/modules/workflow-core.js';

describe('WorkflowSerializer', () => {
    let core;

    beforeEach(() => {
        core = new WorkflowCore();
    });

    describe('importWorkflow', () => {
        it('should reject null workflow data', () => {
            core.importWorkflow(null);
            expect(core.nodes).toEqual([]);
            expect(core.edges).toEqual([]);
        });

        it('should reject workflow without nodes', () => {
            core.importWorkflow({});
            expect(core.nodes).toEqual([]);
        });

        it('should import workflow with nodes', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'start', title: '开始', position: { x: 100, y: 200 } }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            expect(core.nodes).toHaveLength(1);
            const node = core.nodes[0];
            expect(node.id).toBe('node_1');
            expect(node.type).toBe('start');
            expect(node.x).toBe(100);
            expect(node.y).toBe(200);
            expect(node.title).toBe('开始');
        });

        it('should import workflow with numeric type resolution', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: '1', position: { x: 0, y: 0 } }
                ],
                edges: []
            };

            core.importWorkflow(workflow);
            expect(core.nodes[0].type).not.toBe('1');
        });

        it('should import workflow with edges', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'start', position: { x: 0, y: 0 } },
                    { id: '2', type: 'end', position: { x: 300, y: 0 } }
                ],
                edges: [
                    { source_node: '1', target_node: '2' }
                ]
            };

            core.importWorkflow(workflow);

            expect(core.nodes).toHaveLength(2);
            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].source).toBe('node_1');
            expect(core.edges[0].target).toBe('node_2');
        });

        it('should handle nodes with missing position', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'code' }
                ],
                edges: []
            };

            core.importWorkflow(workflow);
            expect(core.nodes[0].x).toBe(0);
            expect(core.nodes[0].y).toBe(0);
        });

        it('should handle nodes with icon', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'plugin', icon: 'custom_icon', position: { x: 0, y: 0 } }
                ],
                edges: []
            };

            core.importWorkflow(workflow);
            expect(core.nodes[0].icon).toBe('custom_icon');
        });

        it('should handle nodes with parentId', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'loop', position: { x: 0, y: 0 }, parentId: 'parent_1' }
                ],
                edges: []
            };

            core.importWorkflow(workflow);
            expect(core.nodes[0].parentId).toBe('parent_1');
        });

        it('should handle edges with source_port', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'start', position: { x: 0, y: 0 } },
                    { id: '2', type: 'if', position: { x: 300, y: 0 } }
                ],
                edges: [
                    { source_node: '1', target_node: '2', source_port: 'branch_0' }
                ]
            };

            core.importWorkflow(workflow);

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].sourcePort).toBe('branch_0');
        });

        it('should import nested nodes (loop blocks)', () => {
            const workflow = {
                nodes: [
                    {
                        id: '1', type: 'loop', position: { x: 0, y: 0 },
                        nodes: [
                            { id: '2', type: 'code', position: { x: 50, y: 50 } }
                        ]
                    }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            expect(core.nodes).toHaveLength(2);
            const parentNode = core.nodes.find(n => n.id === 'node_1');
            const childNode = core.nodes.find(n => n.id === 'node_2');
            expect(parentNode).toBeDefined();
            expect(childNode).toBeDefined();
            expect(childNode.parentId).toBe('node_1');
        });

        it('should import nested nodes with icon', () => {
            const workflow = {
                nodes: [
                    {
                        id: '1', type: 'loop', position: { x: 0, y: 0 },
                        nodes: [
                            { id: '2', type: 'code', position: { x: 50, y: 50 }, icon: 'child_icon' }
                        ]
                    }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            const childNode = core.nodes.find(n => n.id === 'node_2');
            expect(childNode.icon).toBe('child_icon');
        });

        it('should handle numeric type in nested nodes', () => {
            const workflow = {
                nodes: [
                    {
                        id: '1', type: '21', position: { x: 0, y: 0 },
                        nodes: [
                            { id: '2', type: '5', position: { x: 50, y: 50 } }
                        ]
                    }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            const parentNode = core.nodes.find(n => n.id === 'node_1');
            const childNode = core.nodes.find(n => n.id === 'node_2');
            expect(parentNode.type).toBe('loop');
            expect(childNode.type).toBe('code');
        });

        it('should remap blockID in loop_set_variable nodes', () => {
            const workflow = {
                nodes: [
                    {
                        id: '1', type: 'loop', position: { x: 0, y: 0 },
                        nodes: [
                            { id: '2', type: 'code', position: { x: 50, y: 50 } },
                            {
                                id: '3', type: 'loop_set_variable', position: { x: 100, y: 100 },
                                parameters: {
                                    variables: [
                                        {
                                            left: { value: { content: { blockID: '2' } } },
                                            right: { value: { content: { blockID: '2' } } }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        id: '4', type: 'loop_set_variable', position: { x: 200, y: 0 },
                        parameters: {
                            variables: [
                                {
                                    left: { value: { content: { blockID: '1' } } },
                                    right: { value: { content: { blockID: '1' } } }
                                }
                            ]
                        }
                    }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            const node3 = core.nodes.find(n => n.id === 'node_3');
            expect(node3.parameters.variables[0].left.value.content.blockID).toBe('2');
            expect(node3.parameters.variables[0].right.value.content.blockID).toBe('2');

            const node4 = core.nodes.find(n => n.id === 'node_4');
            expect(node4.parameters.variables[0].left.value.content.blockID).toBe('1');
        });

        it('should handle edge with source_node not found', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'start', position: { x: 0, y: 0 } }
                ],
                edges: [
                    { source_node: '999', target_node: '1' }
                ]
            };

            core.importWorkflow(workflow);
            expect(core.edges).toHaveLength(0);
        });

        it('should handle edge with target_node not found', () => {
            const workflow = {
                nodes: [
                    { id: '1', type: 'start', position: { x: 0, y: 0 } }
                ],
                edges: [
                    { source_node: '1', target_node: '999' }
                ]
            };

            core.importWorkflow(workflow);
            expect(core.edges).toHaveLength(0);
        });
    });

    describe('exportWorkflow', () => {
        beforeEach(() => {
            core.nodes = [
                { id: 'node_100001', type: 'start', x: 100, y: 200, title: '开始', description: '启动节点' },
                { id: 'node_100002', type: 'end', x: 400, y: 200, title: '结束' }
            ];
            core.edges = [
                { id: 'edge_1', source: 'node_100001', target: 'node_100002' }
            ];
        });

        it('should export workflow with default options', () => {
            const result = core.exportWorkflow();

            expect(result.schema_version).toBe('1.0.0');
            expect(result.name).toBe('my_workflow');
            expect(result.description).toBe('Created with workflow editor');
            expect(result.mode).toBe('workflow');
            expect(result.nodes).toHaveLength(2);
            expect(result.edges).toHaveLength(1);
        });

        it('should export workflow with custom options', () => {
            const result = core.exportWorkflow({
                name: 'custom_name',
                id: 'custom_id',
                description: 'custom desc'
            });

            expect(result.name).toBe('custom_name');
            expect(result.id).toBe('custom_id');
            expect(result.description).toBe('custom desc');
        });

        it('should strip node_ prefix from IDs', () => {
            const result = core.exportWorkflow();
            expect(result.nodes[0].id).toBe('100001');
            expect(result.nodes[1].id).toBe('100002');
        });

        it('should include node positions', () => {
            const result = core.exportWorkflow();
            expect(result.nodes[0].position).toEqual({ x: 100, y: 200 });
        });

        it('should handle edges with sourcePort', () => {
            core.edges = [
                { id: 'edge_1', source: 'node_100001', target: 'node_100002', sourcePort: 'branch_0' }
            ];

            const result = core.exportWorkflow();
            expect(result.edges[0].source_port).toBe('branch_0');
        });

        it('should filter out child nodes (with parentId)', () => {
            core.nodes.push({
                id: 'node_100003', type: 'code', x: 100, y: 300,
                parentId: 'node_100001', title: '子节点'
            });

            const result = core.exportWorkflow();
            expect(result.nodes).toHaveLength(2);
        });

        it('should include icon if present', () => {
            core.nodes[0].icon = 'test_icon';
            const result = core.exportWorkflow();
            expect(result.nodes[0].icon).toBe('test_icon');
        });

        it('should export nested child nodes as blocks', () => {
            core.nodes = [
                {
                    id: 'node_1', type: 'loop', x: 0, y: 0, title: 'Loop',
                    parameters: { loopCount: 3 }
                },
                {
                    id: 'node_2', type: 'code', x: 50, y: 50, title: 'Child',
                    parentId: 'node_1', parameters: { code: 'print(1)' }
                }
            ];
            core.edges = [];

            const result = core.exportWorkflow();
            expect(result.nodes).toHaveLength(1);
            expect(result.nodes[0].nodes).toBeDefined();
            expect(result.nodes[0].nodes).toHaveLength(1);
            expect(result.nodes[0].nodes[0].id).toBe('2');
            expect(result.nodes[0].nodes[0].type).toBe('code');
        });

        it('should include child icon if present', () => {
            core.nodes = [
                { id: 'node_1', type: 'loop', x: 0, y: 0, title: 'Loop' },
                {
                    id: 'node_2', type: 'code', x: 50, y: 50, title: 'Child',
                    parentId: 'node_1', icon: 'child_icon'
                }
            ];
            core.edges = [];

            const result = core.exportWorkflow();
            expect(result.nodes[0].nodes[0].icon).toBe('child_icon');
        });

        it('should handle edge without sourcePort', () => {
            const result = core.exportWorkflow();
            expect(result.edges[0].source_port).toBeUndefined();
        });
    });

    describe('loadFromClipboard', () => {
        it('should reject null data', () => {
            const initialNodes = [...core.nodes];
            core.loadFromClipboard(null);
            expect(core.nodes).toEqual(initialNodes);
        });

        it('should reject data without nodes', () => {
            core.loadFromClipboard({ json: { nodes: [] } });
            expect(core.nodes).toEqual([]);
        });

        it('should load clipboard data with nodes', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Test Node', description: 'A test' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            expect(core.nodes).toHaveLength(1);
            const node = core.nodes[0];
            expect(node.id).toMatch(/^node_\d+$/);
            expect(node.x).toBe(100);
            expect(node.y).toBe(200);
            expect(node.title).toBe('Test Node');
        });

        it('should handle unknown type gracefully', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '999',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Unknown' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].type).toBe('plugin');
        });

        it('should handle node with outputs (defaultValue)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: [
                                    { name: 'text', type: 'string', defaultValue: 'hello', description: 'Output text', required: false }
                                ]
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.text).toBe('hello');
            expect(core.nodes[0].parameters.node_outputs).toBeDefined();
            expect(core.nodes[0].parameters.node_outputs.text.type).toBe('string');
        });

        it('should handle node with outputs schema', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '4',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Plugin' },
                                inputs: {},
                                outputs: [
                                    { name: 'data', type: 'object', schema: [{ name: 'field1', type: 'string' }] }
                                ]
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.node_outputs.data.properties).toBeDefined();
        });

        it('should handle llmParam inputs (array format)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    llmParam: [
                                        { name: 'modelName', input: { value: { content: 'gpt-4' } } },
                                        { name: 'temperature', input: { value: { content: 0.7 } } }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.modelName).toBe('gpt-4');
            expect(core.nodes[0].parameters.temperature).toBe(0.7);
            expect(core.nodes[0].parameters._llmParamRaw).toBeDefined();
        });

        it('should handle llmParam inputs with modleName key', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    llmParam: [
                                        { name: 'modleName', input: { value: { content: 'gpt-4' } } }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.modelName).toBe('gpt-4');
        });

        it('should handle llmParam inputs (object format)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    llmParam: {
                                        modelName: { name: 'modelName', input: { value: { content: 'gpt-4' } } },
                                        temperature: 0.5
                                    }
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.modelName).toBe('gpt-4');
            expect(core.nodes[0].parameters.temperature).toBe(0.5);
        });

        it('should handle code input', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '5',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Code' },
                                inputs: { code: 'print("hello")' },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.code).toBe('print("hello")');
        });

        it('should handle url and method inputs', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '45',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'HTTP' },
                                inputs: {
                                    url: 'https://api.example.com',
                                    method: 'POST'
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.url).toBe('https://api.example.com');
            expect(core.nodes[0].parameters.method).toBe('POST');
        });

        it('should handle headers and body inputs (serialized as JSON string)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '45',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'HTTP' },
                                inputs: {
                                    headers: { 'Content-Type': 'application/json' },
                                    body: '{"key":"value"}'
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.headers).toBe('{"Content-Type":"application/json"}');
            expect(core.nodes[0].parameters.body).toBe('{"key":"value"}');
        });

        it('should handle content input with literal type', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    content: { value: { type: 'literal', content: 'Hello World' } }
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.content).toBe('Hello World');
        });

        it('should handle content input with ref type', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    content: { value: { type: 'ref', content: { blockID: '2' } } }
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(typeof core.nodes[0].parameters.content).toBe('string');
            expect(core.nodes[0].parameters._contentRaw).toBeDefined();
        });

        it('should handle content input with direct value', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {
                                    content: 'direct content'
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.content).toBe('direct content');
        });

        it('should handle loop_set_variable with inputParameters', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '20',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Set Variable' },
                                inputs: {
                                    inputParameters: [
                                        { name: 'var1', type: 'string', value: 'test' }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.variables).toBeDefined();
            expect(core.nodes[0].parameters.variables).toHaveLength(1);
        });

        it('should handle node with blocks (nested)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '21',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Loop' },
                                inputs: {},
                                outputs: []
                            },
                            blocks: [
                                {
                                    id: 2,
                                    type: '5',
                                    meta: { position: { x: 50, y: 50 } },
                                    data: {
                                        nodeMeta: { title: 'Inner Code' },
                                        inputs: { code: 'print(1)' },
                                        outputs: []
                                    }
                                }
                            ]
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            expect(core.nodes).toHaveLength(2);
            expect(core.nodes[0].type).toBe('loop');
            expect(core.nodes[0]._skipLayout).toBe(true);
            expect(core.nodes[1].parentId).toBeDefined();
            expect(core.nodes[1].type).toBe('code');
        });

        it('should handle edges creation', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '1',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'Start' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '2',
                            meta: { position: { x: 300, y: 0 } },
                            data: { nodeMeta: { title: 'End' }, inputs: {}, outputs: [] }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 1, targetNodeID: 2 }
                    ]
                }
            };

            core.loadFromClipboard(data);

            expect(core.edges).toHaveLength(1);
        });

        it('should handle node with no meta.position', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].x).toBe(0);
            expect(core.nodes[0].y).toBe(0);
        });

        it('should handle node with x/y directly', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            x: 150,
                            y: 250,
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].x).toBe(150);
            expect(core.nodes[0].y).toBe(250);
        });

        it('should handle node with no title', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: {},
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].title).toBeDefined();
        });

        it('should handle node with inputParameters', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '4',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Plugin' },
                                inputs: {
                                    inputParameters: [{ name: 'param1', value: 'val1' }]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.inputParameters).toBeUndefined();
        });

        it('should handle other input keys', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '4',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Plugin' },
                                inputs: {
                                    customKey: 'customValue',
                                    schemaType: 'should_skip',
                                    inputParameters: 'should_skip'
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].parameters.customKey).toBe('customValue');
            expect(core.nodes[0].parameters.schemaType).toBeUndefined();
            expect(core.nodes[0].parameters.inputParameters).toBeUndefined();
        });

        it('should handle variable_merge node with mergeGroups', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '32',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '3',
                            meta: { position: { x: 100, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM1' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 2, targetNodeID: 1, sourcePortID: 'output_0' }
                    ]
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes.some(n => n.type === 'variable_merge')).toBe(true);
        });

        it('should handle inputParams with ref blockID remapping', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM1' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '3',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM2' },
                                inputs: {},
                                outputs: []
                            },
                            inputParams: [
                                {
                                    valueType: 'ref',
                                    value: { content: { blockID: '1' } }
                                }
                            ]
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            const node2 = core.nodes.find(n => n.title === 'LLM2');
            const mappedId = core.nodes.find(n => n.title === 'LLM1').id;
            expect(node2.inputParams[0].value.content.blockID).toBe(mappedId);
        });

        it('should handle _contentRaw with ref blockID remapping', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM1' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '3',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM2' },
                                inputs: {
                                    content: { value: { type: 'ref', content: { blockID: '1' } } }
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            const node2 = core.nodes.find(n => n.title === 'LLM2');
            const mappedId = core.nodes.find(n => n.title === 'LLM1').id;
            expect(node2.parameters._contentRaw.value.content.blockID).toBe(mappedId);
        });

        it('should handle dynamic_option with ref blockID remapping', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM1' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '4',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Plugin' },
                                inputs: {
                                    dynamic_option: { value: { type: 'ref', content: { blockID: '1' } } }
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            const node2 = core.nodes.find(n => n.title === 'Plugin');
            const mappedId = core.nodes.find(n => n.title === 'LLM1').id;
            expect(node2.parameters.dynamic_option.value.content.blockID).toBe(mappedId);
        });

        it('should handle mergeGroups with ref blockID remapping', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM1' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '32',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 1, targetNodeID: 2, sourcePortID: 'output_0' }
                    ]
                }
            };

            core.loadFromClipboard(data);

            expect(core.nodes.some(n => n.type === 'variable_merge')).toBe(true);
        });

        it('should handle loop_set_variable with blockID remapping inside loadFromClipboard', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: []
                            }
                        },
                        {
                            id: 2,
                            type: '20',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'SetVar' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            left: { value: { content: { blockID: '1' } } },
                                            right: { value: { content: { blockID: '1' } } }
                                        }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);

            const setVarNode = core.nodes.find(n => n.title === 'SetVar');
            const mappedId = core.nodes.find(n => n.title === 'LLM').id;
            expect(setVarNode.parameters.variables[0].left.value.content.blockID).toBe(mappedId);
            expect(setVarNode.parameters.variables[0].right.value.content.blockID).toBe(mappedId);
        });

        it('should handle edge with source or target not found', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '1',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'Start' }, inputs: {}, outputs: [] }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 999, targetNodeID: 1 },
                        { sourceNodeID: 1, targetNodeID: 999 }
                    ]
                }
            };

            core.loadFromClipboard(data);
            expect(core.edges).toHaveLength(0);
        });

        it('should handle nodes with id as string', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 'abc',
                            type: '1',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'Start' }, inputs: {}, outputs: [] }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes).toHaveLength(1);
        });

        it('should handle variable_merge with multiple incoming edges of different types and map to most common', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'LLM1' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '3',
                            meta: { position: { x: 100, y: 0 } },
                            data: { nodeMeta: { title: 'LLM2' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 3,
                            type: '5',
                            meta: { position: { x: 200, y: 0 } },
                            data: { nodeMeta: { title: 'Code' }, inputs: { code: 'test' }, outputs: [] }
                        },
                        {
                            id: 4,
                            type: '32',
                            meta: { position: { x: 300, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {
                                    mergeGroups: [
                                        { name: 'group1', variables: [{}] }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 1, targetNodeID: 4, sourcePortID: 'output' },
                        { sourceNodeID: 2, targetNodeID: 4, sourcePortID: 'output' },
                        { sourceNodeID: 3, targetNodeID: 4, sourcePortID: 'output' }
                    ]
                }
            };

            core.loadFromClipboard(data);
            const mergeNode = core.nodes.find(n => n.type === 'variable_merge');
            expect(mergeNode).toBeDefined();
        });

        it('should handle variable_merge when no matching source node found', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '32',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g1',
                                            variables: [{ value: { type: 'ref', content: { blockID: 999 } } }]
                                        }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            const mergeNode = core.nodes.find(n => n.type === 'variable_merge');
            expect(mergeNode).toBeDefined();
        });

        it('should handle multiple incoming edges all same type for variable_merge', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'LLM' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '3',
                            meta: { position: { x: 100, y: 0 } },
                            data: { nodeMeta: { title: 'LLM2' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 3,
                            type: '32',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {
                                    mergeGroups: [
                                        { name: 'g', variables: [{}, {}] }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: [
                        { sourceNodeID: 1, targetNodeID: 3, sourcePortID: 'default' },
                        { sourceNodeID: 2, targetNodeID: 3, sourcePortID: 'output' }
                    ]
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes).toHaveLength(3);
        });

        it('should handle mergeGroups variables with ref already mapped', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'LLM' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '32',
                            meta: { position: { x: 200, y: 0 } },
                            data: {
                                nodeMeta: { title: 'Merge' },
                                inputs: {
                                    mergeGroups: [
                                        {
                                            name: 'g',
                                            variables: [
                                                { value: { type: 'ref', content: { blockID: 1 } } }
                                            ]
                                        }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            const mergeNode = core.nodes.find(n => n.type === 'variable_merge');
            const mappedId = core.nodes.find(n => n.title === 'LLM').id;
            expect(mergeNode.parameters.mergeGroups[0].variables[0].value.content.blockID).toBe(mappedId);
        });

        it('should handle node with inputParams ref where blockID not found in idMap', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                outputs: [],
                                inputs: {},
                                inputParams: [
                                    { valueType: 'ref', value: { content: { blockID: 999 } } }
                                ]
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes).toHaveLength(1);
        });

        it('should handle _contentRaw ref not found and dynamic_option ref not found', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                outputs: [],
                                inputs: {
                                    content: { value: { type: 'ref', content: { blockID: 999 } } },
                                    dynamic_option: { value: { type: 'ref', content: { blockID: 999 } } }
                                }
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes).toHaveLength(1);
        });

        it('should handle loop_set_variable with multiple variables and no blockID change needed', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'LLM' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '20',
                            meta: { position: { x: 100, y: 0 } },
                            data: {
                                nodeMeta: { title: 'SetVar' },
                                inputs: {
                                    inputParameters: [
                                        { name: 'v1', left: { value: { content: 'fixed' } }, right: { value: { content: 'fixed' } } }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes).toHaveLength(2);
        });

        it('should handle loop_set_variable with blockID already in idMap', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 0, y: 0 } },
                            data: { nodeMeta: { title: 'LLM' }, inputs: {}, outputs: [] }
                        },
                        {
                            id: 2,
                            type: '20',
                            meta: { position: { x: 100, y: 0 } },
                            data: {
                                nodeMeta: { title: 'SetVar' },
                                inputs: {
                                    inputParameters: [
                                        {
                                            name: 'v1',
                                            left: { value: { content: { blockID: '1' } } },
                                            right: { value: { content: { blockID: '1' } } }
                                        }
                                    ]
                                },
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            const setVar = core.nodes.find(n => n.type === 'loop_set_variable');
            const llmId = core.nodes.find(n => n.title === 'LLM').id;
            expect(setVar.parameters.variables[0].left.value.content.blockID).toBe(llmId);
            expect(setVar.parameters.variables[0].right.value.content.blockID).toBe(llmId);
        });

        it('should handle node with meta.position only (no x/y)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            meta: { position: { x: 50, y: 100 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].x).toBe(50);
            expect(core.nodes[0].y).toBe(100);
        });

        it('should handle node with both x/y and meta.position (meta.position takes priority)', () => {
            const data = {
                json: {
                    nodes: [
                        {
                            id: 1,
                            type: '3',
                            x: 10,
                            y: 20,
                            meta: { position: { x: 50, y: 100 } },
                            data: {
                                nodeMeta: { title: 'LLM' },
                                inputs: {},
                                outputs: []
                            }
                        }
                    ],
                    edges: []
                }
            };

            core.loadFromClipboard(data);
            expect(core.nodes[0].x).toBe(50);
            expect(core.nodes[0].y).toBe(100);
        });
    });

    describe('importWorkflow - loop_set_variable blockID remap', () => {
        it('should remap blockID when original ids are numbers and blockID is string', () => {
            const workflow = {
                nodes: [
                    { id: 1, type: 'loop', position: { x: 0, y: 0 } },
                    {
                        id: 2, type: 'loop_set_variable', position: { x: 100, y: 0 },
                        parameters: {
                            variables: [
                                {
                                    left: { value: { content: { blockID: '1' } } },
                                    right: { value: { content: { blockID: '1' } } }
                                }
                            ]
                        }
                    }
                ],
                edges: []
            };

            core.importWorkflow(workflow);

            const node2 = core.nodes.find(n => n.id === 'node_2');
            const node1 = core.nodes.find(n => n.id === 'node_1');
            expect(node2.parameters.variables[0].left.value.content.blockID).toBe(node1.id);
            expect(node2.parameters.variables[0].right.value.content.blockID).toBe(node1.id);
        });
    });
});