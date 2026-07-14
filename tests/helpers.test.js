/**
 * 工具函数测试
 */
import { DOM, StringUtils, Storage, ArrayUtils, ClipboardUtils, deepClone, getJsyaml } from '../src/utils/helpers.js';

// Mock navigator.clipboard for ClipboardUtils tests
if (!navigator.clipboard) {
    navigator.clipboard = {};
}
navigator.clipboard.writeText = async function (text) {};

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

describe('StringUtils', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(StringUtils.escapeHtml('<div>')).toBe('&lt;div&gt;');
        });

        it('should escape ampersand', () => {
            expect(StringUtils.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('should escape quotes', () => {
            expect(StringUtils.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
        });

        it('should escape single quotes', () => {
            expect(StringUtils.escapeHtml("'hello'")).toBe('&#39;hello&#39;');
        });

        it('should handle empty string', () => {
            expect(StringUtils.escapeHtml('')).toBe('');
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            expect(StringUtils.truncate('hello world', 5)).toBe('hello...');
        });

        it('should not truncate short strings', () => {
            expect(StringUtils.truncate('hello', 10)).toBe('hello');
        });
    });

    describe('formatTime', () => {
        it('should format timestamp', () => {
            const ts = Date.now();
            const result = StringUtils.formatTime(ts);
            expect(typeof result).toBe('string');
            expect(result.length > 0).toBe(true);
        });

        it('should return empty string for empty input', () => {
            expect(StringUtils.formatTime('')).toBe('');
        });
    });

    describe('generateId', () => {
        it('should generate non-empty string', () => {
            const id1 = StringUtils.generateId();
            const id2 = StringUtils.generateId();
            expect(id1.length > 0).toBe(true);
            expect(id1 !== id2).toBe(true);
        });
    });
});

describe('Storage', () => {
    describe('get/set', () => {
        it('should set and get value', () => {
            Storage.set('testKey', 'testValue');
            expect(Storage.get('testKey')).toBe('testValue');
        });

        it('should return default value when key not found', () => {
            expect(Storage.get('nonexistent', 'default')).toBe('default');
        });

        it('should return null when key not found and no default', () => {
            expect(Storage.get('nonexistent')).toBeNull();
        });

        it('should handle object values', () => {
            const obj = { a: 1, b: 2 };
            Storage.set('objKey', obj);
            expect(Storage.get('objKey')).toEqual(obj);
        });

        it('should handle array values', () => {
            const arr = [1, 2, 3];
            Storage.set('arrKey', arr);
            expect(Storage.get('arrKey')).toEqual(arr);
        });

        it('should handle number values', () => {
            Storage.set('numKey', 42);
            expect(Storage.get('numKey')).toBe(42);
        });

        it('should handle boolean values', () => {
            Storage.set('boolKey', true);
            expect(Storage.get('boolKey')).toBe(true);
        });

        it('should handle null values', () => {
            Storage.set('nullKey', null);
            expect(Storage.get('nullKey')).toBeNull();
        });
    });

    describe('remove', () => {
        it('should remove value', () => {
            Storage.set('key', 'value');
            Storage.remove('key');
            expect(Storage.get('key')).toBeNull();
        });
    });

    describe('session', () => {
        it('should have session storage', () => {
            expect(Storage.session).toBeDefined();
        });

        it('should set and get session value', () => {
            Storage.session.set('sessionKey', 'sessionValue');
            expect(Storage.session.get('sessionKey')).toBe('sessionValue');
        });

        it('should remove session value', () => {
            Storage.session.set('sessionKey', 'sessionValue');
            Storage.session.remove('sessionKey');
            expect(Storage.session.get('sessionKey')).toBeNull();
        });
    });

    describe('error handling', () => {
        it('should handle corrupted JSON gracefully', () => {
            localStorage.setItem('corrupted', '{invalid json');
            expect(Storage.get('corrupted', 'safe')).toBe('safe');
        });
    });
});

