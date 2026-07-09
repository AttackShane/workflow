/**
 * 工具函数测试
 */
import { DOM, StringUtils, Storage, ArrayUtils, ClipboardUtils, deepClone, getJsyaml } from '../src/utils/helpers.js';

// Mock localStorage for Node environment
global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = value; },
    removeItem: function(key) { delete this._data[key]; },
    clear: function() { this._data = {}; }
};

// Mock document for DOM tests
global.document = {
    _bodyChildren: [],
    get body() { return this._body; },
    set body(v) { this._body = v; },
    getElementById: function(id) {
        if (!this._elements) this._elements = {};
        if (!this._body) {
            this._body = {
                appendChild: (el) => { this._bodyChildren.push(el); },
                removeChild: (el) => {
                    const idx = this._bodyChildren.indexOf(el);
                    if (idx >= 0) this._bodyChildren.splice(idx, 1);
                }
            };
        }
        return this._elements[id] || null;
    },
    createElement: function(tag) {
        return {
            tagName: tag.toUpperCase(),
            className: '',
            id: '',
            textContent: '',
            innerHTML: '',
            value: '',
            style: {},
            disabled: false,
            classList: {
                _classes: [],
                add: function(c) { if (!this._classes.includes(c)) this._classes.push(c); },
                remove: function(c) { this._classes = this._classes.filter(x => x !== c); },
                toggle: function(c, force) {
                    if (force === undefined) {
                        this.contains(c) ? this.remove(c) : this.add(c);
                    } else if (force) {
                        this.add(c);
                    } else {
                        this.remove(c);
                    }
                },
                contains: function(c) { return this._classes.includes(c); }
            },
            setAttribute: function(name, value) { this._attrs = this._attrs || {}; this._attrs[name] = value; },
            getAttribute: function(name) { return this._attrs ? this._attrs[name] : null; },
            addEventListener: function(event, handler) {
                this._events = this._events || {};
                this._events[event] = handler;
            },
            removeEventListener: function(event, handler) {
                if (this._events) delete this._events[event];
            },
            select: function() {},
            focus: function() {}
        };
    },
    createElementNS: function(ns, tag) {
        return {
            tagName: tag,
            setAttribute: function(name, value) { this._attrs = this._attrs || {}; this._attrs[name] = value; },
            getAttribute: function(name) { return this._attrs ? this._attrs[name] : null; }
        };
    },
    execCommand: function(cmd) { return cmd === 'copy'; }
};

// Mock navigator for ClipboardUtils
global.navigator = {
    clipboard: {
        writeText: async function(text) { return; }
    }
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

    describe('get with default', () => {
        it('should return default value for non-existent key', () => {
            expect(Storage.get('missing', 'fallback')).toBe('fallback');
        });

        it('should return stored value when key exists', () => {
            Storage.set('has_value', 'real');
            expect(Storage.get('has_value', 'fallback')).toBe('real');
        });
    });

    describe('error handling', () => {
        it('should handle corrupted JSON gracefully', () => {
            localStorage._data['corrupted'] = '{invalid json';
            expect(Storage.get('corrupted', 'safe')).toBe('safe');
        });
    });

    describe('set error handling', () => {
        it('should handle setItem throwing error', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = function() { throw new Error('quota exceeded'); };
            expect(() => Storage.set('test', 'value')).not.toThrow();
            localStorage.setItem = originalSetItem;
            consoleSpy.mockRestore();
        });
    });

    describe('remove error handling', () => {
        it('should handle removeItem throwing error', () => {
            const originalRemoveItem = localStorage.removeItem;
            localStorage.removeItem = function() { throw new Error('not available'); };
            expect(() => Storage.remove('test')).not.toThrow();
            localStorage.removeItem = originalRemoveItem;
        });
    });

    describe('clear error handling', () => {
        it('should handle clear throwing error', () => {
            const originalClear = localStorage.clear;
            localStorage.clear = function() { throw new Error('not available'); };
            expect(() => Storage.clear()).not.toThrow();
            localStorage.clear = originalClear;
        });
    });
});

