import { APP_CONFIG } from '../config/constants.js';
import { DOM, Storage } from '../utils/helpers.js';

let elements = {};
let currentFontSize = Storage.get(APP_CONFIG.THEME.FONT_SIZE_KEY, APP_CONFIG.THEME.DEFAULT_FONT_SIZE);

/**
 * 初始化主题控制器
 */
export function initThemeController() {
    // 获取 DOM 元素
    elements = {
        themeBtn: DOM.get('themeBtn'),
        fontSizeDisplay: DOM.get('fontSizeDisplay'),
        fontSmallBtn: DOM.get('fontSmallBtn'),
        fontLargeBtn: DOM.get('fontLargeBtn'),
        outputArea: DOM.get('outputArea'),
        lineNumbers: DOM.get('lineNumbers'),
        lineNumbersToggle: DOM.get('lineNumbersToggle'),
    };

    // 加载保存的主题
    const savedTheme = Storage.get(APP_CONFIG.THEME.KEY, APP_CONFIG.THEME.DEFAULT);
    document.documentElement.setAttribute('data-theme', savedTheme);
    DOM.setText(elements.themeBtn, savedTheme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式');

    // 更新字体大小
    updateFontSize();

    // 恢复行号显示状态
    const showLineNumbers = Storage.get('workflow-converter-linenumbers', 'true') === 'true';
    DOM.setAttr(elements.lineNumbersToggle, 'checked', showLineNumbers);
    DOM.setStyle(elements.lineNumbers, 'display', showLineNumbers ? 'block' : 'none');

    // 绑定事件
    DOM.on(elements.themeBtn, 'click', toggleTheme);
    DOM.on(elements.fontSmallBtn, 'click', decreaseFontSize);
    DOM.on(elements.fontLargeBtn, 'click', increaseFontSize);
    DOM.on(elements.lineNumbersToggle, 'change', toggleLineNumbers);
}

/**
 * 切换主题
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    Storage.set(APP_CONFIG.THEME.KEY, newTheme);
    DOM.setText(elements.themeBtn, newTheme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式');
}

/**
 * 更新字体大小显示
 */
function updateFontSize() {
    const lineHeight = currentFontSize * 1.5; // 保持 line-height 为 font-size 的 1.5 倍
    
    // 使用 CSS 变量更新字体大小和行高
    document.documentElement.style.setProperty('--code-font-size', `${currentFontSize}px`);
    document.documentElement.style.setProperty('--code-line-height', `${lineHeight}px`);
    
    // 触发自定义事件通知其他模块字体大小变化
    const event = new CustomEvent('fontsizechange', { 
        detail: { fontSize: currentFontSize, lineHeight: lineHeight } 
    });
    document.dispatchEvent(event);
    
    DOM.setText(elements.fontSizeDisplay, `${currentFontSize}px`);
    Storage.set(APP_CONFIG.THEME.FONT_SIZE_KEY, currentFontSize);
}

/**
 * 减小字体大小
 */
function decreaseFontSize() {
    if (currentFontSize > 10) {
        currentFontSize--;
        updateFontSize();
    }
}

/**
 * 增大字体大小
 */
function increaseFontSize() {
    if (currentFontSize < 24) {
        currentFontSize++;
        updateFontSize();
    }
}

/**
 * 切换行号显示
 */
function toggleLineNumbers() {
    const show = elements.lineNumbersToggle.checked;
    DOM.setStyle(elements.lineNumbers, 'display', show ? 'block' : 'none');
    Storage.set('workflow-converter-linenumbers', show.toString());
}