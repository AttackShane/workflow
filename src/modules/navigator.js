/**
 * 页面导航模块 - 提供更友好的页面切换体验
 */

import { Logger } from '../utils/logger.js';

const PAGES = {
    MANAGER: '/',
    CONVERTER: '/converter',
    EDITOR: '/editor'
};

let isNavigating = false;

let tFn = null;

function t(key, fallback) {
    try {
        return (tFn && tFn(key)) || fallback;
    } catch {
        return fallback;
    }
}

async function loadI18n() {
    try {
        const m = await import('../i18n/i18n.js');
        tFn = m.t || m.default?.t;
    } catch {
        tFn = null;
    }
}
loadI18n();

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
        Logger.info(message);
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
    navigateTo(PAGES.MANAGER, { message: t('navigator.goingManager', '正在返回工作流管理...') });
}

/**
 * 导航到转换器页面
 */
export function goToConverter() {
    navigateTo(PAGES.CONVERTER, { message: t('navigator.goingConverter', '正在打开转换器...') });
}

/**
 * 导航到编辑器页面
 */
export function goToEditor() {
    navigateTo(PAGES.EDITOR, { message: t('navigator.goingEditor', '正在打开编辑器...') });
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
 * 初始化导航模块（只调用一次）
 */
export function initNavigator() {
    // 页面加载完成后恢复透明度
    document.addEventListener('DOMContentLoaded', restoreOpacity);
    
    // 处理浏览器后退/前进时页面从缓存恢复的情况
    window.addEventListener('pageshow', (event) => {
        if (event.persisted || isNavigating) {
            restoreOpacity();
        }
    });
    
    // 处理 popstate 事件（浏览器后退/前进）
    window.addEventListener('popstate', restoreOpacity);
}

// 自初始化
initNavigator();