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
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(document, 'keydown', (e) => this.handleKeydown(e));

        DOM.on(DOM.get('navConverterBtn'), 'click', () => {
            sessionStorage.removeItem('editingWorkflowId');
            sessionStorage.removeItem('savedWorkflow');
            sessionStorage.removeItem('savedWorkflowName');
            sessionStorage.removeItem('savedWorkflowDesc');
            goToConverter();
        });
        DOM.on(DOM.get('navManagerBtn'), 'click', () => {
            if (!sessionStorage.getItem('savedWorkflow')) {
                sessionStorage.removeItem('editingWorkflowId');
            }
            goToManager();
        });
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