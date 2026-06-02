/**
 * 页面导航模块 - 提供更友好的页面切换体验
 */

const PAGES = {
    MANAGER: '/',
    CONVERTER: '/converter',
    EDITOR: '/editor'
};

let isNavigating = false;

/**
 * 导航到指定页面
 * @param {string} url - 目标页面 URL
 * @param {object} options - 导航选项
 * @param {boolean} options.animate - 是否显示动画（默认 true）
 * @param {string} options.message - 跳转前提示消息
 */
export function navigateTo(url, options = {}) {
    const { animate = true, message = null } = options;
    
    if (isNavigating) return;
    if (window.location.pathname === url) return;
    
    isNavigating = true;
    
    // 如果有提示消息，先显示
    if (message) {
        console.log(message);
    }
    
    // 添加页面切换动画
    if (animate) {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.3s ease-out';
    }
    
    // 延迟跳转以显示动画
    setTimeout(() => {
        window.location.href = url;
    }, animate ? 300 : 0);
}

/**
 * 返回上一页
 */
export function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        navigateTo(PAGES.MANAGER);
    }
}

/**
 * 导航到工作流管理页面
 */
export function goToManager() {
    navigateTo(PAGES.MANAGER, { message: '正在返回工作流管理...' });
}

/**
 * 导航到转换器页面
 */
export function goToConverter() {
    navigateTo(PAGES.CONVERTER, { message: '正在打开转换器...' });
}

/**
 * 导航到编辑器页面
 */
export function goToEditor() {
    navigateTo(PAGES.EDITOR, { message: '正在打开编辑器...' });
}

/**
 * 恢复页面透明度
 */
function restoreOpacity() {
    document.body.style.opacity = '1';
    document.body.style.transition = 'opacity 0.3s ease-in';
    isNavigating = false;
}

/**
 * 初始化导航模块
 */
export function initNavigator() {
    // 页面加载完成后恢复透明度
    document.addEventListener('DOMContentLoaded', restoreOpacity);
    
    // 处理浏览器后退/前进时页面从缓存恢复的情况
    // pageshow 事件在页面显示时触发，包括从缓存恢复
    window.addEventListener('pageshow', (event) => {
        // persisted 表示页面是从缓存中恢复的
        if (event.persisted || isNavigating) {
            restoreOpacity();
        }
    });
    
    // 处理 popstate 事件（浏览器后退/前进）
    window.addEventListener('popstate', restoreOpacity);
}

// 自初始化 - 确保无论哪个页面加载都会正确处理透明度
// 监听 DOMContentLoaded 和 pageshow 事件
document.addEventListener('DOMContentLoaded', restoreOpacity);
window.addEventListener('pageshow', (event) => {
    if (event.persisted || isNavigating) {
        restoreOpacity();
    }
});
window.addEventListener('popstate', restoreOpacity);