describe('ArrayUtils', () => {
    describe('limit', () => {
        it('should limit array length', () => {
            expect(ArrayUtils.limit([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
        });

        it('should return full array when limit > length', () => {
            expect(ArrayUtils.limit([1, 2], 5)).toEqual([1, 2]);
        });

        it('should return empty array for non-array', () => {
            expect(ArrayUtils.limit(null, 5)).toEqual([]);
        });
    });
});

describe('DOM', () => {
    let mockGetElementById;

    beforeEach(() => {
        mockGetElementById = jest.spyOn(document, 'getElementById');
    });

    afterEach(() => {
        mockGetElementById.mockRestore();
    });

    describe('get', () => {
        it('should return element by id', () => {
            const el = document.createElement('div');
            mockGetElementById.mockReturnValue(el);
            expect(DOM.get('testId')).toBe(el);
            expect(mockGetElementById).toHaveBeenCalledWith('testId');
        });

        it('should return null for non-existent id', () => {
            mockGetElementById.mockReturnValue(null);
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
            // jsdom textarea doesn't have value as a property by default
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
            const spy = jest.spyOn(el, 'addEventListener');
            const handler = () => {};
            DOM.on(el, 'click', handler);
            expect(spy).toHaveBeenCalledWith('click', handler, undefined);
            spy.mockRestore();
        });

        it('should remove event listener', () => {
            const el = document.createElement('div');
            const spy = jest.spyOn(el, 'removeEventListener');
            const handler = () => {};
            DOM.off(el, 'click', handler);
            expect(spy).toHaveBeenCalledWith('click', handler);
            spy.mockRestore();
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

        it('should not throw on null element', () => {
            expect(() => DOM.addClass(null, 'active')).not.toThrow();
            expect(() => DOM.removeClass(null, 'active')).not.toThrow();
            expect(() => DOM.toggleClass(null, 'active')).not.toThrow();
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
    let mockExecCommand;

    beforeEach(() => {
        try {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: async function () {} },
                writable: true,
                configurable: true,
            });
        } catch (e) {
            navigator.clipboard = { writeText: async function () {} };
        }
        if (!document.execCommand) {
            document.execCommand = function () {
                return true;
            };
        }
        mockExecCommand = jest.spyOn(document, 'execCommand').mockReturnValue(true);
    });

    afterEach(() => {
        if (mockExecCommand) {
            mockExecCommand.mockRestore();
        }
    });

    describe('copy', () => {
        it('should copy text successfully', async () => {
            const result = await ClipboardUtils.copy('test text');
            expect(result).toBe(true);
        });

        it('should fallback to document.execCommand when clipboard API fails', async () => {
            navigator.clipboard.writeText = async () => {
                throw new Error('denied');
            };
            const result = await ClipboardUtils.copy('test');
            expect(result).toBe(true);
        });
    });

    describe('copyWithFeedback', () => {
        it('should copy and show success feedback', async () => {
            const btn = document.createElement('button');
            btn.textContent = 'Copy';

            const result = await ClipboardUtils.copyWithFeedback('test', btn);
            expect(result).toBe(true);
            expect(btn.textContent).toBe('✓ 已复制');
        });

        it('should handle null button', async () => {
            const result = await ClipboardUtils.copyWithFeedback('test', null);
            expect(result).toBe(true);
        });

        it('should show error feedback on complete copy failure', async () => {
            navigator.clipboard.writeText = async () => {
                throw new Error('denied');
            };
            mockExecCommand.mockReturnValue(false);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const btn = document.createElement('button');
            btn.textContent = 'Copy';

            const result = await ClipboardUtils.copyWithFeedback('test', btn, 'OK', 'FAIL');
            expect(result).toBe(false);
            expect(btn.textContent).toBe('FAIL');

            consoleSpy.mockRestore();
        });

        it('should use custom success/error text', async () => {
            const btn = document.createElement('button');
            btn.textContent = 'Copy';

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

    it('should handle Date objects', () => {
        const date = new Date('2024-01-01');
        const cloned = deepClone(date);
        // structuredClone not available in jsdom, falls back to JSON which converts Date to string
        expect(cloned).toEqual(date.toISOString());
    });

    it('should handle primitive values', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
    });
});

describe('getJsyaml', () => {
    it('should return js-yaml when loaded', () => {
        const mockJsyaml = { load: () => {}, dump: () => {} };
        global.window = global.window || {};
        global.window.jsyaml = mockJsyaml;
        const yaml = getJsyaml();
        expect(yaml).toBe(mockJsyaml);
    });

    it('should throw error when jsyaml is not loaded', () => {
        global.window = global.window || {};
        global.window.jsyaml = undefined;
        expect(() => getJsyaml()).toThrow('js-yaml 库未加载');
    });
});
