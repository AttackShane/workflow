import { initThemeController } from './shared-theme.js';
import { initI18nController } from './shared-i18n.js';
// 导入导航模块（模块加载时自动初始化事件监听器）
import './shared-navigator.js';

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

/**
 * 恢复页面可见性（淡入动画，与 navigateTo 淡出对称）
 * 使用 Web Animations API 替代 CSS transition，
 * 因为 CSS transition 依赖浏览器跨帧绘制，在首帧前全部回调挤在同一帧，过渡不触发。
 * animate() 直接创建独立动画，不依赖帧时序。
 */
function restorePageVisibility() {
    requestAnimationFrame(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        document.documentElement.style.backgroundColor = theme === 'dark' ? '#0a0e17' : '#f1f5f9';

        document.body.classList.remove('preload');

        document.body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    });
}

// 在所有页面上立即初始化 i18n 和 theme
// 模块脚本延迟执行，此时 DOM 已就绪，无需等待 DOMContentLoaded
// 必须在编辑器内联脚本之前执行，确保页面首次渲染时主题已正确应用
initI18nController();
initThemeController();

document.addEventListener('DOMContentLoaded', () => {
    // 检查当前页面类型并初始化对应的模块
    const h1Element = document.querySelector('h1');
    const h1Text = h1Element ? h1Element.textContent.toLowerCase() : '';

    const _v = Date.now();
    if (h1Text && (h1Text.includes('转换器') || h1Text.includes('converter'))) {
        Promise.all([
            import(`./converter-ui.js?v=${_v}`).then((m) => m.initUI()),
            import(`./converter-keyboard.js?v=${_v}`).then((m) => m.initKeyboardShortcuts()),
            import(`./converter-stats.js?v=${_v}`)
                .then((m) => m.initHistoryPanel())
                .catch((e) => console.error('加载统计视图失败:', e)),
            import(`./shared-graph.js?v=${_v}`)
                .then((m) => m.initGraphModal())
                .catch((e) => console.error('加载图形视图失败:', e)),
        ])
            .then(() => {
                restorePageVisibility();
            })
            .catch((e) => {
                console.error('加载页面功能失败:', e);
                showErrorBanner('页面功能加载失败，请刷新页面重试');
                restorePageVisibility();
            });
    } else if (h1Text && (h1Text.includes('工作流管理') || h1Text.includes('workflow manager'))) {
        import(`./manager-core.js?v=${_v}`)
            .then((m) => {
                const manager = new m.WorkflowManager();
                manager.init();
                restorePageVisibility();
            })
            .catch((e) => {
                console.error('加载工作流管理器失败:', e);
                showErrorBanner('工作流管理器加载失败，请刷新页面重试');
                restorePageVisibility();
            });
    } else {
        // 编辑器页面：由内联 <script> 同步初始化，延迟到下一帧显示
        // 其他未知页面：直接显示
        restorePageVisibility();
    }
    // 编辑器页面由内联 <script> 初始化，不在此处理
});
