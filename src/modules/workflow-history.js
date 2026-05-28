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
        
        this.ui.refreshCanvas();
        this.updatePanel();
        this.ui.showMessage(`跳转到: ${state.action}`, 'info');
    }

    undo() {
        if (this.core.canUndo()) {
            const success = this.core.undo();
            if (success) {
                this.ui.refreshCanvas();
                this.updatePanel();
                this.ui.showMessage('撤销成功', 'info');
            }
        } else {
            this.ui.showMessage('无法撤销', 'warning');
        }
    }

    redo() {
        if (this.core.canRedo()) {
            const success = this.core.redo();
            if (success) {
                this.ui.refreshCanvas();
                this.updatePanel();
                this.ui.showMessage('重做成功', 'info');
            }
        } else {
            this.ui.showMessage('无法重做', 'warning');
        }
    }
}