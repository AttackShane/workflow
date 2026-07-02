import { processContainerNode } from '../../src/components/containerHandler.js';

jest.mock('../../src/utils/types.js', () => ({
    toValueObject: jest.fn(val => {
        if (val && typeof val === 'object' && val.type) return val;
        return { type: 'literal', content: val };
    }),
    findRef: jest.fn(val => {
        if (val && val.value && val.value.ref_node) {
            return { ref_node: val.value.ref_node, path: val.value.path };
        }
        return null;
    }),
    mapOutType: jest.fn(type => type),
    getAssistFromType: jest.fn(type => {
        if (type === 'image') return 5;
        return undefined;
    })
}));

jest.mock('../../src/utils/utils.js', () => ({
    convertEdges: jest.fn(edges => edges.map(e => ({ ...e, converted: true })))
}));

describe('processContainerNode', () => {
    const createMockCtx = (overrides = {}) => ({
        inputParams: [],
        node: {},
        outputMap: new Map(),
        ...overrides,
        convertNode: jest.fn(sub => ({ id: sub.id, type: 'converted' }))
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loop type', () => {
        it('should process loop container with loop count', () => {
            const data = { inputs: {} };
            const params = { loopCount: 5 };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.inputs.inputParameters).toEqual([]);
            expect(data.inputs.loopCount).toBeDefined();
        });

        it('should process loop container with loop items', () => {
            const data = { inputs: {} };
            const params = { loopItems: ['a', 'b', 'c'] };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.inputs.loopItems).toBeDefined();
        });

        it('should process loop container with iteration variable', () => {
            const data = { inputs: {} };
            const params = { iterationVariable: 'item' };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.inputs.iterationVariable).toEqual({ type: 'literal', content: 'item' });
        });

        it('should process loop container with loopType', () => {
            const data = { inputs: {} };
            const params = { loopType: 'forEach' };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.inputs.loopType).toBe('forEach');
        });

        it('should process loop container with variableParameters', () => {
            const data = { inputs: {} };
            const params = { variableParameters: { a: 1 } };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.inputs.variableParameters).toEqual({ a: 1 });
        });
    });

    describe('batch type', () => {
        it('should process batch container with batch size', () => {
            const data = { inputs: {} };
            const params = { batchSize: 10 };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'batch');

            expect(data.inputs.batchSize).toBe(10);
        });

        it('should process batch container with concurrent size', () => {
            const data = { inputs: {} };
            const params = { concurrentSize: 5 };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'batch');

            expect(data.inputs.concurrentSize).toBe(5);
        });

        it('should use default batch size when not provided', () => {
            const data = { inputs: {} };
            const params = { batchSize: 0 };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'batch');

            expect(data.inputs.batchSize).toEqual({ type: 'integer', value: { type: 'literal', content: 100 } });
        });

        it('should use default concurrent size when not provided', () => {
            const data = { inputs: {} };
            const params = { concurrentSize: 0 };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'batch');

            expect(data.inputs.concurrentSize).toEqual({ type: 'integer', value: { type: 'literal', content: 2 } });
        });
    });

    describe('inner nodes', () => {
        it('should convert inner nodes from params.nodes', () => {
            const data = { inputs: {} };
            const params = {
                nodes: [{ id: 'inner1', type: 'code' }]
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(ctx.convertNode).toHaveBeenCalled();
            expect(data.blocks).toHaveLength(1);
        });

        it('should convert inner nodes from ctx.node.nodes', () => {
            const data = { inputs: {} };
            const params = {};
            const ctx = createMockCtx({
                node: { nodes: [{ id: 'inner1', type: 'code' }] }
            });

            processContainerNode(data, params, ctx, 'loop');

            expect(ctx.convertNode).toHaveBeenCalled();
            expect(data.blocks).toHaveLength(1);
        });

        it('should convert inner nodes from params.blocks', () => {
            const data = { inputs: {} };
            const params = {
                blocks: [{ id: 'inner1', type: 'code' }]
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.blocks).toHaveLength(1);
        });

        it('should not set blocks when no inner nodes', () => {
            const data = { inputs: {} };
            const params = {};
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.blocks).toBeUndefined();
        });
    });

    describe('inner edges', () => {
        it('should convert inner edges from params.edges', () => {
            const data = { inputs: {} };
            const params = {
                edges: [{ id: 'e1', source: 'a', target: 'b' }]
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.edges).toHaveLength(1);
            expect(data.edges[0].converted).toBe(true);
        });

        it('should convert inner edges from ctx.node.edges', () => {
            const data = { inputs: {} };
            const params = {};
            const ctx = createMockCtx({
                node: { edges: [{ id: 'e1', source: 'a', target: 'b' }] }
            });

            processContainerNode(data, params, ctx, 'loop');

            expect(data.edges).toHaveLength(1);
        });
    });

    describe('outputs', () => {
        it('should process outputs with ref', () => {
            const data = { inputs: {} };
            const params = {
                node_outputs: {
                    result: {
                        type: 'string',
                        value: {
                            type: 'ref',
                            value: { ref_node: 'inner1', path: 'output1' }
                        }
                    }
                }
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.outputs).toBeDefined();
            expect(data.outputs.length).toBeGreaterThanOrEqual(1);
        });

        it('should process outputs without ref', () => {
            const data = { inputs: {} };
            const params = {
                node_outputs: {
                    result: { type: 'string' }
                }
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.outputs).toBeDefined();
            expect(data.outputs.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle list type output', () => {
            const data = { inputs: {} };
            const params = {
                node_outputs: {
                    listOutput: {
                        type: 'list',
                        items: { type: 'string' },
                        value: {
                            type: 'list',
                            items: { type: 'string' }
                        }
                    }
                }
            };
            const ctx = createMockCtx();

            processContainerNode(data, params, ctx, 'loop');

            expect(data.outputs).toBeDefined();
        });
    });
});