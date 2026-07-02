import { initThemeController } from './theme-controller.js';
import { initI18nController } from './i18n-controller.js';
// 导入导航模块（模块加载时自动初始化事件监听器）
import './navigator.js';

/**
 * 显示用户可见的错误横幅
 * @param {string} message - 错误消息
 */
function showErrorBanner(message) {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #FEE2E2;
        color: #991B1B;
        padding: 12px 24px;
        text-align: center;
        font-size: 14px;
        z-index: 99999;
        border-bottom: 2px solid #EF4444;
        animation: slideDown 0.3s ease;
    `;
    banner.textContent = message;
    document.body.prepend(banner);
    setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.5s ease';
        setTimeout(() => banner.remove(), 500);
    }, 8000);
}

document.addEventListener('DOMContentLoaded', () => {
    // 在所有页面上都初始化 i18n 和 theme
    initI18nController();
    initThemeController();
    
    // 检查当前页面类型并初始化对应的模块
    const h1Element = document.querySelector('h1');
    const h1Text = h1Element ? h1Element.textContent.toLowerCase() : '';
    
    const _v = Date.now();
    if (h1Text && (h1Text.includes('转换器') || h1Text.includes('converter'))) {
        import(`./ui-controller.js?v=${_v}`).then(m => m.initUI()).catch(e => { console.error('加载 UI 控制器失败:', e); showErrorBanner('页面功能加载失败，请刷新页面重试'); });
        import(`./converter-keyboard.js?v=${_v}`).then(m => m.initKeyboardShortcuts()).catch(e => { console.error('加载键盘快捷键失败:', e); showErrorBanner('快捷键功能加载失败，请刷新页面重试'); });
        import(`./stats-view.js?v=${_v}`).then(m => m.initHistoryPanel()).catch(e => console.error('加载统计视图失败:', e));
        import(`./graph-view.js?v=${_v}`).then(m => m.initGraphModal()).catch(e => console.error('加载图形视图失败:', e));
    } else if (h1Text && (h1Text.includes('工作流管理') || h1Text.includes('workflow manager'))) {
        import(`./workflow-manager.js?v=${_v}`).then(m => {
            const manager = new m.WorkflowManager();
            manager.init();
        }).catch(e => { console.error('加载工作流管理器失败:', e); showErrorBanner('工作流管理器加载失败，请刷新页面重试'); });
    }
    // 编辑器页面由内联 <script> 初始化，不在此处理
});