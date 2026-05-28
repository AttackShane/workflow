import { getNodeTypeName, getNodeColor } from '../utils/utils.js';

let workflowGraph = null;
let graphRenderCount = 0;

/**
 * 在 YAML 字符串中，将大数字（超过安全整数范围）转换为字符串
 * @param {string} input - YAML 字符串
 * @returns {string} 处理后的 YAML 字符串
 */
function convertLargeNumbersToStrings(input) {
    // JavaScript 最大安全整数：2^53 - 1 = 9007199254740991
    // 我们处理 16 位以上的数字，确保安全
    const idPattern = /(\b(id|ref_node|source_node|target_node)\s*:\s*)(\d{16,})/g;
    
    return input.replace(idPattern, (match, prefix, key, numStr) => {
        // 将大数字转换为字符串（添加引号）
        return `${prefix}"${numStr}"`;
    });
}

function showNodeDetail(node) {
    const nodeDetailModal = document.createElement('div');
    nodeDetailModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--bg-primary, #1e293b);
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        padding: 1rem;
        border-bottom: 1px solid var(--border, #334155);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--text-secondary, #94a3b8);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0 0.5rem;
    `;
    modalHeader.innerHTML = '<h3 style="margin: 0; color: var(--text-primary, #f1f5f9); font-size: 1rem;">📦 节点详情</h3>';
    modalHeader.appendChild(closeBtn);
    
    const modalBody = document.createElement('div');
    modalBody.style.cssText = `
        padding: 1rem;
        max-height: calc(85vh - 120px);
        overflow-y: auto;
    `;
    
    const pre = document.createElement('pre');
    pre.style.cssText = `
        background: var(--bg-secondary, #0f172a);
        padding: 1rem;
        border-radius: 8px;
        color: var(--text-primary, #f1f5f9);
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 0.875rem;
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
        max-height: 400px;
        overflow-y: auto;
    `;
    pre.textContent = JSON.stringify(node, null, 2);
    modalBody.appendChild(pre);
    
    const modalFooter = document.createElement('div');
    modalFooter.style.cssText = `
        padding: 1rem;
        border-top: 1px solid var(--border, #334155);
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
    `;
    
    const convertToClipboardFormat = (node) => {
        const pos = node.position || node.meta?.position || { x: 0, y: 0 };
        const nodeMeta = node.data?.nodeMeta || {
            title: node.title || '',
            icon: node.icon || '',
            description: node.description || '',
            mainColor: node.mainColor || '#5C62FF',
            subTitle: node.subTitle || ''
        };
        
        let inputs = {};
        if (node.inputs) {
            inputs = node.inputs;
        } else if (node.data?.inputs) {
            inputs = node.data.inputs;
        } else if (node.parameters) {
            if (node.parameters.branches) {
                inputs = { branches: node.parameters.branches };
            } else {
                inputs = node.parameters;
            }
        } else if (node.data?.parameters) {
            if (node.data.parameters.branches) {
                inputs = { branches: node.data.parameters.branches };
            } else {
                inputs = node.data.parameters;
            }
        }
        
        const nodeWidth = 180;
        const nodeHeight = 80;
        
        const clipboardData = {
            type: "coze-workflow-clipboard-data",
            source: {
                workflowId: node.id || "exported_workflow",
                flowMode: 0,
                spaceId: "7638450388769374260",
                isDouyin: false,
                host: "www.coze.cn"
            },
            json: {
                nodes: [{
                    id: node.id || "exported_node",
                    type: node.type,
                    meta: {
                        position: {
                            x: pos.x,
                            y: pos.y
                        }
                    },
                    data: {
                        nodeMeta: nodeMeta,
                        outputs: node.outputs || node.data?.outputs || [],
                        inputs: inputs
                    },
                    _temp: {
                        bounds: {
                            x: pos.x - nodeWidth/2,
                            y: pos.y - nodeHeight/2,
                            width: nodeWidth,
                            height: nodeHeight
                        },
                        externalData: {
                            icon: nodeMeta.icon,
                            description: nodeMeta.description,
                            title: nodeMeta.title,
                            mainColor: nodeMeta.mainColor
                        }
                    }
                }],
                edges: []
            },
            bounds: {
                x: pos.x - nodeWidth/2,
                y: pos.y - nodeHeight/2,
                width: nodeWidth,
                height: nodeHeight
            }
        };
        return clipboardData;
    };
    
    const copyJsonBtn = document.createElement('button');
    copyJsonBtn.textContent = '📋 复制 JSON';
    copyJsonBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid var(--border, #334155);
        border-radius: 8px;
        background: transparent;
        color: var(--text-primary, #f1f5f9);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyJsonBtn.addEventListener('click', async () => {
        try {
            const clipboardData = convertToClipboardFormat(node);
            await navigator.clipboard.writeText(JSON.stringify(clipboardData, null, 2));
            copyJsonBtn.textContent = '✓ 已复制';
            copyJsonBtn.style.background = '#10B981';
            copyJsonBtn.style.borderColor = '#10B981';
            setTimeout(() => {
                copyJsonBtn.textContent = '📋 复制 JSON';
                copyJsonBtn.style.background = 'transparent';
                copyJsonBtn.style.borderColor = 'var(--border, #334155)';
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    });
    
    const copyYamlBtn = document.createElement('button');
    copyYamlBtn.textContent = '📋 复制 YAML';
    copyYamlBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: none;
        border-radius: 8px;
        background: #5C62FF;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyYamlBtn.addEventListener('click', async () => {
        try {
            const clipboardData = convertToClipboardFormat(node);
            const yamlStr = window.jsyaml.dump(clipboardData, { indent: 2, lineWidth: 120 });
            await navigator.clipboard.writeText(yamlStr);
            copyYamlBtn.textContent = '✓ 已复制';
            copyYamlBtn.style.background = '#10B981';
            setTimeout(() => {
                copyYamlBtn.textContent = '📋 复制 YAML';
                copyYamlBtn.style.background = '#5C62FF';
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    });
    
    const copyRawBtn = document.createElement('button');
    copyRawBtn.textContent = '📋 复制原始节点';
    copyRawBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid #5C62FF;
        border-radius: 8px;
        background: rgba(92, 98, 255, 0.1);
        color: #5C62FF;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyRawBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(node, null, 2));
            copyRawBtn.textContent = '✓ 已复制';
            copyRawBtn.style.background = '#10B981';
            copyRawBtn.style.borderColor = '#10B981';
            copyRawBtn.style.color = 'white';
            setTimeout(() => {
                copyRawBtn.textContent = '📋 复制原始节点';
                copyRawBtn.style.background = 'rgba(92, 98, 255, 0.1)';
                copyRawBtn.style.borderColor = '#5C62FF';
                copyRawBtn.style.color = '#5C62FF';
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    });
    
    const openEditorBtn = document.createElement('button');
    openEditorBtn.textContent = '🛠️ 打开工作流编辑器';
    openEditorBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid #5C62FF;
        border-radius: 8px;
        background: linear-gradient(135deg, #5C62FF 0%, #7C3AED 100%);
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
        font-weight: 500;
    `;
    openEditorBtn.addEventListener('click', async () => {
        const clipboardData = convertToClipboardFormat(node);
        sessionStorage.setItem('workflow-node-data', JSON.stringify(clipboardData));
        window.open('workflow-editor.html', '_blank');
    });
    
    modalFooter.appendChild(openEditorBtn);
    modalFooter.appendChild(copyRawBtn);
    modalFooter.appendChild(copyJsonBtn);
    modalFooter.appendChild(copyYamlBtn);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    nodeDetailModal.appendChild(modalContent);
    
    document.body.appendChild(nodeDetailModal);
    
    const closeModal = () => {
        document.body.removeChild(nodeDetailModal);
    };
    
    nodeDetailModal.addEventListener('click', (e) => {
        if (e.target === nodeDetailModal) closeModal();
    });
    
    closeBtn.addEventListener('click', closeModal);
}

function findField(obj, ...keys) {
    for (const key of keys) {
        if (obj && obj[key] !== undefined) {
            return obj[key];
        }
        const parts = key.split('.');
        let current = obj;
        let found = true;
        for (const part of parts) {
            if (current && current[part] !== undefined) {
                current = current[part];
            } else {
                found = false;
                break;
            }
        }
        if (found && current !== undefined && current !== obj) {
            return current;
        }
    }
    return undefined;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderWorkflowGraph(data, isJson) {
    try {
        const parsedData = isJson ? JSON.parse(data) : window.jsyaml.load(convertLargeNumbersToStrings(data));
        
        let nodes = [];
        let edges = [];
        
        if (parsedData.json && parsedData.json.nodes) {
            nodes = parsedData.json.nodes;
            edges = parsedData.json.edges || [];
        } else if (parsedData.nodes) {
            nodes = parsedData.nodes;
            edges = parsedData.edges || [];
        } else if (Array.isArray(parsedData)) {
            nodes = parsedData;
        } else if (parsedData.type === 'coze-workflow-clipboard-data' && parsedData.data) {
            if (parsedData.data.nodes) {
                nodes = parsedData.data.nodes;
                edges = parsedData.data.edges || [];
            } else if (Array.isArray(parsedData.data)) {
                nodes = parsedData.data;
            }
        }
        
        if (!Array.isArray(nodes) || nodes.length === 0) {
            const dataPreview = JSON.stringify(parsedData, null, 2).substring(0, 500);
            workflowGraph.innerHTML = `
                <div class="workflow-empty">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📊</div>
                    <div>暂无节点数据</div>
                    <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">
                        支持格式: { nodes: [...], edges: [...] }
                    </div>
                    <div style="font-size: 0.7rem; margin-top: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: 0.5rem; text-align: left; max-height: 200px; overflow: auto;">
                        <div style="margin-bottom: 0.25rem; font-weight: 500;">数据结构预览:</div>
                        <pre style="margin: 0; font-family: monospace; font-size: 0.65rem;">${escapeHtml(dataPreview)}${data.length > 500 ? '...' : ''}</pre>
                    </div>
                </div>
            `;
            return;
        }
        
        const nodeMap = new Map();
        const nodePositions = new Map();
        const nodeTypes = new Map();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const hasPositionData = nodes.some(node => {
            const pos = findField(node, 'position', 'meta.position', 'data.position');
            return pos && (pos.x !== undefined || pos.y !== undefined);
        });
        
        nodes.forEach((node, index) => {
            const nodeId = findField(node, 'id', 'nodeId', 'key', 'uid', 'uuid', 'node.id', 'data.id', '_id');
            const finalId = nodeId !== undefined ? nodeId : JSON.stringify(node).substring(0, 20);
            const rawType = findField(node, 'type', 'nodeType', 'category', 'kind', 
                                      'data.type', 'node.type', 'config.type', 'data.nodeMeta.type');
            
            const pos = findField(node, 'position', 'meta.position', 'data.position');
            
            let x, y;
            if (pos && pos.x !== undefined && pos.y !== undefined) {
                x = pos.x;
                y = pos.y;
            } else if (!hasPositionData) {
                const cols = 4;
                const col = index % cols;
                const row = Math.floor(index / cols);
                x = 200 + col * 200;
                y = 150 + row * 140;
            } else {
                x = 0;
                y = 0;
            }
            
            nodeMap.set(String(finalId), { ...node, __id: finalId });
            nodePositions.set(String(finalId), { x, y });
            nodeTypes.set(String(finalId), String(rawType));
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
        
        const padding = 120;
        const nodeWidth = 160;
        const nodeHeight = 80;
        const actualWidth = Math.max(maxX - minX + nodeWidth + padding * 2, 900);
        const actualHeight = Math.max(maxY - minY + nodeHeight + padding * 2, 700);
        const offsetX = padding - minX;
        const offsetY = padding - minY;
        
        const nodesSvg = nodes.map(node => {
            const nodeId = findField(node, 'id', 'nodeId', 'key', 'uid', 'uuid', 'node.id', 'data.id', '_id') || '';
            const nodeName = findField(node, 'title', 'name', 'label', 'displayName', 'nodeName', 
                                      'data.nodeMeta.title', 'data.name', 'data.label', 'data.title', 
                                      'props.name', 'config.name', 'node.name', 'meta.name') || '未命名';
            const rawType = findField(node, 'type', 'nodeType', 'category', 'kind', 
                                      'data.type', 'node.type', 'config.type', 'data.nodeMeta.type');
            const nodeType = getNodeTypeName(rawType);
            const color = getNodeColor(rawType);
            const typeStr = String(rawType);
            
            const pos = findField(node, 'position', 'meta.position', 'data.position');
            const x = (pos?.x || 0) + offsetX;
            const y = (pos?.y || 0) + offsetY;
            
            const displayName = String(nodeName).length > 14 ? String(nodeName).substring(0, 14) + '...' : nodeName;
            
            const fontSize = Math.min(13, Math.max(10, 140 / displayName.length));
            const typeFontSize = Math.min(11, Math.max(9, 120 / String(nodeType).length));
            
            let connectionPoints = '';
            if (typeStr !== '31') {
                if (typeStr !== '1') {
                    connectionPoints += `<circle cx="0" cy="${nodeHeight/2}" r="6" fill="white" stroke="#64748B" stroke-width="2" opacity="0.9"/>`;
                }
                if (typeStr !== '2') {
                    connectionPoints += `<circle cx="${nodeWidth}" cy="${nodeHeight/2}" r="6" fill="white" stroke="#64748B" stroke-width="2" opacity="0.9"/>`;
                }
            }
            
            return `
                <g class="workflow-graph-node" data-node-id="${escapeHtml(String(nodeId))}" 
                   transform="translate(${x}, ${y})"
                   style="cursor: pointer; transition: transform 0.2s;" title="${escapeHtml(String(nodeName))}">
                    <rect x="0" y="0" width="${nodeWidth}" height="${nodeHeight}" 
                          rx="12" ry="12" fill="${color}" stroke="white" stroke-width="2"
                          style="filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));"/>
                    <rect x="3" y="3" width="${nodeWidth - 6}" height="${nodeHeight - 6}" 
                          rx="10" ry="10" fill="rgba(255,255,255,0.12)"/>
                    ${connectionPoints}
                    <text x="${nodeWidth/2}" y="${nodeHeight/2 - 5}" text-anchor="middle" fill="white" font-size="${fontSize}px" font-weight="600">
                        ${escapeHtml(displayName)}
                    </text>
                    <text x="${nodeWidth/2}" y="${nodeHeight/2 + 15}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="${typeFontSize}px">
                        ${escapeHtml(String(nodeType))}
                    </text>
                </g>
            `;
        }).join('');
        
        graphRenderCount++;
        const uniqueId = `graph-${graphRenderCount}`;
        
        const edgesSvg = edges.map((edge, index) => {
            const sourceId = findField(edge, 'sourceNodeID', 'source_node', 'source', 'from', 'src', 'startNodeId', 
                                      'sourceNodeId', 'data.source', 'node.source', 'data.source_node') || '';
            const targetId = findField(edge, 'targetNodeID', 'target_node', 'target', 'to', 'dest', 'endNodeId', 
                                      'targetNodeId', 'data.target', 'node.target', 'data.target_node') || '';
            
            const sourcePos = nodePositions.get(String(sourceId));
            const targetPos = nodePositions.get(String(targetId));
            
            if (!sourcePos || !targetPos) return '';
            
            const x1 = sourcePos.x + offsetX + nodeWidth;
            const y1 = sourcePos.y + offsetY + nodeHeight/2;
            const x2 = targetPos.x + offsetX;
            const y2 = targetPos.y + offsetY + nodeHeight/2;
            
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const controlOffset = Math.max(dx * 0.4, 50);
            
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowOffset = 8;
            const finalX2 = x2 - Math.cos(angle) * arrowOffset;
            const finalY2 = y2 - Math.sin(angle) * arrowOffset;
            
            let pathD;
            if (dx < nodeWidth) {
                pathD = `M ${x1} ${y1} L ${finalX2} ${finalY2}`;
            } else {
                pathD = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${finalX2 - controlOffset} ${finalY2}, ${finalX2} ${finalY2}`;
            }
            
            return `
                <path d="${pathD}"
                      stroke="#64748B" stroke-width="2.5" fill="none" marker-end="url(#arrowhead-${uniqueId})"
                      class="workflow-edge" data-edge-index="${index}"/>
            `;
        }).join('');
        
        const svg = `
            <svg width="${actualWidth}" height="${actualHeight}" 
                 style="background: var(--bg-secondary); border-radius: 12px;">
                <defs>
                    <marker id="arrowhead-${uniqueId}" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
                        <polygon points="0 0, 12 4, 0 8" fill="#64748B"/>
                    </marker>
                    <pattern id="grid-${uniqueId}" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(100, 116, 139, 0.15)" stroke-width="0.5"/>
                    </pattern>
                    <filter id="nodeShadow-${uniqueId}" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.3"/>
                    </filter>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-${uniqueId})"/>
                ${edgesSvg}
                ${nodesSvg}
            </svg>
        `;
        
        const containerId = `graphContainer-${uniqueId}`;
        
        workflowGraph.innerHTML = `
            <div style="width: 100%; height: 500px; overflow: hidden; padding: 1rem; display: flex; flex-direction: column; box-sizing: border-box;">
                <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <span style="font-size: 1.1rem;">🗺️</span>
                    <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">工作流可视化</span>
                    <span style="color: var(--border);">|</span>
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">节点: <strong style="color: var(--accent); font-weight: 600;">${nodes.length}</strong></span>
                    ${edges.length > 0 ? `<span style="color: var(--text-secondary); font-size: 0.9rem;">| 连接: <strong style="color: var(--accent); font-weight: 600;">${edges.length}</strong></span>` : ''}
                </div>
                <div id="${containerId}" style="flex: 1; overflow: auto; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--border);">
                    <div style="min-width: ${actualWidth + 40}px; min-height: ${actualHeight + 40}px; padding: 20px;">
                        ${svg}
                    </div>
                </div>
                <div style="margin-top: 0.75rem; padding: 0.6rem; background: rgba(92, 98, 255, 0.1); border-radius: 6px; display: flex; align-items: center; gap: 0.4rem;">
                    <span style="font-size: 0.75rem;">🖱️</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">拖动查看 | 点击节点查看详情</span>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const container = document.getElementById(containerId);
            if (container) {
                let isDown = false;
                let startX, startY, scrollLeft, scrollTop;
                
                const handleMouseDown = (e) => {
                    if (e.target.tagName === 'rect' || e.target.tagName === 'text' || e.target.tagName === 'circle') {
                        const parent = e.target.closest('g');
                        if (parent && parent.classList.contains('workflow-graph-node')) {
                            return;
                        }
                    }
                    isDown = true;
                    startX = e.pageX - container.offsetLeft;
                    startY = e.pageY - container.offsetTop;
                    scrollLeft = container.scrollLeft;
                    scrollTop = container.scrollTop;
                    container.style.cursor = 'grabbing';
                };
                
                const handleMouseMove = (e) => {
                    if (!isDown) return;
                    e.preventDefault();
                    const x = e.pageX - container.offsetLeft;
                    const y = e.pageY - container.offsetTop;
                    const walkX = x - startX;
                    const walkY = y - startY;
                    container.scrollLeft = scrollLeft - walkX;
                    container.scrollTop = scrollTop - walkY;
                };
                
                const handleMouseUp = () => {
                    isDown = false;
                    container.style.cursor = 'grab';
                };
                
                container.addEventListener('mousedown', handleMouseDown);
                container.addEventListener('mousemove', handleMouseMove);
                container.addEventListener('mouseup', handleMouseUp);
                container.addEventListener('mouseleave', handleMouseUp);
                
                container.style.cursor = 'grab';
            }
        }, 50);
        
        workflowGraph.querySelectorAll('.workflow-graph-node').forEach(nodeEl => {
            nodeEl.addEventListener('click', () => {
                const nodeId = nodeEl.dataset.nodeId;
                const node = nodeMap.get(nodeId);
                if (node) {
                    const displayNode = { ...node };
                    delete displayNode.__id;
                    showNodeDetail(displayNode);
                }
            });
        });
        
    } catch (e) {
        console.error('Graph render error:', e);
        workflowGraph.innerHTML = `
            <div class="workflow-empty">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">❌</div>
                <div>无法解析工作流数据</div>
                <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">
                    错误: ${e.message}
                </div>
            </div>
        `;
    }
}

export function initGraphModal() {
    workflowGraph = document.getElementById('workflowGraph');
    const statsModal = document.getElementById('statsModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const statsTabBtn = document.getElementById('statsTabBtn');
    const graphTabBtn = document.getElementById('graphTabBtn');
    const statsContent = document.getElementById('statsContent');
    const graphContent = document.getElementById('graphContent');
    
    const openStatsBtn = document.createElement('button');
    openStatsBtn.className = 'btn btn-sm btn-outline';
    openStatsBtn.innerHTML = '📊 统计';
    openStatsBtn.addEventListener('click', async () => {
        statsModal.style.display = 'flex';
        statsTabBtn.classList.add('active');
        graphTabBtn.classList.remove('active');
        statsContent.style.display = 'block';
        graphContent.style.display = 'none';
        
        const { showStatsDetail } = await import('./stats-view.js');
        const { getCurData, getCurDataType } = await import('./ui-controller.js');
        
        if (getCurData()) {
            showStatsDetail(getCurData(), getCurDataType() === 'json');
        }
    });
    
    const resultHeader = document.querySelector('.result-header');
    if (resultHeader) {
        resultHeader.appendChild(openStatsBtn);
    }
    
    if (closeModalBtn && statsModal) {
        closeModalBtn.addEventListener('click', () => {
            statsModal.style.display = 'none';
        });
        
        statsModal.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                statsModal.style.display = 'none';
            }
        });
    }
    
    if (statsTabBtn && graphTabBtn && statsContent && graphContent) {
        statsTabBtn.addEventListener('click', () => {
            statsTabBtn.classList.add('active');
            graphTabBtn.classList.remove('active');
            statsContent.style.display = 'block';
            graphContent.style.display = 'none';
        });
    }
    
    if (graphTabBtn && statsTabBtn && statsContent && graphContent) {
        graphTabBtn.addEventListener('click', async () => {
            graphTabBtn.classList.add('active');
            statsTabBtn.classList.remove('active');
            statsContent.style.display = 'none';
            graphContent.style.display = 'block';
            
            const { getCurData, getCurDataType } = await import('./ui-controller.js');
            
            if (getCurData()) {
                renderWorkflowGraph(getCurData(), getCurDataType() === 'json');
            }
        });
    }
}