import {
    I18nManager,
    i18n,
    t,
    setLanguage,
    getLanguage,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
} from '../src/i18n/i18n.js';

beforeEach(() => {
    localStorage.clear();
    i18n.setLanguage('zh-CN');
});

describe('I18n', () => {
    describe('constants', () => {
        it('should have supported languages', () => {
            expect(SUPPORTED_LANGUAGES).toBeDefined();
            expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
            expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
            expect(SUPPORTED_LANGUAGES.find((l) => l.code === 'zh-CN')).toBeDefined();
            expect(SUPPORTED_LANGUAGES.find((l) => l.code === 'en-US')).toBeDefined();
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
                localStorage.clear();
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
            });

            it('should return key if translation not found', () => {
                const result = manager.t('nonexistent.key');
                expect(result).toBe('nonexistent.key');
            });

            it('should replace params', () => {
                manager.setLanguage('en-US');
                const result = manager.t('converter.importSuccess', { count: '5' });
                expect(result).toContain('5');
            });

            it('should return key for empty key', () => {
                expect(manager.t('')).toBe('');
            });
        });

        describe('getValueByKey', () => {
            it('should return value for simple key', () => {
                const obj = { a: 1 };
                expect(manager.getValueByKey(obj, 'a')).toBe(1);
            });

            it('should return value for nested key', () => {
                const obj = { a: { b: { c: 'hello' } } };
                expect(manager.getValueByKey(obj, 'a.b.c')).toBe('hello');
            });

            it('should return key for non-existent path', () => {
                const obj = { a: 1 };
                expect(manager.getValueByKey(obj, 'a.b.c')).toBe('a.b.c');
            });

            it('should handle null obj', () => {
                expect(manager.getValueByKey(null, 'a')).toBe('a');
            });

            it('should handle empty key', () => {
                expect(manager.getValueByKey({ a: 1 }, '')).toBe('');
            });
        });

        describe('replaceParams', () => {
            it('should replace params in text', () => {
                const result = manager.replaceParams('Hello {name}', { name: 'World' });
                expect(result).toBe('Hello World');
            });

            it('should keep unmatched params', () => {
                const result = manager.replaceParams('Hello {name}', {});
                expect(result).toBe('Hello {name}');
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
                localStorage.setItem('workflow_language', JSON.stringify('en-US'));
                const m = new I18nManager();
                expect(m.getLanguage()).toBe('en-US');
                localStorage.removeItem('workflow_language');
            });

            it('should ignore invalid stored language', () => {
                localStorage.setItem('workflow_language', JSON.stringify('fr-FR'));
                const m = new I18nManager();
                expect(m.getLanguage()).toBe('zh-CN');
                localStorage.removeItem('workflow_language');
            });
        });

        describe('saveToStorage', () => {
            it('should save language to localStorage', () => {
                manager.setLanguage('en-US');
                expect(localStorage.getItem('workflow_language')).toBe(JSON.stringify('en-US'));
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
                const badListener = jest.fn(() => {
                    throw new Error('listener error');
                });
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
        });

        describe('isSupported', () => {
            it('should return true for supported languages', () => {
                expect(manager.isSupported('zh-CN')).toBe(true);
                expect(manager.isSupported('en-US')).toBe(true);
            });

            it('should return false for unsupported languages', () => {
                expect(manager.isSupported('fr-FR')).toBe(false);
            });
        });

        describe('getSupportedLanguages', () => {
            it('should return copy of supported languages', () => {
                const langs = manager.getSupportedLanguages();
                expect(langs).toEqual(SUPPORTED_LANGUAGES);
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
