/**
 * 工具函数测试
 */
import {
    ERROR_CODES,
    ERROR_MESSAGES,
    ConversionError,
    convertEdges,
    convertEdgesReverse,
    cleanIcon,
    convertLargeNumbersToStrings,
    validateYamlInput,
    validateEdges,
    validateClipboardInput,
    getNodeTypeName,
    getNodeColor,
    formatError
} from '../src/utils/utils.js';

// Mock the types module used by utils
jest.mock('../src/utils/types.js', () => ({
    REV_TYPE_MAP: {
        '1': 'start', '2': 'end', '3': 'llm', '4': 'plugin',
        '5': 'code', '8': 'condition', '21': 'loop', '28': 'batch',
        '45': 'http', '18': 'question'
    },
    NODE_DISPLAY_NAMES: {
        start: '🚀 开始', end: '🏁 结束', llm: '🤖 大模型',
        plugin: '🔌 插件', code: '💻 代码', condition: '🔀 条件',
        http: '🌐 HTTP请求', question: '❓ 问答', loop: '🔄 循环',
        batch: '📤 批处理'
    },
    NODE_COLORS: {
        start: '#5C62FF', end: '#5C62FF', llm: '#5C62FF',
        plugin: '#CA61FF', code: '#00B2B2', condition: '#00B2B2',
        http: '#F59E0B', question: '#3071F2', loop: '#00B2B2',
        batch: '#00B2B2'
    }
}));

