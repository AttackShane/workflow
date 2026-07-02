/**
 * 类型映射工具测试
 */
import {
    TYPE_MAP,
    REV_TYPE_MAP,
    ASSIST_MAP,
    RAW_TYPE,
    NODE_CAPABILITIES,
    INHERIT_ASSIST_NODES,
    NODE_DISPLAY_NAMES,
    NODE_COLORS,
    NODE_HEIGHTS,
    NODE_DEFAULT_WIDTH,
    NODE_DEFAULT_HEIGHT,
    NODE_QUESTION_HEIGHT,
    NODE_CENTER_OFFSET,
    LANG_PYTHON,
    LANG_JAVASCRIPT,
    UNKNOWN_NODE_TYPE_DEFAULT,
    getAssistFromType,
    mapLang,
    mapOutType,
    getMainColor,
    getSubTitle,
    getBounds,
    resolveNodeType,
    inferRawMetaFromType,
    inferRawMetaFromValue,
    toValueObject
} from '../src/utils/types.js';

// Mock the dependencies
jest.mock('../src/utils/refCache.js', () => ({
    findRef: jest.fn(() => null),
    clearRefCache: jest.fn()
}));

jest.mock('../src/utils/logger.js', () => ({
    Logger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    },
    LOG_LEVELS_CONST: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, OFF: 4 }
}));

describe('Constants', () => {
    describe('NODE_DEFAULT_WIDTH', () => {
        it('should be a number', () => {
            expect(typeof NODE_DEFAULT_WIDTH).toBe('number');
            expect(NODE_DEFAULT_WIDTH).toBeGreaterThan(0);
        });
    });

    describe('NODE_DEFAULT_HEIGHT', () => {
        it('should be a number', () => {
            expect(typeof NODE_DEFAULT_HEIGHT).toBe('number');
            expect(NODE_DEFAULT_HEIGHT).toBeGreaterThan(0);
        });
    });

    describe('NODE_QUESTION_HEIGHT', () => {
        it('should be larger than default height', () => {
            expect(NODE_QUESTION_HEIGHT).toBeGreaterThan(NODE_DEFAULT_HEIGHT);
        });
    });

    describe('NODE_CENTER_OFFSET', () => {
        it('should be a number', () => {
            expect(typeof NODE_CENTER_OFFSET).toBe('number');
            expect(NODE_CENTER_OFFSET).toBe(200);
        });
    });

    describe('LANG_PYTHON', () => {
        it('should be 5', () => {
            expect(LANG_PYTHON).toBe(5);
        });
    });

    describe('LANG_JAVASCRIPT', () => {
        it('should be 6', () => {
            expect(LANG_JAVASCRIPT).toBe(6);
        });
    });

    describe('UNKNOWN_NODE_TYPE_DEFAULT', () => {
        it('should be "4" (plugin type)', () => {
            expect(UNKNOWN_NODE_TYPE_DEFAULT).toBe('4');
        });
    });
});

describe('TYPE_MAP', () => {
    it('should map common node types', () => {
        expect(TYPE_MAP.start).toBe('1');
        expect(TYPE_MAP.end).toBe('2');
        expect(TYPE_MAP.llm).toBe('3');
        expect(TYPE_MAP.plugin).toBe('4');
        expect(TYPE_MAP.code).toBe('5');
        expect(TYPE_MAP.condition).toBe('8');
        expect(TYPE_MAP.http).toBe('45');
        expect(TYPE_MAP.loop).toBe('21');
        expect(TYPE_MAP.batch).toBe('28');
    });

    it('should map all entries to string values', () => {
        for (const [key, value] of Object.entries(TYPE_MAP)) {
            expect(typeof key).toBe('string');
            expect(typeof value).toBe('string');
        }
    });

    it('should have unique values', () => {
        const values = Object.values(TYPE_MAP);
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });

    it('should include all major node types', () => {
        const requiredTypes = [
            'start', 'end', 'llm', 'plugin', 'code', 'condition',
            'http', 'loop', 'batch', 'intent', 'question', 'output',
            'input', 'variable_assign', 'variable_merge', 'comment'
        ];
        for (const type of requiredTypes) {
            expect(TYPE_MAP[type]).toBeDefined();
        }
    });
});

