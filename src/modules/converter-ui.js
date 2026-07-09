import { convertYamlToClipboard } from './converter.js';
import { convertClipboardToYaml } from './converter-reverse.js';
import { showStats, saveToHistory } from './converter-stats.js';
import { goToEditor, goToManager, initNavigator } from './shared-navigator.js';
import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, ClipboardUtils, getJsyaml, Storage } from '../utils/helpers.js';
import { convertLargeNumbersToStrings } from '../utils/utils.js';
import { Logger } from '../utils/logger.js';
import { t } from '../i18n/i18n.js';
import { renderWithVirtualScroll, renderSync, renderAsync } from './converter-renderer.js';

function _loadYamlWithStringIds(input) {
    const processedInput = convertLargeNumbersToStrings(input);
    const yamlData = getJsyaml().load(processedInput);
    return yamlData;
}

function _generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

class UIController {
    constructor() {
        this._curData = null;
        this._curDataType = null;
        this._selectedFile = null;
        this._elements = {};
        this._isHighlighting = false;
        this._worker = null;
        this._workerTaskId = 0;
        this._virtualScroll = null;
        this._VirtualScroll = null;
        this._conversionCache = new Map();
        this._highlightCache = new Map();
        this._performanceStats = {
            conversionTime: 0,
            highlightTime: 0,
            renderTime: 0
        };

        import('./converter-virtual-scroll.js').then(m => { this._VirtualScroll = m.VirtualScroll; });

        window.addEventListener('beforeunload', () => this._terminateWorker());
    }