describe('ERROR_CODES', () => {
    it('should define all error codes', () => {
        expect(ERROR_CODES.EMPTY_INPUT).toBe('EMPTY_INPUT');
        expect(ERROR_CODES.INVALID_STRUCTURE).toBe('INVALID_STRUCTURE');
        expect(ERROR_CODES.INVALID_TYPE).toBe('INVALID_TYPE');
        expect(ERROR_CODES.MISSING_NODE_ID).toBe('MISSING_NODE_ID');
        expect(ERROR_CODES.MISSING_NODE_TYPE).toBe('MISSING_NODE_TYPE');
        expect(ERROR_CODES.INVALID_NODE_TYPE).toBe('INVALID_NODE_TYPE');
        expect(ERROR_CODES.DUPLICATE_NODE_ID).toBe('DUPLICATE_NODE_ID');
        expect(ERROR_CODES.INVALID_EDGE).toBe('INVALID_EDGE');
        expect(ERROR_CODES.CYCLIC_REFERENCE).toBe('CYCLIC_REFERENCE');
        expect(ERROR_CODES.YAML_PARSE_ERROR).toBe('YAML_PARSE_ERROR');
        expect(ERROR_CODES.JSON_PARSE_ERROR).toBe('JSON_PARSE_ERROR');
        expect(ERROR_CODES.INVALID_PARAMETER).toBe('INVALID_PARAMETER');
        expect(ERROR_CODES.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should have unique values', () => {
        const values = Object.values(ERROR_CODES);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });
});

describe('ERROR_MESSAGES', () => {
    it('should have messages for all error codes', () => {
        for (const code of Object.values(ERROR_CODES)) {
            expect(ERROR_MESSAGES[code]).toBeDefined();
            expect(typeof ERROR_MESSAGES[code]).toBe('string');
        }
    });

    it('should contain template placeholders', () => {
        expect(ERROR_MESSAGES[ERROR_CODES.MISSING_NODE_ID]).toContain('{index}');
        expect(ERROR_MESSAGES[ERROR_CODES.INVALID_NODE_TYPE]).toContain('{nodeId}');
        expect(ERROR_MESSAGES[ERROR_CODES.INVALID_EDGE]).toContain('{source}');
        expect(ERROR_MESSAGES[ERROR_CODES.YAML_PARSE_ERROR]).toContain('{line}');
    });
});

describe('ConversionError', () => {
    describe('constructor', () => {
        it('should create an error with basic properties', () => {
            const err = new ConversionError('test message', 'TEST_CODE');
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(ConversionError);
            expect(err.name).toBe('ConversionError');
            expect(err.message).toBe('test message');
            expect(err.code).toBe('TEST_CODE');
        });

        it('should set optional properties', () => {
            const err = new ConversionError(
                'msg', 'CODE',
                { key: 'value' }, 10, 5, 'node_123'
            );
            expect(err.details).toEqual({ key: 'value' });
            expect(err.line).toBe(10);
            expect(err.column).toBe(5);
            expect(err.nodeId).toBe('node_123');
        });

        it('should set timestamp', () => {
            const before = Date.now();
            const err = new ConversionError('msg', 'CODE');
            const after = Date.now();
            expect(err.timestamp).toBeGreaterThanOrEqual(before);
            expect(err.timestamp).toBeLessThanOrEqual(after);
        });

        it('should default optional properties to null', () => {
            const err = new ConversionError('msg', 'CODE');
            expect(err.details).toBeNull();
            expect(err.line).toBeNull();
            expect(err.column).toBeNull();
            expect(err.nodeId).toBeNull();
        });
    });

    describe('getFriendlyMessage', () => {
        it('should use template for MISSING_NODE_TYPE (has {nodeId})', () => {
            const err = new ConversionError(
                'raw msg', ERROR_CODES.MISSING_NODE_TYPE,
                null, null, null, 'node_abc'
            );
            const msg = err.getFriendlyMessage();
            expect(msg).toContain('node_abc');
            expect(msg).toContain('缺少type字段');
        });

        it('should use template for MISSING_NODE_ID with details.index', () => {
            const err = new ConversionError(
                'raw msg', ERROR_CODES.MISSING_NODE_ID,
                { index: 5 }, null, null, 'node_x'
            );
            const msg = err.getFriendlyMessage();
            expect(msg).toContain('5');
        });

        it('should fall back to raw message for unknown codes', () => {
            const err = new ConversionError('raw message', 'UNKNOWN');
            expect(err.getFriendlyMessage()).toBe('raw message');
        });

        it('should replace template placeholders in INVALID_EDGE', () => {
            const err = new ConversionError(
                'msg', ERROR_CODES.INVALID_EDGE,
                { source: 'A', target: 'B' },
                null, null, 'node_A'
            );
            const msg = err.getFriendlyMessage();
            expect(msg).toContain('A');
            expect(msg).toContain('B');
        });

        it('should replace {line} and {column} in YAML_PARSE_ERROR', () => {
            const err = new ConversionError(
                'msg', ERROR_CODES.YAML_PARSE_ERROR,
                null, 10, 5
            );
            const msg = err.getFriendlyMessage();
            expect(msg).toContain('10');
            expect(msg).toContain('5');
        });

        it('should replace {details} in INVALID_STRUCTURE', () => {
            const err = new ConversionError(
                'msg', ERROR_CODES.INVALID_STRUCTURE,
                { missingField: 'nodes' }
            );
            const msg = err.getFriendlyMessage();
            expect(msg).toContain('nodes');
        });
    });

    describe('getLocation', () => {
        it('should return empty string when no location info', () => {
            const err = new ConversionError('msg', 'CODE');
            expect(err.getLocation()).toBe('');
        });

        it('should format line and column', () => {
            const err = new ConversionError('msg', 'CODE', null, 5, 10);
            const loc = err.getLocation();
            expect(loc).toContain('行 5');
            expect(loc).toContain('列 10');
        });

        it('should include nodeId when available', () => {
            const err = new ConversionError('msg', 'CODE', null, null, null, 'test_node');
            const loc = err.getLocation();
            expect(loc).toContain('test_node');
        });

        it('should combine all location info', () => {
            const err = new ConversionError('msg', 'CODE', null, 3, 8, 'node_x');
            const loc = err.getLocation();
            expect(loc).toContain('行 3');
            expect(loc).toContain('列 8');
            expect(loc).toContain('node_x');
        });
    });

    describe('toJSON', () => {
        it('should return JSON representation', () => {
            const err = new ConversionError('test', ERROR_CODES.EMPTY_INPUT);
            const json = err.toJSON();
            expect(json.name).toBe('ConversionError');
            expect(json.code).toBe(ERROR_CODES.EMPTY_INPUT);
            expect(json.message).toBe('test');
            expect(json.friendlyMessage).toBeDefined();
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('fromYamlError', () => {
        it('should create error from YAML parse error', () => {
            const yamlErr = new Error('bad syntax at line 5, column 10');
            const err = ConversionError.fromYamlError(yamlErr);
            expect(err.code).toBe(ERROR_CODES.YAML_PARSE_ERROR);
            expect(err.line).toBe(5);
            expect(err.column).toBe(10);
        });

        it('should handle YAML error with mark property', () => {
            const yamlErr = new Error('syntax error');
            yamlErr.mark = { line: 2, column: 3 };
            const err = ConversionError.fromYamlError(yamlErr);
            expect(err.line).toBe(3);
            expect(err.column).toBe(4);
        });

        it('should handle YAML error without line/column', () => {
            const yamlErr = new Error('generic error');
            const err = ConversionError.fromYamlError(yamlErr);
            expect(err.code).toBe(ERROR_CODES.YAML_PARSE_ERROR);
            expect(err.line).toBeNull();
            expect(err.column).toBeNull();
        });
    });

    describe('fromJsonError', () => {
        it('should create error from JSON parse error', () => {
            const jsonErr = new Error('Unexpected token');
            const err = ConversionError.fromJsonError(jsonErr);
            expect(err.code).toBe(ERROR_CODES.JSON_PARSE_ERROR);
            expect(err.message).toBe('Unexpected token');
        });
    });
});

describe('convertEdges', () => {
    it('should return empty array for null/undefined', () => {
        expect(convertEdges(null)).toEqual([]);
        expect(convertEdges(undefined)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
        expect(convertEdges([])).toEqual([]);
    });

    it('should convert source_node/target_node format', () => {
        const edges = [
            { source_node: 'n1', target_node: 'n2' }
        ];
        const result = convertEdges(edges);
        expect(result[0].sourceNodeID).toBe('n1');
        expect(result[0].targetNodeID).toBe('n2');
    });

    it('should convert sourceNodeID/targetNodeID format', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2' }
        ];
        const result = convertEdges(edges);
        expect(result[0].sourceNodeID).toBe('n1');
        expect(result[0].targetNodeID).toBe('n2');
    });

    it('should convert port IDs', () => {
        const edges = [
            {
                source_node: 'n1', target_node: 'n2',
                source_port: 'p1', target_port: 'p2'
            }
        ];
        const result = convertEdges(edges);
        expect(result[0].sourcePortID).toBe('p1');
        expect(result[0].targetPortID).toBe('p2');
    });

    it('should convert multiple edges', () => {
        const edges = [
            { source_node: 'n1', target_node: 'n2' },
            { source_node: 'n2', target_node: 'n3' }
        ];
        const result = convertEdges(edges);
        expect(result).toHaveLength(2);
    });

    it('should convert all values to strings', () => {
        const edges = [
            { source_node: 123, target_node: 456 }
        ];
        const result = convertEdges(edges);
        expect(result[0].sourceNodeID).toBe('123');
        expect(result[0].targetNodeID).toBe('456');
    });
});

describe('convertEdgesReverse', () => {
    it('should return empty array for null/undefined', () => {
        expect(convertEdgesReverse(null)).toEqual([]);
        expect(convertEdgesReverse(undefined)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
        expect(convertEdgesReverse([])).toEqual([]);
    });

    it('should convert sourceNodeID/targetNodeID to source_node/target_node', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2' }
        ];
        const result = convertEdgesReverse(edges);
        expect(result[0].source_node).toBe('n1');
        expect(result[0].target_node).toBe('n2');
    });

    it('should include port IDs when present', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2', sourcePortID: 'p1', targetPortID: 'p2' }
        ];
        const result = convertEdgesReverse(edges);
        expect(result[0].source_port).toBe('p1');
        expect(result[0].target_port).toBe('p2');
    });

    it('should omit port IDs when not present', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2' }
        ];
        const result = convertEdgesReverse(edges);
        expect(result[0].source_port).toBeUndefined();
        expect(result[0].target_port).toBeUndefined();
    });

    it('should handle multiple edges', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2' },
            { sourceNodeID: 'n2', targetNodeID: 'n3' }
        ];
        const result = convertEdgesReverse(edges);
        expect(result).toHaveLength(2);
    });
});

