/**
 * 工具函数测试
 */
import { StringUtils, Storage } from '../src/utils/helpers.js';

// Mock localStorage for Node environment
global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = value; },
    removeItem: function(key) { delete this._data[key]; },
    clear: function() { this._data = {}; }
};

describe('StringUtils', () => {
    describe('escapeHtml', () => {
        it('should escape < and > characters', () => {
            expect(StringUtils.escapeHtml('<script>')).toBe('&lt;script&gt;');
        });

        it('should escape & character', () => {
            expect(StringUtils.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('should escape " character', () => {
            expect(StringUtils.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
        });

        it('should return empty string for null/undefined', () => {
            expect(StringUtils.escapeHtml(null)).toBe('');
            expect(StringUtils.escapeHtml(undefined)).toBe('');
        });

        it('should not escape safe characters', () => {
            const safe = 'hello world 123';
            expect(StringUtils.escapeHtml(safe)).toBe(safe);
        });

        it('should handle numbers', () => {
            expect(StringUtils.escapeHtml(42)).toBe('42');
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            expect(StringUtils.truncate('hello world', 5)).toBe('hello...');
        });

        it('should return original string if shorter than limit', () => {
            expect(StringUtils.truncate('hi', 10)).toBe('hi');
        });

        it('should handle empty string', () => {
            expect(StringUtils.truncate('', 5)).toBe('');
        });
    });

    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = StringUtils.generateId();
            const id2 = StringUtils.generateId();
            expect(id1).not.toBe(id2);
        });

        it('should be string type', () => {
            expect(typeof StringUtils.generateId()).toBe('string');
        });
    });

    describe('formatTime', () => {
        it('should format timestamp', () => {
            const result = StringUtils.formatTime(Date.now());
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});

describe('Storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('set and get', () => {
        it('should store and retrieve values', () => {
            Storage.set('test_key', 'test_value');
            expect(Storage.get('test_key')).toBe('test_value');
        });

        it('should store and retrieve objects', () => {
            const obj = { a: 1, b: [2, 3], c: { d: 'e' } };
            Storage.set('test_obj', obj);
            expect(Storage.get('test_obj')).toEqual(obj);
        });

        it('should return null for non-existent key', () => {
            expect(Storage.get('non_existent')).toBeNull();
        });
    });

    describe('remove', () => {
        it('should remove stored value', () => {
            Storage.set('test_remove', 'value');
            Storage.remove('test_remove');
            expect(Storage.get('test_remove')).toBeNull();
        });
    });

    describe('clear', () => {
        it('should clear all stored values', () => {
            Storage.set('a', 1);
            Storage.set('b', 2);
            Storage.clear();
            expect(Storage.get('a')).toBeNull();
            expect(Storage.get('b')).toBeNull();
        });
    });
});