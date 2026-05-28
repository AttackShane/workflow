import { msg } from './ui-controller.js';
import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, Storage, StringUtils, ArrayUtils } from '../utils/helpers.js';
import { getNodeTypeName } from '../utils/utils.js';

let statsInfo = null;

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

/**
 * 获取历史记录
 * @returns {Array}
 */
export function getHistory() {
    return Storage.get(APP_CONFIG.HISTORY.KEY, []);
}

/**
 * 保存到历史记录
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 * @param {string} name - 名称（可选）
 */
export function saveToHistory(data, isJson, name = '') {
    const history = getHistory();
    
    let workflowName = name || extractWorkflowName(data, isJson);
    if (!workflowName) {
        workflowName = `未命名 ${history.length + 1}`;
    }
    
    const entry = {
        id: Date.now(),
        name: workflowName,
        data: data,
        isJson: isJson,
        timestamp: new Date().toISOString()
    };
    
    history.unshift(entry);
    if (history.length > APP_CONFIG.HISTORY.MAX_ITEMS) {
        history.pop();
    }
    
    Storage.set(APP_CONFIG.HISTORY.KEY, history);
    
    // 设置新保存的记录为选中状态
    Storage.set(APP_CONFIG.HISTORY.SELECTED_KEY, entry.id.toString());
    
    updateHistoryPanel();
}

/**
 * 提取工作流名称
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 * @returns {string}
 */
function extractWorkflowName(data, isJson) {
    try {
        const parsed = isJson ? JSON.parse(data) : window.jsyaml.load(convertLargeNumbersToStrings(data));
        if (parsed && typeof parsed === 'object') {
            return parsed.name || parsed.workflow_name || parsed.title || parsed.json?.name || '';
        }
    } catch {
        // 解析失败时返回空字符串
    }
    return '';
}

/**
 * 更新历史记录面板
 * @param {string} searchQuery - 搜索关键词
 */
export function updateHistoryPanel(searchQuery = '') {
    const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
    const history = getHistory();
    
    // 过滤历史记录
    let filteredHistory = history;
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredHistory = ArrayUtils.filter(history, entry => {
            const name = (entry.name || '').toLowerCase();
            const type = (entry.isJson ? 'json' : 'yaml').toLowerCase();
            const data = (entry.data || '').toLowerCase();
            return name.includes(query) || type.includes(query) || data.includes(query);
        });
    }
    
    if (filteredHistory.length === 0) {
        const message = searchQuery.trim() 
            ? APP_CONFIG.MESSAGES.ERROR.NO_DATA 
            : APP_CONFIG.MESSAGES.ERROR.NO_HISTORY;
        DOM.setHtml(historyList, `<div class="history-item empty">${message}</div>`);
        return;
    }
    
    DOM.setHtml(historyList, filteredHistory.map(entry => `
        <div class="history-item" data-id="${entry.id}">
            <div class="history-content">
                <div class="history-info">
                    <div class="history-name">${StringUtils.escapeHtml(entry.name || '未命名')}</div>
                    <div class="history-meta">
                        <span class="history-type">${entry.isJson ? 'JSON' : 'YAML'}</span>
                        <span class="history-time">${StringUtils.formatTime(entry.timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="history-actions">
                <button class="edit-btn" title="编辑名称">✏️</button>
                <button class="delete-btn" title="删除">🗑️</button>
            </div>
        </div>
    `).join(''));
    
    // 绑定事件
    bindHistoryItemEvents();
    
    // 设置选中状态
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        // 清除之前的选中状态
        historyList.querySelectorAll('.history-item').forEach(el => DOM.removeClass(el, 'active'));
        
        // 查找并设置新的选中状态
        const selectedItem = historyList.querySelector(`[data-id="${selectedId}"]`);
        if (selectedItem) {
            DOM.addClass(selectedItem, 'active');
        }
    }
}

/**
 * 绑定历史记录项事件
 */
