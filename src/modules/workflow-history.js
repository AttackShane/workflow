import { t } from '../i18n/i18n.js';

export class WorkflowHistory {
    constructor(ui, prefix = '') {
        this.ui = ui;
        this.core = ui.core;
        this.prefix = prefix;
        this.historyList = null;
    }

    init() {
        this.historyList = document.getElementById(this.prefix + 'historyList');
    }

    updatePanel() {
        if (!this.historyList) return;
        
        while (this.historyList.firstChild) {
            this.historyList.removeChild(this.historyList.firstChild);
        }
        
        this.core.history.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = `history-item ${index === this.core.historyIndex ? 'current' : ''} ${index === 0 ? 'initial' : ''}`;
            item.textContent = state.action;
            item.style.order = index;
            
            item.addEventListener('click', () => {
                this.goTo(index);
            });
            
            this.historyList.appendChild(item);
        });
    }

    goTo(index) {
        if (index < 0 || index >= this.core.history.length) return;
        
        this.core.historyIndex = index;
        const state = this.core.history[index];
        
        // 使用深拷贝避免污染历史记录
        this.core.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.core.edges = JSON.parse(JSON.stringify(state.edges));
        this.core.selectedNode = state.selectedNode;
        this.core.selectedEdge = state.selectedEdge;
        
        this.core._emitChange('undo');
        this.ui.showMessage(t('history.jumpTo', { action: state.action }), 'info');
    }

    undo() {
        if (this.core.canUndo()) {
            this.core.undo();
            this.ui.showMessage(t('history.undoSuccess'), 'info');
        } else {
            this.ui.showMessage(t('history.undoFail'), 'warning');
        }
    }

    redo() {
        if (this.core.canRedo()) {
            this.core.redo();
            this.ui.showMessage(t('history.redoSuccess'), 'info');
        } else {
            this.ui.showMessage(t('history.redoFail'), 'warning');
        }
    }
}