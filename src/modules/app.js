import { initThemeController } from './theme-controller.js';
import { initI18nController } from './i18n-controller.js';
// 导入导航模块（模块加载时自动初始化事件监听器）
import './navigator.js';

document.addEventListener('DOMContentLoaded', () => {
    // 在所有页面上都初始化 i18n 和 theme
    initI18nController();
    initThemeController();
    
    // 检查是否是转换器页面
    const h1Element = document.querySelector('h1');
    if (h1Element && (h1Element.textContent.includes('转换器') || h1Element.textContent.includes('Workflow Converter'))) {
        // 动态导入转换器特定的模块
        import('./ui-controller.js').then(m => m.initUI());
        import('./keyboard-shortcuts.js').then(m => m.initKeyboardShortcuts());
        import('./stats-view.js').then(m => m.initHistoryPanel());
        import('./graph-view.js').then(m => m.initGraphModal());
    }
});