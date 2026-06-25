/**
 * 页面导航模块 - 提供更友好的页面切换体验
 */

import { Logger } from '../utils/logger.js';

const PAGES = {
    MANAGER: '/',
    CONVERTER: '/converter',
    EDITOR: '/editor'
};

class Navigator {
    constructor() {
        this._isNavigating = false;
        this._tFn = null;
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
            if (typeof i18n !== 'undefined' && i18n.t) {
                this._tFn = (key) => i18n.t(key);
                return;
            }
            const m = await import('../i18n/i18n.js');
            this._tFn = m.t || m.default?.t;
        } catch {
            this._tFn = null;
        }
    }

    /**
     * 导航到指定页面
     * @param {string} url - 目标页面 URL
     * @param {object} options - 导航选项
     * @param {boolean} options.animate - 是否显示动画（默认 true）
     * @param {string} options.message - 跳转前提示消息
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
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.3s ease-out';
        }

        setTimeout(() => {
            window.location.href = url;
        }, animate ? 300 : 0);
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
            sessionStorage.removeItem('editingWorkflowId');
            sessionStorage.removeItem('editingWorkflow');
            localStorage.removeItem('workflow_current');
        }
        this.navigateTo(PAGES.EDITOR, { message: this._navT('navigator.goingEditor', '正在打开编辑器...') });
    };

    /**
     * 恢复页面透明度
     */
    _restoreOpacity = () => {
        document.body.style.opacity = '1';
        document.body.style.transition = 'opacity 0.3s ease-in';
        this._isNavigating = false;
    };

    /**
     * 初始化导航模块（只调用一次）
     */
    initNavigator = () => {
        document.addEventListener('DOMContentLoaded', this._restoreOpacity);

        window.addEventListener('pageshow', (event) => {
            if (event.persisted || this._isNavigating) {
                this._restoreOpacity();
            }
        });

        window.addEventListener('popstate', this._restoreOpacity);
    };
}

const _instance = new Navigator();
_instance._loadI18n();

export const navigateTo = (...args) => _instance.navigateTo(...args);
export const goBack = (...args) => _instance.goBack(...args);
export const goToManager = (...args) => _instance.goToManager(...args);
export const goToConverter = (...args) => _instance.goToConverter(...args);
export const goToEditor = (...args) => _instance.goToEditor(...args);
export const initNavigator = (...args) => _instance.initNavigator(...args);