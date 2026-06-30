import { DOM } from '../utils/helpers.js';
import { goToConverter, goToManager } from './navigator.js';

/**
 * 键盘快捷键模块
 * 负责所有键盘事件绑定和快捷键分发
 */
export class WorkflowKeyboard {
    /**
     * @param {import('./workflow-ui.js').WorkflowUI} ui
     */
    constructor(ui) {
        this.ui = ui;
        this._keydownHandler = null;
        this._navConverterHandler = null;
        this._navManagerHandler = null;
        this._beforeUnloadHandler = null;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this._keydownHandler = (e) => this.handleKeydown(e);
        DOM.on(document, 'keydown', this._keydownHandler);

        this._navConverterHandler = () => {
            sessionStorage.removeItem('editingWorkflowId');
            sessionStorage.removeItem('savedWorkflow');
            sessionStorage.removeItem('savedWorkflowName');
            sessionStorage.removeItem('savedWorkflowDesc');
            goToConverter();
        };
        DOM.on(DOM.get('navConverterBtn'), 'click', this._navConverterHandler);

        this._navManagerHandler = () => {
            if (!sessionStorage.getItem('savedWorkflow')) {
                sessionStorage.removeItem('editingWorkflowId');
            }
            goToManager();
        };
        DOM.on(DOM.get('navManagerBtn'), 'click', this._navManagerHandler);

        this._beforeUnloadHandler = () => this.destroy();
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    }

    /**
     * 移除事件监听器
     */
    destroy() {
        if (this._keydownHandler) {
            DOM.off(document, 'keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        if (this._navConverterHandler) {
            DOM.off(DOM.get('navConverterBtn'), 'click', this._navConverterHandler);
            this._navConverterHandler = null;
        }
        if (this._navManagerHandler) {
            DOM.off(DOM.get('navManagerBtn'), 'click', this._navManagerHandler);
            this._navManagerHandler = null;
        }
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleKeydown(e) {
        const activeEl = document.activeElement;
        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';
        const isContentEditable = activeEl.isContentEditable;
        const isModalOpen = document.querySelector('.node-editor-modal') !== null;

        if (isModalOpen || isInput || isContentEditable) {
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.ui.selection.deleteSelected();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            this.ui.clipboard.copy();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            this.ui.clipboard.paste();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            this.ui.selection.duplicateSelected();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.ui.selection.selectAll();
        }

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            this.ui.history.undo();
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            this.ui.history.redo();
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this.ui.confirmExit();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.ui.quickSave();
        }
    }
}