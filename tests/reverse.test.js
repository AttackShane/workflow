/**
 * 反向转换模块测试
 */
import { convertClipboardToYaml } from '../src/modules/reverse.js';

describe('Reverse Module', () => {
    describe('convertClipboardToYaml', () => {
        it('should convert basic clipboard data to YAML format', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_test' },
                json: {
                    name: 'Test Workflow',
                    nodes: [
                        {
                            id: '1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: '开始', icon: '', description: '', mainColor: '#10b981' },
                                inputs: { inputParameters: [], inputs: {} },
                                outputs: []
                            },
                            _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} }
                        },
                        {
                            id: '2',
                            type: '2',
                            meta: { position: { x: 400, y: 200 } },
                            data: {
                                nodeMeta: { title: '结束', icon: '', description: '', mainColor: '#ef4444' },
                                inputs: { inputParameters: [], inputs: {} },
                                outputs: []
                            },
                            _temp: { bounds: { x: 400, y: 200, width: 200, height: 100 }, externalData: {} }
                        }
                    ],
                    edges: [
                        {
                            sourceNodeId: '1',
                            targetNodeId: '2',
                            sourcePortId: 'output',
                            targetPortId: 'input'
                        }
                    ]
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result).toBeDefined();
            expect(result.nodes).toBeDefined();
            expect(result.nodes.length).toBe(2);
            expect(result.edges).toBeDefined();
            expect(result.edges.length).toBe(1);
        });

        it('should convert LLM node with parameters', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_llm' },
                json: {
                    name: 'LLM Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: 'AI Model', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                inputs: {
                                    prompt: {
                                        name: 'prompt',
                                        type: 'string',
                                        input: { type: 'string', value: { content: 'Hello' } }
                                    }
                                }
                            },
                            outputs: [{ name: 'output', type: 'string', to: 'output' }]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('llm');
            expect(result.nodes[0].parameters).toBeDefined();
        });

        it('should use fallback name when name is missing', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_no_name' },
                json: {
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: '', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.name).toBeDefined();
        });

        it('should default position to 0,0 when missing', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_no_pos' },
                json: {
                    name: 'Test',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: {},
                        data: {
                            nodeMeta: { title: 'Node', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            const node = result.nodes[0];
            expect(node.position).toBeDefined();
            expect(node.position.x).toBe(0);
            expect(node.position.y).toBe(0);
        });

        it('should handle empty nodes array', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_empty' },
                json: { nodes: [], edges: [], name: 'Empty' }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
        });

        it('should handle null input gracefully', () => {
            expect(() => convertClipboardToYaml(null)).toThrow();
        });

        it('should convert condition node with branches', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_cond' },
                json: {
                    name: 'Condition Test',
                    nodes: [{
                        id: '1',
                        type: '8',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Condition', icon: '', description: '', mainColor: '#f59e0b' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: [
                                { name: 'optionId', type: 'optionId', to: 'true' },
                                { name: 'optionContent', type: 'optionContent', to: 'false' }
                            ]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('condition');
        });

        it('should convert http node with url parameter', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_http' },
                json: {
                    name: 'HTTP Test',
                    nodes: [{
                        id: '1',
                        type: '45',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'HTTP', icon: '', description: '', mainColor: '#06b6d4' },
                            inputs: {
                                inputParameters: [],
                                url: {
                                    type: 'string',
                                    value: { content: 'https://api.example.com' }
                                },
                                method: {
                                    type: 'string',
                                    value: { content: 'GET' }
                                }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('http');
            expect(result.nodes[0].parameters).toBeDefined();
            expect(result.nodes[0].parameters.url).toBeDefined();
            expect(result.nodes[0].parameters.method).toBeDefined();
        });

        it('should convert code node with parameters', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_code' },
                json: {
                    name: 'Code Test',
                    nodes: [{
                        id: '1',
                        type: '5',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#6366f1' },
                            inputs: {
                                inputParameters: [],
                                code: {
                                    name: 'code',
                                    type: 'string',
                                    input: { type: 'string', value: { content: 'console.log(1)' } }
                                }
                            },
                            outputs: [{ name: 'output', type: 'string', to: 'output' }]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('code');
            expect(result.nodes[0].parameters.code).toBeDefined();
            expect(result.nodes[0].parameters.code.input.value.content).toBe('console.log(1)');
        });

        it('should convert loop node with parameters', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_loop' },
                json: {
                    name: 'Loop Test',
                    nodes: [{
                        id: '1',
                        type: '21',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                loopCount: {
                                    name: 'loopCount',
                                    type: 'integer',
                                    input: { type: 'integer', value: { content: '5' } }
                                }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('loop');
            expect(result.nodes[0].parameters.loopCount).toBeDefined();
            expect(result.nodes[0].parameters.loopCount.input.value.content).toBe('5');
        });

        it('should convert plugin node with apiParam', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_plugin' },
                json: {
                    name: 'Plugin Test',
                    nodes: [{
                        id: '1',
                        type: '4',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Plugin', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                apiParam: {
                                    name: 'apiParam',
                                    input: { type: 'array', value: [{ pluginName: 'MyPlugin', apiName: 'myApi' }] }
                                }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('plugin');
            expect(result.nodes[0].parameters.apiParam).toBeDefined();
        });

        it('should convert variable node', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_var' },
                json: {
                    name: 'Variable Test',
                    nodes: [{
                        id: '1',
                        type: '40',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Variable', icon: '', description: '', mainColor: '#10b981' },
                            inputs: {
                                inputParameters: [],
                                value: {
                                    name: 'value',
                                    type: 'string',
                                    input: { type: 'string', value: { content: 'hello' } }
                                }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('variable_assign');
        });

        it('should convert knowledge node', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_know' },
                json: {
                    name: 'Knowledge Test',
                    nodes: [{
                        id: '1',
                        type: '6',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Knowledge', icon: '', description: '', mainColor: '#f59e0b' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('knowledge_query');
        });

        it('should convert break node', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_break' },
                json: {
                    name: 'Break Test',
                    nodes: [{
                        id: '1',
                        type: '19',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Break', icon: '', description: '', mainColor: '#ef4444' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('break');
        });

        it('should handle empty edges array', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_no_edges' },
                json: {
                    name: 'No Edges',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.edges).toEqual([]);
        });

        it('should preserve schema_version in output', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_ver' },
                json: {
                    name: 'Version Test',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.schema_version).toBe('1.0.0');
        });

        it('should handle node with map type input', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_map' },
                json: {
                    name: 'Map Test',
                    nodes: [{
                        id: '1',
                        type: '45',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'HTTP', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                headers: {
                                    name: 'headers',
                                    type: 'map',
                                    input: {
                                        type: 'map',
                                        value: {
                                            entries: [
                                                { key: { content: 'Content-Type' }, value: { content: 'application/json' } }
                                            ]
                                        }
                                    }
                                }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('http');
            expect(result.nodes[0].parameters.headers).toBeDefined();
        });

        it('should throw error for invalid clipboard data', () => {
            expect(() => convertClipboardToYaml(null)).toThrow();
            expect(() => convertClipboardToYaml({})).toThrow();
            expect(() => convertClipboardToYaml({ type: 'wrong', source: {}, json: {} })).toThrow();
        });

        it('should handle nodes with no data property', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_no_data' },
                json: {
                    name: 'No Data',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes.length).toBe(1);
            expect(result.nodes[0].type).toBe('start');
        });

        it('should persist node id as string', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_id' },
                json: {
                    name: 'ID Test',
                    nodes: [{
                        id: 12345,
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [], inputs: {} },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(typeof result.nodes[0].id).toBe('string');
            expect(result.nodes[0].id).toBe('12345');
        });

        it('should handle node with canvasPosition', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_canvas' },
                json: {
                    name: 'Canvas Test',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 100, y: 200 }, canvasPosition: { x: 500, y: 600 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 200, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].canvas_position).toEqual({ x: 500, y: 600 });
        });

        it('should handle node with mainColor', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_color' },
                json: {
                    name: 'Color Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].color).toBe('#8b5cf6');
        });

        it('should handle node with nested blocks', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_blocks' },
                json: {
                    name: 'Blocks Test',
                    nodes: [{
                        id: '1',
                        type: '21',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [], loopCount: { type: 'integer', value: { type: 'literal', content: 3 } } },
                            outputs: []
                        },
                        blocks: [{
                            id: '2',
                            type: '5',
                            meta: { position: { x: 50, y: 50 } },
                            data: {
                                nodeMeta: { title: 'Inner Code', icon: '', description: '', mainColor: '#6366f1' },
                                inputs: { inputParameters: [], code: 'print(1)' },
                                outputs: []
                            },
                            _temp: { bounds: { x: 50, y: 50, width: 200, height: 100 }, externalData: {} }
                        }],
                        _temp: { bounds: { x: 0, y: 0, width: 300, height: 200 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].nodes).toBeDefined();
            expect(result.nodes[0].nodes.length).toBe(1);
            expect(result.nodes[0].nodes[0].type).toBe('code');
            expect(result.nodes[0].nodes[0].title).toBe('Inner Code');
        });

        it('should handle node with internal edges', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_edges' },
                json: {
                    name: 'Edges Test',
                    nodes: [{
                        id: '1',
                        type: '21',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        edges: [
                            { sourceNodeID: '2', targetNodeID: '3', sourcePortID: 'output', targetPortID: 'input' }
                        ],
                        _temp: { bounds: { x: 0, y: 0, width: 300, height: 200 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].edges).toBeDefined();
            expect(result.nodes[0].edges.length).toBe(1);
            expect(result.nodes[0].edges[0].source_node).toBe('2');
            expect(result.nodes[0].edges[0].source_port).toBe('output');
            expect(result.nodes[0].edges[0].target_port).toBe('input');
        });

        it('should handle comment node with size', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_comment' },
                json: {
                    name: 'Comment Test',
                    nodes: [{
                        id: '1',
                        type: '31',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Comment', icon: '', description: '', mainColor: '#f59e0b' },
                            inputs: { inputParameters: [], note: 'This is a comment', schemaType: 'slate' },
                            outputs: [],
                            size: { width: 300, height: 200 }
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 300, height: 200 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('comment');
            expect(result.nodes[0].size).toEqual({ width: 300, height: 200 });
            expect(result.nodes[0].parameters.note).toBeDefined();
            expect(result.nodes[0].parameters.schemaType).toBeDefined();
        });

        it('should handle end node with terminatePlan', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_end' },
                json: {
                    name: 'End Test',
                    nodes: [{
                        id: '1',
                        type: '2',
                        meta: { position: { x: 400, y: 200 } },
                        data: {
                            nodeMeta: { title: 'End', icon: '', description: '', mainColor: '#ef4444' },
                            inputs: { inputParameters: [], terminatePlan: { type: 'literal', content: 'done' } },
                            outputs: []
                        },
                        _temp: { bounds: { x: 400, y: 200, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('end');
            expect(result.nodes[0].parameters.terminatePlan).toBeDefined();
        });

        it('should handle question node with object format llmParam', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_question' },
                json: {
                    name: 'Question Test',
                    nodes: [{
                        id: '1',
                        type: '18',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Question', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                llmParam: { modelName: 'gpt-4', temperature: 0.7 }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('question');
            expect(result.nodes[0].parameters.llmParam).toBeDefined();
        });

        it('should handle loop node with complex loopCount', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_loop_cmplx' },
                json: {
                    name: 'Loop Complex Test',
                    nodes: [{
                        id: '1',
                        type: '21',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                loopCount: { type: 'integer', value: { type: 'literal', content: 5, rawMeta: {} } },
                                loopItems: { type: 'array', value: { type: 'ref', content: { name: 'items', blockID: '2' } } }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('loop');
            expect(result.nodes[0].parameters.loopCount).toBeDefined();
            expect(result.nodes[0].parameters.loopCount.type).toBe('integer');
            expect(result.nodes[0].parameters.loopCount.value.type).toBe('literal');
            expect(result.nodes[0].parameters.loopItems).toBeDefined();
        });

        it('should handle batch node with batchSize', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_batch' },
                json: {
                    name: 'Batch Test',
                    nodes: [{
                        id: '1',
                        type: '28',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Batch', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                batchSize: { type: 'integer', value: { type: 'literal', content: 10 } },
                                concurrentSize: 5
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('batch');
            expect(result.nodes[0].parameters.batchSize).toBeDefined();
            expect(result.nodes[0].parameters.concurrentSize).toBeDefined();
        });

        it('should handle node with settingOnError common param', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_error' },
                json: {
                    name: 'Error Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                settingOnError: { type: 'literal', content: 'continue' }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.settingOnError).toBeDefined();
        });

        it('should handle unknown type by falling back to plugin', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_unknown' },
                json: {
                    name: 'Unknown Test',
                    nodes: [{
                        id: '1',
                        type: '999',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Unknown', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('plugin');
        });

        it('should handle node with inputParameters', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_inputs' },
                json: {
                    name: 'InputParams Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [
                                    { name: 'prompt', input: { type: 'string', value: { type: 'literal', content: 'Hello' } } }
                                ]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_inputs).toBeDefined();
            expect(result.nodes[0].parameters.node_inputs.length).toBe(1);
            expect(result.nodes[0].parameters.node_inputs[0].name).toBe('prompt');
        });

        it('should handle node with outputs containing defaultValue', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_outputs' },
                json: {
                    name: 'Outputs Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: [
                                { name: 'text', type: 'string', defaultValue: 'hello', required: true, description: 'output text' }
                            ]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_outputs).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.text).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.text.default_value).toBe('hello');
            expect(result.nodes[0].parameters.node_outputs.text.required).toBe(true);
        });

        it('should handle node with output containing schema', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_schema' },
                json: {
                    name: 'Schema Test',
                    nodes: [{
                        id: '1',
                        type: '4',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Plugin', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: [
                                { name: 'data', type: 'object', schema: { type: 'object', properties: { field1: { type: 'string', value: undefined } } } }
                            ]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_outputs.data).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.data.items).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.data.items.properties).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.data.items.properties.field1.value).toBeNull();
        });

        it('should handle node with output having input ref', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_input_ref' },
                json: {
                    name: 'Input Ref Test',
                    nodes: [{
                        id: '1',
                        type: '4',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Plugin', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: [
                                {
                                    name: 'result',
                                    type: 'string',
                                    input: {
                                        type: 'list',
                                        schema: { type: 'string' },
                                        value: { type: 'ref', content: { name: 'output', blockID: '2', source: 'block-output' } }
                                    }
                                }
                            ]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_outputs.result).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.result.items).toBeDefined();
            expect(result.nodes[0].parameters.node_outputs.result.value.path).toBe('output');
            expect(result.nodes[0].parameters.node_outputs.result.value.ref_node).toBe('2');
            expect(result.nodes[0].parameters.node_outputs.result.value.source).toBe('block-output');
        });

        it('should handle node with inputParameters ref value', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_ip_ref' },
                json: {
                    name: 'IP Ref Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [
                                    { name: 'prompt', input: { type: 'ref', value: { type: 'ref', content: { name: 'text', blockID: '2', source: 'block-output' } } } }
                                ]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            const inputParam = result.nodes[0].parameters.node_inputs[0];
            expect(inputParam.input.value.path).toBe('text');
            expect(inputParam.input.value.ref_node).toBe('2');
            expect(inputParam.input.value.source).toBe('block-output');
        });

        it('should handle node with empty inputParameters array', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_empty_ip' },
                json: {
                    name: 'Empty IP Test',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters).toBeUndefined();
        });

        it('should handle node with null input value', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_null' },
                json: {
                    name: 'Null Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [
                                    { name: 'param', input: { type: 'string', value: null } }
                                ]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_inputs[0].input.value).toBeNull();
        });

        it('should handle node with output value null', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_out_null' },
                json: {
                    name: 'Output Null Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: [{ name: 'text', type: 'string', value: null }]
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].parameters.node_outputs.text.value).toBeNull();
        });

        it('should handle node with llmParam array input', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_llm_arr' },
                json: {
                    name: 'LLM Array Test',
                    nodes: [{
                        id: '1',
                        type: '3',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'LLM', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                llmParam: [
                                    { name: 'modelName', input: { type: 'string', value: { type: 'literal', content: 'gpt-4' } } },
                                    { name: 'temperature', input: { type: 'number', value: { type: 'literal', content: 0.7 } } }
                                ]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('llm');
            expect(result.nodes[0].parameters.llmParam).toBeDefined();
            expect(result.nodes[0].parameters.llmParam.length).toBe(2);
        });

        it('should handle node with branches parameter', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_branches' },
                json: {
                    name: 'Branches Test',
                    nodes: [{
                        id: '1',
                        type: '8',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Condition', icon: '', description: '', mainColor: '#f59e0b' },
                            inputs: {
                                inputParameters: [],
                                branches: [
                                    { condition: { type: 'literal', content: 'true' }, name: 'branch1' }
                                ]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('condition');
            expect(result.nodes[0].parameters.branches).toBeDefined();
        });

        it('should handle text node with concatParams', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_text' },
                json: {
                    name: 'Text Test',
                    nodes: [{
                        id: '1',
                        type: '15',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Text', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                concatParams: [{ type: 'literal', content: 'hello' }],
                                method: 'concat'
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('text');
            expect(result.nodes[0].parameters.concatParams).toBeDefined();
            expect(result.nodes[0].parameters.method).toBeDefined();
        });

        it('should handle edge without sourcePort and targetPort', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_edge' },
                json: {
                    name: 'Edge Test',
                    nodes: [{
                        id: '1',
                        type: '1',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Start', icon: '', description: '', mainColor: '#10b981' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: [
                        { sourceNodeId: '1', targetNodeId: '2' }
                    ]
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.edges.length).toBe(1);
            expect(result.edges[0].source_port).toBeUndefined();
            expect(result.edges[0].target_port).toBeUndefined();
        });

        it('should handle unknown node type without mainColor', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_no_color' },
                json: {
                    name: 'No Color Test',
                    nodes: [{
                        id: '1',
                        type: '999',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Unknown', icon: '', description: '' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        _temp: { bounds: { x: 0, y: 0, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('plugin');
            expect(result.nodes[0].color).toBeUndefined();
        });

        it('should handle output node with content', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_output' },
                json: {
                    name: 'Output Test',
                    nodes: [{
                        id: '1',
                        type: '13',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Output', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                content: { type: 'literal', content: 'result text' },
                                streamingOutput: true,
                                callTransferVoice: false,
                                chatHistoryWriting: 'historyWrite'
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('output');
            expect(result.nodes[0].parameters.content).toBeDefined();
            expect(result.nodes[0].parameters.streamingOutput).toBeDefined();
            expect(result.nodes[0].parameters.callTransferVoice).toBeDefined();
            expect(result.nodes[0].parameters.chatHistoryWriting).toBeDefined();
        });

        it('should handle variable_merge node', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_merge' },
                json: {
                    name: 'Merge Test',
                    nodes: [{
                        id: '1',
                        type: '32',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Merge', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                mergeGroups: [{ name: 'group1', variables: [] }]
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('variable_merge');
            expect(result.nodes[0].parameters.mergeGroups).toBeDefined();
        });

        it('should handle variable_assign node', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_assign' },
                json: {
                    name: 'Assign Test',
                    nodes: [{
                        id: '1',
                        type: '40',
                        meta: { position: { x: 100, y: 100 } },
                        data: {
                            nodeMeta: { title: 'Assign', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: {
                                inputParameters: [],
                                variableName: 'myVar',
                                variableValue: { type: 'literal', content: 'hello' }
                            },
                            outputs: []
                        },
                        _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].type).toBe('variable_assign');
            expect(result.nodes[0].parameters.variableName).toBeDefined();
            expect(result.nodes[0].parameters.variableValue).toBeDefined();
        });

        it('should handle deep nested blocks', () => {
            const clipboardData = {
                type: 'coze-workflow-clipboard-data',
                source: { workflowId: 'wf_deep' },
                json: {
                    name: 'Deep Nest Test',
                    nodes: [{
                        id: '1',
                        type: '21',
                        meta: { position: { x: 0, y: 0 } },
                        data: {
                            nodeMeta: { title: 'Outer Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                            inputs: { inputParameters: [] },
                            outputs: []
                        },
                        blocks: [{
                            id: '2',
                            type: '21',
                            meta: { position: { x: 50, y: 50 } },
                            data: {
                                nodeMeta: { title: 'Inner Loop', icon: '', description: '', mainColor: '#8b5cf6' },
                                inputs: { inputParameters: [] },
                                outputs: []
                            },
                            blocks: [{
                                id: '3',
                                type: '5',
                                meta: { position: { x: 100, y: 100 } },
                                data: {
                                    nodeMeta: { title: 'Code', icon: '', description: '', mainColor: '#6366f1' },
                                    inputs: { inputParameters: [], code: 'print(1)' },
                                    outputs: []
                                },
                                _temp: { bounds: { x: 100, y: 100, width: 200, height: 100 }, externalData: {} }
                            }],
                            _temp: { bounds: { x: 50, y: 50, width: 300, height: 200 }, externalData: {} }
                        }],
                        _temp: { bounds: { x: 0, y: 0, width: 400, height: 300 }, externalData: {} }
                    }],
                    edges: []
                }
            };

            const result = convertClipboardToYaml(clipboardData);
            expect(result.nodes[0].nodes).toBeDefined();
            expect(result.nodes[0].nodes.length).toBe(1);
            expect(result.nodes[0].nodes[0].nodes).toBeDefined();
            expect(result.nodes[0].nodes[0].nodes[0].type).toBe('code');
        });
    });
});