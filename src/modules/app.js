import { initThemeController } from './theme-controller.js';
import { initI18nController } from './i18n-controller.js';
// 导入导航模块（模块加载时自动初始化事件监听器）
import './navigator.js';

document.addEventListener('DOMContentLoaded', () => {
    // 在所有页面上都初始化 i18n 和 theme
    initI18nController();
    initThemeController();
    
    // 检查当前页面类型并初始化对应的模块
    const h1Element = document.querySelector('h1');
    const h1Text = h1Element ? h1Element.textContent.toLowerCase() : '';
    
    if (h1Text && (h1Text.includes('转换器') || h1Text.includes('converter'))) {
        // 转换器页面
        import('./ui-controller.js').then(m => m.initUI());
        import('./converter-keyboard.js').then(m => m.initKeyboardShortcuts());
        import('./stats-view.js').then(m => m.initHistoryPanel());
        import('./graph-view.js').then(m => m.initGraphModal());
    } else if (h1Text && (h1Text.includes('工作流管理') || h1Text.includes('workflow manager'))) {
        // 工作流管理器页面
        import('./workflow-manager.js').then(m => {
            const manager = new m.WorkflowManager();
            manager.init();
        });
    }
    // 编辑器页面由内联 <script> 初始化，不在此处理
});