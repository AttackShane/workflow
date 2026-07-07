import { APP_CONFIG } from '../config/constants.js';
import { DOM, Storage } from '../utils/helpers.js';
import { Logger } from '../utils/logger.js';
import { t } from '../i18n/i18n.js';

class ThemeController {
    constructor() {
        this._elements = {};
        this._currentFontSize = Storage.get(APP_CONFIG.THEME.FONT_SIZE_KEY, APP_CONFIG.THEME.DEFAULT_FONT_SIZE);
        this._currentTheme = null;
        this._storageTimeout = null;
    }

    initThemeController = () => {
        this._elements = {
            themeBtn: DOM.get('themeBtn'),
            fontSizeDisplay: DOM.get('fontSizeDisplay'),
            fontSmallBtn: DOM.get('fontSmallBtn'),
            fontLargeBtn: DOM.get('fontLargeBtn'),
            outputArea: DOM.get('outputArea'),
            lineNumbers: DOM.get('lineNumbers'),
            lineNumbersToggle: DOM.get('lineNumbersToggle'),
        };

        this._currentTheme = Storage.get(APP_CONFIG.THEME.KEY, APP_CONFIG.THEME.DEFAULT);

        document.documentElement.setAttribute('data-theme', this._currentTheme);

        this._updateThemeButtonText();

        this._updateFontSize();

        const showLineNumbers = Storage.get('workflow-converter-linenumbers', 'true') === 'true';
        DOM.setAttr(this._elements.lineNumbersToggle, 'checked', String(showLineNumbers));
        DOM.setStyle(this._elements.lineNumbers, 'display', showLineNumbers ? 'block' : 'none');

        DOM.on(this._elements.themeBtn, 'click', this._toggleTheme);
        DOM.on(this._elements.fontSmallBtn, 'click', this._decreaseFontSize);
        DOM.on(this._elements.fontLargeBtn, 'click', this._increaseFontSize);
        DOM.on(this._elements.lineNumbersToggle, 'change', this._toggleLineNumbers);
    };

    _updateThemeButtonText() {
        if (!this._elements.themeBtn) return;
        const text = this._currentTheme === 'dark' ? t('converter.themeLight') : t('converter.themeDark');
        DOM.setText(this._elements.themeBtn, text);
    }

    _toggleTheme = () => {
        const newTheme = this._currentTheme === 'dark' ? 'light' : 'dark';

        this._currentTheme = newTheme;

        document.documentElement.setAttribute('data-theme', newTheme);
        DOM.setText(this._elements.themeBtn, newTheme === 'dark' ? t('converter.themeLight') : t('converter.themeDark'));

        this._saveThemeToStorage(newTheme);
    };

    _saveThemeToStorage(theme) {
        if (this._storageTimeout) {
            clearTimeout(this._storageTimeout);
        }

        this._storageTimeout = setTimeout(() => {
            try {
                Storage.set(APP_CONFIG.THEME.KEY, theme);
            } catch (e) {
                Logger.warn('Failed to save theme:', e);
            }
            this._storageTimeout = null;
        }, 500);
    }

    updateThemeButtonText = () => {
        this._updateThemeButtonText();
    };

    _updateFontSize = () => {
        const lineHeight = this._currentFontSize * 1.5;

        document.documentElement.style.setProperty('--code-font-size', `${this._currentFontSize}px`);
        document.documentElement.style.setProperty('--code-line-height', `${lineHeight}px`);

        const lineNumbersWidth = APP_CONFIG.LINE_NUMBERS.WIDTH_CALC(this._currentFontSize);
        DOM.setStyle(this._elements.lineNumbers, 'width', `${lineNumbersWidth}px`);
        DOM.setStyle(this._elements.lineNumbers, 'minWidth', `${lineNumbersWidth}px`);

        const event = new CustomEvent('fontsizechange', {
            detail: { fontSize: this._currentFontSize, lineHeight: lineHeight }
        });
        document.dispatchEvent(event);

        DOM.setText(this._elements.fontSizeDisplay, `${this._currentFontSize}px`);
        Storage.set(APP_CONFIG.THEME.FONT_SIZE_KEY, this._currentFontSize);
    };

    _decreaseFontSize = () => {
        if (this._currentFontSize > APP_CONFIG.THEME.FONT_SIZE_MIN) {
            this._currentFontSize -= APP_CONFIG.THEME.FONT_SIZE_STEP;
            this._updateFontSize();
        }
    };

    _increaseFontSize = () => {
        if (this._currentFontSize < APP_CONFIG.THEME.FONT_SIZE_MAX) {
            this._currentFontSize += APP_CONFIG.THEME.FONT_SIZE_STEP;
            this._updateFontSize();
        }
    };

    _toggleLineNumbers = () => {
        const show = this._elements.lineNumbersToggle.checked;
        DOM.setStyle(this._elements.lineNumbers, 'display', show ? 'block' : 'none');
        Storage.set('workflow-converter-linenumbers', show.toString());
    };
}

const _instance = new ThemeController();
// @ts-ignore
export const initThemeController = (...args) => _instance.initThemeController(...args);
// @ts-ignore
export const updateThemeButtonText = (...args) => _instance.updateThemeButtonText(...args);