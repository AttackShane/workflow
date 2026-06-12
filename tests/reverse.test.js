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
    });
});