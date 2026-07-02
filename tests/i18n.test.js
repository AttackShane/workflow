import { I18nManager, i18n, t, setLanguage, getLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../src/i18n/i18n.js';

global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = value; },
    removeItem(key) { delete this._data[key]; }
};

beforeEach(() => {
    localStorage._data = {};
    i18n.setLanguage('zh-CN');
});

describe('I18n', () => {
    describe('constants', () => {
        it('should have supported languages', () => {
            expect(SUPPORTED_LANGUAGES).toBeDefined();
            expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
            expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
            expect(SUPPORTED_LANGUAGES.find(l => l.code === 'zh-CN')).toBeDefined();
            expect(SUPPORTED_LANGUAGES.find(l => l.code === 'en-US')).toBeDefined();
        });

        it('should have default language', () => {
            expect(DEFAULT_LANGUAGE).toBe('zh-CN');
        });
    });

    describe('I18nManager', () => {
        let manager;

        beforeEach(() => {
            manager = new I18nManager();
        });

        describe('constructor', () => {
            it('should create instance with default language', () => {
                expect(manager.getLanguage()).toBe('zh-CN');
            });

            it('should create instance with custom language', () => {
                localStorage._data = {};
                const m = new I18nManager('en-US');
                expect(m.getLanguage()).toBe('en-US');
            });

            it('should have listeners array', () => {
                expect(manager.listeners).toEqual([]);
            });
        });

        describe('getLanguage', () => {
            it('should return current language', () => {
                expect(manager.getLanguage()).toBe('zh-CN');
            });
        });

        describe('setLanguage', () => {
            it('should set valid language', () => {
                manager.setLanguage('en-US');
                expect(manager.getLanguage()).toBe('en-US');
            });

            it('should not set unsupported language', () => {
                manager.setLanguage('fr-FR');
                expect(manager.getLanguage()).toBe('zh-CN');
            });

            it('should notify listeners when language changes', () => {
                const listener = jest.fn();
                manager.addListener(listener);
                manager.setLanguage('en-US');
                expect(listener).toHaveBeenCalledWith('en-US');
            });

            it('should notify listeners even when setting same language', () => {
                const listener = jest.fn();
                manager.addListener(listener);
                manager.setLanguage('zh-CN');
                expect(listener).toHaveBeenCalledWith('zh-CN');
            });
        });

        describe('t (translate)', () => {
            it('should translate using nested keys', () => {
                const result = manager.t('common.confirm');
                expect(typeof result).toBe('string');
                expect(result).not.toBe('common.confirm');
            });

            it('should return key when translation not found', () => {
                const result = manager.t('nonexistent.key.here');
                expect(result).toBe('nonexistent.key.here');
            });

            it('should replace params in template', () => {
                manager.setLanguage('zh-CN');
                const result = manager.t('common.confirm', {});
                expect(typeof result).toBe('string');
            });

            it('should handle empty params', () => {
                const result = manager.t('common.confirm');
                expect(typeof result).toBe('string');
            });

            it('should fallback to default language when current language pack missing', () => {
                const m = new I18nManager('fr-FR');
                const result = m.t('common.confirm');
                expect(typeof result).toBe('string');
            });
        });

        describe('getValueByKey', () => {
            it('should return nested value', () => {
                const obj = { a: { b: { c: 'hello' } } };
                const result = manager.getValueByKey(obj, 'a.b.c');
                expect(result).toBe('hello');
            });

            it('should return key when obj is null', () => {
                const result = manager.getValueByKey(null, 'a.b');
                expect(result).toBe('a.b');
            });

            it('should return key when key is empty', () => {
                const result = manager.getValueByKey({ a: 1 }, '');
                expect(result).toBe('');
            });

            it('should return key when path not found', () => {
                const result = manager.getValueByKey({ a: 1 }, 'a.b.c');
                expect(result).toBe('a.b.c');
            });

            it('should return key when intermediate value is not an object', () => {
                const result = manager.getValueByKey({ a: 'string' }, 'a.b');
                expect(result).toBe('a.b');
            });
        });

        describe('replaceParams', () => {
            it('should replace {param} in text', () => {
                const result = manager.replaceParams('Hello {name}', { name: 'World' });
                expect(result).toBe('Hello World');
            });

            it('should keep unmatched params', () => {
                const result = manager.replaceParams('Hello {name}', {});
                expect(result).toBe('Hello {name}');
            });

            it('should handle null text', () => {
                const result = manager.replaceParams(null, {});
                expect(result).toBeNull();
            });

            it('should handle non-string text', () => {
                const result = manager.replaceParams(123, {});
                expect(result).toBe(123);
            });

            it('should replace multiple params', () => {
                const result = manager.replaceParams('{greeting} {name}', { greeting: 'Hi', name: 'Alice' });
                expect(result).toBe('Hi Alice');
            });
        });

        describe('getLocale', () => {
            it('should return locale object', () => {
                const locale = manager.getLocale();
                expect(locale).toBeDefined();
                expect(typeof locale).toBe('object');
            });

            it('should return locale for current language', () => {
                manager.setLanguage('en-US');
                const locale = manager.getLocale();
                expect(locale).toBeDefined();
            });
        });

        describe('loadFromStorage', () => {
            it('should load language from localStorage', () => {
                localStorage.setItem('workflow_language', 'en-US');
                const m = new I18nManager();
                expect(m.getLanguage()).toBe('en-US');
                localStorage.removeItem('workflow_language');
            });

            it('should ignore invalid stored language', () => {
                localStorage.setItem('workflow_language', 'fr-FR');
                const m = new I18nManager();
                expect(m.getLanguage()).toBe('zh-CN');
                localStorage.removeItem('workflow_language');
            });
        });

        describe('saveToStorage', () => {
            it('should save language to localStorage', () => {
                manager.setLanguage('en-US');
                expect(localStorage.getItem('workflow_language')).toBe('en-US');
            });
        });

        describe('listeners', () => {
            it('should add listener', () => {
                const listener = jest.fn();
                manager.addListener(listener);
                expect(manager.listeners).toContain(listener);
            });

            it('should not add non-function listener', () => {
                manager.addListener('not a function');
                expect(manager.listeners.length).toBe(0);
            });

            it('should remove listener', () => {
                const listener = jest.fn();
                manager.addListener(listener);
                manager.removeListener(listener);
                expect(manager.listeners).not.toContain(listener);
            });

            it('should handle removing non-existent listener', () => {
                expect(() => manager.removeListener(() => {})).not.toThrow();
            });

            it('should handle listener errors gracefully', () => {
                const badListener = jest.fn(() => { throw new Error('listener error'); });
                const goodListener = jest.fn();
                manager.addListener(badListener);
                manager.addListener(goodListener);
                manager.setLanguage('en-US');
                expect(goodListener).toHaveBeenCalled();
            });
        });

        describe('getLanguageName', () => {
            it('should return Chinese name for zh-CN', () => {
                expect(manager.getLanguageName('zh-CN')).toBe('中文');
            });

            it('should return English name for en-US', () => {
                expect(manager.getLanguageName('en-US')).toBe('English');
            });

            it('should return code for unknown language', () => {
                expect(manager.getLanguageName('fr-FR')).toBe('fr-FR');
            });

            it('should use current language by default', () => {
                expect(manager.getLanguageName()).toBe('中文');
            });
        });

        describe('isSupported', () => {
            it('should return true for supported language', () => {
                expect(manager.isSupported('zh-CN')).toBe(true);
                expect(manager.isSupported('en-US')).toBe(true);
            });

            it('should return false for unsupported language', () => {
                expect(manager.isSupported('fr-FR')).toBe(false);
            });
        });

        describe('getSupportedLanguages', () => {
            it('should return copy of supported languages', () => {
                const langs = manager.getSupportedLanguages();
                expect(Array.isArray(langs)).toBe(true);
                expect(langs.length).toBe(SUPPORTED_LANGUAGES.length);
                expect(langs).not.toBe(SUPPORTED_LANGUAGES);
            });
        });
    });

    describe('global instance', () => {
        it('should have i18n instance', () => {
            expect(i18n).toBeDefined();
            expect(i18n instanceof I18nManager).toBe(true);
        });

        it('t() should work', () => {
            const result = t('common.confirm');
            expect(typeof result).toBe('string');
        });

        it('setLanguage() should work', () => {
            setLanguage('en-US');
            expect(getLanguage()).toBe('en-US');
            setLanguage('zh-CN');
            expect(getLanguage()).toBe('zh-CN');
        });

        it('getLanguage() should work', () => {
            expect(getLanguage()).toBe('zh-CN');
        });
    });
});