import { nodeHandlers } from '../../src/components/nodeHandlers.js';

jest.mock('../../src/utils/types.js', () => ({
    mapLang: jest.fn(lang => lang === 'javascript' ? 'js' : lang),
    toValueObject: jest.fn(val => {
        if (val && typeof val === 'object' && val.type) return val;
        return { type: 'literal', content: val };
    })
}));

jest.mock('../../src/components/outputMapper.js', () => ({
    convertOutputs: jest.fn((outputs, keepAssist) => {
        if (!outputs || typeof outputs !== 'object') return [];
        return Object.entries(outputs)
            .filter(([name]) => name !== 'reasoning_content' && name !== 'thinking_result')
            .map(([name, def]) => ({ name, type: def.type || 'string' }));
    })
}));

jest.mock('../../src/components/inputMapper.js', () => ({
    convertInputParameters: jest.fn((inputs, outputMap) => {
        if (!Array.isArray(inputs)) return [];
        return inputs.map(inp => ({ name: inp.name, input: { type: 'string', value: { type: 'literal', content: '' } } }));
    })
}));

jest.mock('../../src/components/containerHandler.js', () => ({
    processContainerNode: jest.fn((data, params, ctx, type) => {
        data.type = type;
    })
}));

const createMockCtx = (overrides = {}) => ({
    inputParams: [],
    node: {},
    outputMap: new Map(),
    ...overrides
});

