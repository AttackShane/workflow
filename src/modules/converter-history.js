import { APP_CONFIG } from '../config/constants.js';
import { Storage, getJsyaml } from '../utils/helpers.js';
import { convertLargeNumbersToStrings } from '../utils/utils.js';

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
 * @returns {object} - 保存的记录
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
    Storage.set(APP_CONFIG.HISTORY.SELECTED_KEY, entry.id.toString());
    
    return entry;
}

/**
 * 提取工作流名称
 * @param {string} data - 数据内容
 * @param {boolean} isJson - 是否为 JSON 格式
 * @returns {string}
 */
function extractWorkflowName(data, isJson) {
    try {
        const parsed = isJson ? JSON.parse(data) : getJsyaml().load(convertLargeNumbersToStrings(data));
        if (parsed && typeof parsed === 'object') {
            return parsed.name || parsed.workflow_name || parsed.title || parsed.json?.name || '';
        }
    } catch {
        // 解析失败时返回空字符串
    }
    return '';
}

/**
 * 删除历史记录项
 * @param {number} id - 记录 ID
 * @returns {boolean} - 是否删除成功
 */
export function deleteHistoryItem(id) {
    const history = getHistory();
    const filtered = history.filter(h => h.id !== id);
    
    if (filtered.length === history.length) {
        return false; // 未找到要删除的记录
    }
    
    Storage.set(APP_CONFIG.HISTORY.KEY, filtered);
    
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        if (String(selectedId) === String(id)) {
            Storage.remove(APP_CONFIG.HISTORY.SELECTED_KEY);
        }
    }
    
    return true;
}

/**
 * 更新历史记录项名称
 * @param {number} id - 记录 ID
 * @param {string} name - 新名称
 * @returns {string|false} - 更新后的数据字符串，失败返回 false
 */
export function updateHistoryItem(id, name) {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (entry) {
        entry.name = name;
        let updatedData = null;
        try {
            const parsed = entry.isJson
                ? JSON.parse(entry.data)
                : getJsyaml().load(convertLargeNumbersToStrings(entry.data));
            if (parsed && typeof parsed === 'object') {
                parsed.name = name;
                if (parsed.json && typeof parsed.json === 'object') {
                    parsed.json.name = name;
                }
                entry.data = entry.isJson
                    ? JSON.stringify(parsed, null, 2)
                    : getJsyaml().dump(parsed);
                updatedData = entry.data;
            }
        } catch {
            // 解析失败时仅更新显示名称
        }
        Storage.set(APP_CONFIG.HISTORY.KEY, history);
        return updatedData || entry.data;
    }
    return false;
}

/**
 * 导出历史记录
 * @returns {string} - JSON 字符串
 */
export function exportHistory() {
    const history = getHistory();
    return JSON.stringify(history, null, 2);
}

/**
 * 导入历史记录
 * @param {Array} historyData - 历史记录数据
 * @returns {number} - 成功导入的记录数
 */
export function importHistory(historyData) {
    if (!Array.isArray(historyData)) {
        throw new Error('无效的历史记录数据格式');
    }
    
    const existingHistory = getHistory();
    
    // 过滤无效记录并去重
    const validEntries = historyData.filter(entry => 
        entry && typeof entry === 'object' && entry.id && entry.data !== undefined
    );
    
    // 合并记录，去重
    const merged = [...validEntries, ...existingHistory];
    const seen = new Set();
    const deduplicated = merged.filter(entry => {
        const key = String(entry.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // 按时间戳降序排列（最新的在前）
    deduplicated.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
    });

    // 限制最大数量
    if (deduplicated.length > APP_CONFIG.HISTORY.MAX_ITEMS) {
        deduplicated.splice(APP_CONFIG.HISTORY.MAX_ITEMS);
    }
    
    Storage.set(APP_CONFIG.HISTORY.KEY, deduplicated);
    return deduplicated.length;
}

/**
 * 清空历史记录
 */
export function clearHistory() {
    Storage.remove(APP_CONFIG.HISTORY.KEY);
    Storage.remove(APP_CONFIG.HISTORY.SELECTED_KEY);
}

/**
 * 获取选中的历史记录 ID
 * @returns {string|null}
 */
export function getSelectedHistoryId() {
    return Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY, null);
}

/**
 * 设置选中的历史记录 ID
 * @param {string|number} id - 记录 ID
 */
export function setSelectedHistoryId(id) {
    Storage.set(APP_CONFIG.HISTORY.SELECTED_KEY, String(id));
}