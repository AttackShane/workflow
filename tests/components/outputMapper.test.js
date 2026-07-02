import { buildOutputMap, convertOutputs } from '../../src/components/outputMapper.js';

jest.mock('../../src/utils/types.js', () => ({
    getAssistFromType: jest.fn(type => {
        if (type === 'image') return 5;
        if (type === 'audio') return 6;
        if (type === 'video') return 7;
        return undefined;
    }),
    inferRawMetaFromType: jest.fn((type, assist) => {
        if (type === 'string') return { type: 1 };
        return { type: 0 };
    }),
    mapOutType: jest.fn(type => type),
    RAW_TYPE: { stringList: 1, imageList: 5, audioList: 6, videoList: 7, list: 100 }
}));

describe('buildOutputMap', () => {
    it('should return empty map for empty nodes', () => {
        const map = buildOutputMap([]);
        expect(map.size).toBe(0);
    });

    it('should build output map for node with outputs', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        result: { type: 'string', description: 'result output' }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.has('node1.result')).toBe(true);
        const entry = map.get('node1.result');
        expect(entry.type).toBe('string');
        expect(entry.description).toBe('result output');
    });

    it('should include assistType from output definition', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        img: { type: 'image', assistType: 5 }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.get('node1.img').assistType).toBe(5);
    });

    it('should infer assistType from type', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        img: { type: 'image' }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.get('node1.img').assistType).toBe(5);
    });

    it('should handle required and default_value', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        result: { type: 'string', required: true, default_value: 'default' }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        const entry = map.get('node1.result');
        expect(entry.required).toBe(true);
        expect(entry.defaultValue).toBe('default');
    });

    it('should handle list type with items', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        listOutput: { type: 'list', items: { type: 'string' } }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        const entry = map.get('node1.listOutput');
        expect(entry.type).toBe('list');
        expect(entry.itemsType).toBe('string');
    });

    it('should handle ref value with ref_node', () => {
        const nodes = [
            {
                id: 'node1',
                parameters: {
                    node_outputs: {
                        output1: {
                            type: 'string',
                            value: {
                                type: 'image',
                                value: { ref_node: 'other', path: 'img' }
                            }
                        }
                    }
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.has('node1.output1')).toBe(true);
    });

    it('should process nested nodes', () => {
        const nodes = [
            {
                id: 'container',
                parameters: {
                    node_outputs: { result: { type: 'string' } },
                    nodes: [
                        {
                            id: 'inner1',
                            parameters: {
                                node_outputs: { innerResult: { type: 'string' } }
                            }
                        }
                    ]
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.has('container.result')).toBe(true);
        expect(map.has('inner1.innerResult')).toBe(true);
    });

    it('should process nested nodes in blocks', () => {
        const nodes = [
            {
                id: 'container',
                parameters: {
                    blocks: [
                        {
                            id: 'inner1',
                            parameters: {
                                node_outputs: { innerResult: { type: 'string' } }
                            }
                        }
                    ]
                }
            }
        ];
        const map = buildOutputMap(nodes);
        expect(map.has('inner1.innerResult')).toBe(true);
    });

    it('should handle nodes without parameters', () => {
        const nodes = [{ id: 'empty' }];
        const map = buildOutputMap(nodes);
        expect(map.size).toBe(0);
    });
});

describe('convertOutputs', () => {
    it('should return empty array for null/undefined', () => {
        expect(convertOutputs(null)).toEqual([]);
        expect(convertOutputs(undefined)).toEqual([]);
        expect(convertOutputs('string')).toEqual([]);
    });

    it('should convert basic output', () => {
        const outputs = {
            result: { type: 'string', description: 'result' }
        };
        const result = convertOutputs(outputs);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('result');
        expect(result[0].type).toBe('string');
        expect(result[0].description).toBe('result');
    });

    it('should filter out reasoning_content and thinking_result', () => {
        const outputs = {
            result: { type: 'string' },
            reasoning_content: { type: 'string' },
            thinking_result: { type: 'string' }
        };
        const result = convertOutputs(outputs);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('result');
    });

    it('should include assistType when keepAssist is true', () => {
        const outputs = {
            img: { type: 'image', assistType: 5 }
        };
        const result = convertOutputs(outputs, true);
        expect(result[0].assistType).toBe(5);
    });

    it('should exclude assistType when keepAssist is false', () => {
        const outputs = {
            img: { type: 'image', assistType: 5 }
        };
        const result = convertOutputs(outputs, false);
        expect(result[0].assistType).toBeUndefined();
    });

    it('should handle required and default_value', () => {
        const outputs = {
            result: { type: 'string', required: true, default_value: 'default' }
        };
        const result = convertOutputs(outputs);
        expect(result[0].required).toBe(true);
        expect(result[0].defaultValue).toBe('default');
    });

    it('should handle list type with items', () => {
        const outputs = {
            listOutput: {
                type: 'list',
                items: { type: 'string', assistType: 5 }
            }
        };
        const result = convertOutputs(outputs);
        expect(result[0].schema).toBeDefined();
        expect(result[0].schema.type).toBe('string');
    });

    it('should handle object type with properties', () => {
        const outputs = {
            obj: {
                type: 'object',
                properties: {
                    name: { type: 'string', required: true, description: 'name field' },
                    age: { type: 'integer', description: 'age field' }
                }
            }
        };
        const result = convertOutputs(outputs);
        expect(result[0].schema).toHaveLength(2);
        expect(result[0].schema[0].name).toBe('name');
        expect(result[0].schema[0].required).toBe(true);
        expect(result[0].schema[1].name).toBe('age');
    });

    it('should infer rawMeta from type', () => {
        const outputs = {
            result: { type: 'string' }
        };
        const result = convertOutputs(outputs);
        expect(result[0].rawMeta).toBeDefined();
    });
});