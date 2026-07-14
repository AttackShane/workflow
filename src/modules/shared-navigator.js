/**
 * 页面导航模块 - 提供更友好的页面切换体验
 */

import { Logger } from '../utils/logger.js';
import { Storage } from '../utils/helpers.js';

const PAGES = {
    MANAGER: '/',
    CONVERTER: '/converter',
    EDITOR: '/editor',
};

class Navigator {
    constructor() {
        this._isNavigating = false;
        this._tFn = null;
        if (typeof window !== 'undefined') {
            window.addEventListener('pageshow', () => this._restoreOpacity());
        }
    }

    _navT(key, fallback) {
        try {
            return (this._tFn && this._tFn(key)) || fallback;
        } catch {
            return fallback;
        }
    }

    async _loadI18n() {
        try {
            // @ts-ignore - i18n 是运行时全局变量
            if (typeof i18n !== 'undefined' && i18n.t) {
                // @ts-ignore
                this._tFn = (key) => i18n.t(key);
                return;
            }
            const m = await import('../i18n/i18n.js');
            this._tFn = m.t || /** @type {any} */ (m).default?.t;
        } catch {
            this._tFn = null;
        }
    }

    /**
     * 导航到指定页面
     * @param {string} url - 目标页面 URL
     * @param {object} [options] - 导航选项
     * @param {boolean} [options.animate] - 是否显示动画（默认 true）
     * @param {string} [options.message] - 跳转前提示消息
     */
    navigateTo = (url, options = {}) => {
        const { animate = true, message = null } = options;

        if (this._isNavigating) return;
        if (window.location.pathname === url) return;

        this._isNavigating = true;

        if (message) {
            Logger.info(message);
        }

        if (animate) {
            const theme = document.documentElement.getAttribute('data-theme');
            document.documentElement.style.backgroundColor = theme === 'dark' ? '#0a0e17' : '#f1f5f9';
            document.body.style.transition = 'opacity 0.2s ease-out';
            document.body.style.opacity = '0';
        }

        setTimeout(
            () => {
                window.location.href = url;
            },
            animate ? 200 : 0
        );
    };

    /**
     * 返回上一页
     */
    goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.navigateTo(PAGES.MANAGER);
        }
    };

    /**
     * 导航到工作流管理页面
     */
    goToManager = () => {
        this.navigateTo(PAGES.MANAGER, { message: this._navT('navigator.goingManager', '正在返回工作流管理...') });
    };

    /**
     * 导航到转换器页面
     */
    goToConverter = () => {
        this.navigateTo(PAGES.CONVERTER, { message: this._navT('navigator.goingConverter', '正在打开转换器...') });
    };

    /**
     * 导航到编辑器页面
     * @param {Object} options - 选项
     * @param {boolean} [options.newWorkflow=false] - 是否新建空工作流（清除缓存）
     */
    goToEditor = (options = {}) => {
        const { newWorkflow = false } = options;
        if (newWorkflow) {
            Storage.session.remove('editingWorkflowId');
            Storage.session.remove('editingWorkflow');
            Storage.remove('workflow_current');
        }
        this.navigateTo(PAGES.EDITOR, { message: this._navT('navigator.goingEditor', '正在打开编辑器...') });
    };

    /**
     * 恢复页面状态（仅用于 bfcache 恢复）
     */
    _restoreOpacity = () => {
        document.body.style.opacity = '';
        document.body.style.transition = '';
        this._isNavigating = false;
    };

    /**
     * 初始化导航模块（只调用一次）
     */
    initNavigator = () => {
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this._restoreOpacity();
            }
        });
    };
}

const _instance = new Navigator();
if (typeof window !== 'undefined') {
    _instance._loadI18n();
}

// @ts-ignore
export const navigateTo = (...args) => _instance.navigateTo(...args);
// @ts-ignore
export const goBack = (...args) => _instance.goBack(...args);
// @ts-ignore
export const goToManager = (...args) => _instance.goToManager(...args);
// @ts-ignore
export const goToConverter = (...args) => _instance.goToConverter(...args);
// @ts-ignore
export const goToEditor = (...args) => _instance.goToEditor(...args);
// @ts-ignore
export const initNavigator = (...args) => _instance.initNavigator(...args);