describe('ArrayUtils', () => {
    describe('find', () => {
        it('should find element in array', () => {
            const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
            expect(ArrayUtils.find(arr, item => item.id === 2)).toEqual({ id: 2 });
        });

        it('should return undefined for non-array', () => {
            expect(ArrayUtils.find(null, x => x)).toBeUndefined();
            expect(ArrayUtils.find('string', x => x)).toBeUndefined();
        });

        it('should return undefined when not found', () => {
            expect(ArrayUtils.find([1, 2, 3], x => x > 5)).toBeUndefined();
        });
    });

    describe('filter', () => {
        it('should filter array elements', () => {
            expect(ArrayUtils.filter([1, 2, 3, 4], x => x % 2 === 0)).toEqual([2, 4]);
        });

        it('should return empty array for non-array', () => {
            expect(ArrayUtils.filter(null, x => x)).toEqual([]);
            expect(ArrayUtils.filter(undefined, x => x)).toEqual([]);
        });
    });

    describe('unique', () => {
        it('should deduplicate array by identity', () => {
            expect(ArrayUtils.unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
        });

        it('should deduplicate array by key function', () => {
            const arr = [{ id: 1 }, { id: 2 }, { id: 1 }];
            const result = ArrayUtils.unique(arr, item => item.id);
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('should return empty array for non-array', () => {
            expect(ArrayUtils.unique(null)).toEqual([]);
        });
    });

    describe('limit', () => {
        it('should limit array length', () => {
            expect(ArrayUtils.limit([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
        });

        it('should return all elements if maxLength exceeds array length', () => {
            expect(ArrayUtils.limit([1, 2], 5)).toEqual([1, 2]);
        });

        it('should return empty array for non-array', () => {
            expect(ArrayUtils.limit(null, 5)).toEqual([]);
        });
    });
});

describe('DOM', () => {
    beforeEach(() => {
        document._elements = {};
    });

    describe('get', () => {
        it('should return element by id', () => {
            const el = document.createElement('div');
            document._elements['testId'] = el;
            expect(DOM.get('testId')).toBe(el);
        });

        it('should return null for non-existent id', () => {
            expect(DOM.get('missing')).toBeNull();
        });
    });

    describe('setText', () => {
        it('should set textContent for regular elements', () => {
            const el = document.createElement('div');
            DOM.setText(el, 'hello');
            expect(el.textContent).toBe('hello');
        });

        it('should set value for textarea', () => {
            const el = document.createElement('textarea');
            DOM.setText(el, 'input text');
            expect(el.value).toBe('input text');
        });

        it('should set value for input', () => {
            const el = document.createElement('input');
            DOM.setText(el, 'input text');
            expect(el.value).toBe('input text');
        });

        it('should not throw on null element', () => {
            expect(() => DOM.setText(null, 'text')).not.toThrow();
        });
    });

    describe('setHtml', () => {
        it('should set innerHTML', () => {
            const el = document.createElement('div');
            DOM.setHtml(el, '<span>test</span>');
            expect(el.innerHTML).toBe('<span>test</span>');
        });

        it('should not throw on null element', () => {
            expect(() => DOM.setHtml(null, 'html')).not.toThrow();
        });
    });

    describe('setAttr', () => {
        it('should set attribute', () => {
            const el = document.createElement('div');
            DOM.setAttr(el, 'data-test', 'value');
            expect(el.getAttribute('data-test')).toBe('value');
        });

        it('should not throw on null element', () => {
            expect(() => DOM.setAttr(null, 'attr', 'val')).not.toThrow();
        });
    });

    describe('setStyle', () => {
        it('should set style property', () => {
            const el = document.createElement('div');
            DOM.setStyle(el, 'color', 'red');
            expect(el.style.color).toBe('red');
        });

        it('should not throw on null element', () => {
            expect(() => DOM.setStyle(null, 'color', 'red')).not.toThrow();
        });
    });

    describe('setDisabled', () => {
        it('should set disabled state', () => {
            const el = document.createElement('button');
            DOM.setDisabled(el, true);
            expect(el.disabled).toBe(true);
            DOM.setDisabled(el, false);
            expect(el.disabled).toBe(false);
        });

        it('should not throw on null element', () => {
            expect(() => DOM.setDisabled(null, true)).not.toThrow();
        });
    });

    describe('on/off', () => {
        it('should add event listener', () => {
            const el = document.createElement('div');
            const handler = () => {};
            DOM.on(el, 'click', handler);
            expect(el._events['click']).toBe(handler);
        });

        it('should remove event listener', () => {
            const el = document.createElement('div');
            const handler = () => {};
            DOM.on(el, 'click', handler);
            DOM.off(el, 'click', handler);
            expect(el._events['click']).toBeUndefined();
        });

        it('should not throw on null element', () => {
            expect(() => DOM.on(null, 'click', () => {})).not.toThrow();
            expect(() => DOM.off(null, 'click', () => {})).not.toThrow();
        });
    });

    describe('class manipulation', () => {
        it('should add class', () => {
            const el = document.createElement('div');
            DOM.addClass(el, 'active');
            expect(el.classList.contains('active')).toBe(true);
        });

        it('should remove class', () => {
            const el = document.createElement('div');
            el.classList.add('active');
            DOM.removeClass(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should toggle class', () => {
            const el = document.createElement('div');
            DOM.toggleClass(el, 'active');
            expect(el.classList.contains('active')).toBe(true);
            DOM.toggleClass(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should toggle class with force', () => {
            const el = document.createElement('div');
            DOM.toggleClass(el, 'active', true);
            expect(el.classList.contains('active')).toBe(true);
            DOM.toggleClass(el, 'active', false);
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should not throw on null element', () => {
            expect(() => DOM.addClass(null, 'cls')).not.toThrow();
            expect(() => DOM.removeClass(null, 'cls')).not.toThrow();
            expect(() => DOM.toggleClass(null, 'cls')).not.toThrow();
        });
    });

    describe('create', () => {
        it('should create basic element', () => {
            const el = DOM.create('div');
            expect(el.tagName).toBe('DIV');
        });

        it('should create element with className', () => {
            const el = DOM.create('div', { className: 'my-class' });
            expect(el.className).toBe('my-class');
        });

        it('should create element with id', () => {
            const el = DOM.create('div', { id: 'my-id' });
            expect(el.id).toBe('my-id');
        });

        it('should create element with text', () => {
            const el = DOM.create('div', { text: 'hello' });
            expect(el.textContent).toBe('hello');
        });

        it('should create element with html', () => {
            const el = DOM.create('div', { html: '<span>test</span>' });
            expect(el.innerHTML).toBe('<span>test</span>');
        });

        it('should create element with value', () => {
            const el = DOM.create('input', { value: 'test value' });
            expect(el.value).toBe('test value');
        });

        it('should create element with style', () => {
            const el = DOM.create('div', { style: { color: 'red' } });
            expect(el.style.color).toBe('red');
        });

        it('should create element with attributes', () => {
            const el = DOM.create('div', { attributes: { 'data-x': '1', 'data-y': '2' } });
            expect(el.getAttribute('data-x')).toBe('1');
            expect(el.getAttribute('data-y')).toBe('2');
        });
    });

    describe('createSVG', () => {
        it('should create SVG element', () => {
            const el = DOM.createSVG('circle');
            expect(el.tagName).toBe('circle');
        });

        it('should create SVG element with attributes', () => {
            const el = DOM.createSVG('circle', { attributes: { cx: '10', cy: '20', r: '5' } });
            expect(el.getAttribute('cx')).toBe('10');
            expect(el.getAttribute('cy')).toBe('20');
            expect(el.getAttribute('r')).toBe('5');
        });
    });
});

describe('ClipboardUtils', () => {
    describe('copy', () => {
        it('should copy text successfully', async () => {
            const result = await ClipboardUtils.copy('test text');
            expect(result).toBe(true);
        });

        it('should fallback to document.execCommand when clipboard API fails', async () => {
            const originalWriteText = navigator.clipboard.writeText;
            navigator.clipboard.writeText = async () => { throw new Error('denied'); };
            const result = await ClipboardUtils.copy('test');
            expect(result).toBe(true);
            navigator.clipboard.writeText = originalWriteText;
        });
    });

    describe('copyWithFeedback', () => {
        it('should copy and show success feedback', async () => {
            const btn = document.createElement('button');
            btn.textContent = 'Copy';
            btn.style.background = '';
            btn.style.borderColor = '';

            const result = await ClipboardUtils.copyWithFeedback('test', btn);
            expect(result).toBe(true);
            expect(btn.textContent).toBe('✓ 已复制');
        });

        it('should handle null button', async () => {
            const result = await ClipboardUtils.copyWithFeedback('test', null);
            expect(result).toBe(true);
        });

        it('should show error feedback on complete copy failure', async () => {
            const originalWriteText = navigator.clipboard.writeText;
            navigator.clipboard.writeText = async () => { throw new Error('denied'); };
            const originalExecCommand = document.execCommand;
            document.execCommand = () => false;
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const btn = document.createElement('button');
            btn.textContent = 'Copy';
            btn.style.background = '#5C62FF';
            btn.style.borderColor = '#5C62FF';

            const result = await ClipboardUtils.copyWithFeedback('test', btn, 'OK', 'FAIL');
            expect(result).toBe(false);
            expect(btn.textContent).toBe('FAIL');

            navigator.clipboard.writeText = originalWriteText;
            document.execCommand = originalExecCommand;
            consoleSpy.mockRestore();
        });

        it('should use custom success/error text', async () => {
            const btn = document.createElement('button');
            btn.textContent = 'Copy';
            btn.style.background = '';
            btn.style.borderColor = '';

            const result = await ClipboardUtils.copyWithFeedback('test', btn, 'Copied!', 'Failed!');
            expect(result).toBe(true);
            expect(btn.textContent).toBe('Copied!');
        });
    });
});

describe('deepClone', () => {
    it('should return null/undefined as-is', () => {
        expect(deepClone(null)).toBeNull();
        expect(deepClone(undefined)).toBeUndefined();
    });

    it('should deep clone plain objects', () => {
        const obj = { a: 1, b: { c: 2 } };
        const cloned = deepClone(obj);
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.b).not.toBe(obj.b);
    });

    it('should deep clone arrays', () => {
        const arr = [1, [2, 3], { a: 4 }];
        const cloned = deepClone(arr);
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
        expect(cloned[1]).not.toBe(arr[1]);
        expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone primitive values', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
    });

    it('should fallback to JSON when structuredClone fails', () => {
        const originalStructuredClone = global.structuredClone;
        global.structuredClone = undefined;
        const obj = { a: 1, b: { c: 2 } };
        const cloned = deepClone(obj);
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        global.structuredClone = originalStructuredClone;
    });
});

describe('getJsyaml', () => {
    it('should throw error when jsyaml is not loaded', () => {
        global.window = global.window || {};
        global.window.jsyaml = undefined;
        expect(() => getJsyaml()).toThrow('js-yaml 库未加载');
    });

    it('should return jsyaml when loaded', () => {
        const mockJsyaml = { load: () => {} };
        global.window.jsyaml = mockJsyaml;
        expect(getJsyaml()).toBe(mockJsyaml);
    });
});