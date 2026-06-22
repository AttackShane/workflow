import { StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

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

    /**
     * 计算边的几何数据（纯函数，无副作用）
     * @param {object} edge - 边数据
     * @returns {object|null} 几何数据 { x1, y1, x2, y2, d, arrowPoints, labelText, labelX, labelY }
     */
    _computeEdgeGeometry(edge) {
        const source = this.core.nodes.find(n => n.id === edge.source);
        const target = this.core.nodes.find(n => n.id === edge.target);
        if (!source || !target) return null;

        const getAbsPos = (node) => {
            let absX = node.x || 0;
            let absY = node.y || 0;
            if (node.parentId) {
                const parent = this.core.nodes.find(n => n.id === node.parentId);
                if (parent) {
                    absX = (parent.x || 0) + absX;
                    absY = (parent.y || 0) + 58 + absY;
                }
            }
            return { x: absX, y: absY };
        };

        const sourcePos = getAbsPos(source);
        const targetPos = getAbsPos(target);

        const width1 = source.width || 200;
        const height1 = source.height || 100;
        const width2 = target.width || 200;
        const height2 = target.height || 100;

        let x1 = sourcePos.x + width1;
        let x2 = targetPos.x;
        let y2 = targetPos.y + height2 / 2;
        let y1 = sourcePos.y + height1 / 2;
        let labelText = '';

        const sourceIsContainer = this.core.isContainerNode(source.id);
        const targetIsContainer = this.core.isContainerNode(target.id);

        if (sourceIsContainer) {
            if (edge.sourcePort === 'container_start') {
                x1 = sourcePos.x;
                y1 = sourcePos.y + height1 / 2 + 28;
            } else {
                y1 = sourcePos.y + 30;
            }
        }

        if (targetIsContainer) {
            if (edge.targetPort === 'container_end') {
                x2 = targetPos.x + width2;
                y2 = targetPos.y + height2 / 2 + 28;
            } else {
                y2 = targetPos.y + 30;
            }
        }

        if (edge.sourcePort && source.type === 'question' && source.parameters?.options) {
            const options = Array.isArray(source.parameters.options) ? source.parameters.options : [];
            const totalPorts = options.length + 1;
            let portIndex = options.length;
            if (edge.sourcePort.startsWith('branch_')) {
                portIndex = parseInt(edge.sourcePort.replace('branch_', ''), 10);
                if (isNaN(portIndex) || portIndex >= options.length) portIndex = options.length;
            }
            y1 = sourcePos.y + height1 * (portIndex + 0.5) / totalPorts;
            if (portIndex < options.length) {
                labelText = typeof options[portIndex] === 'string' ? options[portIndex] : (options[portIndex]?.name || '');
            } else {
                labelText = '其他';
            }
        } else if (edge.sourcePort && source.type === 'condition' && source.parameters?.branches) {
            const branches = Array.isArray(source.parameters.branches) ? source.parameters.branches : [];
            const totalPorts = branches.length;
            let portIndex = 0;
            if (edge.sourcePort.startsWith('branch_')) {
                portIndex = parseInt(edge.sourcePort.replace('branch_', ''), 10);
                if (isNaN(portIndex) || portIndex >= branches.length) portIndex = 0;
            }
            y1 = sourcePos.y + height1 * (portIndex + 0.5) / totalPorts;
            const branch = branches[portIndex];
            labelText = (branch && branch.name) ? branch.name : (portIndex === 0 ? 'True' : (portIndex === 1 ? 'False' : `Branch ${portIndex}`));
        }

        const dx = Math.abs(x2 - x1);
        const ctrl = Math.max(dx * 0.4, 50);
        const d = `M ${x1} ${y1} C ${x1 + ctrl} ${y1}, ${x2 - ctrl} ${y2}, ${x2} ${y2}`;

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 8;
        const ax1 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const ay1 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const ax2 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const ay2 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        const arrowPoints = `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`;

        const labelX = x1 + (x2 - x1) * 0.15;
        const labelY = y1 - 8;

        return { x1, y1, x2, y2, ctrl, d, arrowPoints, labelText, labelX, labelY };
    }

    /**
     * 创建或更新边的 DOM 元素（增量更新核心）
     * @param {object} edge - 边数据
     * @param {object} geom - 几何数据（来自 _computeEdgeGeometry）
     */
    _upsertEdgeElements(edge, geom) {
        const isSelected = document.querySelector(`path[data-edge-id="${edge.id}"].selected`) !== null
            || this.core.selectedEdge === edge.id;

        let path = this.svgLayer.querySelector(`path[data-edge-id="${edge.id}"]`);
        let arrow = this.svgLayer.querySelector(`polygon[data-edge-id="${edge.id}"]`);
        let hitPath = this.svgHitLayer.querySelector(`path[data-edge-id="${edge.id}"]`);
        let label = this.svgLayer.querySelector(`text[data-edge-id="${edge.id}"]`);

        if (path) {
            path.setAttribute('d', geom.d);
            path.setAttribute('stroke', isSelected ? '#F59E0B' : '#5C62FF');
            path.setAttribute('stroke-width', isSelected ? '3' : '2');
            if (isSelected) {
                path.classList.add('selected');
            } else {
                path.classList.remove('selected');
            }
        } else {
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', geom.d);
            path.setAttribute('stroke', isSelected ? '#F59E0B' : '#5C62FF');
            path.setAttribute('stroke-width', isSelected ? '3' : '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('data-edge-id', edge.id);
            path.classList.add('workflow-edge');
            if (isSelected) path.classList.add('selected');
            this.svgLayer.appendChild(path);
        }

        if (arrow) {
            arrow.setAttribute('points', geom.arrowPoints);
            arrow.setAttribute('fill', isSelected ? '#F59E0B' : '#5C62FF');
        } else {
            arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', geom.arrowPoints);
            arrow.setAttribute('fill', isSelected ? '#F59E0B' : '#5C62FF');
            arrow.setAttribute('data-edge-id', edge.id);
            this.svgLayer.appendChild(arrow);
        }

        if (hitPath) {
            hitPath.setAttribute('d', geom.d);
        } else {
            hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', geom.d);
            hitPath.setAttribute('stroke', '#5C62FF');
            hitPath.setAttribute('stroke-width', '20');
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke-opacity', '0.01');
            hitPath.setAttribute('data-edge-id', edge.id);
            hitPath.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(edge.id, e.ctrlKey || e.metaKey);
            });
            this.svgHitLayer.appendChild(hitPath);
        }

        if (geom.labelText) {
            if (label) {
                label.setAttribute('x', geom.labelX);
                label.setAttribute('y', geom.labelY);
                label.textContent = geom.labelText;
            } else {
                label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', geom.labelX);
                label.setAttribute('y', geom.labelY);
                label.setAttribute('fill', '#94a3b8');
                label.setAttribute('font-size', '11');
                label.setAttribute('font-family', 'sans-serif');
                label.setAttribute('data-edge-id', edge.id);
                label.textContent = geom.labelText;
                this.svgLayer.appendChild(label);
            }
        } else if (label) {
            label.remove();
        }
    }

    /**
     * 增量更新：只更新与指定节点相连的边
     * @param {string[]} nodeIds - 发生变化的节点 ID 列表
     */
    updateAffectedEdges(nodeIds) {
        const affectedSet = new Set(nodeIds);
        const affectedEdges = this.core.edges.filter(e => affectedSet.has(e.source) || affectedSet.has(e.target));
        for (const edge of affectedEdges) {
            const geom = this._computeEdgeGeometry(edge);
            if (!geom) continue;
            this._upsertEdgeElements(edge, geom);
        }
    }

    update() {
        const currentIds = new Set(this.core.edges.map(e => e.id));

        const ns = 'http://www.w3.org/2000/svg';
        const removeOrphaned = (layer) => {
            const all = layer.querySelectorAll('[data-edge-id]');
            all.forEach(el => {
                if (!currentIds.has(el.getAttribute('data-edge-id'))) {
                    el.remove();
                }
            });
        };
        removeOrphaned(this.svgLayer);
        removeOrphaned(this.svgHitLayer);

        this.core.edges.forEach(edge => {
            const geom = this._computeEdgeGeometry(edge);
            if (!geom) return;
            this._upsertEdgeElements(edge, geom);
        });
    }

    select(edgeId, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.workflow-edge').forEach(e => e.classList.remove('selected'));
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            this.core.selectNode(null);
            this.ui.isMultiSelectMode = false;
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
        this.ui.showSummaryPanel();
        
        if (saveHistory) {
            this.core.saveHistory(t('actions.deleteConnection'));
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
                <h4>${t('edge.connectionEdge')}</h4>
                <div class="property-group">
                    <label class="property-label">${t('edge.sourceNode')}</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(source?.title || t('edge.unknown'))}" readonly>
                </div>
                <div class="property-group">
                    <label class="property-label">${t('edge.targetNode')}</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(target?.title || t('edge.unknown'))}" readonly>
                </div>
                ${edge.sourcePortID ? `
                <div class="property-group">
                    <label class="property-label">${t('edge.sourcePort')}</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(edge.sourcePortID)}" readonly>
                </div>
                ` : ''}
                ${edge.targetPortID ? `
                <div class="property-group">
                    <label class="property-label">${t('edge.targetPort')}</label>
                    <input class="property-input" type="text" value="${StringUtils.escapeHtml(edge.targetPortID)}" readonly>
                </div>
                ` : ''}
                <div style="margin-top: 1.5rem;">
                    <button class="btn btn-danger" onclick="workflowUI.deleteEdge('${StringUtils.escapeHtml(edge.id)}')">${t('edge.deleteConnection')}</button>
                </div>
            </div>
        `;
    }

    startConnection(nodeId, e, portId = '') {
        this.ui.connectingFrom = nodeId;
        this.ui.connectingFromPort = portId;
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
                            this.core.createEdge(sourceId, targetId, this.ui.connectingFromPort);
                            this.core.saveHistory(t('actions.createConnection'));
                            this.ui.showMessage(t('actions.connectionCreated'), 'success');
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
        this.ui.connectingFromPort = '';
    }

    /**
     * 更新所有边（别名方法）
     */
    updateAllEdges() {
        this.update();
    }
}