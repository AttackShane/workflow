import { DOM, Storage } from '../utils/helpers.js';
import { goToConverter, goToManager } from './shared-navigator.js';
import { t } from '../i18n/i18n.js';

const DEFAULT_SHORTCUTS = {
    delete: 'Delete',
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    duplicate: 'Ctrl+D',
    selectAll: 'Ctrl+A',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    save: 'Ctrl+S',
    search: 'Ctrl+F',
    lock: 'Ctrl+L',
    escape: 'Escape'
};

/**
 * 键盘快捷键模块
 * 负责所有键盘事件绑定和快捷键分发
 */
export class WorkflowKeyboard {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui
     */
    constructor(ui) {
        this.ui = ui;
        this._keydownHandler = null;
        this._navConverterHandler = null;
        this._navManagerHandler = null;
        this._beforeUnloadHandler = null;
        this.shortcuts = this._loadShortcuts();
    }

    _loadShortcuts() {
        const saved = Storage.get('keyboardShortcuts');
        if (saved && typeof saved === 'object') {
            return { ...DEFAULT_SHORTCUTS, ...saved };
        }
        return { ...DEFAULT_SHORTCUTS };
    }

    saveShortcuts(newShortcuts) {
        this.shortcuts = { ...this.shortcuts, ...newShortcuts };
        Storage.set('keyboardShortcuts', this.shortcuts);
    }

    resetShortcuts() {
        this.shortcuts = { ...DEFAULT_SHORTCUTS };
        Storage.remove('keyboardShortcuts');
    }

    getShortcuts() {
        return { ...this.shortcuts };
    }

    parseShortcut(shortcutStr) {
        const parts = shortcutStr.split('+');
        const result = { ctrl: false, shift: false, alt: false, meta: false, key: '' };
        parts.forEach(p => {
            const trimmed = p.trim();
            if (trimmed === 'Ctrl' || trimmed === 'Control') result.ctrl = true;
            else if (trimmed === 'Shift') result.shift = true;
            else if (trimmed === 'Alt') result.alt = true;
            else if (trimmed === 'Meta' || trimmed === 'Cmd') result.meta = true;
            else result.key = trimmed;
        });
        return result;
    }

    matchShortcut(e, shortcutStr) {
        const parsed = this.parseShortcut(shortcutStr);
        if (!parsed.key) return false;
        if (parsed.key.length === 1 && e.key.length === 1) {
            if (e.key.toUpperCase() !== parsed.key.toUpperCase()) return false;
        } else if (e.key !== parsed.key) {
            return false;
        }
        const hasCtrlPressed = parsed.ctrl || parsed.meta;
        const eventHasCtrlPressed = e.ctrlKey || e.metaKey;
        if (hasCtrlPressed !== eventHasCtrlPressed) return false;
        if (parsed.shift !== e.shiftKey) return false;
        if (parsed.alt !== e.altKey) return false;
        return true;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this._keydownHandler = (e) => this.handleKeydown(e);
        DOM.on(/** @type {*} */ (document), 'keydown', this._keydownHandler);

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
            DOM.off(/** @type {*} */ (document), 'keydown', this._keydownHandler);
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
        const isContentEditable = /** @type {HTMLElement} */ (activeEl).isContentEditable;

        if (isInput || isContentEditable) {
            return;
        }

        const s = this.shortcuts;

        if (this.matchShortcut(e, s.delete) || (e.key === 'Backspace' && s.delete === 'Delete')) {
            this.ui.selection.deleteSelected();
        }

        if (e.key === 'Backspace' && s.delete !== 'Backspace') {
            return;
        }

        if (this.matchShortcut(e, s.copy)) {
            e.preventDefault();
            this.ui.clipboard.copy();
        }

        if (this.matchShortcut(e, s.paste)) {
            e.preventDefault();
            this.ui.clipboard.paste();
        }

        if (this.matchShortcut(e, s.duplicate)) {
            e.preventDefault();
            this.ui.selection.duplicateSelected();
        }

        if (this.matchShortcut(e, s.selectAll)) {
            e.preventDefault();
            this.ui.selection.selectAll();
        }

        if (this.matchShortcut(e, s.undo)) {
            e.preventDefault();
            this.ui.history.undo();
        }

        if (this.matchShortcut(e, s.redo)) {
            e.preventDefault();
            this.ui.history.redo();
        }

        if (this.matchShortcut(e, s.escape)) {
            e.preventDefault();
            this.ui.confirmExit();
        }

        if (this.matchShortcut(e, s.save)) {
            e.preventDefault();
            this.ui.quickSave();
        }

        if (this.matchShortcut(e, s.search)) {
            e.preventDefault();
            this.ui.canvas.autoOptimizeLayout();
        }

        if (this.matchShortcut(e, s.lock)) {
            e.preventDefault();
            this.ui.toggleSelectedNodesLock();
        }
    }