describe('REV_TYPE_MAP', () => {
    it('should be the reverse of TYPE_MAP', () => {
        for (const [key, value] of Object.entries(TYPE_MAP)) {
            expect(REV_TYPE_MAP[value]).toBe(key);
        }
    });

    it('should have same number of entries as TYPE_MAP', () => {
        expect(Object.keys(REV_TYPE_MAP).length).toBe(Object.keys(TYPE_MAP).length);
    });

    it('should map common IDs back to names', () => {
        expect(REV_TYPE_MAP['1']).toBe('start');
        expect(REV_TYPE_MAP['2']).toBe('end');
        expect(REV_TYPE_MAP['3']).toBe('llm');
        expect(REV_TYPE_MAP['4']).toBe('plugin');
        expect(REV_TYPE_MAP['8']).toBe('condition');
        expect(REV_TYPE_MAP['21']).toBe('loop');
    });
});

describe('ASSIST_MAP', () => {
    it('should map assist types to numbers', () => {
        expect(ASSIST_MAP.image).toBe(2);
        expect(ASSIST_MAP.audio).toBe(8);
        expect(ASSIST_MAP.video).toBe(10);
        expect(ASSIST_MAP.file).toBe(1);
    });
});

describe('RAW_TYPE', () => {
    it('should map type names to numbers', () => {
        expect(RAW_TYPE.string).toBe(1);
        expect(RAW_TYPE.integer).toBe(2);
        expect(RAW_TYPE.float).toBe(4);
        expect(RAW_TYPE.boolean).toBe(3);
        expect(RAW_TYPE.list).toBe(100);
        expect(RAW_TYPE.image).toBe(7);
        expect(RAW_TYPE.audio).toBe(14);
        expect(RAW_TYPE.video).toBe(16);
    });
});

describe('NODE_CAPABILITIES', () => {
    it('should have INHERIT_ASSIST set', () => {
        expect(NODE_CAPABILITIES.INHERIT_ASSIST).toBeInstanceOf(Set);
        expect(NODE_CAPABILITIES.INHERIT_ASSIST.has('llm')).toBe(true);
        expect(NODE_CAPABILITIES.INHERIT_ASSIST.has('code')).toBe(true);
        expect(NODE_CAPABILITIES.INHERIT_ASSIST.has('condition')).toBe(true);
        expect(NODE_CAPABILITIES.INHERIT_ASSIST.has('loop')).toBe(true);
    });

    it('should have HAS_BLOCKS set', () => {
        expect(NODE_CAPABILITIES.HAS_BLOCKS).toBeInstanceOf(Set);
        expect(NODE_CAPABILITIES.HAS_BLOCKS.has('loop')).toBe(true);
        expect(NODE_CAPABILITIES.HAS_BLOCKS.has('batch')).toBe(true);
    });

    it('should have HAS_OUTPUTS set', () => {
        expect(NODE_CAPABILITIES.HAS_OUTPUTS).toBeInstanceOf(Set);
        expect(NODE_CAPABILITIES.HAS_OUTPUTS.has('start')).toBe(true);
        expect(NODE_CAPABILITIES.HAS_OUTPUTS.has('llm')).toBe(true);
        expect(NODE_CAPABILITIES.HAS_OUTPUTS.has('code')).toBe(true);
    });
});

describe('INHERIT_ASSIST_NODES', () => {
    it('should be the same as NODE_CAPABILITIES.INHERIT_ASSIST', () => {
        expect(INHERIT_ASSIST_NODES).toBe(NODE_CAPABILITIES.INHERIT_ASSIST);
    });
});

