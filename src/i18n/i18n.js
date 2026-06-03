/**
 * 国际化管理模块
 * 支持中英文切换，提供统一的翻译接口
 */

import { zhCN } from './zh-CN.js';
import { enUS } from './en-US.js';

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES = [
    { code: 'zh-CN', name: '中文' },
    { code: 'en-US', name: 'English' }
];

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE = 'zh-CN';

/**
 * 语言包映射
 */
const LOCALES = {
    'zh-CN': zhCN,
    'en-US': enUS
};

/**
 * 国际化管理器类
 */
export class I18nManager {
    /**
     * 构造函数
     * @param {string} [language] - 初始语言代码
     */
    constructor(language = DEFAULT_LANGUAGE) {
        this.language = language;
        this.loadFromStorage();
        this.listeners = [];
    }

    /**
     * 获取当前语言
     * @returns {string} 当前语言代码
     */
    getLanguage() {
        return this.language;
    }

    /**
     * 设置语言
     * @param {string} language - 语言代码
     */
    setLanguage(language) {
        if (LOCALES[language]) {
            this.language = language;
            this.saveToStorage();
            this.notifyListeners();
        } else {
            console.warn(`Unsupported language: ${language}`);
        }
    }

    /**
     * 获取翻译文本
     * @param {string} key - 翻译键名，支持点分隔，如 'common.confirm'
     * @param {object} [params] - 参数对象，用于替换模板变量
     * @returns {string} 翻译后的文本
     */
    t(key, params = {}) {
        const locale = LOCALES[this.language] || LOCALES[DEFAULT_LANGUAGE];
        const value = this.getValueByKey(locale, key);
        
        if (typeof value === 'string') {
            return this.replaceParams(value, params);
        }
        
        return key;
    }

    /**
     * 根据键名获取值
     * @param {object} obj - 对象
     * @param {string} key - 键名
     * @returns {*} 值
     */
    getValueByKey(obj, key) {
        if (!obj || !key) return key;
        
        const keys = key.split('.');
        let result = obj;
        
        for (const k of keys) {
            if (result && typeof result === 'object' && k in result) {
                result = result[k];
            } else {
                return key;
            }
        }
        
        return result;
    }

    /**
     * 替换模板参数
     * @param {string} text - 模板文本
     * @param {object} params - 参数对象
     * @returns {string} 替换后的文本
     */
    replaceParams(text, params) {
        if (!text || typeof text !== 'string') return text;
        
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            if (params && params[key] !== undefined) {
                return params[key];
            }
            return match;
        });
    }

    /**
     * 获取当前语言的完整语言包
     * @returns {object} 语言包对象
     */
    getLocale() {
        return LOCALES[this.language] || LOCALES[DEFAULT_LANGUAGE];
    }

    /**
     * 从本地存储加载语言设置
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('workflow_language');
            if (stored && LOCALES[stored]) {
                this.language = stored;
            }
        } catch (e) {
            console.warn('Failed to load language from storage:', e);
        }
    }

    /**
     * 保存语言设置到本地存储
     */
    saveToStorage() {
        try {
            localStorage.setItem('workflow_language', this.language);
        } catch (e) {
            console.warn('Failed to save language to storage:', e);
        }
    }

    /**
     * 添加语言变化监听器
     * @param {Function} listener - 监听器函数
     */
    addListener(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        }
    }

    /**
     * 移除语言变化监听器
     * @param {Function} listener - 监听器函数
     */
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * 通知所有监听器语言已变化
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.language);
            } catch (e) {
                console.warn('Listener error:', e);
            }
        }
    }

    /**
     * 获取语言显示名称
     * @param {string} [language] - 语言代码，默认为当前语言
     * @returns {string} 语言显示名称
     */
    getLanguageName(language = this.language) {
        const lang = SUPPORTED_LANGUAGES.find(l => l.code === language);
        return lang ? lang.name : language;
    }

    /**
     * 检查语言是否支持
     * @param {string} language - 语言代码
     * @returns {boolean} 是否支持
     */
    isSupported(language) {
        return !!LOCALES[language];
    }

    /**
     * 获取支持的语言列表
     * @returns {Array} 语言列表
     */
    getSupportedLanguages() {
        return [...SUPPORTED_LANGUAGES];
    }
}

/**
 * 创建全局国际化实例
 */
export const i18n = new I18nManager();

/**
 * 便捷翻译函数
 * @param {string} key - 翻译键名
 * @param {object} [params] - 参数对象
 * @returns {string} 翻译后的文本
 */
export function t(key, params) {
    return i18n.t(key, params);
}

/**
 * 设置语言的便捷函数
 * @param {string} language - 语言代码
 */
export function setLanguage(language) {
    i18n.setLanguage(language);
}

/**
 * 获取当前语言的便捷函数
 * @returns {string} 当前语言代码
 */
export function getLanguage() {
    return i18n.getLanguage();
}
