import { msg } from './ui-controller.js';
import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, Storage, StringUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { 
    getHistory as getData, 
    saveToHistory as saveData, 
    deleteHistoryItem as deleteData, 
    updateHistoryItem as updateData, 
    exportHistory as exportData, 
    importHistory as importData, 
    clearHistory as clearData 
} from './history-manager.js';
import { renderStats, renderStatsDetail } from './stats-renderer.js';

let statsInfo = null;

function getHistory() {
    return getData();
}

export function updateHistoryPanel(searchQuery = '') {
    const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
    const history = getHistory();
    
    let filteredHistory = history;
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredHistory = history.filter(entry => {
            const name = (entry.name || '').toLowerCase();
            const type = (entry.isJson ? 'json' : 'yaml').toLowerCase();
            const data = (entry.data || '').toLowerCase();
            return name.includes(query) || type.includes(query) || data.includes(query);
        });
    }
    
    if (filteredHistory.length === 0) {
        const message = searchQuery.trim() 
            ? t('converter.noData')
            : t('converter.noHistory');
        DOM.setHtml(historyList, `<div class="history-item empty">${message}</div>`);
        return;
    }
    
    DOM.setHtml(historyList, filteredHistory.map(entry => `
        <div class="history-item" data-id="${entry.id}">
            <div class="history-content">
                <div class="history-info">
                    <div class="history-name">${StringUtils.escapeHtml(entry.name || t('converter.unnamed'))}</div>
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
    
    bindHistoryItemEvents();
    
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        historyList.querySelectorAll('.history-item').forEach(el => DOM.removeClass(el, 'active'));
        
        const selectedItem = historyList.querySelector(`[data-id="${selectedId}"]`);
        if (selectedItem) {
            DOM.addClass(selectedItem, 'active');
        }
    }
}

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

export function saveToHistory(data, isJson, name = '') {
    saveData(data, isJson, name);
    updateHistoryPanel();
}

export function deleteHistoryItem(id) {
    deleteData(id);
    
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        if (String(selectedId) === String(id)) {
            const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
            const lineNumbersContent = DOM.get('lineNumbersContent');
            if (outputArea) {
                outputArea.innerHTML = APP_CONFIG.UI.DEFAULT_OUTPUT;
            }
            if (lineNumbersContent) {
                lineNumbersContent.innerHTML = '';
                lineNumbersContent.style.height = '';
            }
            DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), true);
            DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), true);
        }
    }
    
    updateHistoryPanel();
}

export function updateHistoryItem(id, name) {
    updateData(id, name);
    updateHistoryPanel();
}

export function exportHistory() {
    const dataStr = exportData();
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

export function importHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target?.result || '[]');
            if (Array.isArray(imported)) {
                const importedCount = importData(imported);
                updateHistoryPanel();
                msg(APP_CONFIG.MESSAGES.SUCCESS.IMPORT(importedCount), false);
            } else {
                msg('导入的数据格式不正确', true);
            }
        } catch {
            msg('导入失败：无效的 JSON 文件', true);
        }
    };
    reader.readAsText(file);
}

export function clearHistory() {
    clearData();
    updateHistoryPanel();
    msg('历史记录已清空', false);
    
    const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
    const lineNumbersContent = DOM.get('lineNumbersContent');
    if (outputArea) {
        outputArea.innerHTML = APP_CONFIG.UI.DEFAULT_OUTPUT;
    }
    if (lineNumbersContent) {
        lineNumbersContent.innerHTML = '';
        lineNumbersContent.style.height = '';
    }
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), true);
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), true);
}

export function showStats(data, isJson) {
    if (!statsInfo) return;
    renderStats(statsInfo, data, isJson);
}

export function showStatsDetail(data, isJson) {
    const statsContent = document.getElementById('statsContent');
    renderStatsDetail(statsContent, data, isJson);
}

function handleHistoryItemClick(id) {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (entry) {
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

function handleHistoryItemEdit(id) {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (entry) {
        showEditModal(id, entry.name);
    }
}

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
    DOM.on(cancelBtn, 'click', () => {
        document.body.removeChild(editModal);
    });
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
        } else if (e.key === 'Escape') {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                updateHistoryItem(id, newName);
            }
            document.body.removeChild(editModal);
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
    
    const closeModalWithSave = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            updateHistoryItem(id, newName);
        }
        document.body.removeChild(editModal);
    };
    
    DOM.on(editModal, 'click', (e) => {
        if (e.target === editModal) closeModalWithSave();
    });
    
    DOM.on(DOM.get('closeEditModal'), 'click', closeModalWithSave);
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
}

function handleHistoryItemDelete(id) {
    showDeleteConfirm(id);
}

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
    
    DOM.on(historySearchInput, 'input', (e) => {
        updateHistoryPanel(e.target.value);
    });
    
    updateHistoryPanel();
    
    loadSelectedHistory();
}

function loadSelectedHistory() {
    const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
    if (selectedId !== null && selectedId !== undefined) {
        const history = getHistory();
        const entry = history.find(h => String(h.id) === String(selectedId));
        if (entry) {
            import('./ui-controller.js').then(({ displayOutput }) => {
                displayOutput(entry.data, entry.isJson, false);
            });
        }
    }
}

export { getHistory };