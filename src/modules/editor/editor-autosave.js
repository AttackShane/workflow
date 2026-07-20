/**
 * 工作流自动保存模块
 * 负责定时自动保存和手动保存
 */
import { t } from '../../i18n/i18n.js';

export class WorkflowAutoSave {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui - 主 UI 实例
     */
    constructor(ui) {
        this.ui = ui;
        this._lastAutoSaveTime = 0;
        this._autoSaveIndicatorTimer = null;
        this.autoSaveTimer = null;
    }

    /**
     * 更新自动保存指示器文本
     */
    _updateAutoSaveIndicator() {
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
    }

    /**
     * 启动自动保存
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.ui.core.nodes.length > 0) {
                this.ui.core.saveToLocalStorage();
                this._lastAutoSaveTime = Date.now();
                this._updateAutoSaveIndicator();
            }
        }, 5000);

        this._autoSaveIndicatorTimer = setInterval(() => {
            this._updateAutoSaveIndicator();
        }, 10000);
    }

    /**
     * 停止自动保存
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        if (this._autoSaveIndicatorTimer) {
            clearInterval(this._autoSaveIndicatorTimer);
            this._autoSaveIndicatorTimer = null;
        }
    }

    /**
     * 销毁
     */
    destroy() {
        this.stopAutoSave();
    }

    /**
     * 手动保存工作流
     */
    saveWorkflow() {
        const success = this.ui.core.saveToLocalStorage();
        if (success) {
            this._lastAutoSaveTime = Date.now();
            this._updateAutoSaveIndicator();
            this.ui.showMessage(t('messages.workflowSaved'), 'success');
        } else {
            this.ui.showMessage(t('messages.saveFailed'), 'error');
        }
    }

    /**
     * 清除保存的工作流
     */
    clearSavedWorkflow() {
        this.ui.core.clearSavedWorkflow();
        this.ui.showMessage(t('messages.savedWorkflowCleared'), 'success');
    }
}
