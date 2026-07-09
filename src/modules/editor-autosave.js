// @ts-nocheck
/**
 * 工作流自动保存模块
 * 负责定时自动保存和手动保存
 */
import { t } from '../i18n/i18n.js';

/**
 * 自动保存相关的 mixin 方法
 * @param {import('./editor-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinAutoSave(ui) {
    ui._lastAutoSaveTime = 0;
    ui._autoSaveIndicatorTimer = null;

    ui._updateAutoSaveIndicator = function() {
        const el = document.getElementById('autosaveIndicator');
        if (!el) return;
        if (!this._lastAutoSaveTime) {
            el.style.display = 'none';
            return;
        }
        const elapsed = Math.floor((Date.now() - this._lastAutoSaveTime) / 1000);
        let text;
        if (elapsed < 10) {
            text = t('editor.savedJustNow');
        } else if (elapsed < 60) {
            text = t('editor.savedSecondsAgo', { seconds: elapsed });
        } else if (elapsed < 3600) {
            text = t('editor.savedMinutesAgo', { minutes: Math.floor(elapsed / 60) });
        } else {
            text = t('editor.savedHoursAgo', { hours: Math.floor(elapsed / 3600) });
        }
        el.textContent = text;
        el.style.display = '';
    };

    /**
     * 启动自动保存
     */
    ui.startAutoSave = function() {
        this.autoSaveTimer = setInterval(() => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
                this.markSaved();
                this._lastAutoSaveTime = Date.now();
                this._updateAutoSaveIndicator();
            }
        }, 5000);

        this._autoSaveIndicatorTimer = setInterval(() => {
            this._updateAutoSaveIndicator();
        }, 10000);

        this.beforeUnloadHandler = () => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
            }
        };
        this.beforeUnloadCheckHandler = (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        window.addEventListener('beforeunload', this.beforeUnloadCheckHandler);
    };

    /**
     * 停止自动保存
     */
    ui.stopAutoSave = function() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        if (this._autoSaveIndicatorTimer) {
            clearInterval(this._autoSaveIndicatorTimer);
            this._autoSaveIndicatorTimer = null;
        }
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
        if (this.beforeUnloadCheckHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadCheckHandler);
            this.beforeUnloadCheckHandler = null;
        }
    };

    /**
     * 销毁
     */
    ui.destroy = function() {
        this.stopAutoSave();
    };

    /**
     * 手动保存工作流
     */
    ui.saveWorkflow = function() {
        const success = this.core.saveToLocalStorage();
        if (success) {
            this._lastAutoSaveTime = Date.now();
            this._updateAutoSaveIndicator();
            this.showMessage(t('messages.workflowSaved'), 'success');
        } else {
            this.showMessage(t('messages.saveFailed'), 'error');
        }
    };

    /**
     * 清除保存的工作流
     */
    ui.clearSavedWorkflow = function() {
        this.core.clearSavedWorkflow();
        this.showMessage(t('messages.savedWorkflowCleared'), 'success');
    };
}