    _terminateWorker() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
    }

    _addToCache(cache, key, value) {
        if (cache.size >= APP_CONFIG.CACHE.MAX_SIZE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
        cache.set(key, value);
    }

    _getFromCache(cache, key) {
        if (!cache.has(key)) return undefined;
        const value = cache.get(key);
        cache.delete(key);
        cache.set(key, value);
        return value;
    }

    getCurData = () => this._curData;

    getCurDataType = () => this._curDataType;

    msg = (text, isError = false) => {
        const statusElement = DOM.get(SELECTORS.CONVERTER.COPY_STATUS);
        if (!statusElement) return;

        DOM.setText(statusElement, text);
        DOM.setStyle(statusElement, 'color', isError ? '#dc2626' : '#10b981');

        setTimeout(() => {
            DOM.setText(statusElement, '');
        }, APP_CONFIG.UI.COPY_TIMEOUT);
    };

    resetUI = () => {
        this._curData = null;
        this._curDataType = null;
        this._selectedFile = null;

        DOM.setText(DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY), '');
        DOM.setText(DOM.get(SELECTORS.CONVERTER.INPUT_TEXT), '');
        DOM.setHtml(DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA), t('converter.defaultOutput'));
        DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), true);
        DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), true);

        this.updateLineNumbers(t('converter.defaultOutput'));
    };

    updateLineNumbers = (text) => {
        const lineNumbers = DOM.get(SELECTORS.CONVERTER.LINE_NUMBERS);
        const lineNumbersContent = DOM.get('lineNumbersContent');
        if (!lineNumbers || !text) return;

        const lines = text.split('\n').length;
        const lineHeight = parseFloat(document.documentElement.style.getPropertyValue('--code-line-height') || '21');

        const totalHeight = lines * lineHeight;
        lineNumbersContent.style.height = totalHeight + 'px';

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < lines; i++) {
            const div = document.createElement('div');
            div.className = 'line-numbers-line';
            fragment.appendChild(div);
        }

        lineNumbersContent.innerHTML = '';
        lineNumbersContent.appendChild(fragment);
    };

    handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!this._isValidFile(file)) {
            this.msg('不支持的文件类型', true);
            return;
        }

        const fileNameDisplay = DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY);
        const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
        if (!fileNameDisplay || !inputText) return;

        this._selectedFile = file;
        DOM.setText(fileNameDisplay, `已选择: ${file.name}`);

        const reader = new FileReader();
        reader.onload = (e) => {
            DOM.setText(inputText, String(e.target?.result || ''));
            this.handleConvert();
        };
        reader.readAsText(file);
    };

    handleConvert = async () => {
        const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
        if (!inputText) return;

        const input = /** @type {HTMLInputElement} */ (inputText).value.trim();
        if (!input) {
            this.msg(t('converter.emptyInput'), true);
            return;
        }

        const inputHash = _generateHash(input);

        if (this._conversionCache.has(inputHash)) {
            const cached = this._getFromCache(this._conversionCache, inputHash);
            this.displayOutput(cached.result, cached.type);
            this.msg('✓ 使用缓存结果');
            return;
        }

        let result, type;
        const conversionStart = performance.now();

        try {
            const trimmedInput = input.trimStart();
            const isJsonLike = trimmedInput.startsWith('{') || trimmedInput.startsWith('[');

            if (isJsonLike) {
                try {
                    const jsonData = JSON.parse(input);
                    const yamlObj = convertClipboardToYaml(jsonData);
                    result = getJsyaml().dump(yamlObj);
                    type = 'yaml';
                } catch (jsonError) {
                    const yamlData = _loadYamlWithStringIds(input);
                    const clipboardData = convertYamlToClipboard(/** @type {any} */ (yamlData));
                    result = JSON.stringify(clipboardData, null, 2);
                    type = 'json';
                }
            } else {
                const yamlData = _loadYamlWithStringIds(input);
                const clipboardData = convertYamlToClipboard(/** @type {any} */ (yamlData), input);
                result = JSON.stringify(clipboardData, null, 2);
                type = 'json';
            }

            this._addToCache(this._conversionCache, inputHash, { result, type });

            this._performanceStats.conversionTime = performance.now() - conversionStart;
            this.displayOutput(result, type);
            this.msg(`${t('converter.successConvert')} (${this._performanceStats.conversionTime.toFixed(1)}ms)`);
        } catch (error) {
            this.msg(`${t('converter.errorConvert')}: ${error.message}`, true);
            Logger.error('Conversion error:', error);
        }
    };

    displayOutput = (data, type, saveToHistoryFlag = true) => {
        if (typeof type === 'boolean') {
            type = type ? 'json' : 'yaml';
        }
        this._curData = data;
        this._curDataType = type;

        const contentKey = _generateHash(data) + ':' + type;

        const lines = data.split('\n').length;

        const outputWrapper = DOM.get('outputWrapper');
        const lineNumbers = DOM.get(SELECTORS.CONVERTER.LINE_NUMBERS);
        if (outputWrapper) outputWrapper.scrollTop = 0;
        if (lineNumbers) lineNumbers.scrollTop = 0;

        if (lines > APP_CONFIG.VIRTUAL_SCROLL.THRESHOLD && this._VirtualScroll) {
            this._renderWithVirtualScroll(data, type, contentKey);
        } else {
            if (this._virtualScroll) {
                this._virtualScroll.destroy();
                this._virtualScroll = null;
            }
            this._initLineNumberScrollSync();

            if (lines > 500) {
                this._renderAsync(data, type, contentKey);
                this.updateLineNumbers(data);
            } else {
                this._renderSync(data, type, contentKey);
                this.updateLineNumbers(data);
            }
        }

        DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), false);
        DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), false);

        showStats(data, type === 'json');
        if (saveToHistoryFlag) {
            saveToHistory(data, type === 'json');
        }
    };

    _renderWithVirtualScroll(data, type, contentKey) {
        renderWithVirtualScroll(this, data, type, contentKey);
    }

    _renderSync(data, type, contentKey) {
        renderSync(this, data, type, contentKey);
    }

    async _renderAsync(data, type, contentKey) {
        await renderAsync(this, data, type, contentKey);
    }

    copyOutput = async () => {
        const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
        let dataToCopy = this._curData;

        if (selectedId !== null && selectedId !== undefined) {
            const history = Storage.get(APP_CONFIG.HISTORY.KEY, []);
            const entry = history.find(h => String(h.id) === String(selectedId));
            if (entry && entry.data) {
                dataToCopy = entry.data;
            }
        }

        if (!dataToCopy) return;

        if (await ClipboardUtils.copy(dataToCopy)) {
            this.msg(t('converter.copySuccess'));
        } else {
            this.msg(t('converter.copyError'), true);
        }
    };

    downloadOutput = () => {
        const selectedId = Storage.get(APP_CONFIG.HISTORY.SELECTED_KEY);
        let dataToDownload = this._curData;
        let dataType = this._curDataType;

        if (selectedId !== null && selectedId !== undefined) {
            const history = Storage.get(APP_CONFIG.HISTORY.KEY, []);
            const entry = history.find(h => String(h.id) === String(selectedId));
            if (entry && entry.data) {
                dataToDownload = entry.data;
                dataType = entry.isJson ? 'json' : 'yaml';
            }
        }

        if (!dataToDownload || !dataType) return;

        const blob = new Blob([dataToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = DOM.create('a', {
            attributes: {
                href: url,
                download: `output.${dataType}`
            }
        });

        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        this.msg(t('converter.downloadSuccess'));
    };

    initUI = () => {
        this._elements = {
            modeFileBtn: DOM.get(SELECTORS.CONVERTER.MODE_FILE_BTN),
            modeTextBtn: DOM.get(SELECTORS.CONVERTER.MODE_TEXT_BTN),
            filePanel: DOM.get(SELECTORS.CONVERTER.FILE_PANEL),
            textPanel: DOM.get(SELECTORS.CONVERTER.TEXT_PANEL),
            fileInput: DOM.get(SELECTORS.CONVERTER.FILE_INPUT),
            fileNameDisplay: DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY),
            inputText: DOM.get(SELECTORS.CONVERTER.INPUT_TEXT),
            convertFileBtn: DOM.get(SELECTORS.CONVERTER.CONVERT_FILE_BTN),
            clearFileBtn: DOM.get(SELECTORS.CONVERTER.CLEAR_FILE_BTN),
            convertTextBtn: DOM.get(SELECTORS.CONVERTER.CONVERT_TEXT_BTN),
            clearTextBtn: DOM.get(SELECTORS.CONVERTER.CLEAR_TEXT_BTN),
            copyOutputBtn: DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN),
            downloadBtn: DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN),
            resetBtn: DOM.get('resetBtn'),
            outputArea: DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA),
            copyStatus: DOM.get(SELECTORS.CONVERTER.COPY_STATUS),
            lineNumbers: DOM.get(SELECTORS.CONVERTER.LINE_NUMBERS),
            uploadArea: DOM.get('uploadArea'),
            codeContainer: DOM.get(SELECTORS.CONVERTER.CODE_CONTAINER)
        };

        this._bindEvents();

        if (this._elements.outputArea) {
            this._elements.outputArea.innerHTML = t('converter.defaultOutput');
        }

        this._initLineNumberScrollSync();

        document.addEventListener('fontsizechange', this._handleFontSizeChange);
    };

    _handleFontSizeChange = () => {
        if (this._virtualScroll) {
            this._virtualScroll.updateFontSize();
        } else if (this._curData) {
            this.updateLineNumbers(this._curData);
        }
    };

    _initLineNumberScrollSync = () => {
        const { lineNumbers } = this._elements;
        const outputWrapper = DOM.get('outputWrapper');
        if (!outputWrapper || !lineNumbers) return;

        lineNumbers.style.overflow = 'hidden';
        lineNumbers.style.pointerEvents = 'none';
        lineNumbers.style.userSelect = 'none';

        outputWrapper.addEventListener('scroll', () => {
            lineNumbers.scrollTop = outputWrapper.scrollTop;
        });
    };

    _bindEvents = () => {
        const {
            modeFileBtn,
            modeTextBtn,
            fileInput,
            convertFileBtn,
            clearFileBtn,
            convertTextBtn,
            clearTextBtn,
            copyOutputBtn,
            downloadBtn,
            resetBtn,
            uploadArea
        } = this._elements;

        DOM.on(modeFileBtn, 'click', () => this._switchMode('file'));
        DOM.on(modeTextBtn, 'click', () => this._switchMode('text'));

        DOM.on(fileInput, 'change', this.handleFileSelect);
        DOM.on(convertFileBtn, 'click', this.handleConvert);
        DOM.on(clearFileBtn, 'click', () => {
            DOM.setText(this._elements.fileNameDisplay, '');
            DOM.setText(this._elements.inputText, '');
            this.resetUI();
        });

        DOM.on(convertTextBtn, 'click', (e) => {
            e.stopPropagation();
            this.handleConvert();
        });
        DOM.on(clearTextBtn, 'click', () => {
            DOM.setText(this._elements.inputText, '');
            this.resetUI();
        });

        DOM.on(copyOutputBtn, 'click', this.copyOutput);
        DOM.on(downloadBtn, 'click', this.downloadOutput);
        DOM.on(resetBtn, 'click', this.resetUI);

        DOM.on(DOM.get('editorBtn'), 'click', () => goToEditor({ newWorkflow: true }));
        DOM.on(DOM.get('managerBtn'), 'click', goToManager);

        DOM.on(uploadArea, 'click', () => {
            fileInput?.click();
        });

        DOM.on(uploadArea, 'dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });

        DOM.on(uploadArea, 'dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });

        DOM.on(uploadArea, 'drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');

            const files = /** @type {DragEvent} */ (e).dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (this._isValidFile(file)) {
                    this._handleDroppedFile(file);
                } else {
                    this.msg('不支持的文件类型', true);
                }
            }
        });
    };

    _isValidFile(file) {
        const validExtensions = ['.yaml', '.yml', '.json'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!validExtensions.includes(ext)) return false;

        const validMimeTypes = [
            'application/json',
            'application/x-yaml',
            'text/yaml',
            'text/x-yaml',
            'text/plain',
            'application/octet-stream'
        ];
        const mime = file.type || '';
        return !mime || validMimeTypes.includes(mime) || mime.startsWith('text/');
    }

    _handleDroppedFile(file) {
        const fileNameDisplay = DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY);
        const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
        if (!fileNameDisplay || !inputText) return;

        this._selectedFile = file;
        DOM.setText(fileNameDisplay, `已选择: ${file.name}`);

        const reader = new FileReader();
        reader.onload = (e) => {
            DOM.setText(inputText, String(e.target?.result || ''));
            this.handleConvert();
        };
        reader.readAsText(file);
    }

    _switchMode = (mode) => {
        const isFileMode = mode === 'file';

        DOM.toggleClass(this._elements.filePanel, 'hidden', !isFileMode);
        DOM.toggleClass(this._elements.textPanel, 'hidden', isFileMode);
        DOM.toggleClass(this._elements.modeFileBtn, 'active', isFileMode);
        DOM.toggleClass(this._elements.modeTextBtn, 'active', !isFileMode);

        if (isFileMode) {
            DOM.setText(this._elements.inputText, '');
        }
    };
}

const _instance = new UIController();
export const getCurData = () => _instance.getCurData();
export const getCurDataType = () => _instance.getCurDataType();
// @ts-ignore
export const msg = (...args) => _instance.msg(...args);
// @ts-ignore
export const resetUI = (...args) => _instance.resetUI(...args);
// @ts-ignore
export const updateLineNumbers = (...args) => _instance.updateLineNumbers(...args);
// @ts-ignore
export const handleFileSelect = (...args) => _instance.handleFileSelect(...args);
// @ts-ignore
export const handleConvert = (...args) => _instance.handleConvert(...args);
// @ts-ignore
export const displayOutput = (...args) => _instance.displayOutput(...args);
// @ts-ignore
export const copyOutput = (...args) => _instance.copyOutput(...args);
// @ts-ignore
export const downloadOutput = (...args) => _instance.downloadOutput(...args);
// @ts-ignore
export const initUI = (...args) => _instance.initUI(...args);