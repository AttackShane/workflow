// @ts-nocheck
import { APP_CONFIG } from '../config/constants.js';
import { DOM, Storage } from '../utils/helpers.js';
import { Logger } from '../utils/logger.js';

let elements = {};
let currentFontSize = Storage.get(APP_CONFIG.THEME.FONT_SIZE_KEY, APP_CONFIG.THEME.DEFAULT_FONT_SIZE);
let currentTheme = null;
let storageTimeout = null;

let themeTextCache = {
    light: '☀️ 浅色模式',
    dark: '🌙 深色模式'
};

export function initThemeController() {
    elements = {
        themeBtn: DOM.get('themeBtn'),
        fontSizeDisplay: DOM.get('fontSizeDisplay'),
        fontSmallBtn: DOM.get('fontSmallBtn'),
        fontLargeBtn: DOM.get('fontLargeBtn'),
        outputArea: DOM.get('outputArea'),
        lineNumbers: DOM.get('lineNumbers'),
        lineNumbersToggle: DOM.get('lineNumbersToggle'),
    };

    currentTheme = Storage.get(APP_CONFIG.THEME.KEY, APP_CONFIG.THEME.DEFAULT);
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    DOM.setText(elements.themeBtn, currentTheme === 'dark' ? themeTextCache.light : themeTextCache.dark);

    updateFontSize();

    const showLineNumbers = Storage.get('workflow-converter-linenumbers', 'true') === 'true';
    DOM.setAttr(elements.lineNumbersToggle, 'checked', showLineNumbers);
    DOM.setStyle(elements.lineNumbers, 'display', showLineNumbers ? 'block' : 'none');

    DOM.on(elements.themeBtn, 'click', toggleTheme);
    DOM.on(elements.fontSmallBtn, 'click', decreaseFontSize);
    DOM.on(elements.fontLargeBtn, 'click', increaseFontSize);
    DOM.on(elements.lineNumbersToggle, 'change', toggleLineNumbers);
    
    loadTranslations();
}

async function loadTranslations() {
    try {
        const { t } = await import('../i18n/i18n.js');
        themeTextCache.light = t('converter.themeLight');
        themeTextCache.dark = t('converter.themeDark');
        
        if (elements.themeBtn) {
            DOM.setText(elements.themeBtn, currentTheme === 'dark' ? themeTextCache.light : themeTextCache.dark);
        }
    } catch (e) {
        Logger.warn('Failed to load translations:', e);
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    currentTheme = newTheme;
    
    document.documentElement.setAttribute('data-theme', newTheme);
    DOM.setText(elements.themeBtn, newTheme === 'dark' ? themeTextCache.light : themeTextCache.dark);
    
    saveThemeToStorage(newTheme);
}

function saveThemeToStorage(theme) {
    if (storageTimeout) {
        clearTimeout(storageTimeout);
    }
    
    storageTimeout = setTimeout(() => {
        try {
            Storage.set(APP_CONFIG.THEME.KEY, theme);
        } catch (e) {
            Logger.warn('Failed to save theme:', e);
        }
        storageTimeout = null;
    }, 500);
}

export function updateThemeButtonText() {
    if (!elements.themeBtn) return;
    loadTranslations();
}

function updateFontSize() {
    const lineHeight = currentFontSize * 1.5;
    
    document.documentElement.style.setProperty('--code-font-size', `${currentFontSize}px`);
    document.documentElement.style.setProperty('--code-line-height', `${lineHeight}px`);
    
    const lineNumbersWidth = APP_CONFIG.LINE_NUMBERS.WIDTH_CALC(currentFontSize);
    DOM.setStyle(elements.lineNumbers, 'width', `${lineNumbersWidth}px`);
    DOM.setStyle(elements.lineNumbers, 'minWidth', `${lineNumbersWidth}px`);
    
    const event = new CustomEvent('fontsizechange', { 
        detail: { fontSize: currentFontSize, lineHeight: lineHeight } 
    });
    document.dispatchEvent(event);
    
    DOM.setText(elements.fontSizeDisplay, `${currentFontSize}px`);
    Storage.set(APP_CONFIG.THEME.FONT_SIZE_KEY, currentFontSize);
}

function decreaseFontSize() {
    if (currentFontSize > APP_CONFIG.THEME.FONT_SIZE_MIN) {
        currentFontSize -= APP_CONFIG.THEME.FONT_SIZE_STEP;
        updateFontSize();
    }
}

function increaseFontSize() {
    if (currentFontSize < APP_CONFIG.THEME.FONT_SIZE_MAX) {
        currentFontSize += APP_CONFIG.THEME.FONT_SIZE_STEP;
        updateFontSize();
    }
}

function toggleLineNumbers() {
    const show = elements.lineNumbersToggle.checked;
    DOM.setStyle(elements.lineNumbers, 'display', show ? 'block' : 'none');
    Storage.set('workflow-converter-linenumbers', show.toString());
}