describe('cleanIcon', () => {
    it('should return empty string for null/undefined', () => {
        expect(cleanIcon(null)).toBe('');
        expect(cleanIcon(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        expect(cleanIcon('')).toBe('');
    });

    it('should remove backticks', () => {
        expect(cleanIcon('`icon`')).toBe('icon');
    });

    it('should remove single quotes', () => {
        expect(cleanIcon("'icon'")).toBe('icon');
    });

    it('should remove double quotes', () => {
        expect(cleanIcon('"icon"')).toBe('icon');
    });

    it('should remove backslashes', () => {
        expect(cleanIcon('\\icon\\')).toBe('icon');
    });

    it('should trim whitespace', () => {
        expect(cleanIcon('  icon  ')).toBe('icon');
    });

    it('should handle numbers', () => {
        expect(cleanIcon(123)).toBe('123');
    });

    it('should handle clean strings unchanged', () => {
        expect(cleanIcon('clean_icon')).toBe('clean_icon');
    });
});

describe('convertLargeNumbersToStrings', () => {
    it('should convert 16+ digit IDs to strings', () => {
        const input = 'id: 1234567890123456';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('id: "1234567890123456"');
    });

    it('should convert ref_node with large numbers', () => {
        const input = 'ref_node: 12345678901234567890';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('ref_node: "12345678901234567890"');
    });

    it('should convert source_node with large numbers', () => {
        const input = 'source_node: 9999999999999999';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('source_node: "9999999999999999"');
    });

    it('should convert target_node with large numbers', () => {
        const input = 'target_node: 1111111111111111';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('target_node: "1111111111111111"');
    });

    it('should not convert short numbers', () => {
        const input = 'id: 123';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('id: 123');
    });

    it('should not convert non-id fields', () => {
        const input = 'name: 1234567890123456';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toBe('name: 1234567890123456');
    });

    it('should handle multiple large numbers', () => {
        const input = 'id: 1234567890123456\nsource_node: 2345678901234567';
        const result = convertLargeNumbersToStrings(input);
        expect(result).toContain('"1234567890123456"');
        expect(result).toContain('"2345678901234567"');
    });

    it('should handle input without large numbers', () => {
        const input = 'id: 123\nref_node: 456';
        expect(convertLargeNumbersToStrings(input)).toBe(input);
    });

    it('should handle empty string', () => {
        expect(convertLargeNumbersToStrings('')).toBe('');
    });
});

describe('validateYamlInput', () => {
    it('should throw for null input', () => {
        expect(() => validateYamlInput(null)).toThrow(ConversionError);
        expect(() => validateYamlInput(null)).toThrow('输入为空');
    });

    it('should throw for undefined input', () => {
        expect(() => validateYamlInput(undefined)).toThrow(ConversionError);
    });

    it('should throw for non-object input', () => {
        expect(() => validateYamlInput('string')).toThrow(ConversionError);
        expect(() => validateYamlInput(42)).toThrow(ConversionError);
    });

    it('should throw for object without nodes array', () => {
        expect(() => validateYamlInput({})).toThrow(ConversionError);
        expect(() => validateYamlInput({ nodes: 'not_array' })).toThrow(ConversionError);
    });

    it('should throw for node without id', () => {
        const input = { nodes: [{ type: 'start' }] };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should throw for node with null id', () => {
        const input = { nodes: [{ id: null, type: 'start' }] };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should throw for node without type', () => {
        const input = { nodes: [{ id: 'n1' }] };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should throw for duplicate node IDs', () => {
        const input = {
            nodes: [
                { id: 'n1', type: 'start' },
                { id: 'n1', type: 'end' }
            ]
        };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should pass for valid input', () => {
        const input = {
            nodes: [
                { id: 'n1', type: 'start' },
                { id: 'n2', type: 'llm' },
                { id: 'n3', type: 'end' }
            ]
        };
        expect(() => validateYamlInput(input)).not.toThrow();
    });

    it('should pass for valid input with edges', () => {
        const input = {
            nodes: [
                { id: 'n1', type: 'start' },
                { id: 'n2', type: 'end' }
            ],
            edges: [
                { source_node: 'n1', target_node: 'n2' }
            ]
        };
        expect(() => validateYamlInput(input)).not.toThrow();
    });

    it('should throw for edge referencing non-existent source node', () => {
        const input = {
            nodes: [
                { id: 'n1', type: 'start' }
            ],
            edges: [
                { source_node: 'n999', target_node: 'n1' }
            ]
        };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should throw for edge referencing non-existent target node', () => {
        const input = {
            nodes: [
                { id: 'n1', type: 'start' }
            ],
            edges: [
                { source_node: 'n1', target_node: 'n999' }
            ]
        };
        expect(() => validateYamlInput(input)).toThrow(ConversionError);
    });

    it('should pass for empty edges array', () => {
        const input = {
            nodes: [{ id: 'n1', type: 'start' }],
            edges: []
        };
        expect(() => validateYamlInput(input)).not.toThrow();
    });

    it('should pass when edges is not an array', () => {
        const input = {
            nodes: [{ id: 'n1', type: 'start' }],
            edges: 'not_array'
        };
        expect(() => validateYamlInput(input)).not.toThrow();
    });
});

describe('validateEdges', () => {
    const nodeIds = new Set(['n1', 'n2', 'n3']);

    it('should pass for valid edges', () => {
        const edges = [
            { source_node: 'n1', target_node: 'n2' }
        ];
        expect(() => validateEdges(edges, nodeIds)).not.toThrow();
    });

    it('should throw for edge without source', () => {
        const edges = [{ target_node: 'n2' }];
        expect(() => validateEdges(edges, nodeIds)).toThrow(ConversionError);
    });

    it('should throw for edge without target', () => {
        const edges = [{ source_node: 'n1' }];
        expect(() => validateEdges(edges, nodeIds)).toThrow(ConversionError);
    });

    it('should throw for non-existent source', () => {
        const edges = [{ source_node: 'n999', target_node: 'n1' }];
        expect(() => validateEdges(edges, nodeIds)).toThrow(ConversionError);
    });

    it('should throw for non-existent target', () => {
        const edges = [{ source_node: 'n1', target_node: 'n999' }];
        expect(() => validateEdges(edges, nodeIds)).toThrow(ConversionError);
    });

    it('should handle sourceNodeID/targetNodeID format', () => {
        const edges = [
            { sourceNodeID: 'n1', targetNodeID: 'n2' }
        ];
        expect(() => validateEdges(edges, nodeIds)).not.toThrow();
    });
});

describe('validateClipboardInput', () => {
    it('should throw for null input', () => {
        expect(() => validateClipboardInput(null)).toThrow(ConversionError);
    });

    it('should throw for invalid type', () => {
        const clip = { type: 'invalid-type', json: {} };
        expect(() => validateClipboardInput(clip)).toThrow(ConversionError);
    });

    it('should throw for missing json field', () => {
        const clip = { type: 'coze-workflow-clipboard-data' };
        expect(() => validateClipboardInput(clip)).toThrow(ConversionError);
    });

    it('should throw for missing nodes in json', () => {
        const clip = {
            type: 'coze-workflow-clipboard-data',
            json: {}
        };
        expect(() => validateClipboardInput(clip)).toThrow(ConversionError);
    });

    it('should throw for non-array nodes in json', () => {
        const clip = {
            type: 'coze-workflow-clipboard-data',
            json: { nodes: 'not_array' }
        };
        expect(() => validateClipboardInput(clip)).toThrow(ConversionError);
    });

    it('should pass for valid clipboard data', () => {
        const clip = {
            type: 'coze-workflow-clipboard-data',
            json: { nodes: [] }
        };
        expect(() => validateClipboardInput(clip)).not.toThrow();
    });

    it('should pass for valid clipboard with nodes', () => {
        const clip = {
            type: 'coze-workflow-clipboard-data',
            json: { nodes: [{ id: 'n1', type: 'start' }] }
        };
        expect(() => validateClipboardInput(clip)).not.toThrow();
    });
});

describe('getNodeTypeName', () => {
    it('should return display name for known type ID', () => {
        expect(getNodeTypeName('1')).toBe('🚀 开始');
        expect(getNodeTypeName('3')).toBe('🤖 大模型');
        expect(getNodeTypeName('5')).toBe('💻 代码');
    });

    it('should return the type string for unknown types', () => {
        expect(getNodeTypeName('999')).toBe('999');
    });

    it('should return "Unknown" for null/undefined', () => {
        expect(getNodeTypeName(null)).toBe('Unknown');
        expect(getNodeTypeName(undefined)).toBe('Unknown');
    });
});

describe('getNodeColor', () => {
    it('should return color for known type ID', () => {
        expect(getNodeColor('1')).toBe('#5C62FF');
        expect(getNodeColor('4')).toBe('#CA61FF');
        expect(getNodeColor('5')).toBe('#00B2B2');
    });

    it('should return default color for unknown types', () => {
        expect(getNodeColor('999')).toBe('#00B2B2');
    });
});

describe('formatError', () => {
    it('should format ConversionError with friendly message', () => {
        const err = new ConversionError('msg', ERROR_CODES.EMPTY_INPUT);
        const formatted = formatError(err);
        expect(formatted).toBeTruthy();
        expect(typeof formatted).toBe('string');
    });

    it('should format ConversionError with location', () => {
        const err = new ConversionError('msg', 'CODE', null, 5, 10);
        const formatted = formatError(err);
        expect(formatted).toContain('行 5');
    });

    it('should format regular Error', () => {
        const err = new Error('regular error');
        expect(formatError(err)).toBe('regular error');
    });

    it('should handle error without message', () => {
        const err = new Error();
        expect(formatError(err)).toBe('Unknown error');
    });
});