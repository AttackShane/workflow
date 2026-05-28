export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;
    }

    createElement(nodeData) {
        const info = this.core.nodeTypeInfo[nodeData.type] || { title: '未知节点', icon: '📦', description: '', hasInput: true, hasOutput: true };
        const el = document.createElement('div');
        el.className = `canvas-node ${nodeData.type}`;
        el.style.left = `${nodeData.x}px`;
        el.style.top = `${nodeData.y}px`;
        el.dataset.nodeId = nodeData.id;
        
        const inputPoint = info.hasInput ? '<div class="connection-point input"></div>' : '';
        const outputPoint = info.hasOutput ? '<div class="connection-point output"></div>' : '';
        
        el.innerHTML = `
            <div class="node-header">
                <div class="node-icon">${info.icon}</div>
                <div class="node-title">${nodeData.title}</div>
                <div class="node-type">${nodeData.type}</div>
            </div>
            <div class="node-description">${nodeData.description}</div>
            ${inputPoint}
            ${outputPoint}
        `;
        
        el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
        el.addEventListener('click', (e) => this.onClick(e, el));
        el.addEventListener('dblclick', () => this.openEditor(nodeData.id));
        
        const outputPoints = el.querySelectorAll('.connection-point.output');
        outputPoints.forEach(point => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.ui.startConnection(nodeData.id, e);
            });
        });
        
        const inputPoints = el.querySelectorAll('.connection-point.input');
        inputPoints.forEach(point => {
            point.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (this.ui.connectingFrom && this.ui.connectingFrom !== nodeData.id) {
                    const edge = this.core.createEdge(this.ui.connectingFrom, nodeData.id);
                    if (edge) {
                        this.ui.updateEdges();
                        this.ui.updateSummary();
                        this.core.saveHistory('创建连接');
                        this.ui.updateHistoryPanel();
                    }
                    this.ui.cancelConnection();
                }
            });
        });
        
        const rect = el.getBoundingClientRect();
        nodeData.width = rect.width;
        nodeData.height = rect.height;
        
        return el;
    }

    addToCanvas(type, screenX, screenY, data = null) {
        // 将屏幕坐标转换为画布坐标（考虑平移和缩放）
        const { canvasX, canvasY } = this.ui.canvas.screenToCanvas(screenX, screenY);
        
        const nodeData = this.core.createNode(type, canvasX, canvasY, data);
        const el = this.createElement(nodeData);
        this.ui.canvas.canvasContent.appendChild(el);
        this.ui.canvas.setEmptyState(false);
        this.ui.updateSummary();
        
        this.core.saveHistory(`添加节点: ${type}`);
        this.ui.updateHistoryPanel();
        
        return el;
    }

    onMouseDown(e, el) {
        if (e.target.classList.contains('connection-point')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        this.ui.dragStartX = e.clientX;
        this.ui.dragStartY = e.clientY;
        this.ui.hasDragged = false;
        
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const hasMultipleSelected = selectedNodes.length > 1;
        const ctrlPressed = e.ctrlKey || e.metaKey;
        const isAlreadySelected = el.classList.contains('selected');
        
        if (ctrlPressed && isAlreadySelected) {
            el.classList.remove('selected');
            const newSelectedNodes = document.querySelectorAll('.canvas-node.selected');
            if (newSelectedNodes.length === 0) {
                this.ui.isMultiSelectMode = false;
                this.core.selectNode(null);
                this.propertyContent.innerHTML = '';
            } else {
                const lastSelected = newSelectedNodes[newSelectedNodes.length - 1];
                this.core.selectNode(lastSelected.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
            }
        } else if (ctrlPressed && !isAlreadySelected) {
            el.classList.add('selected');
            this.ui.isMultiSelectMode = true;
        } else if (!this.ui.isMultiSelectMode && !ctrlPressed && !hasMultipleSelected) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
            el.classList.add('selected');
            this.ui.isMultiSelectMode = false;
            this.core.selectNode(el.dataset.nodeId);
            const node = this.core.nodes.find(n => n.id === el.dataset.nodeId);
            if (node) this.renderPropertyPanel(node);
        } else if (this.ui.isMultiSelectMode || hasMultipleSelected) {
            if (!isAlreadySelected) {
                el.classList.add('selected');
            }
            this.ui.isMultiSelectMode = true;
        } else {
            el.classList.add('selected');
        }
        
        el.classList.add('dragging');
        el.style.zIndex = 1000;
        
        const nodeStartPositions = {};
        const selectedNodeEls = Array.from(document.querySelectorAll('.canvas-node.selected'));
        selectedNodeEls.forEach(nodeEl => {
            nodeStartPositions[nodeEl.dataset.nodeId] = {
                x: parseInt(nodeEl.style.left) || 0,
                y: parseInt(nodeEl.style.top) || 0
            };
        });
        
        let rafId = null;
        
        const onMouseMove = (e) => {
            const dx = Math.abs(e.clientX - this.ui.dragStartX);
            const dy = Math.abs(e.clientY - this.ui.dragStartY);
            if (dx > 5 || dy > 5) {
                this.ui.hasDragged = true;
            }
            
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            
            rafId = requestAnimationFrame(() => {
                const moveDx = (e.clientX - this.ui.dragStartX) / this.ui.canvas.canvasScale;
                const moveDy = (e.clientY - this.ui.dragStartY) / this.ui.canvas.canvasScale;
                
                for (const nodeEl of selectedNodes) {
                    const startPos = nodeStartPositions[nodeEl.dataset.nodeId];
                    const newX = startPos.x + moveDx;
                    const newY = startPos.y + moveDy;
                    nodeEl.style.left = `${newX}px`;
                    nodeEl.style.top = `${newY}px`;
                }
            });
        };
        
        const onMouseUp = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            selectedNodes.forEach(nodeEl => {
                nodeEl.classList.remove('dragging');
                nodeEl.style.zIndex = '';
                const newX = parseInt(nodeEl.style.left) || 0;
                const newY = parseInt(nodeEl.style.top) || 0;
                this.core.updateNodePosition(nodeEl.dataset.nodeId, newX, newY);
            });
            el.classList.remove('dragging');
            el.style.zIndex = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            this.ui.updateEdges();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    onClick(e, el) {
        if (e.target.classList.contains('connection-point')) return;
        
        if (this.ui.hasDragged) {
            this.ui.hasDragged = false;
            return;
        }
        
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        const clickedNode = e.target.closest('.canvas-node');
        
        if (!e.ctrlKey && !e.metaKey && this.ui.isMultiSelectMode) {
            if (clickedNode && clickedNode.classList.contains('selected')) {
                return;
            } else if (clickedNode) {
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                document.querySelectorAll('.workflow-edge').forEach(edge => edge.classList.remove('selected'));
                clickedNode.classList.add('selected');
                this.ui.isMultiSelectMode = false;
                
                this.core.selectNode(clickedNode.dataset.nodeId);
                const node = this.core.nodes.find(n => n.id === clickedNode.dataset.nodeId);
                if (node) this.renderPropertyPanel(node);
                this.ui.updateEdges();
            }
        }
    }

    select(el, multiSelect = false) {
        if (!multiSelect) {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            document.querySelectorAll('.workflow-edge').forEach(e => e.classList.remove('selected'));
            this.core.selectEdge(null);
            this.ui.isMultiSelectMode = false;
        }
        
        el.classList.toggle('selected');
        const selectedNodes = document.querySelectorAll('.canvas-node.selected');
        
        if (selectedNodes.length > 0) {
            const lastSelected = selectedNodes[selectedNodes.length - 1];
            this.core.selectNode(lastSelected.dataset.nodeId);
            const node = this.core.nodes.find(n => n.id === lastSelected.dataset.nodeId);
            if (node) this.renderPropertyPanel(node);
            
            if (selectedNodes.length > 1) {
                this.ui.isMultiSelectMode = true;
            }
        } else {
            this.core.selectNode(null);
            this.propertyContent.innerHTML = '';
            this.ui.isMultiSelectMode = false;
        }
        
        this.ui.updateEdges();
    }

    delete(nodeId, saveHistory = true, updatePanel = true) {
        this.core.deleteNode(nodeId);
        document.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
        
        const selectedEdges = document.querySelectorAll('.workflow-edge.selected');
        if (selectedEdges.length > 0) {
            const stillExists = Array.from(selectedEdges).some(edge => {
                const edgeId = edge.getAttribute('data-edge-id');
                return this.core.edges.find(e => e.id === edgeId);
            });
            if (!stillExists) {
                this.core.selectEdge(null);
            }
        }
        
        this.ui.updateEdges();
        this.ui.updateSummary();
        this.propertyContent.innerHTML = '';
        
        if (this.core.nodes.length === 0) {
            this.ui.canvas.setEmptyState(true);
        }
        
        if (saveHistory) {
            this.core.saveHistory('删除节点');
        }
        
        if (updatePanel) {
            this.ui.updateHistoryPanel();
        }
    }

    renderPropertyPanel(node) {
        const info = this.core.nodeTypeInfo[node.type] || {};
        const hasParams = Object.keys(node.parameters || {}).length > 0;
        const importedNodeInfo = this.ui.importedNodeInfo;
        
        this.propertyContent.innerHTML = `
            ${importedNodeInfo?.style.display === 'block' ? importedNodeInfo.outerHTML : ''}
            
            <div class="workflow-summary">
                <div class="summary-row"><span class="label">节点数量</span><span class="value" id="nodeCount">${this.core.nodes.length}</span></div>
                <div class="summary-row"><span class="label">连接数量</span><span class="value" id="edgeCount">${this.core.edges.length}</span></div>
                <div class="summary-row"><span class="label">开始节点</span><span class="value" id="startCount">${this.core.nodes.filter(n => n.type === 'start').length}</span></div>
                <div class="summary-row"><span class="label">结束节点</span><span class="value" id="endCount">${this.core.nodes.filter(n => n.type === 'end').length}</span></div>
            </div>
            
            <div class="property-panel-section">
                <h4>${info.icon} ${node.title}</h4>
                <div class="property-group">
                    <label class="property-label">类型</label>
                    <input class="property-input" type="text" value="${node.type}" readonly>
                </div>
                <div class="property-group">
                    <label class="property-label">位置</label>
                    <input class="property-input" type="text" value="(${Math.round(node.x)}, ${Math.round(node.y)})" readonly>
                </div>
                <div class="property-group">
                    <label class="property-label">描述</label>
                    <textarea class="property-textarea" readonly>${node.description}</textarea>
                </div>
                ${hasParams ? `
                <div class="property-group">
                    <label class="property-label">参数</label>
                    <pre class="property-pre">${JSON.stringify(node.parameters, null, 2)}</pre>
                </div>
                ` : ''}
                <button class="btn btn-danger" onclick="workflowUI.deleteNode('${node.id}')">删除节点</button>
            </div>
        `;
    }

    openEditor(nodeId) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        let paramsHtml = '';
        params.forEach(param => {
            const value = node.parameters?.[param.name] ?? param.defaultValue;
            paramsHtml += this.renderParamInput(param, value);
        });
        
        const modal = document.createElement('div');
        modal.className = 'node-editor-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content node-editor-content">
                <div class="modal-header">
                    <h3>${info.icon || '📦'} 编辑节点</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <h4>基本信息</h4>
                        <div class="form-group">
                            <label>节点标题</label>
                            <input type="text" class="form-input" id="editTitle" value="${node.title}">
                        </div>
                        <div class="form-group">
                            <label>节点描述</label>
                            <textarea class="form-textarea" id="editDescription">${node.description || ''}</textarea>
                        </div>
                    </div>
                    ${params.length > 0 ? `
                    <div class="form-section">
                        <h4>参数配置</h4>
                        ${paramsHtml}
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">取消</button>
                    <button class="btn btn-primary" onclick="workflowUI.saveNodeEdit('${nodeId}')">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    renderParamInput(param, value) {
        const required = param.required ? '<span class="required">*</span>' : '';
        let inputHtml = '';
        
        switch (param.type) {
            case 'select':
                const options = param.options.map(opt => 
                    `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
                ).join('');
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <select class="form-select" id="param_${param.name}">${options}</select>
                    </div>
                `;
                break;
                
            case 'number':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <input type="number" class="form-input" id="param_${param.name}" 
                               value="${value}" min="${param.min}" max="${param.max}" step="${param.step || 1}">
                    </div>
                `;
                break;
                
            case 'textarea':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea" id="param_${param.name}">${value}</textarea>
                    </div>
                `;
                break;
                
            case 'json':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea form-textarea-code" id="param_${param.name}" placeholder="{}">${value}</textarea>
                    </div>
                `;
                break;
                
            case 'code':
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <textarea class="form-textarea form-textarea-code" rows="8" id="param_${param.name}">${value}</textarea>
                    </div>
                `;
                break;
                
            default:
                inputHtml = `
                    <div class="form-group">
                        <label>${param.label}${required}</label>
                        <input type="text" class="form-input" id="param_${param.name}" value="${value}">
                    </div>
                `;
        }
        
        return inputHtml;
    }

    saveEdit(nodeId) {
        const node = this.core.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const title = document.getElementById('editTitle').value;
        const description = document.getElementById('editDescription').value;
        
        if (title) {
            node.title = title;
            const el = document.querySelector(`[data-node-id="${nodeId}"] .node-title`);
            if (el) el.textContent = title;
        }
        
        node.description = description;
        const descEl = document.querySelector(`[data-node-id="${nodeId}"] .node-description`);
        if (descEl) descEl.textContent = description;
        
        // 保存参数配置
        const info = this.core.nodeTypeInfo[node.type] || {};
        const params = info.parameters || [];
        
        if (!node.parameters) {
            node.parameters = {};
        }
        
        params.forEach(param => {
            const input = document.getElementById(`param_${param.name}`);
            if (input) {
                let value = input.value;
                
                if (param.type === 'number') {
                    value = parseFloat(value);
                } else if (param.type === 'json') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        value = input.value;
                    }
                }
                
                node.parameters[param.name] = value;
            }
        });
        
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            node.width = rect.width;
            node.height = rect.height;
        }
        
        this.ui.updateEdges();
        
        document.querySelector('.node-editor-modal').remove();
        
        if (this.core.selectedNode === nodeId) {
            this.renderPropertyPanel(node);
        }
        
        this.core.saveHistory('编辑节点');
        this.ui.updateHistoryPanel();
    }
}