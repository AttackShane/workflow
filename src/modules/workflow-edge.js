import { StringUtils } from '../utils/helpers.js';

export class WorkflowEdge {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;
    }

    get svgLayer() {
        return this.ui.canvas.svgLayer;
    }

    get svgHitLayer() {
        return this.ui.canvas.svgHitLayer;
    }

    update() {
        const selectedEdges = new Set();
        document.querySelectorAll('.workflow-edge.selected').forEach(e => {
            selectedEdges.add(e.getAttribute('data-edge-id'));
        });
        
        while (this.svgLayer.children.length > 0) {
            this.svgLayer.removeChild(this.svgLayer.children[0]);
        }
        while (this.svgHitLayer.children.length > 0) {
            this.svgHitLayer.removeChild(this.svgHitLayer.children[0]);
        }
        
        this.core.edges.forEach(edge => {
            const source = this.core.nodes.find(n => n.id === edge.source);
            const target = this.core.nodes.find(n => n.id === edge.target);
            
            if (!source || !target) return;
            
            const width1 = source.width || 200;
            const height1 = source.height || 100;
            const width2 = target.width || 200;
            const height2 = target.height || 100;
            
            const x1 = source.x + width1;
            const y1 = source.y + height1 / 2;
            const x2 = target.x;
            const y2 = target.y + height2 / 2;
            
            const dx = Math.abs(x2 - x1);
            const ctrl = Math.max(dx * 0.4, 50);
            
            const d = `M ${x1} ${y1} C ${x1 + ctrl} ${y1}, ${x2 - ctrl} ${y2}, ${x2} ${y2}`;
            
            const isSelected = selectedEdges.has(edge.id) || this.core.selectedEdge === edge.id;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('stroke', isSelected ? '#F59E0B' : '#5C62FF');
            path.setAttribute('stroke-width', isSelected ? '3' : '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('data-edge-id', edge.id);
            path.classList.add('workflow-edge');
            
            if (isSelected) {
                path.classList.add('selected');
            }
            
            const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', d);
            hitPath.setAttribute('stroke', '#5C62FF');
            hitPath.setAttribute('stroke-width', '20');
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke-opacity', '0.01');
            hitPath.setAttribute('data-edge-id', edge.id);
            
            hitPath.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(edge.id, e.ctrlKey || e.metaKey);
            });
            
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowSize = 8;
            const ax1 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
            const ay1 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
            const ax2 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
            const ay2 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
            
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`);
            arrow.setAttribute('fill', isSelected ? '#F59E0B' : '#5C62FF');
            
            this.svgLayer.appendChild(path);
            this.svgLayer.appendChild(arrow);
            this.svgHitLayer.appendChild(hitPath);
        });
    }

    select(edgeId, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.workflow-edge').forEach(e => e.classList.remove('selected'));
            if (!this.ui.isMultiSelectMode) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                this.core.selectNode(null);
            }
        }
        
        const edgePath = document.querySelector(`path[data-edge-id="${edgeId}"]`);
        if (edgePath) {
            edgePath.classList.toggle('selected');
        }
        
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        
        if (selectedEdges.length > 0) {
            const lastSelected = selectedEdges[selectedEdges.length - 1];
            const lastEdgeId = lastSelected.getAttribute('data-edge-id');
            this.core.selectEdge(lastEdgeId);
            const edge = this.core.edges.find(e => e.id === lastEdgeId);
            if (edge) this.renderPropertyPanel(edge);
        } else {
            this.core.selectEdge(null);
            this.ui.showSummaryPanel();
        }
        
        this.update();
    }

    delete(edgeId, saveHistory = true, updatePanel = true) {
        this.core.deleteEdge(edgeId);
        this.core.selectEdge(null);
        this.update();
        this.ui.updateSummary();
        this.ui.showSummaryPanel();
        
        if (saveHistory) {
            this.core.saveHistory('删除连接');
        }
        
        if (updatePanel) {
            this.ui.updateHistoryPanel();
        }
    }

    renderPropertyPanel(edge) {
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        const selectedCount = selectedNodes.length + selectedEdges.length;
        
        // 多选或无选中 - 显示摘要
        if (selectedCount !== 1 || !edge) {
            this.ui.showSummaryPanel();
            return;
        }
        
        // 单选一条边 - 显示详情
        const source = this.core.nodes.find(n => n.id === edge.source);
        const target = this.core.nodes.find(n => n.id === edge.target);
        
        this.ui.showDetailPanel();
        const detailContainer = document.getElementById('nodeDetail');
        if (!detailContainer) return;
        
        detailContainer.innerHTML = `
            <div class="property-panel-section">
                <h4>🔗 连接边</h4>
                <div class="property-group">
                    <label class="property-label">源节点</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(source?.title || '未知')}" readonly>
                </div>
                <div class="property-group">
                    <label class="property-label">目标节点</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(target?.title || '未知')}" readonly>
                </div>
                ${edge.sourcePortID ? `
                <div class="property-group">
                    <label class="property-label">源端口</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(edge.sourcePortID)}" readonly>
                </div>
                ` : ''}
                ${edge.targetPortID ? `
                <div class="property-group">
                    <label class="property-label">目标端口</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(edge.targetPortID)}" readonly>
                </div>
                ` : ''}
                <div style="margin-top: 1.5rem;">
                    <button class="btn btn-danger" onclick="workflowUI.deleteEdge('${StringUtils.escapeHtml(edge.id)}')">删除连接</button>
                </div>
            </div>
        `;
    }

    startConnection(nodeId, e) {
        this.ui.connectingFrom = nodeId;
        const canvasRect = this.ui.canvas.canvas.getBoundingClientRect();

        const pointRect = e.target.getBoundingClientRect();
        const screenStartX = pointRect.left + pointRect.width / 2 - canvasRect.left;
        const screenStartY = pointRect.top + pointRect.height / 2 - canvasRect.top;

        const { canvasX: startX, canvasY: startY } = this.ui.canvas.screenToCanvas(screenStartX, screenStartY);

        this.ui.svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.ui.svgPath.setAttribute('stroke', '#5C62FF');
        this.ui.svgPath.setAttribute('stroke-width', '2');
        this.ui.svgPath.setAttribute('fill', 'none');
        this.ui.svgPath.setAttribute('stroke-dasharray', '5,5');
        this.svgLayer.appendChild(this.ui.svgPath);

        const onMouseMove = (e) => {
            if (!this.ui.svgPath) return;
            const canvasRect = this.ui.canvas.canvas.getBoundingClientRect();
            const screenX = e.clientX - canvasRect.left;
            const screenY = e.clientY - canvasRect.top;
            const { canvasX: x, canvasY: y } = this.ui.canvas.screenToCanvas(screenX, screenY);
            const dx = x - startX;
            const ctrl = Math.max(Math.abs(dx) * 0.4, 50);
            this.ui.svgPath.setAttribute('d', `M ${startX} ${startY} C ${startX + ctrl} ${startY}, ${x - ctrl} ${y}, ${x} ${y}`);
        };
        
        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // 检测鼠标是否在某个节点的输入端口上方
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const inputPort = target?.closest('.input-port');
            
            if (inputPort) {
                const targetNode = inputPort.closest('.canvas-node');
                if (targetNode) {
                    const targetId = targetNode.dataset.nodeId;
                    const sourceId = this.ui.connectingFrom;
                    
                    if (sourceId && targetId && sourceId !== targetId) {
                        // 检查是否已存在相同的边
                        const exists = this.core.edges.some(
                            ed => ed.source === sourceId && ed.target === targetId
                        );
                        if (!exists) {
                            this.core.createEdge(sourceId, targetId);
                            this.core.saveHistory('创建连接');
                            this.ui.updateHistoryPanel();
                            this.ui.updateSummary();
                            this.ui.showMessage('连接已创建', 'success');
                        }
                    }
                }
            }
            
            this.cancelConnection();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    cancelConnection() {
        if (this.ui.svgPath) {
            try {
                this.svgLayer.removeChild(this.ui.svgPath);
            } catch (e) {
                // svgPath already removed
            }
            this.ui.svgPath = null;
        }
        this.ui.connectingFrom = null;
    }

    /**
     * 更新所有边（别名方法）
     */
    updateAllEdges() {
        this.update();
    }
}