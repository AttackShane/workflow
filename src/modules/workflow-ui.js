import { WorkflowCanvas } from './workflow-canvas.js';
import { WorkflowNode } from './workflow-node.js';
import { WorkflowEdge } from './workflow-edge.js';
import { WorkflowHistory } from './workflow-history.js';
import { WorkflowClipboard } from './workflow-clipboard.js';
import { Dialog } from './dialog.js';
import { goToConverter, goToManager, initNavigator } from './navigator.js';
import { SELECTORS } from '../config/constants.js';
import { DOM } from '../utils/helpers.js';

export class WorkflowUI {
    constructor(core) {
        this.core = core;
        
        // 状态管理
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.hasDragged = false;
        this.isMultiSelectMode = false;
        this.connectingFrom = null;
        this.svgPath = null;
    }
    
    /**
     * 初始化 UI
     */
    init() {
        const isModal = DOM.get('workflowEditorModal') !== null;
        const prefix = isModal ? 'editor' : '';
        
        // 获取 DOM 元素
        this.propertyContent = DOM.get(prefix + SELECTORS.EDITOR.PROPERTY_CONTENT);
        this.importedNodeInfo = DOM.get(prefix + SELECTORS.EDITOR.IMPORTED_NODE_INFO);
        
        // 初始化子模块
        this.canvas = new WorkflowCanvas(this, prefix);
        this.node = new WorkflowNode(this);
        this.edge = new WorkflowEdge(this);
        this.history = new WorkflowHistory(this, prefix);
        this.clipboard = new WorkflowClipboard(this);
        
        // 启动子模块
        this.canvas.init();
        this.history.init();
        this.history.updatePanel();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 检查导入数据（优先级更高）
        this.checkImportedData();
        
        // 创建消息容器
        this.createMessageContainer();
        
        // 如果有已加载的节点，渲染它们
        if (this.core.nodes.length > 0) {
            this.core.nodes.forEach(node => {
                const nodeCopy = JSON.parse(JSON.stringify(node));
                const el = this.node.createElement(nodeCopy);
                this.canvas.canvasContent.appendChild(el);
            });
            this.canvas.setEmptyState(false);
            this.updateEdges();
            this.updateSummary();
        }
        
        // 启动自动保存
        this.startAutoSave();
    }

