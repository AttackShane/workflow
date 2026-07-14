import { getNodeTypeName, getNodeColor, convertLargeNumbersToStrings } from '../utils/utils.js';
import { StringUtils, getJsyaml } from '../utils/helpers.js';
import { Logger } from '../utils/logger.js';
import { showNodeDetail } from './shared-node-detail.js';

class GraphView {
    constructor() {
        this._workflowGraph = null;
        this._graphRenderCount = 0;
    }

    _showNodeDetail(node) {
        showNodeDetail(node);
    }

    _findField(obj, ...keys) {
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

    renderWorkflowGraph = (data, isJson) => {
        try {
            const parsedData = isJson ? JSON.parse(data) : getJsyaml().load(convertLargeNumbersToStrings(data));

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
                this._workflowGraph.innerHTML = `
                    <div class="workflow-empty">
                        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📊</div>
                        <div>暂无节点数据</div>
                        <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">
                            支持格式: { nodes: [...], edges: [...] }
                        </div>
                        <div style="font-size: 0.7rem; margin-top: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: 0.5rem; text-align: left; max-height: 200px; overflow: auto;">
                            <div style="margin-bottom: 0.25rem; font-weight: 500;">数据结构预览:</div>
                            <pre style="margin: 0; font-family: monospace; font-size: 0.65rem;">${StringUtils.escapeHtml(dataPreview)}${data.length > 500 ? '...' : ''}</pre>
                        </div>
                    </div>
                `;
                return;
            }

            const nodeMap = new Map();
            const nodePositions = new Map();
            const nodeTypes = new Map();
            let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
            const hasPositionData = nodes.some((node) => {
                const pos = this._findField(node, 'position', 'meta.position', 'data.position');
                return pos && (pos.x !== undefined || pos.y !== undefined);
            });

            nodes.forEach((node, index) => {
                const nodeId = this._findField(node, 'id', 'nodeId', 'key', 'uid', 'uuid', 'node.id', 'data.id', '_id');
                const finalId = nodeId !== undefined ? nodeId : JSON.stringify(node).substring(0, 20);
                const rawType = this._findField(
                    node,
                    'type',
                    'nodeType',
                    'category',
                    'kind',
                    'data.type',
                    'node.type',
                    'config.type',
                    'data.nodeMeta.type'
                );

                const pos = this._findField(node, 'position', 'meta.position', 'data.position');

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

            const nodesSvg = nodes
                .map((node) => {
                    const nodeId =
                        this._findField(node, 'id', 'nodeId', 'key', 'uid', 'uuid', 'node.id', 'data.id', '_id') || '';
                    const nodeName =
                        this._findField(
                            node,
                            'title',
                            'name',
                            'label',
                            'displayName',
                            'nodeName',
                            'data.nodeMeta.title',
                            'data.name',
                            'data.label',
                            'data.title',
                            'props.name',
                            'config.name',
                            'node.name',
                            'meta.name'
                        ) || '未命名';
                    const rawType = this._findField(
                        node,
                        'type',
                        'nodeType',
                        'category',
                        'kind',
                        'data.type',
                        'node.type',
                        'config.type',
                        'data.nodeMeta.type'
                    );
                    const nodeType = getNodeTypeName(rawType);
                    const color = getNodeColor(rawType);
                    const typeStr = String(rawType);

                    const pos = this._findField(node, 'position', 'meta.position', 'data.position');
                    const x = (pos?.x || 0) + offsetX;
                    const y = (pos?.y || 0) + offsetY;

                    const displayName =
                        String(nodeName).length > 14 ? String(nodeName).substring(0, 14) + '...' : nodeName;

                    const fontSize = Math.min(13, Math.max(10, 140 / displayName.length));
                    const typeFontSize = Math.min(11, Math.max(9, 120 / String(nodeType).length));

                    let connectionPoints = '';
                    if (typeStr !== '31') {
                        if (typeStr !== '1') {
                            connectionPoints += `<circle cx="0" cy="${nodeHeight / 2}" r="6" fill="white" stroke="#64748B" stroke-width="2" opacity="0.9"/>`;
                        }
                        if (typeStr !== '2') {
                            connectionPoints += `<circle cx="${nodeWidth}" cy="${nodeHeight / 2}" r="6" fill="white" stroke="#64748B" stroke-width="2" opacity="0.9"/>`;
                        }
                    }

                    return `
                    <g class="workflow-graph-node" data-node-id="${StringUtils.escapeHtml(String(nodeId))}"
                       transform="translate(${x}, ${y})"
                       style="cursor: pointer; transition: transform 0.2s;" title="${StringUtils.escapeHtml(String(nodeName))}">
                        <rect x="0" y="0" width="${nodeWidth}" height="${nodeHeight}"
                              rx="12" ry="12" fill="${color}" stroke="white" stroke-width="2"
                              style="filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));"/>
                        <rect x="3" y="3" width="${nodeWidth - 6}" height="${nodeHeight - 6}"
                              rx="10" ry="10" fill="rgba(255,255,255,0.12)"/>
                        ${connectionPoints}
                        <text x="${nodeWidth / 2}" y="${nodeHeight / 2 - 5}" text-anchor="middle" fill="white" font-size="${fontSize}px" font-weight="600">
                            ${StringUtils.escapeHtml(displayName)}
                        </text>
                        <text x="${nodeWidth / 2}" y="${nodeHeight / 2 + 15}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="${typeFontSize}px">
                            ${StringUtils.escapeHtml(String(nodeType))}
                        </text>
                    </g>
                `;
                })
                .join('');

            this._graphRenderCount++;
            const uniqueId = `graph-${this._graphRenderCount}`;

            const edgesSvg = edges
                .map((edge, index) => {
                    const sourceId =
                        this._findField(
                            edge,
                            'sourceNodeID',
                            'source_node',
                            'source',
                            'from',
                            'src',
                            'startNodeId',
                            'sourceNodeId',
                            'data.source',
                            'node.source',
                            'data.source_node'
                        ) || '';
                    const targetId =
                        this._findField(
                            edge,
                            'targetNodeID',
                            'target_node',
                            'target',
                            'to',
                            'dest',
                            'endNodeId',
                            'targetNodeId',
                            'data.target',
                            'node.target',
                            'data.target_node'
                        ) || '';

                    const sourcePos = nodePositions.get(String(sourceId));
                    const targetPos = nodePositions.get(String(targetId));

                    if (!sourcePos || !targetPos) return '';

                    const x1 = sourcePos.x + offsetX + nodeWidth;
                    const y1 = sourcePos.y + offsetY + nodeHeight / 2;
                    const x2 = targetPos.x + offsetX;
                    const y2 = targetPos.y + offsetY + nodeHeight / 2;

                    const dx = Math.abs(x2 - x1);
                    const _dy = Math.abs(y2 - y1);
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
                })
                .join('');

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
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-${uniqueId})"/>
                    ${edgesSvg}
                    ${nodesSvg}
                </svg>
            `;

            const containerId = `graphContainer-${uniqueId}`;

            this._workflowGraph.innerHTML = `
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
                        if (
                            e.target.tagName === 'rect' ||
                            e.target.tagName === 'text' ||
                            e.target.tagName === 'circle'
                        ) {
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

            this._workflowGraph.querySelectorAll('.workflow-graph-node').forEach((nodeEl) => {
                nodeEl.addEventListener('click', () => {
                    const nodeId = /** @type {HTMLElement} */ (nodeEl).dataset.nodeId;
                    const node = nodeMap.get(nodeId);
                    if (node) {
                        const displayNode = { ...node };
                        delete displayNode.__id;
                        this._showNodeDetail(displayNode);
                    }
                });
            });
        } catch (e) {
            Logger.error('Graph render error:', e);
            this._workflowGraph.innerHTML = `
                <div class="workflow-empty">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">❌</div>
                    <div>无法解析工作流数据</div>
                    <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">
                        错误: ${e.message}
                    </div>
                </div>
            `;
        }
    };

    initGraphModal = () => {
        this._workflowGraph = document.getElementById('workflowGraph');
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

            const { showStatsDetail } = await import('./converter-stats.js');
            const { getCurData, getCurDataType } = await import('./converter-ui.js');

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

                const { getCurData, getCurDataType } = await import('./converter-ui.js');

                if (getCurData()) {
                    this.renderWorkflowGraph(getCurData(), getCurDataType() === 'json');
                }
            });
        }
    };
}

const _instance = new GraphView();
// @ts-ignore
export const renderWorkflowGraph = (...args) => _instance.renderWorkflowGraph(...args);
// @ts-ignore
export const initGraphModal = (...args) => _instance.initGraphModal(...args);
