// @ts-nocheck
/**
 * 国际化 UI 控制器模块
 * 处理语言切换 UI 和页面文本更新
 */

import { i18n, setLanguage, getLanguage, SUPPORTED_LANGUAGES } from '../i18n/i18n.js';
import { updateThemeButtonText } from './theme-controller.js';

/**
 * 国际化控制器类
 */
export class I18nController {
    /**
     * 构造函数
     */
    constructor() {
        this.elements = {};
        this.cachedElements = {
            i18nElements: null,
            placeholderElements: null,
            titleElement: null
        };
        this.updateTimeout = null;
        this.isUpdating = false;
        this.currentLang = null;
    }

    /**
     * 初始化国际化控制器
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.currentLang = getLanguage();
        this.updateLanguageButton();
        this.updatePageTexts();
        
        // 添加语言变化监听器
        i18n.addListener((lang) => this.handleLanguageChange(lang));
    }

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        this.elements.languageBtn = document.getElementById('languageBtn');
        // 缓存标题元素
        this.cachedElements.titleElement = document.querySelector('h1');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        if (this.elements.languageBtn) {
            this.elements.languageBtn.addEventListener('click', () => this.toggleLanguage());
        }
    }

    /**
     * 切换语言
     */
    toggleLanguage() {
        // 如果正在更新，直接返回
        if (this.isUpdating) return;
        
        const currentLang = getLanguage();
        const nextLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
        setLanguage(nextLang);
    }

    /**
     * 更新语言按钮显示
     */
    updateLanguageButton() {
        if (!this.elements.languageBtn) return;
        
        const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === this.currentLang);
        
        if (langInfo) {
            const icon = this.currentLang === 'zh-CN' ? 'US' : 'CN';
            const text = this.currentLang === 'zh-CN' ? 'English' : '中文';
            this.elements.languageBtn.textContent = icon + ' ' + text;
            this.elements.languageBtn.title = this.currentLang === 'zh-CN' ? 'Switch to English' : '切换到中文';
        }
    }

    /**
     * 更新页面所有文本（带防抖优化）
     */
    updatePageTexts() {
        // 如果有待执行的更新，先取消
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            this.doUpdatePageTexts();
            this.updateTimeout = null;
        }, 100);
    }

    /**
     * 实际执行页面文本更新（使用 requestAnimationFrame 优化）
     */
    doUpdatePageTexts() {
        // 设置更新标志
        this.isUpdating = true;

        requestAnimationFrame(() => {
            this.performUpdate();
            this.isUpdating = false;
        });
    }

    /**
     * 执行实际的更新操作
     */
    performUpdate() {
        // 每次都重新查询元素，确保新添加的元素也能被更新
        const i18nElements = document.querySelectorAll('[data-i18n]');
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        const titleElements = document.querySelectorAll('[data-i18n-title]');

        // 更新带有 data-i18n 属性的元素（跳过主题按钮）
        const i18nLen = i18nElements.length;
        for (let i = 0; i < i18nLen; i++) {
            const el = i18nElements[i];
            // 跳过主题按钮，它的文本由主题控制器管理
            if (el.id === 'themeBtn') {
                continue;
            }
            
            const key = el.getAttribute('data-i18n');
            if (key) {
                const text = i18n.t(key);
                if (text !== key && el.textContent !== text) {
                    el.textContent = text;
                }
            }
        }

        // 更新带有 data-i18n-placeholder 属性的元素
        const placeholderLen = placeholderElements.length;
        for (let i = 0; i < placeholderLen; i++) {
            const el = placeholderElements[i];
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const text = i18n.t(key);
                if (text !== key && el.placeholder !== text) {
                    el.placeholder = text;
                }
            }
        }

        // 更新带有 data-i18n-title 属性的元素
        const titleLen = titleElements.length;
        for (let i = 0; i < titleLen; i++) {
            const el = titleElements[i];
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const text = i18n.t(key);
                if (text !== key && el.title !== text) {
                    el.title = text;
                }
            }
        }

        // 更新 HTML lang 属性
        document.documentElement.lang = this.currentLang;
    }

    /**
     * 处理语言变化事件
     */
    handleLanguageChange(lang) {
        // 更新缓存的语言
        this.currentLang = lang;
        
        // 更新语言按钮（立即更新）
        this.updateLanguageButton();
        
        // 更新页面文本（防抖）
        this.updatePageTexts();
        
        // 更新主题按钮文本
        updateThemeButtonText();
    }
}

/**
 * 创建并初始化国际化控制器
 */
export function initI18nController() {
    const controller = new I18nController();
    controller.init();
    return controller;
}