    /**
     * 创建消息容器 
     */
    createMessageContainer() {
        this.messageContainer = DOM.create('div', {
            className: 'workflow-message-container',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }
        });
        document.body.appendChild(this.messageContainer);
    }

    /**
     * 显示消息提示
     * @param {string} text - 消息文本
     * @param {string} type - 消息类型 ('success', 'error', 'info', 'warning')
     */
    showMessage(text, type = 'info') {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        
        const messageEl = DOM.create('div', {
            className: `workflow-message workflow-message-${type}`,
            style: {
                padding: '12px 20px',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transform: 'translateX(100%)',
                animation: 'slideIn 0.3s ease-out forwards',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '320px',
                backgroundColor: colors[type] || colors.info
            },
            html: `<span>${icons[type] || icons.info}</span><span>${text}</span>`
        });
        
        this.messageContainer.appendChild(messageEl);
        
        setTimeout(() => {
            DOM.setStyle(messageEl, 'animation', 'slideOut 0.3s ease-out forwards');
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        DOM.on(document, 'keydown', (e) => this.handleKeydown(e));
        
        // 导航按钮
        DOM.on(DOM.get('navConverterBtn'), 'click', goToConverter);
        DOM.on(DOM.get('navManagerBtn'), 'click', goToManager);
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleKeydown(e) {
        const activeEl = document.activeElement;
        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        const isContentEditable = activeEl.isContentEditable;
        const isModalOpen = document.querySelector('.node-editor-modal') !== null;
        
        // 如果有模态框打开或在可编辑元素中，不处理快捷键
        if (isModalOpen || isInput || isContentEditable) {
            return;
        }
        
        // 删除选中项
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
        }
        
        // 复制
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            this.clipboard.copy();
        }
        
        // 粘贴
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            this.clipboard.paste();
        }
        
        // 全选
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }
        
        // 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this.history.undo();
        }
        
        // 重做
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            this.history.redo();
        }
        
        // Esc - 返回管理页面并询问保存
        if (e.key === 'Escape') {
            e.preventDefault();
            this.confirmExit();
        }
        
        // Ctrl+S - 快速保存（不返回）
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.quickSave();
        }
    }

    /**
     * 全选节点和边
     */
    selectAll() {
        // 选中所有节点
        document.querySelectorAll('.canvas-node').forEach(n => DOM.addClass(n, 'selected'));
        
        // 选中所有边
        document.querySelectorAll('.workflow-edge').forEach(e => DOM.addClass(e, 'selected'));
        
        // 更新边的显示
        if (this.core.edges.length > 0) {
            this.core.selectEdge(this.core.edges[0].id);
        }
        this.updateEdges();
        
        // 更新属性面板
        if (this.core.nodes.length > 0) {
            const firstNode = this.core.nodes[0];
            const node = this.core.nodes.find(n => n.id === firstNode.id);
            if (node) this.node.renderPropertyPanel(node);
        }
        
        // 设置多选模式
        if (this.core.nodes.length > 1) {
            this.isMultiSelectMode = true;
        }
    }

    /**
     * 更新选择状态
     */
    updateSelection() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        
        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);
            
            const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (node) this.node.renderPropertyPanel(node);
            
            if (selectedNodes.length > 1 || selectedEdges.length > 0) {
                this.isMultiSelectMode = true;
            }
        } else if (selectedEdges.length > 0) {
            const lastSelected = selectedEdges[selectedEdges.length - 1];
            const lastEdgeId = lastSelected.getAttribute('data-edge-id');
            this.core.selectEdge(lastEdgeId);
            
            const edge = this.core.edges.find(e => e.id === lastEdgeId);
            if (edge) this.edge.renderPropertyPanel(edge);
        }
    }

    /**
     * 删除选中项
     */
    deleteSelected() {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        
        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
            return;
        }
        
        // 批量操作只保存一次历史记录
        this.core.saveHistory('删除选中项');
        
        // 删除选中的边（不重复保存历史）
        selectedEdges.forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            this.edge.delete(edgeId, false, false);
        });
        
        // 删除选中的节点（不重复保存历史）
        selectedNodes.forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;
            this.node.delete(nodeId, false, false);
        });
        
        // 最后更新一次历史面板
        this.updateHistoryPanel();
        this.showMessage('已删除选中项', 'success');
    }

    /**
     * 清除属性面板
     */
    clearPropertyPanel() {
        if (this.propertyContent) {
            DOM.setHtml(this.propertyContent, '');
        }
    }

    /**
     * 更新边的显示
     */
    updateEdges() {
        if (this.edge) {
            this.edge.updateAllEdges();
        }
    }

    /**
     * 取消全选
     */
    deselectAll() {
        document.querySelectorAll('.canvas-node.selected').forEach(n => DOM.removeClass(n, 'selected'));
        document.querySelectorAll('.workflow-edge.selected').forEach(e => DOM.removeClass(e, 'selected'));
        this.isMultiSelectMode = false;
        this.core.selectedNode = null;
        this.core.selectedEdge = null;
        this.clearPropertyPanel();
        this.edge.update();
    }

    /**
     * 选择指定矩形区域内的节点和边（当边的两个端点都被选中时才选中边）
     * @param {number} left - 左侧坐标
     * @param {number} top - 顶部坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    selectNodesInRect(left, top, width, height) {
        this.deselectAll();
        
        const selectedNodeIds = new Set();
        
        document.querySelectorAll('.canvas-node').forEach(nodeEl => {
            const rect = nodeEl.getBoundingClientRect();
            const nodeLeft = rect.left;
            const nodeTop = rect.top;
            const nodeWidth = rect.width;
            const nodeHeight = rect.height;
            
            if (
                nodeLeft < left + width &&
                nodeLeft + nodeWidth > left &&
                nodeTop < top + height &&
                nodeTop + nodeHeight > top
            ) {
                DOM.addClass(nodeEl, 'selected');
                const nodeId = nodeEl.getAttribute('data-node-id');
                if (nodeId) {
                    selectedNodeIds.add(nodeId);
                }
            }
        });
        
        document.querySelectorAll('.workflow-edge').forEach(edgeEl => {
            const edgeId = edgeEl.getAttribute('data-edge-id');
            if (edgeId) {
                const edge = this.core.edges.find(e => e.id === edgeId);
                if (edge && selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
                    DOM.addClass(edgeEl, 'selected');
                }
            }
        });
        
        this.updateSelection();
        this.edge.update();
    }

    /**
     * 检查导入数据
     */
    checkImportedData() {
        // 检查 URL 参数中的导入数据
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        
        if (data) {
            try {
                const workflowData = JSON.parse(decodeURIComponent(data));
                this.core.loadFromClipboard(workflowData);
                this.showMessage('工作流数据已导入', 'success');
            } catch (error) {
                this.showMessage('导入失败：无效的数据格式', 'error');
                console.error('Import error:', error);
            }
        }
    }

    /**
     * 更新面板
     */
    updatePanel() {
        this.history.updatePanel();
    }

    /**
     * 更新摘要信息
     */
    updateSummary() {
        // 可以在这里添加摘要更新逻辑
    }
    
    /**
     * 启动自动保存
     */
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
            }
        }, 5000); // 每5秒自动保存一次
        
        // 页面关闭前也保存一次
        window.addEventListener('beforeunload', () => {
            if (this.core.nodes.length > 0) {
                this.core.saveToLocalStorage();
            }
        });
    }
    
    /**
     * 手动保存工作流
     */
    saveWorkflow() {
        const success = this.core.saveToLocalStorage();
        if (success) {
            this.showMessage('工作流已保存', 'success');
        } else {
            this.showMessage('保存失败', 'error');
        }
    }
    
    /**
     * 清除保存的工作流
     */
    clearSavedWorkflow() {
        this.core.clearSavedWorkflow();
        this.showMessage('已清除保存的工作流', 'success');
    }

    /**
     * 在画布上添加节点（供外部调用）
     * @param {string} type - 节点类型
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     */
    addNodeToCanvas(type, screenX, screenY) {
        this.node.addToCanvas(type, screenX, screenY);
    }
    
    /**
     * 更新历史记录面板（供外部调用）
     */
    updateHistoryPanel() {
        this.history.updatePanel();
    }
    
    /**
     * 刷新画布显示
     */
    refreshCanvas() {
        // 清空画布内容
        while (this.canvas.canvasContent.firstChild) {
            this.canvas.canvasContent.removeChild(this.canvas.canvasContent.firstChild);
        }
        
        // 重新渲染所有节点（使用深拷贝避免污染历史记录）
        this.core.nodes.forEach(node => {
            const nodeCopy = JSON.parse(JSON.stringify(node));
            const el = this.node.createElement(nodeCopy);
            this.canvas.canvasContent.appendChild(el);
        });
        
        // 更新边和 SVG 大小
        this.updateEdges();
        this.canvas.updateSvgSize();
        
        // 更新摘要
        this.updateSummary();
        
        // 检查是否需要显示空状态
        if (this.core.nodes.length === 0) {
            this.canvas.setEmptyState(true);
        }
    }
    
    /**
     * 开始创建连接（委托给 edge 模块）
     * @param {string} nodeId - 源节点 ID
     * @param {MouseEvent} e - 鼠标事件
     */
    startConnection(nodeId, e) {
        if (this.edge) {
            this.edge.startConnection(nodeId, e);
        }
    }
    
    /**
     * 取消连接创建（委托给 edge 模块）
     */
    cancelConnection() {
        if (this.edge) {
            this.edge.cancelConnection();
        }
    }
    
    /**
     * 删除节点（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    deleteNode(nodeId) {
        this.node.delete(nodeId);
    }
    
    /**
     * 保存节点编辑（供外部调用）
     * @param {string} nodeId - 节点 ID
     */
    saveNodeEdit(nodeId) {
        this.node.saveEdit(nodeId);
    }
    
    /**
     * 删除边（供外部调用）
     * @param {string} edgeId - 边 ID
     */
    deleteEdge(edgeId) {
        this.edge.delete(edgeId);
    }
    
    /**
     * 验证工作流（供外部调用）
     */
    validate() {
        const result = this.core.validate();
        if (result.valid) {
            this.showMessage('工作流验证通过', 'success');
        } else {
            this.showMessage(`验证失败：\n${result.message}`, 'error');
        }
    }
    
    /**
     * 导出工作流（供外部调用）
     */
    exportWorkflow() {
        const workflow = this.core.exportWorkflow();
        const dataStr = JSON.stringify(workflow, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage('工作流导出成功', 'success');
    }
    
    /**
     * 清空画布（供外部调用）
     */
    async clearCanvas() {
        const confirmed = await Dialog.confirm('确定要清空画布吗？', '清空确认', { danger: true });
        if (!confirmed) {
            return;
        }
        this.core.clearAll();
        this.core.clearSavedWorkflow();
        document.querySelectorAll('.canvas-node').forEach(n => n.remove());
        this.edge.update();
        this.canvas.setEmptyState(true);
        this.clearPropertyPanel();
        this.showMessage('画布已清空', 'info');
    }
    
    /**
     * 保存工作流并返回管理页面
     */
    saveAndReturn() {
        const workflow = {
            nodes: this.core.nodes,
            edges: this.core.edges,
            selectedNode: this.core.selectedNode,
            selectedEdge: this.core.selectedEdge,
            updatedAt: Date.now()
        };
        
        // 获取当前编辑的工作流ID
        const editingId = sessionStorage.getItem('editingWorkflowId');
        if (editingId) {
            workflow.id = editingId;
        }
        
        // 保存到 sessionStorage，供工作流管理页面读取
        sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
        
        // 只清除 editingWorkflow，保留 editingWorkflowId 供管理页面更新使用
        sessionStorage.removeItem('editingWorkflow');
        
        this.showMessage('工作流已保存', 'success');
        
        // 延迟跳转，让用户看到保存成功的提示
        setTimeout(() => {
            goToManager();
        }, 500);
    }
    
    /**
     * 确认退出并询问是否保存
     */
    async confirmExit() {
        const result = await Dialog.confirm('是否保存当前工作流后返回？', '退出确认');
        
        if (result) {
            // 用户选择保存
            this.saveAndReturn();
        } else {
            // 用户选择不保存，直接返回
            goToManager();
        }
    }
    
    /**
     * 快速保存（不返回）
     */
    quickSave() {
        try {
            const workflow = {
                nodes: JSON.parse(JSON.stringify(this.core.nodes)),
                edges: JSON.parse(JSON.stringify(this.core.edges)),
                selectedNode: this.core.selectedNode,
                selectedEdge: this.core.selectedEdge,
                updatedAt: Date.now()
            };
            
            // 保存到 sessionStorage，供工作流管理页面读取
            sessionStorage.setItem('savedWorkflow', JSON.stringify(workflow));
            
            // 同时保存到 localStorage，防止页面刷新丢失
            this.core.saveToLocalStorage();
            
            this.showMessage('工作流已保存', 'success');
        } catch (error) {
            console.error('保存失败:', error);
            this.showMessage('保存失败，请重试', 'error');
        }
    }
}