describe('nodeHandlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('start', () => {
        it('should convert start node', () => {
            const data = {};
            const params = {};
            nodeHandlers.start(data, params);
            expect(data.inputs).toEqual({ inputParameters: [] });
            expect(data.outputs).toEqual([]);
        });

        it('should convert start node with outputs', () => {
            const data = {};
            const params = { node_outputs: { result: { type: 'string' } } };
            nodeHandlers.start(data, params);
            expect(data.outputs).toHaveLength(1);
            expect(data.outputs[0].name).toBe('result');
        });
    });

    describe('end', () => {
        it('should convert end node', () => {
            const data = {};
            const params = { content: 'hello' };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.end(data, params, ctx);
            expect(data.inputs.terminatePlan).toBeDefined();
            expect(data.inputs.streamingOutput).toBe(false);
            expect(data.inputs.content.value.content).toBe('hello');
        });

        it('should convert end node with streaming output', () => {
            const data = {};
            const params = { streamingOutput: true };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.end(data, params, ctx);
            expect(data.inputs.streamingOutput).toBe(true);
        });

        it('should convert end node with object content', () => {
            const data = {};
            const params = { content: { type: 'string', value: { type: 'literal', content: 'test' } } };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.end(data, params, ctx);
            expect(data.inputs.content).toEqual(params.content);
        });

        it('should use default empty content', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.end(data, params, ctx);
            expect(data.inputs.content.value.content).toBe('');
        });

        it('should handle terminatePlan', () => {
            const data = {};
            const params = { terminatePlan: 'custom' };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.end(data, params, ctx);
            expect(data.inputs.terminatePlan).toBe('custom');
        });
    });

    describe('llm', () => {
        it('should convert llm node', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: { version: '3' } });
            nodeHandlers.llm(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([]);
            expect(data.inputs.settingOnError).toBeDefined();
            expect(data.version).toBe('3');
        });

        it('should convert llm with default version', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.llm(data, params, ctx);
            expect(data.version).toBe('3');
        });
    });

    describe('code', () => {
        it('should convert code node', () => {
            const data = {};
            const params = { code: 'console.log(1)', language: 'javascript' };
            const ctx = createMockCtx({ inputParams: [], node: { version: 'v2' } });
            nodeHandlers.code(data, params, ctx);
            expect(data.inputs.code).toBe('console.log(1)');
            expect(data.version).toBe('v2');
        });

        it('should use default code and language', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.code(data, params, ctx);
            expect(data.inputs.code).toBe('');
        });
    });

    describe('image_generate', () => {
        it('should convert image_generate node', () => {
            const data = {};
            const params = { prompt: 'a cat' };
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.image_generate(data, params, ctx);
            expect(data.inputs.prompt.prompt).toBe('a cat');
            expect(data.inputs.prompt.negative_prompt).toBe('');
        });

        it('should use default modelSetting', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.image_generate(data, params, ctx);
            expect(data.inputs.modelSetting).toEqual({ model: 10, ratio: 0, watermark: true });
        });

        it('should use ctx node modelSetting', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: { modelSetting: { model: 5 } } });
            nodeHandlers.image_generate(data, params, ctx);
            expect(data.inputs.modelSetting).toEqual({ model: 5 });
        });
    });

    describe('video_generation', () => {
        it('should convert video_generation node', () => {
            const data = {};
            const params = { prompt: 'a video', duration: 10 };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.video_generation(data, params, ctx);
            expect(data.inputs.prompt).toBe('a video');
            expect(data.inputs.duration).toBe(10);
        });

        it('should use defaults', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.video_generation(data, params, ctx);
            expect(data.inputs.duration).toBe(5);
            expect(data.inputs.generateMode).toBe('image2Video');
            expect(data.inputs.resolution).toBe('720p');
        });
    });

    describe('condition', () => {
        it('should convert condition node', () => {
            const data = {};
            const params = { branches: [{ condition: { conditions: [{ left: {}, right: {} }] } }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.condition(data, params, ctx);
            expect(data.inputs.branches).toHaveLength(1);
        });

        it('should use ctx node branches', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: { branches: [{ name: 'default' }] } });
            nodeHandlers.condition(data, params, ctx);
            expect(data.inputs.branches).toHaveLength(1);
        });

        it('should convert condition values', () => {
            const data = {};
            const params = {
                branches: [{
                    condition: {
                        conditions: [{
                            left: { input: { value: { type: 'literal', content: 'left' } } },
                            right: { input: { value: { type: 'literal', content: 'right' } } }
                        }]
                    }
                }]
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.condition(data, params, ctx);
            expect(data.inputs.branches).toHaveLength(1);
        });
    });

    describe('variable_merge', () => {
        it('should convert variable_merge node', () => {
            const data = {};
            const params = { mergeGroups: [{ name: 'group1' }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.variable_merge(data, params, ctx);
            expect(data.inputs.mergeGroups).toHaveLength(1);
        });

        it('should use ctx node mergeGroups', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: { mergeGroups: [{ name: 'g1' }] } });
            nodeHandlers.variable_merge(data, params, ctx);
            expect(data.inputs.mergeGroups).toHaveLength(1);
        });
    });

    describe('plugin', () => {
        it('should convert plugin node', () => {
            const data = {};
            const params = { apiParam: [{ name: 'p1', input: { value: 'test' } }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.plugin(data, params, ctx);
            expect(data.inputs.apiParam).toHaveLength(1);
        });

        it('should handle apiParam with literal value', () => {
            const data = {};
            const params = { apiParam: [{ name: 'p1', input: { value: { type: 'literal', content: 'test' } } }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.plugin(data, params, ctx);
            expect(data.inputs.apiParam[0].input.value.rawMeta).toEqual({ type: 1 });
        });

        it('should handle empty apiParam value', () => {
            const data = {};
            const params = { apiParam: [{ name: 'p1', input: {} }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.plugin(data, params, ctx);
            expect(data.inputs.apiParam[0].input.value.content).toBe('');
        });
    });

    describe('loop and batch', () => {
        it('should delegate loop to processContainerNode', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.loop(data, params, ctx);
            expect(data.type).toBe('loop');
        });

        it('should delegate batch to processContainerNode', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.batch(data, params, ctx);
            expect(data.type).toBe('batch');
        });
    });

    describe('intent', () => {
        it('should convert intent node', () => {
            const data = {};
            const params = { intents: [{ name: 'intent1' }] };
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.intent(data, params, ctx);
            expect(data.inputs.intents).toHaveLength(1);
        });

        it('should use default values', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.intent(data, params, ctx);
            expect(data.inputs.mode).toBe('top_speed');
            expect(data.inputs.version).toBe('2');
        });
    });

    describe('async_task', () => {
        it('should convert async_task node', () => {
            const data = {};
            const params = { actionType: 2 };
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.async_task(data, params, ctx);
            expect(data.inputs.actionType).toBe(2);
        });

        it('should use default actionType', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.async_task(data, params, ctx);
            expect(data.inputs.actionType).toBe(1);
        });
    });

    describe('http', () => {
        it('should convert http node', () => {
            const data = {};
            const params = { url: 'https://api.example.com', method: 'POST' };
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.http(data, params, ctx);
            expect(data.inputs.url).toBe('https://api.example.com');
            expect(data.inputs.method).toBe('POST');
        });

        it('should use defaults', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.http(data, params, ctx);
            expect(data.inputs.method).toBe('GET');
            expect(data.inputs.url).toBe('');
        });
    });

    describe('comment', () => {
        it('should convert comment node', () => {
            const data = {};
            const params = { note: 'my note' };
            const ctx = createMockCtx({ inputParams: [], node: {} });
            nodeHandlers.comment(data, params, ctx);
            expect(data.inputs.note).toBe('my note');
            expect(data.outputs).toEqual([]);
        });

        it('should use ctx node size', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [], node: { size: { width: 200, height: 100 } } });
            nodeHandlers.comment(data, params, ctx);
            expect(data.size).toEqual({ width: 200, height: 100 });
        });
    });

    describe('text', () => {
        it('should convert text node', () => {
            const data = {};
            const params = { method: 'concat', concatParams: [] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.text(data, params, ctx);
            expect(data.inputs.method).toBe('concat');
        });

        it('should convert concatParams with values', () => {
            const data = {};
            const params = {
                concatParams: [{ name: 'p1', input: { value: { type: 'literal', content: 'test' } } }]
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.text(data, params, ctx);
            expect(data.inputs.concatParams).toHaveLength(1);
        });
    });

    describe('output', () => {
        it('should convert output node', () => {
            const data = {};
            const params = { content: 'hello' };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.output(data, params, ctx);
            expect(data.inputs.content.value.content).toBe('hello');
        });

        it('should use default empty content', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.output(data, params, ctx);
            expect(data.inputs.content.value.content).toBe('');
        });

        it('should handle object content', () => {
            const data = {};
            const params = { content: { type: 'string', value: { type: 'literal', content: 'test' } } };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.output(data, params, ctx);
            expect(data.inputs.content).toEqual(params.content);
        });

        it('should handle streaming output', () => {
            const data = {};
            const params = { streamingOutput: true };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.output(data, params, ctx);
            expect(data.inputs.streamingOutput).toBe(true);
        });
    });

    describe('input', () => {
        it('should convert input node', () => {
            const data = {};
            const params = { outputSchema: '[{"name":"field1","type":"string"}]' };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.input(data, params, ctx);
            expect(Array.isArray(data.inputs.outputSchema)).toBe(true);
        });

        it('should handle invalid JSON outputSchema', () => {
            const data = {};
            const params = { outputSchema: 'invalid json' };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.input(data, params, ctx);
            expect(data.inputs.outputSchema).toEqual([]);
        });

        it('should handle array outputSchema', () => {
            const data = {};
            const params = { outputSchema: [{ name: 'f1', type: 'string' }] };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.input(data, params, ctx);
            expect(data.inputs.outputSchema).toHaveLength(1);
        });

        it('should use empty schema for non-array non-string', () => {
            const data = {};
            const params = { outputSchema: 123 };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.input(data, params, ctx);
            expect(data.inputs.outputSchema).toEqual([]);
        });
    });

    describe('question', () => {
        it('should convert question node with array llmParam', () => {
            const data = {};
            const params = {
                question: 'What is your name?',
                llmParam: [
                    { name: 'systemPrompt', input: { type: 'string', value: { type: 'literal', content: 'prompt' } } }
                ]
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.inputs.question).toBe('What is your name?');
            expect(data.inputs.llmParam.systemPrompt).toBe('prompt');
        });

        it('should convert question node with object llmParam', () => {
            const data = {};
            const params = {
                question: 'test',
                llmParam: {
                    systemPrompt: 'hello',
                    '0': { name: 'p1', input: { type: 'string', value: { type: 'literal', content: 'v1' } } }
                }
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.inputs.llmParam.systemPrompt).toBe('hello');
        });

        it('should handle dynamic_option', () => {
            const data = {};
            const params = {
                question: 'test',
                dynamic_option: { type: 'string', value: { type: 'literal', content: 'dynamic' } }
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.inputs.dynamic_option).toEqual(params.dynamic_option);
        });

        it('should handle options as array of objects', () => {
            const data = {};
            const params = {
                question: 'test',
                options: [{ name: 'opt1', value: 'v1' }, { name: 'opt2' }]
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.inputs.options).toHaveLength(2);
        });

        it('should handle options as array of strings', () => {
            const data = {};
            const params = {
                question: 'test',
                options: ['opt1', 'opt2']
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.inputs.options).toHaveLength(2);
        });

        it('should handle node_outputs', () => {
            const data = {};
            const params = {
                question: 'test',
                node_outputs: {
                    result: { type: 'string', required: true }
                }
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.outputs).toHaveLength(1);
        });

        it('should handle node_outputs with nested properties', () => {
            const data = {};
            const params = {
                question: 'test',
                node_outputs: {
                    result: {
                        type: 'object',
                        properties: {
                            field1: { type: 'string', required: true },
                            field2: { type: 'list', items: { type: 'object', properties: {} } }
                        }
                    }
                }
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.question(data, params, ctx);
            expect(data.outputs).toHaveLength(1);
        });
    });

    describe('default', () => {
        it('should convert default node', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [{ name: 'p1' }] });
            nodeHandlers.default(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([{ name: 'p1' }]);
        });

        it('should convert default node with outputs', () => {
            const data = {};
            const params = { node_outputs: { result: { type: 'string' } } };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.default(data, params, ctx);
            expect(data.outputs).toHaveLength(1);
        });
    });

    describe('break', () => {
        it('should convert break node', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [{ name: 'p1' }] });
            nodeHandlers.break(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([{ name: 'p1' }]);
        });
    });

    describe('loop_set_variable', () => {
        it('should convert with variables array', () => {
            const data = {};
            const params = {
                variables: [{ left: 'a', right: 'b' }]
            };
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.loop_set_variable(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([{ left: 'a', right: 'b' }]);
        });

        it('should use empty array when no variables', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [] });
            nodeHandlers.loop_set_variable(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([]);
        });

        it('should use ctx node variables', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({
                inputParams: [],
                node: { parameters: { variables: [{ left: 'x', right: 'y' }] } }
            });
            nodeHandlers.loop_set_variable(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([{ left: 'x', right: 'y' }]);
        });
    });

    describe('loop_continue', () => {
        it('should convert loop_continue node', () => {
            const data = {};
            const params = {};
            const ctx = createMockCtx({ inputParams: [{ name: 'p1' }] });
            nodeHandlers.loop_continue(data, params, ctx);
            expect(data.inputs.inputParameters).toEqual([{ name: 'p1' }]);
        });
    });
});