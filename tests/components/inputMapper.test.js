import { convertInputParameters } from '../../src/components/inputMapper.js';

jest.mock('../../src/utils/types.js', () => ({
    mapOutType: jest.fn(type => type === 'image' ? 'image' : type === 'file' ? 'file' : 'string'),
    INHERIT_ASSIST_NODES: new Set(['llm', 'code']),
    toValueObject: jest.fn(val => {
        if (val && typeof val === 'object' && val.type) return val;
        return { type: 'literal', content: val };
    })
}));

describe('convertInputParameters', () => {
    it('should return empty array for non-array input', () => {
        expect(convertInputParameters(null)).toEqual([]);
        expect(convertInputParameters(undefined)).toEqual([]);
        expect(convertInputParameters('string')).toEqual([]);
        expect(convertInputParameters({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
        expect(convertInputParameters([])).toEqual([]);
    });

    it('should convert basic input parameter', () => {
        const inputs = [
            { name: 'param1', input: { type: 'string', value: { type: 'literal', content: 'hello' } } }
        ];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('param1');
        expect(result[0].input.type).toBe('string');
        expect(result[0].input.value).toEqual({ type: 'literal', content: 'hello' });
    });

    it('should handle input without value', () => {
        const inputs = [
            { name: 'param1', input: { type: 'string' } }
        ];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result[0].input.value).toEqual({ type: 'literal', content: '' });
    });

    it('should handle input without input field', () => {
        const inputs = [{ name: 'param1' }];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result[0].name).toBe('param1');
        expect(result[0].input.type).toBe('string');
    });

    it('should resolve ref type from outputMap', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'image', assistType: 5 });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.type).toBe('image');
    });

    it('should handle list type ref with itemsType', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'list', itemsType: 'string', assistType: 5 });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.schema).toBeDefined();
        expect(result[0].input.schema.type).toBe('string');
    });

    it('should handle object type ref with schema', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'object', schema: [{ name: 'a', type: 'string' }] });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.schema).toEqual([{ name: 'a', type: 'string' }]);
    });

    it('should inherit rawMeta from outputMap', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'string', rawMeta: { type: 1 } });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.value.rawMeta).toEqual({ type: 1 });
    });

    it('should inherit assistType from outputMap for inherit nodes', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'string', assistType: 5 });
        const result = convertInputParameters(inputs, outputMap, 'llm');
        expect(result[0].input.assistType).toBe(5);
    });

    it('should not inherit assistType for non-inherit nodes', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'string', assistType: 5 });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.assistType).toBeUndefined();
    });

    it('should preserve existing assistType when not inheriting', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    type: 'string',
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } },
                    assistType: 3
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'string', assistType: 5 });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.assistType).toBe(3);
    });

    it('should handle list type with object items', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'node1', name: 'output1' } }
                }
            }
        ];
        const outputMap = new Map();
        outputMap.set('node1.output1', { type: 'list', itemsType: 'object' });
        const result = convertInputParameters(inputs, outputMap, 'start');
        expect(result[0].input.schema).toEqual({ type: 'string', schema: [] });
    });

    it('should preserve rawMeta on value', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    type: 'string',
                    value: { type: 'literal', content: 'test' },
                    rawMeta: { type: 1 }
                }
            }
        ];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result[0].input.value.rawMeta).toEqual({ type: 1 });
    });

    it('should handle multiple inputs', () => {
        const inputs = [
            { name: 'a', input: { type: 'string', value: { type: 'literal', content: 'a' } } },
            { name: 'b', input: { type: 'integer', value: { type: 'literal', content: 1 } } }
        ];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('a');
        expect(result[1].name).toBe('b');
    });

    it('should handle ref without matching outputMap entry', () => {
        const inputs = [
            {
                name: 'param1',
                input: {
                    value: { type: 'ref', content: { blockID: 'nonexistent', name: 'output' } }
                }
            }
        ];
        const result = convertInputParameters(inputs, new Map(), 'start');
        expect(result[0].input.type).toBe('string');
    });
});