function bindHistoryItemEvents() {
    const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
    if (!historyList) return;
    
    historyList.querySelectorAll('.history-item').forEach(item => {
        const id = parseInt(item.dataset.id);
        
        const content = item.querySelector('.history-content');
        DOM.on(content, 'click', () => handleHistoryItemClick(id));
        
        const editBtn = item.querySelector('.edit-btn');
        DOM.on(editBtn, 'click', (e) => {
            e.stopPropagation();
            handleHistoryItemEdit(id);
        });
        
        const deleteBtn = item.querySelector('.delete-btn');
        DOM.on(deleteBtn, 'click', (e) => {
            e.stopPropagation();
            handleHistoryItemDelete(id);
        });
    });
}

/**
 * 删除历史记录项
 * @param {number} id - 记录 ID
 */
export function deleteHistoryItem(id) {
    const history = getHistory();
    const filtered = ArrayUtils.filter(history, h => h.id !== id);
    Storage.set(APP_CONFIG.HISTORY.KEY, filtered);
    
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    // 处理类型不匹配问题：存储的是字符串，比较时转换为相同类型
    if (selectedId !== null && selectedId !== undefined) {
        if (String(selectedId) === String(id)) {
            Storage.remove(APP_CONFIG.HISTORY.SELECTED_KEY);
        }
    }
    
    updateHistoryPanel();
}

/**
 * 更新历史记录项名称
 * @param {number} id - 记录 ID
 * @param {string} name - 新名称
 */
export function updateHistoryItem(id, name) {
    const history = getHistory();
    const entry = ArrayUtils.find(history, h => h.id === id);
    if (entry) {
        entry.name = name;
        Storage.set(APP_CONFIG.HISTORY.KEY, history);
        updateHistoryPanel();
    }
}

/**
 * 导出历史记录
 */
export function exportHistory() {
    const history = getHistory();
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = DOM.create('a', {
        href: url,
        download: `workflow-history-${new Date().toISOString().split('T')[0]}.json`
    });
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 导入历史记录
 * @param {Event} event - 文件选择事件
 */
export function importHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target?.result || '[]');
            if (Array.isArray(imported)) {
                const history = getHistory();
                const existingIds = new Set(history.map(h => h.id));
                imported.forEach(item => {
                    if (!existingIds.has(item.id) && item.data && item.isJson !== undefined) {
                        history.unshift(item);
                    }
                });
                if (history.length > APP_CONFIG.HISTORY.MAX_ITEMS) {
                    history.splice(APP_CONFIG.HISTORY.MAX_ITEMS);
                }
                Storage.set(APP_CONFIG.HISTORY.KEY, history);
                updateHistoryPanel();
                msg(APP_CONFIG.MESSAGES.SUCCESS.IMPORT(imported.length), false);
            } else {
                msg('导入的数据格式不正确', true);
            }
        } catch {
            msg('导入失败：无效的 JSON 文件', true);
        }
    };
    reader.readAsText(file);
}

/**
 * 清空历史记录
 */
export function clearHistory() {
    Storage.remove(APP_CONFIG.HISTORY.KEY);
    Storage.remove(APP_CONFIG.HISTORY.SELECTED_KEY);
    updateHistoryPanel();
    msg('历史记录已清空', false);
}