describe('NODE_DISPLAY_NAMES', () => {
    it('should have display names for common types', () => {
        expect(NODE_DISPLAY_NAMES.start).toBeTruthy();
        expect(NODE_DISPLAY_NAMES.end).toBeTruthy();
        expect(NODE_DISPLAY_NAMES.llm).toBeTruthy();
        expect(NODE_DISPLAY_NAMES.code).toBeTruthy();
    });

    it('should be a string for each entry', () => {
        for (const [key, value] of Object.entries(NODE_DISPLAY_NAMES)) {
            expect(typeof key).toBe('string');
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        }
    });
});

describe('NODE_COLORS', () => {
    it('should have colors for common types', () => {
        expect(NODE_COLORS.start).toBeTruthy();
        expect(NODE_COLORS.end).toBeTruthy();
        expect(NODE_COLORS.llm).toBeTruthy();
    });

    it('should be valid hex colors', () => {
        for (const [key, color] of Object.entries(NODE_COLORS)) {
            expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });
});

describe('NODE_HEIGHTS', () => {
    it('should have heights for common types', () => {
        expect(typeof NODE_HEIGHTS.start).toBe('number');
        expect(typeof NODE_HEIGHTS.llm).toBe('number');
        expect(typeof NODE_HEIGHTS.code).toBe('number');
    });

    it('should have positive heights', () => {
        for (const [key, height] of Object.entries(NODE_HEIGHTS)) {
            expect(height).toBeGreaterThan(0);
        }
    });
});

describe('getAssistFromType', () => {
    it('should return assist value for known types', () => {
        expect(getAssistFromType('image')).toBe(2);
        expect(getAssistFromType('audio')).toBe(8);
        expect(getAssistFromType('video')).toBe(10);
        expect(getAssistFromType('file')).toBe(1);
    });

    it('should be case insensitive', () => {
        expect(getAssistFromType('IMAGE')).toBe(2);
        expect(getAssistFromType('Image')).toBe(2);
        expect(getAssistFromType('Audio')).toBe(8);
    });

    it('should return undefined for unknown types', () => {
        expect(getAssistFromType('unknown')).toBeUndefined();
    });

    it('should return undefined for null/undefined', () => {
        expect(getAssistFromType(null)).toBeUndefined();
        expect(getAssistFromType(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
        expect(getAssistFromType('')).toBeUndefined();
    });
});

describe('mapLang', () => {
    it('should return number as-is', () => {
        expect(mapLang(5)).toBe(5);
        expect(mapLang(6)).toBe(6);
        expect(mapLang(99)).toBe(99);
    });

    it('should map "python" to 5', () => {
        expect(mapLang('python')).toBe(5);
        expect(mapLang('Python')).toBe(5);
        expect(mapLang('PYTHON')).toBe(5);
    });

    it('should map "javascript" to 6', () => {
        expect(mapLang('javascript')).toBe(6);
        expect(mapLang('JavaScript')).toBe(6);
        expect(mapLang('JAVASCRIPT')).toBe(6);
    });

    it('should default to 5 for unknown strings', () => {
        expect(mapLang('ruby')).toBe(5);
        expect(mapLang('go')).toBe(5);
    });

    it('should default to 5 for null/undefined', () => {
        expect(mapLang(null)).toBe(5);
        expect(mapLang(undefined)).toBe(5);
    });
});

describe('mapOutType', () => {
    it('should return known types as-is', () => {
        expect(mapOutType('integer')).toBe('integer');
        expect(mapOutType('float')).toBe('float');
        expect(mapOutType('boolean')).toBe('boolean');
        expect(mapOutType('list')).toBe('list');
        expect(mapOutType('object')).toBe('object');
    });

    it('should default unknown types to "string"', () => {
        expect(mapOutType('unknown')).toBe('string');
        expect(mapOutType('image')).toBe('string');
        expect(mapOutType('')).toBe('string');
    });
});

describe('getMainColor', () => {
    it('should return color for known types', () => {
        expect(getMainColor('start')).toBe(NODE_COLORS.start);
        expect(getMainColor('llm')).toBe(NODE_COLORS.llm);
        expect(getMainColor('code')).toBe(NODE_COLORS.code);
    });

    it('should be case insensitive', () => {
        expect(getMainColor('START')).toBe(NODE_COLORS.start);
        expect(getMainColor('Llm')).toBe(NODE_COLORS.llm);
    });

    it('should return default color for unknown types', () => {
        expect(getMainColor('unknown_type')).toBe('#00B2B2');
    });

    it('should return default color for null/undefined', () => {
        expect(getMainColor(null)).toBe('#00B2B2');
        expect(getMainColor(undefined)).toBe('#00B2B2');
    });
});

describe('getSubTitle', () => {
    it('should strip emoji prefix from display names', () => {
        const subtitle = getSubTitle('start');
        expect(subtitle).toBe('开始');
        expect(subtitle).not.toContain('🚀');
    });

    it('should return empty string for unknown types', () => {
        expect(getSubTitle('unknown')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
        expect(getSubTitle(null)).toBe('');
        expect(getSubTitle(undefined)).toBe('');
    });

    it('should handle types with emoji prefix', () => {
        expect(getSubTitle('llm')).toBe('大模型');
        expect(getSubTitle('code')).toBe('代码');
        expect(getSubTitle('end')).toBe('结束');
    });
});

describe('getBounds', () => {
    it('should return default bounds for null/undefined', () => {
        const bounds = getBounds(null);
        expect(bounds).toEqual({
            x: 0, y: 0,
            width: NODE_DEFAULT_WIDTH,
            height: NODE_DEFAULT_HEIGHT
        });
    });

    it('should use node position when available', () => {
        const node = {
            position: { x: 100, y: 200 },
            type: 'start'
        };
        const bounds = getBounds(node);
        expect(bounds.x).toBe(100 - NODE_CENTER_OFFSET);
        expect(bounds.y).toBe(200);
    });

    it('should use question height for question type', () => {
        const node = {
            position: { x: 0, y: 0 },
            type: 'question'
        };
        const bounds = getBounds(node);
        expect(bounds.height).toBe(NODE_QUESTION_HEIGHT);
    });

    it('should use default height for non-question types', () => {
        const node = {
            position: { x: 0, y: 0 },
            type: 'start'
        };
        const bounds = getBounds(node);
        expect(bounds.height).toBe(NODE_DEFAULT_HEIGHT);
    });

    it('should handle missing position gracefully', () => {
        const node = { type: 'llm' };
        const bounds = getBounds(node);
        expect(bounds.x).toBe(0 - NODE_CENTER_OFFSET);
        expect(bounds.y).toBe(0);
    });

    it('should handle missing type gracefully', () => {
        const node = { position: { x: 50, y: 50 } };
        const bounds = getBounds(node);
        expect(bounds.x).toBe(50 - NODE_CENTER_OFFSET);
        expect(bounds.y).toBe(50);
        expect(bounds.width).toBe(NODE_DEFAULT_WIDTH);
        expect(bounds.height).toBe(NODE_DEFAULT_HEIGHT);
    });
});

describe('resolveNodeType', () => {
    it('should resolve known types to their IDs', () => {
        expect(resolveNodeType('start')).toBe('1');
        expect(resolveNodeType('end')).toBe('2');
        expect(resolveNodeType('llm')).toBe('3');
        expect(resolveNodeType('plugin')).toBe('4');
        expect(resolveNodeType('code')).toBe('5');
        expect(resolveNodeType('condition')).toBe('8');
    });

    it('should return default for unknown types', () => {
        expect(resolveNodeType('unknown_type_xyz')).toBe(UNKNOWN_NODE_TYPE_DEFAULT);
    });

    it('should return default for empty string', () => {
        expect(resolveNodeType('')).toBe(UNKNOWN_NODE_TYPE_DEFAULT);
    });

    it('should return default for null/undefined', () => {
        expect(resolveNodeType(null)).toBe(UNKNOWN_NODE_TYPE_DEFAULT);
        expect(resolveNodeType(undefined)).toBe(UNKNOWN_NODE_TYPE_DEFAULT);
    });
});

describe('inferRawMetaFromType', () => {
    it('should return cached meta for known types', () => {
        expect(inferRawMetaFromType('integer')).toEqual({ type: 2 });
        expect(inferRawMetaFromType('float')).toEqual({ type: 4 });
        expect(inferRawMetaFromType('boolean')).toEqual({ type: 3 });
        expect(inferRawMetaFromType('list')).toEqual({ type: 100 });
        expect(inferRawMetaFromType('object')).toEqual({ type: 1 });
    });

    it('should return image meta for assist=2', () => {
        expect(inferRawMetaFromType('unknown', 2)).toEqual({ type: 7 });
    });

    it('should return audio meta for assist=8', () => {
        expect(inferRawMetaFromType('unknown', 8)).toEqual({ type: 14 });
    });

    it('should return video meta for assist=10', () => {
        expect(inferRawMetaFromType('unknown', 10)).toEqual({ type: 16 });
    });

    it('should default to string type', () => {
        expect(inferRawMetaFromType('unknown', 0)).toEqual({ type: 1 });
        expect(inferRawMetaFromType(null)).toEqual({ type: 1 });
    });
});

describe('inferRawMetaFromValue', () => {
    it('should infer integer type from integer value', () => {
        expect(inferRawMetaFromValue(42)).toEqual({ type: 2 });
    });

    it('should infer float type from float value', () => {
        expect(inferRawMetaFromValue(3.14)).toEqual({ type: 4 });
    });

    it('should infer boolean type from boolean value', () => {
        expect(inferRawMetaFromValue(true)).toEqual({ type: 3 });
        expect(inferRawMetaFromValue(false)).toEqual({ type: 3 });
    });

    it('should infer list type from array', () => {
        expect(inferRawMetaFromValue([1, 2, 3])).toEqual({ type: RAW_TYPE.list });
    });

    it('should default to string type', () => {
        expect(inferRawMetaFromValue('hello')).toEqual({ type: 1 });
        expect(inferRawMetaFromValue({})).toEqual({ type: 1 });
    });
});

describe('toValueObject', () => {
    it('should return literal type for null', () => {
        const result = toValueObject(null);
        expect(result.type).toBe('literal');
        expect(result.content).toBe('');
    });

    it('should return literal type for undefined', () => {
        const result = toValueObject(undefined);
        expect(result.type).toBe('literal');
        expect(result.content).toBe('');
    });

    it('should return literal type for strings', () => {
        const result = toValueObject('hello');
        expect(result.type).toBe('literal');
        expect(result.content).toBe('hello');
    });

    it('should return literal type for numbers', () => {
        const result = toValueObject(42);
        expect(result.type).toBe('literal');
        expect(result.content).toBe(42);
        expect(result.rawMeta).toEqual({ type: 2 });
    });

    it('should return literal type for booleans', () => {
        const result = toValueObject(true);
        expect(result.type).toBe('literal');
        expect(result.content).toBe(true);
        expect(result.rawMeta).toEqual({ type: 3 });
    });

    it('should return literal type for arrays', () => {
        const result = toValueObject([1, 2, 3]);
        expect(result.type).toBe('literal');
        expect(result.content).toEqual([1, 2, 3]);
        expect(result.rawMeta).toEqual({ type: RAW_TYPE.list });
    });

    it('should pass through ref type objects', () => {
        const refObj = { type: 'ref', content: { blockID: '123' } };
        const result = toValueObject(refObj);
        expect(result).toBe(refObj);
    });

    it('should pass through literal type objects', () => {
        const litObj = { type: 'literal', content: 'test' };
        const result = toValueObject(litObj);
        expect(result).toBe(litObj);
    });

    it('should handle objects with type and value', () => {
        const obj = { type: 'custom', value: 'hello' };
        const result = toValueObject(obj);
        expect(result.type).toBe('custom');
        expect(result.value).toEqual({ type: 'literal', content: 'hello', rawMeta: { type: 1 } });
    });
});