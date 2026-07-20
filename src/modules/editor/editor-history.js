import { t } from '../../i18n/i18n.js';
import { deepClone } from '../../utils/helpers.js';

export class WorkflowHistory {
    constructor(ui, prefix = '') {
        this.ui = ui;
        this.core = ui.core;
        this.prefix = prefix;
        this.historyList = null;
        this._languageChangeHandler = null;
    }

    init() {
        this.historyList = document.getElementById(this.prefix + 'historyList');
        this._languageChangeHandler = () => this.updatePanel();
        document.addEventListener('languagechange', this._languageChangeHandler);
    }

    destroy() {
        if (this._languageChangeHandler) {
            document.removeEventListener('languagechange', this._languageChangeHandler);
            this._languageChangeHandler = null;
        }
    }

    updatePanel() {
        if (!this.historyList) return;

        while (this.historyList.firstChild) {
            this.historyList.removeChild(this.historyList.firstChild);
        }

        this.core.history.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = `history-item ${index === this.core.historyIndex ? 'current' : ''} ${index === 0 ? 'initial' : ''}`;
            item.textContent = t(state.actionKey, state.actionParams);
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
        const fullState = this.core._reconstructHistoryState(index);

        this.core.nodes = fullState.nodes;
        this.core.edges = fullState.edges;
        this.core.selectedNode = fullState.selectedNode;
        this.core.selectedEdge = fullState.selectedEdge;
        this.core._rebuildMaps();

        this.core._emitChange('jumpToHistory');
        this.ui.showMessage(
            t('history.jumpTo', {
                action: t(this.core.history[index].actionKey, this.core.history[index].actionParams),
            }),
            'info'
        );
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