    showShortcutSettings() {
        const overlay = document.getElementById('shortcutModalOverlay');
        const body = document.getElementById('shortcutModalBody');
        if (!overlay || !body) return;

        const shortcuts = this.getShortcuts();
        const labels = {
            delete: t('messages.shortcutLabels.delete'),
            copy: t('messages.shortcutLabels.copy'),
            paste: t('messages.shortcutLabels.paste'),
            duplicate: t('messages.shortcutLabels.duplicate'),
            selectAll: t('messages.shortcutLabels.selectAll'),
            undo: t('messages.shortcutLabels.undo'),
            redo: t('messages.shortcutLabels.redo'),
            save: t('messages.shortcutLabels.save'),
            search: t('messages.shortcutLabels.search'),
            lock: t('messages.shortcutLabels.lock'),
            escape: t('messages.shortcutLabels.escape')
        };

        let html = '<div class="shortcut-list">';
        for (const [key, value] of Object.entries(shortcuts)) {
            const label = labels[key] || key;
            html += `
                <div class="shortcut-item" data-shortcut-key="${key}">
                    <span class="shortcut-label">${label}</span>
                    <span class="shortcut-value">${value}</span>
                    <button class="btn btn-sm shortcut-edit-btn" data-shortcut-key="${key}">${t('messages.shortcutEditBtn')}</button>
                </div>`;
        }
        html += '</div>';

        body.innerHTML = html;
        overlay.style.display = '';

        body.querySelectorAll('.shortcut-edit-btn').forEach(btn => {
            btn.addEventListener('click', (_e) => {
                const key = (/** @type {HTMLElement} */ (btn)).dataset.shortcutKey;
                const valueSpan = /** @type {HTMLElement | null} */ (body.querySelector(`.shortcut-item[data-shortcut-key="${key}"] .shortcut-value`));
                if (!valueSpan || !key) return;
                valueSpan.textContent = t('messages.shortcutCapturePrompt');
                valueSpan.style.color = 'var(--accent)';

                const handler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const parts = [];
                    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
                    if (e.shiftKey) parts.push('Shift');
                    if (e.altKey) parts.push('Alt');
                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
                        parts.push(e.key);
                    }
                    const newShortcut = parts.join('+');
                    valueSpan.textContent = newShortcut;
                    valueSpan.style.color = '';
                    this.saveShortcuts({ [key]: newShortcut });
                    document.removeEventListener('keydown', handler, true);
                };
                document.addEventListener('keydown', handler, true);
            });
        });
    }

    hideShortcutSettings() {
        const overlay = document.getElementById('shortcutModalOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    setupShortcutSettingsEvents() {
        const btnShortcuts = document.getElementById('btnShortcuts');
        const btnShortcutClose = document.getElementById('btnShortcutClose');
        const btnResetShortcuts = document.getElementById('btnResetShortcuts');
        const shortcutModalClose = document.getElementById('shortcutModalClose');
        const overlay = document.getElementById('shortcutModalOverlay');

        if (btnShortcuts) {
            btnShortcuts.addEventListener('click', () => this.showShortcutSettings());
        }
        if (btnShortcutClose) {
            btnShortcutClose.addEventListener('click', () => this.hideShortcutSettings());
        }
        if (shortcutModalClose) {
            shortcutModalClose.addEventListener('click', () => this.hideShortcutSettings());
        }
        if (btnResetShortcuts) {
            btnResetShortcuts.addEventListener('click', () => {
                this.resetShortcuts();
                this.showShortcutSettings();
            });
        }
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.hideShortcutSettings();
            });
        }
    }
}