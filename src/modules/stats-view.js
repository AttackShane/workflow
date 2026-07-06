import { msg } from './ui-controller.js';
import { Dialog } from './dialog.js';
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
} from './converter-history.js';
import { renderStats, renderStatsDetail } from './stats-renderer.js';

class StatsView {
    constructor() {
        this._statsInfo = null;
        this._languageChangeHandler = null;
    }

    _getHistory() {
        return getData();
    }

    updateHistoryPanel = (searchQuery = '') => {
        const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
        const history = this._getHistory();

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

        this._bindHistoryItemEvents();

        const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
        if (selectedId !== null && selectedId !== undefined) {
            historyList.querySelectorAll('.history-item').forEach(el => DOM.removeClass(el, 'active'));

            const selectedItem = historyList.querySelector(`[data-id="${selectedId}"]`);
            if (selectedItem) {
                DOM.addClass(selectedItem, 'active');
            }
        }
    };

    _bindHistoryItemEvents() {
        const historyList = DOM.get(SELECTORS.CONVERTER.HISTORY_LIST);
        if (!historyList) return;

        historyList.querySelectorAll('.history-item').forEach(item => {
            const id = parseInt(item.dataset.id);

            const content = item.querySelector('.history-content');
            DOM.on(content, 'click', () => this._handleHistoryItemClick(id));

            const editBtn = item.querySelector('.edit-btn');
            DOM.on(editBtn, 'click', (e) => {
                e.stopPropagation();
                this._handleHistoryItemEdit(id);
            });

            const deleteBtn = item.querySelector('.delete-btn');
            DOM.on(deleteBtn, 'click', (e) => {
                e.stopPropagation();
                this._handleHistoryItemDelete(id);
            });
        });
    }

    saveToHistory = (data, isJson, name = '') => {
        saveData(data, isJson, name);
        this.updateHistoryPanel();
    };

    deleteHistoryItem = (id) => {
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

        this.updateHistoryPanel();
    };

    updateHistoryItem = (id, name) => {
        updateData(id, name);
        this.updateHistoryPanel();
    };

    exportHistory = () => {
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
    };

    importHistory = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result || '[]');
                if (Array.isArray(imported)) {
                    const importedCount = importData(imported);
                    this.updateHistoryPanel();
                    msg(APP_CONFIG.MESSAGES.SUCCESS.IMPORT(importedCount), false);
                } else {
                    msg('导入的数据格式不正确', true);
                }
            } catch {
                msg('导入失败：无效的 JSON 文件', true);
            }
        };
        reader.readAsText(file);
    };

    clearHistory = () => {
        clearData();
        this.updateHistoryPanel();
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
    };

    showStats = (data, isJson) => {
        if (!this._statsInfo) return;
        renderStats(this._statsInfo, data, isJson);
    };

    showStatsDetail = (data, isJson) => {
        const statsContent = document.getElementById('statsContent');
        renderStatsDetail(statsContent, data, isJson);
    };

    _handleHistoryItemClick(id) {
        const history = this._getHistory();
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

    _handleHistoryItemEdit(id) {
        const history = this._getHistory();
        const entry = history.find(h => h.id === id);
        if (entry) {
            this._showEditModal(id, entry.name);
        }
    }

    _showEditModal(id, currentName) {
        Dialog.prompt('✏️ 编辑名称', {
            nameLabel: '名称',
            namePlaceholder: '请输入新名称',
            nameValue: currentName,
            descLabel: '',
            descPlaceholder: '',
            descValue: '',
            okText: '保存',
            cancelText: '取消'
        }).then(result => {
            if (result && result.name) {
                this.updateHistoryItem(id, result.name);
            }
        });
    }

    _handleHistoryItemDelete(id) {
        this._showDeleteConfirm(id);
    }

    _showDeleteConfirm(id) {
        Dialog.confirm('确定要删除这条记录吗？\n此操作无法撤销', '🗑️ 删除', { danger: true, okText: '删除', cancelText: '取消' })
            .then(confirmed => {
                if (confirmed) {
                    this.deleteHistoryItem(id);
                }
            });
    }

    _showClearConfirm() {
        Dialog.confirm('确定要清空所有历史记录吗？\n此操作无法撤销', '⚠️ 清空', { danger: true, okText: '清空', cancelText: '取消' })
            .then(confirmed => {
                if (confirmed) {
                    this.clearHistory();
                }
            });
    }

    initHistoryPanel = () => {
        this._statsInfo = DOM.get('statsInfo');
        const clearHistoryBtn = DOM.get(SELECTORS.CONVERTER.CLEAR_HISTORY_BTN);
        const importHistoryBtn = DOM.get(SELECTORS.CONVERTER.IMPORT_HISTORY_BTN);
        const exportHistoryBtn = DOM.get(SELECTORS.CONVERTER.EXPORT_HISTORY_BTN);
        const historySearchInput = DOM.get(SELECTORS.CONVERTER.HISTORY_SEARCH);

        const importFileInput = DOM.create('input', {
            type: 'file',
            accept: '.json',
            style: { display: 'none' }
        });
        DOM.on(importFileInput, 'change', this.importHistory);
        document.body.appendChild(importFileInput);

        DOM.on(clearHistoryBtn, 'click', () => this._showClearConfirm());
        DOM.on(importHistoryBtn, 'click', () => importFileInput.click());
        DOM.on(exportHistoryBtn, 'click', this.exportHistory);

        DOM.on(historySearchInput, 'input', (e) => {
            this.updateHistoryPanel(e.target.value);
        });

        this.updateHistoryPanel();

        this._loadSelectedHistory();

        this._languageChangeHandler = () => {
            const searchInput = DOM.get(SELECTORS.CONVERTER.HISTORY_SEARCH);
            this.updateHistoryPanel(searchInput ? searchInput.value : '');
        };
        document.addEventListener('languagechange', this._languageChangeHandler);
        window.addEventListener('beforeunload', () => {
            if (this._languageChangeHandler) {
                document.removeEventListener('languagechange', this._languageChangeHandler);
                this._languageChangeHandler = null;
            }
        });
    };

    _loadSelectedHistory() {
        const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
        if (selectedId !== null && selectedId !== undefined) {
            const history = this._getHistory();
            const entry = history.find(h => String(h.id) === String(selectedId));
            if (entry) {
                import('./ui-controller.js').then(({ displayOutput }) => {
                    displayOutput(entry.data, entry.isJson, false);
                });
            }
        }
    }
}

const _instance = new StatsView();
export const getHistory = () => _instance._getHistory();
export const updateHistoryPanel = (...args) => _instance.updateHistoryPanel(...args);
export const saveToHistory = (...args) => _instance.saveToHistory(...args);
export const deleteHistoryItem = (...args) => _instance.deleteHistoryItem(...args);
export const updateHistoryItem = (...args) => _instance.updateHistoryItem(...args);
export const exportHistory = (...args) => _instance.exportHistory(...args);
export const importHistory = (...args) => _instance.importHistory(...args);
export const clearHistory = (...args) => _instance.clearHistory(...args);
export const showStats = (...args) => _instance.showStats(...args);
export const showStatsDetail = (...args) => _instance.showStatsDetail(...args);
export const initHistoryPanel = (...args) => _instance.initHistoryPanel(...args);