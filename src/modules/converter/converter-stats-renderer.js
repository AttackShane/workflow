import { convertLargeNumbersToStrings, getNodeTypeName } from '../../utils/utils.js';
import { StringUtils, getJsyaml } from '../../utils/helpers.js';

/**
 * 渲染统计信息
 * @param {HTMLElement} container - 容器元素
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 */
export function renderStats(container, data, isJson) {
    if (!container) return;
    
    let stats = {};
    
    try {
        const parsed = isJson ? JSON.parse(data) : getJsyaml().load(convertLargeNumbersToStrings(data));
        
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed)) {
                stats = {
                    type: 'array',
                    length: parsed.length
                };
            } else {
                stats = {
                    type: 'object',
                    keys: Object.keys(parsed).length
                };
            }
        }
    } catch {
        // 解析失败时显示默认统计
    }
    
    const lines = data.split('\n').length;
    const chars = data.length;
    const words = data.trim().split(/\s+/).length;
    
    container.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">行数</span>
            <span class="stat-value">${lines}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">字符</span>
            <span class="stat-value">${chars}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">单词</span>
            <span class="stat-value">${words}</span>
        </div>
        ${stats.type ? `
        <div class="stat-item">
            <span class="stat-label">${stats.type === 'array' ? '元素数' : '键数'}</span>
            <span class="stat-value">${stats.length || stats.keys}</span>
        </div>
        ` : ''}
    `;
}

/**
 * 渲染详细统计信息
 * @param {HTMLElement} container - 容器元素
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 */
export function renderStatsDetail(container, data, isJson) {
    if (!container) return;
    
    let detailStats = /** @type {*} */ ({});
    
    try {
        const parsed = isJson ? JSON.parse(data) : getJsyaml().load(convertLargeNumbersToStrings(data));
        
        if (parsed && typeof parsed === 'object') {
            const workflowData = isJson ? parsed.json : parsed;
            
            detailStats = {
                name: parsed.name || workflowData?.name || '未命名',
                type: isJson ? 'Coze JSON' : 'YAML',
                nodeCount: workflowData?.nodes?.length || 0,
                edgeCount: workflowData?.edges?.length || 0,
                keys: Object.keys(parsed).length
            };
            
            if (workflowData?.nodes && Array.isArray(workflowData.nodes)) {
                const nodeTypes = {};
                const nodeTypeNames = {};
                
                workflowData.nodes.forEach(node => {
                    const type = node.type;
                    nodeTypes[type] = (nodeTypes[type] || 0) + 1;
                    const rawType = node.raw_type || node.type;
                    nodeTypeNames[type] = getNodeTypeName(rawType);
                });
                
                detailStats.nodeTypes = nodeTypes;
                detailStats.nodeTypeNames = nodeTypeNames;
            }
        }
    } catch {
        // 解析失败
    }
    
    let nodeTypeHtml = '';
    if (detailStats.nodeTypes) {
        nodeTypeHtml = `
            <div class="stats-detail-section">
                <h4>节点类型分布</h4>
                <div class="node-type-list">
                    ${Object.entries(detailStats.nodeTypes).map(([type, count]) => `
                        <div class="node-type-item">
                            <span class="node-type-name">${StringUtils.escapeHtml(detailStats.nodeTypeNames[type] || type)}</span>
                            <span class="node-type-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <h3>${StringUtils.escapeHtml(detailStats.name)}</h3>
        <div class="stats-detail-grid">
            <div class="stats-detail-item">
                <span class="stats-detail-label">格式</span>
                <span class="stats-detail-value">${detailStats.type}</span>
            </div>
            <div class="stats-detail-item">
                <span class="stats-detail-label">节点数</span>
                <span class="stats-detail-value">${detailStats.nodeCount}</span>
            </div>
            <div class="stats-detail-item">
                <span class="stats-detail-label">连线数</span>
                <span class="stats-detail-value">${detailStats.edgeCount}</span>
            </div>
            <div class="stats-detail-item">
                <span class="stats-detail-label">字段数</span>
                <span class="stats-detail-value">${detailStats.keys}</span>
            </div>
        </div>
        ${nodeTypeHtml}
    `;
}