/**
 * 显示统计信息
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 */
export function showStats(data, isJson) {
    if (!statsInfo) return;
    
    let stats = {};
    
    try {
        const parsed = isJson ? JSON.parse(data) : window.jsyaml.load(convertLargeNumbersToStrings(data));
        
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
    
    statsInfo.innerHTML = `
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

export function showStatsDetail(data, isJson) {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;
    
    let detailStats = {};
    
    try {
        const parsed = isJson ? JSON.parse(data) : window.jsyaml.load(convertLargeNumbersToStrings(data));
        
        if (parsed && typeof parsed === 'object') {
            const workflowData = isJson ? parsed.json : parsed;
            
            detailStats = {
                name: parsed.name || workflowData?.name || '未命名',
                type: isJson ? 'Coze JSON' : 'YAML',
                nodeCount: workflowData?.nodes?.length || 0,
                edgeCount: workflowData?.edges?.length || 0,
                keys: Object.keys(parsed).length
            };
            
            if (workflowData?.nodes) {
                const nodeTypes = {};
                workflowData.nodes.forEach(node => {
                    const rawType = node.type || node.data?.nodeMeta?.type || node.data?.nodeMeta?.title || '未知';
                    const displayType = getNodeTypeName(rawType);
                    nodeTypes[displayType] = (nodeTypes[displayType] || 0) + 1;
                });
                detailStats.nodeTypes = nodeTypes;
            }
        }
    } catch (error) {
        console.error('解析统计数据失败:', error);
    }
    
    const nodeTypesHtml = detailStats.nodeTypes ? `
        <div class="stats-section">
            <h4>节点类型分布</h4>
            <div class="node-types">
                ${Object.entries(detailStats.nodeTypes).map(([type, count]) => `
                    <div class="node-type-item">
                        <span class="node-type-name">${StringUtils.escapeHtml(type)}</span>
                        <span class="node-type-count">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';
    
    statsContent.innerHTML = `
        <div class="stats-detail">
            <div class="stats-section">
                <h4>基本信息</h4>
                <div class="stat-row">
                    <span class="stat-label">工作流名称</span>
                    <span class="stat-value">${StringUtils.escapeHtml(detailStats.name)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">数据格式</span>
                    <span class="stat-value">${detailStats.type}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">顶层键数</span>
                    <span class="stat-value">${detailStats.keys}</span>
                </div>
            </div>
            
            <div class="stats-section">
                <h4>工作流统计</h4>
                <div class="stat-row">
                    <span class="stat-label">节点数量</span>
                    <span class="stat-value highlight">${detailStats.nodeCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">边数量</span>
                    <span class="stat-value highlight">${detailStats.edgeCount}</span>
                </div>
            </div>
            
            ${nodeTypesHtml}
        </div>
    `;
}

/**
 * 处理历史记录项点击
 * @param {number} id - 记录 ID
 */
function handleHistoryItemClick(id) {
    const history = getHistory();
    const entry = ArrayUtils.find(history, h => h.id === id);
    if (entry) {
        // 动态导入以避免循环依赖
        import('./ui-controller.js').then(({ displayOutput }) => {
            displayOutput(entry.data, entry.isJson, false);
            
            const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
            historyList.querySelectorAll('.history-item').forEach(el => DOM.removeClass(el, 'active'));
            
            const item = historyList.querySelector(`[data-id="${id}"]`);
            if (item) {
                DOM.addClass(item, 'active');
                Storage.set(APP_CONFIG.HISTORY.SELECTED_KEY, id.toString());
            }
        });
    }
}

/**
 * 处理历史记录项编辑
 * @param {number} id - 记录 ID
 */
function handleHistoryItemEdit(id) {
    const history = getHistory();
    const entry = ArrayUtils.find(history, h => h.id === id);
    if (entry) {
        showEditModal(id, entry.name);
    }
}

/**
 * 显示编辑模态框
 * @param {number} id - 记录 ID
 * @param {string} currentName - 当前名称
 */
function showEditModal(id, currentName) {
    const editModal = DOM.create('div');
    editModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = DOM.create('div');
    modalContent.style.cssText = `
        background: var(--bg-primary, #1e293b);
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    const modalHeader = DOM.create('div');
    modalHeader.style.cssText = `
        padding: 1rem;
        border-bottom: 1px solid var(--border, #334155);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--text-primary, #f1f5f9); font-size: 1rem;">✏️ 编辑名称</h3>
        <button id="closeEditModal" style="
            background: none;
            border: none;
            color: var(--text-secondary, #94a3b8);
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        ">×</button>
    `;
    
    const modalBody = DOM.create('div');
    modalBody.style.cssText = `
        padding: 1rem;
    `;
    
    const input = DOM.create('input', {
        type: 'text',
        value: currentName,
        style: {
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--border, #334155)',
            borderRadius: '8px',
            background: 'var(--bg-secondary, #334155)',
            color: 'var(--text-primary, #f1f5f9)',
            fontSize: '1rem',
            boxSizing: 'border-box',
            outline: 'none'
        }
    });
    
    const modalFooter = DOM.create('div');
    modalFooter.style.cssText = `
        padding: 1rem;
        border-top: 1px solid var(--border, #334155);
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
    `;
    
    const cancelBtn = DOM.create('button', {
        text: '取消',
        style: {
            padding: '0.5rem 1.5rem',
            border: '1px solid var(--border, #334155)',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--text-primary, #f1f5f9)',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(cancelBtn, 'click', () => document.body.removeChild(editModal));
    DOM.on(cancelBtn, 'mouseenter', () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)');
    DOM.on(cancelBtn, 'mouseleave', () => cancelBtn.style.background = 'transparent');
    
    const saveBtn = DOM.create('button', {
        text: '保存',
        style: {
            padding: '0.5rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            background: '#5C62FF',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(saveBtn, 'click', () => {
        const newName = input.value.trim();
        if (newName) {
            updateHistoryItem(id, newName);
            document.body.removeChild(editModal);
        }
    });
    DOM.on(saveBtn, 'mouseenter', () => saveBtn.style.background = '#4F46E5');
    DOM.on(saveBtn, 'mouseleave', () => saveBtn.style.background = '#5C62FF');
    
    DOM.on(input, 'keydown', (e) => {
        if (e.key === 'Enter') {
            const newName = input.value.trim();
            if (newName) {
                updateHistoryItem(id, newName);
                document.body.removeChild(editModal);
            }
        }
    });
    
    modalFooter.appendChild(cancelBtn);
    modalFooter.appendChild(saveBtn);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalBody.appendChild(input);
    modalContent.appendChild(modalFooter);
    editModal.appendChild(modalContent);
    
    document.body.appendChild(editModal);
    
    const closeModal = () => document.body.removeChild(editModal);
    
    DOM.on(editModal, 'click', (e) => {
        if (e.target === editModal) closeModal();
    });
    
    DOM.on(DOM.get('closeEditModal'), 'click', closeModal);
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
}

/**
 * 处理历史记录项删除
 * @param {number} id - 记录 ID
 */
function handleHistoryItemDelete(id) {
    showDeleteConfirm(id);
}

/**
 * 显示删除确认模态框
 * @param {number} id - 记录 ID
 */
function showDeleteConfirm(id) {
    const confirmModal = DOM.create('div');
    confirmModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = DOM.create('div');
    modalContent.style.cssText = `
        background: var(--bg-primary, #1e293b);
        border-radius: 12px;
        width: 90%;
        max-width: 360px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    const modalBody = DOM.create('div');
    modalBody.style.cssText = `
        padding: 1.5rem;
        text-align: center;
    `;
    modalBody.innerHTML = `
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🗑️</div>
        <p style="color: var(--text-primary, #f1f5f9); margin: 0 0 1rem 0;">确定要删除这条记录吗？</p>
        <p style="color: var(--text-secondary, #94a3b8); margin: 0; font-size: 0.875rem;">此操作无法撤销</p>
    `;
    
    const modalFooter = DOM.create('div');
    modalFooter.style.cssText = `
        padding: 1rem;
        border-top: 1px solid var(--border, #334155);
        display: flex;
        gap: 0.75rem;
        justify-content: center;
    `;
    
    const cancelBtn = DOM.create('button', {
        text: '取消',
        style: {
            padding: '0.5rem 1.5rem',
            border: '1px solid var(--border, #334155)',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--text-primary, #f1f5f9)',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(cancelBtn, 'click', () => document.body.removeChild(confirmModal));
    DOM.on(cancelBtn, 'mouseenter', () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)');
    DOM.on(cancelBtn, 'mouseleave', () => cancelBtn.style.background = 'transparent');
    
    const deleteBtn = DOM.create('button', {
        text: '删除',
        style: {
            padding: '0.5rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            background: '#ef4444',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(deleteBtn, 'click', () => {
        deleteHistoryItem(id);
        document.body.removeChild(confirmModal);
    });
    DOM.on(deleteBtn, 'mouseenter', () => deleteBtn.style.background = '#dc2626');
    DOM.on(deleteBtn, 'mouseleave', () => deleteBtn.style.background = '#ef4444');
    
    modalFooter.appendChild(cancelBtn);
    modalFooter.appendChild(deleteBtn);
    
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    confirmModal.appendChild(modalContent);
    
    document.body.appendChild(confirmModal);
    
    DOM.on(confirmModal, 'click', (e) => {
        if (e.target === confirmModal) {
            document.body.removeChild(confirmModal);
        }
    });
}

/**
 * 显示清空确认模态框
 */
function showClearConfirm() {
    const confirmModal = DOM.create('div');
    confirmModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const modalContent = DOM.create('div');
    modalContent.style.cssText = `
        background: var(--bg-primary, #1e293b);
        border-radius: 12px;
        width: 90%;
        max-width: 360px;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    const modalBody = DOM.create('div');
    modalBody.style.cssText = `
        padding: 1.5rem;
        text-align: center;
    `;
    modalBody.innerHTML = `
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
        <p style="color: var(--text-primary, #f1f5f9); margin: 0 0 1rem 0;">确定要清空所有历史记录吗？</p>
        <p style="color: var(--text-secondary, #94a3b8); margin: 0; font-size: 0.875rem;">此操作无法撤销</p>
    `;
    
    const modalFooter = DOM.create('div');
    modalFooter.style.cssText = `
        padding: 1rem;
        border-top: 1px solid var(--border, #334155);
        display: flex;
        gap: 0.75rem;
        justify-content: center;
    `;
    
    const cancelBtn = DOM.create('button', {
        text: '取消',
        style: {
            padding: '0.5rem 1.5rem',
            border: '1px solid var(--border, #334155)',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--text-primary, #f1f5f9)',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(cancelBtn, 'click', () => document.body.removeChild(confirmModal));
    DOM.on(cancelBtn, 'mouseenter', () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)');
    DOM.on(cancelBtn, 'mouseleave', () => cancelBtn.style.background = 'transparent');
    
    const clearBtn = DOM.create('button', {
        text: '清空',
        style: {
            padding: '0.5rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            background: '#ef4444',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s'
        }
    });
    DOM.on(clearBtn, 'click', () => {
        clearHistory();
        document.body.removeChild(confirmModal);
    });
    DOM.on(clearBtn, 'mouseenter', () => clearBtn.style.background = '#dc2626');
    DOM.on(clearBtn, 'mouseleave', () => clearBtn.style.background = '#ef4444');
    
    modalFooter.appendChild(cancelBtn);
    modalFooter.appendChild(clearBtn);
    
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    confirmModal.appendChild(modalContent);
    
    document.body.appendChild(confirmModal);
    
    DOM.on(confirmModal, 'click', (e) => {
        if (e.target === confirmModal) {
            document.body.removeChild(confirmModal);
        }
    });
}

/**
 * 初始化历史记录面板
 */
export function initHistoryPanel() {
    statsInfo = DOM.get('statsInfo');
    const clearHistoryBtn = DOM.get(SELECTORS.CONVERTER.CLEAR_HISTORY_BTN);
    const importHistoryBtn = DOM.get(SELECTORS.CONVERTER.IMPORT_HISTORY_BTN);
    const exportHistoryBtn = DOM.get(SELECTORS.CONVERTER.EXPORT_HISTORY_BTN);
    const historySearchInput = DOM.get(SELECTORS.CONVERTER.HISTORY_SEARCH);
    
    const importFileInput = DOM.create('input', {
        type: 'file',
        accept: '.json',
        style: { display: 'none' }
    });
    DOM.on(importFileInput, 'change', importHistory);
    document.body.appendChild(importFileInput);
    
    DOM.on(clearHistoryBtn, 'click', showClearConfirm);
    DOM.on(importHistoryBtn, 'click', () => importFileInput.click());
    DOM.on(exportHistoryBtn, 'click', exportHistory);
    
    // 添加搜索功能
    DOM.on(historySearchInput, 'input', (e) => {
        updateHistoryPanel(e.target.value);
    });
    
    updateHistoryPanel();
    
    // 如果有选中的历史记录，加载并显示它
    loadSelectedHistory();
}

/**
 * 加载选中的历史记录并显示
 */
function loadSelectedHistory() {
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        const history = getHistory();
        const entry = ArrayUtils.find(history, h => String(h.id) === String(selectedId));
        if (entry) {
            import('./ui-controller.js').then(({ displayOutput }) => {
                displayOutput(entry.data, entry.isJson, false);
            });
        }
    }
}