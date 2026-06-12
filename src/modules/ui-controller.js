import { convertYamlToClipboard } from './converter.js';
import { convertClipboardToYaml } from './reverse.js';
import { highlightJson, highlightYaml } from './highlighter.js';
import { showStats, saveToHistory } from './stats-view.js';
import { goToEditor, goToManager, initNavigator } from './navigator.js';
import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, StringUtils, ClipboardUtils } from '../utils/helpers.js';
import { convertLargeNumbersToStrings } from '../utils/utils.js';
import { Logger } from '../utils/logger.js';

// 动态导入虚拟滚动模块
let VirtualScroll = null;
import('./virtual-scroll.js').then(m => { VirtualScroll = m.VirtualScroll; });

// 状态管理
let curData = null;
let curDataType = null;
let selectedFile = null;
let elements = {};
let isHighlighting = false;
let worker = null;
let workerTaskId = 0;
let virtualScroll = null;

function terminateWorker() {
    if (worker) {
        worker.terminate();
        worker = null;
    }
}

window.addEventListener('beforeunload', terminateWorker);

// 缓存系统
const conversionCache = new Map();
const highlightCache = new Map();

// 安全验证：Worker 返回的高亮 HTML 只允许 highlight.js 使用的标签
const ALLOWED_TAGS = ['span', 'br'];
function isHighlightHtmlSafe(html) {
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1].toLowerCase();
        if (!ALLOWED_TAGS.includes(tagName)) {
            return false;
        }
    }
    return true;
}

// 性能监控
const performanceStats = {
    conversionTime: 0,
    highlightTime: 0,
    renderTime: 0
};

/**
 * 安全加载 YAML，确保 ID 字段保持为字符串类型
 * @param {string} input - YAML 字符串
 * @returns {object} 解析后的对象
 */
function loadYamlWithStringIds(input) {
    // 在解析前处理 YAML 字符串，将大数字转换为字符串
    const processedInput = convertLargeNumbersToStrings(input);
    const yamlData = window.jsyaml.load(processedInput);
    return yamlData;
}

// 导出状态获取函数
export function getCurData() { return curData; }
export function getCurDataType() { return curDataType; }

/**
 * 显示消息提示
 * @param {string} text - 消息文本
 * @param {boolean} isError - 是否为错误消息
 */
export function msg(text, isError = false) {
    const statusElement = DOM.get(SELECTORS.CONVERTER.COPY_STATUS);
    if (!statusElement) return;
    
    DOM.setText(statusElement, text);
    DOM.setStyle(statusElement, 'color', isError ? '#dc2626' : '#10b981');
    
    setTimeout(() => {
        DOM.setText(statusElement, '');
    }, APP_CONFIG.UI.COPY_TIMEOUT);
}

/**
 * 重置 UI 状态
 */
export function resetUI() {
    curData = null;
    curDataType = null;
    selectedFile = null;
    
    DOM.setText(DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY), '');
    DOM.setText(DOM.get(SELECTORS.CONVERTER.INPUT_TEXT), '');
    DOM.setHtml(DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA), APP_CONFIG.UI.DEFAULT_OUTPUT);
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), true);
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), true);
    
    updateLineNumbers(APP_CONFIG.UI.DEFAULT_OUTPUT);
}

/**
 * 更新行号显示
 * @param {string} text - 文本内容
 */
export function updateLineNumbers(text) {
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
}

/**
 * 处理文件选择
 * @param {Event} event - 文件选择事件
 */
export function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const fileNameDisplay = DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY);
    const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
    if (!fileNameDisplay || !inputText) return;
    
    selectedFile = file;
    DOM.setText(fileNameDisplay, `已选择: ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.setText(inputText, e.target?.result || '');
        handleConvert();
    };
    reader.readAsText(file);
}

/**
 * 生成内容哈希
 * @param {string} content - 内容
 * @returns {string} 哈希值
 */
function generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * 添加到缓存
 * @param {Map} cache - 缓存 Map
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 */
function addToCache(cache, key, value) {
    if (cache.size >= APP_CONFIG.CACHE.MAX_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, value);
}

/**
 * 处理转换操作
 */
export async function handleConvert() {
    const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
    if (!inputText) return;
    
    const input = inputText.value.trim();
    if (!input) {
        msg(APP_CONFIG.MESSAGES.ERROR.EMPTY_INPUT, true);
        return;
    }
    
    const inputHash = generateHash(input);
    
    // 检查转换缓存
    if (conversionCache.has(inputHash)) {
        const cached = conversionCache.get(inputHash);
        displayOutput(cached.result, cached.type);
        msg('✓ 使用缓存结果');
        return;
    }
    
    let result, type;
    const conversionStart = performance.now();
    
    try {
        // 检测输入类型：首先尝试解析为 JSON
        const trimmedInput = input.trimStart();
        
        // 更健壮的类型检测：
        // 1. 检查是否以 { 或 [ 开头（JSON 数组也有可能）
        // 2. 尝试用 JSON.parse 验证
        // 3. 如果失败再尝试 YAML
        const isJsonLike = trimmedInput.startsWith('{') || trimmedInput.startsWith('[');
        
        if (isJsonLike) {
            try {
                // 尝试作为 JSON 解析（剪贴板格式）
                const jsonData = JSON.parse(input);
                // convertClipboardToYaml 返回的是对象，需要用 jsyaml.dump 转换为字符串
                const yamlObj = convertClipboardToYaml(jsonData);
                result = window.jsyaml.dump(yamlObj);
                type = 'yaml';
            } catch (jsonError) {
                // JSON 解析失败，尝试作为 YAML
                const yamlData = loadYamlWithStringIds(input);
                const clipboardData = convertYamlToClipboard(yamlData);
                result = JSON.stringify(clipboardData, null, 2);
                type = 'json';
            }
        } else {
            // 默认当作 YAML 处理
            const yamlData = loadYamlWithStringIds(input);
            const clipboardData = convertYamlToClipboard(yamlData, input);
            result = JSON.stringify(clipboardData, null, 2);
            type = 'json';
        }
        
        // 添加到缓存
        addToCache(conversionCache, inputHash, { result, type });
        
        performanceStats.conversionTime = performance.now() - conversionStart;
        displayOutput(result, type);
        msg(`${APP_CONFIG.MESSAGES.SUCCESS.CONVERT} (${performanceStats.conversionTime.toFixed(1)}ms)`);
    } catch (error) {
        msg(`${APP_CONFIG.MESSAGES.ERROR.CONVERT}${error.message}`, true);
        Logger.error('Conversion error:', error);
    }
}

/**
 * 显示转换结果
 * @param {string} data - 转换后的数据
 * @param {string} type - 数据类型 ('json' 或 'yaml')
 * @param {boolean} saveToHistoryFlag - 是否保存到历史记录
 */
export function displayOutput(data, type, saveToHistoryFlag = true) {
    curData = data;
    curDataType = type;
    
    const contentKey = generateHash(data) + ':' + type;
    
    const lines = data.split('\n').length;
    
    // 重置滚动位置到顶部（任何时候显示新内容都从第一行开始）
    const outputWrapper = DOM.get('outputWrapper');
    const lineNumbers = DOM.get(SELECTORS.CONVERTER.LINE_NUMBERS);
    if (outputWrapper) outputWrapper.scrollTop = 0;
    if (lineNumbers) lineNumbers.scrollTop = 0;
    
    // 大量行使用虚拟滚动
    if (lines > APP_CONFIG.VIRTUAL_SCROLL.THRESHOLD && VirtualScroll) {
        renderWithVirtualScroll(data, type, contentKey);
    } else {
        // 如果之前使用了虚拟滚动，需要清理状态
        if (virtualScroll) {
            virtualScroll.destroy();
            virtualScroll = null;
        }
        // 重新初始化行号同步（确保样式正确）
        initLineNumberScrollSync();
        
        if (lines > 500) {
            renderAsync(data, type, contentKey);
            updateLineNumbers(data);
        } else {
            renderSync(data, type, contentKey);
            updateLineNumbers(data);
        }
    }
    
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.COPY_OUTPUT_BTN), false);
    DOM.setDisabled(DOM.get(SELECTORS.CONVERTER.DOWNLOAD_BTN), false);
    
    showStats(data, type === 'json');
    if (saveToHistoryFlag) {
        saveToHistory(data, type === 'json');
    }
}

function renderWithVirtualScroll(data, type, contentKey) {
    const outputWrapper = DOM.get('outputWrapper');
    const outputArea = DOM.get('outputArea');
    const outputBuffer = DOM.get('outputBuffer');
    const lineNumbers = DOM.get('lineNumbers');
    const lineNumbersContent = DOM.get('lineNumbersContent');
    
    if (!outputWrapper || !outputArea || !lineNumbers || !lineNumbersContent) {
        renderAsync(data, type, contentKey);
        return;
    }
    
    // 获取原始行数（用于行号生成）
    const originalLineCount = data.split('\n').length;
    
    if (!virtualScroll) {
        virtualScroll = new VirtualScroll({
            container: outputWrapper,
            content: outputArea,
            lineNumbers: lineNumbers,
            lineNumbersContent: lineNumbersContent,
            buffer: outputBuffer
        });
    }
    
    // 先渲染行号（基于原始数据的行数）
    const lineHeight = parseFloat(document.documentElement.style.getPropertyValue('--code-line-height') || '21');
    const totalHeight = originalLineCount * lineHeight;
    lineNumbersContent.style.height = totalHeight + 'px';
    
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < originalLineCount; i++) {
        const div = document.createElement('div');
        div.className = 'line-numbers-line';
        fragment.appendChild(div);
    }
    lineNumbersContent.innerHTML = '';
    lineNumbersContent.appendChild(fragment);
    
    // 检查高亮缓存
    if (highlightCache.has(contentKey)) {
        virtualScroll.setContent(highlightCache.get(contentKey), originalLineCount);
        virtualScroll.scrollToTop();
        return;
    }
    
    const currentTaskId = ++workerTaskId;
    
    if (!worker) {
        worker = new Worker('./modules/highlighter-worker.js', { type: 'module' });
    }
    
    isHighlighting = true;
    outputArea.innerHTML = '<span style="color: #9ca3af;">渲染中...</span>';
    
    worker.postMessage({ id: currentTaskId, text: data, type });
    
    worker.addEventListener('message', function handler(e) {
        if (e.data.id === currentTaskId) {
            worker.removeEventListener('message', handler);
            isHighlighting = false;
            const result = e.data.result;
            const safe = isHighlightHtmlSafe(result) ? result : StringUtils.escapeHtml(data);
            addToCache(highlightCache, contentKey, safe);
            virtualScroll.setContent(safe, originalLineCount);
            virtualScroll.scrollToTop();
        }
    });
}

function renderSync(data, type, contentKey) {
    const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
    if (!outputArea) return;
    
    // 检查高亮缓存
    if (highlightCache.has(contentKey)) {
        DOM.setHtml(outputArea, highlightCache.get(contentKey));
        return;
    }
    
    const highlighted = type === 'json' 
        ? highlightJson(data) 
        : highlightYaml(data);
    
    addToCache(highlightCache, contentKey, highlighted);
    DOM.setHtml(outputArea, highlighted);
}

async function renderAsync(data, type, contentKey) {
    const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
    if (!outputArea) return;
    
    // 检查高亮缓存
    if (highlightCache.has(contentKey)) {
        DOM.setHtml(outputArea, highlightCache.get(contentKey));
        return;
    }
    
    isHighlighting = true;
    outputArea.innerHTML = '<span style="color: #9ca3af;">渲染中...</span>';
    
    const currentTaskId = ++workerTaskId;
    
    try {
        if (!worker) {
            worker = new Worker('./modules/highlighter-worker.js', { type: 'module' });
        }
        
        worker.postMessage({ id: currentTaskId, text: data, type });
        
        await new Promise((resolve) => {
            const handler = function(e) {
                if (e.data.id === currentTaskId) {
                    const result = e.data.result;
                    const safe = isHighlightHtmlSafe(result) ? result : StringUtils.escapeHtml(data);
                    addToCache(highlightCache, contentKey, safe);
                    outputArea.innerHTML = safe;
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };
            worker.addEventListener('message', handler);
        });
    } catch (error) {
        Logger.error('Worker error:', error);
        const highlighted = type === 'json' ? highlightJson(data) : highlightYaml(data);
        addToCache(highlightCache, contentKey, highlighted);
        outputArea.innerHTML = highlighted;
    } finally {
        isHighlighting = false;
    }
}

/**
 * 复制输出内容到剪贴板
 */
export async function copyOutput() {
    if (!curData) return;
    
    if (await ClipboardUtils.copy(curData)) {
        msg(APP_CONFIG.MESSAGES.SUCCESS.COPY);
    } else {
        msg(APP_CONFIG.MESSAGES.ERROR.COPY, true);
    }
}

/**
 * 下载输出内容
 */
export function downloadOutput() {
    if (!curData || !curDataType) return;
    
    const blob = new Blob([curData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = DOM.create('a', {
        href: url,
        download: `output.${curDataType}`
    });
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    msg(APP_CONFIG.MESSAGES.SUCCESS.DOWNLOAD);
}

/**
 * 初始化 UI
 */
export function initUI() {
    // 获取 DOM 元素
    elements = {
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
    
    // 绑定事件
    bindEvents();
    
    // 初始化输出区域
    if (elements.outputArea) {
        elements.outputArea.innerHTML = APP_CONFIG.UI.DEFAULT_OUTPUT;
    }
    
    // 初始化行号同步滚动
    initLineNumberScrollSync();
    
    // 监听字体大小变化事件
    document.addEventListener('fontsizechange', handleFontSizeChange);
}

/**
 * 处理字体大小变化
 */
function handleFontSizeChange() {
    if (virtualScroll) {
        virtualScroll.updateFontSize();
    } else if (curData) {
        updateLineNumbers(curData);
    }
}

/**
 * 初始化行号同步滚动
 */
function initLineNumberScrollSync() {
    const { lineNumbers } = elements;
    const outputWrapper = DOM.get('outputWrapper');
    if (!outputWrapper || !lineNumbers) return;
    
    // 禁止行号区域滚动
    lineNumbers.style.overflow = 'hidden';
    lineNumbers.style.pointerEvents = 'none';
    lineNumbers.style.userSelect = 'none';
    
    // 只绑定内容到行号的单向同步（监听正确的滚动容器 outputWrapper）
    outputWrapper.addEventListener('scroll', () => {
        lineNumbers.scrollTop = outputWrapper.scrollTop;
    });
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
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
    } = elements;
    
    // 模式切换
    DOM.on(modeFileBtn, 'click', () => switchMode('file'));
    DOM.on(modeTextBtn, 'click', () => switchMode('text'));
    
    // 文件操作
    DOM.on(fileInput, 'change', handleFileSelect);
    DOM.on(convertFileBtn, 'click', handleConvert);
    DOM.on(clearFileBtn, 'click', () => {
        DOM.setText(elements.fileNameDisplay, '');
        DOM.setText(elements.inputText, '');
        resetUI();
    });
    
    // 文本操作
    DOM.on(convertTextBtn, 'click', (e) => {
        e.stopPropagation();
        handleConvert();
    });
    DOM.on(clearTextBtn, 'click', () => {
        DOM.setText(elements.inputText, '');
        resetUI();
    });
    
    // 输出操作
    DOM.on(copyOutputBtn, 'click', copyOutput);
    DOM.on(downloadBtn, 'click', downloadOutput);
    DOM.on(resetBtn, 'click', resetUI);
    
    // 导航按钮
    DOM.on(DOM.get('editorBtn'), 'click', goToEditor);
    DOM.on(DOM.get('managerBtn'), 'click', goToManager);
    
    // 上传区域点击
    DOM.on(uploadArea, 'click', () => {
        fileInput?.click();
    });
    
    // 拖拽上传
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
        
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (isValidFile(file)) {
                handleDroppedFile(file);
            } else {
                msg('不支持的文件类型', true);
            }
        }
    });
}

/**
 * 检查文件是否有效
 */
function isValidFile(file) {
    const validExtensions = ['.yaml', '.yml', '.json'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(ext);
}

/**
 * 处理拖放的文件
 */
function handleDroppedFile(file) {
    const fileNameDisplay = DOM.get(SELECTORS.CONVERTER.FILE_NAME_DISPLAY);
    const inputText = DOM.get(SELECTORS.CONVERTER.INPUT_TEXT);
    if (!fileNameDisplay || !inputText) return;
    
    selectedFile = file;
    DOM.setText(fileNameDisplay, `已选择: ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.setText(inputText, e.target?.result || '');
        handleConvert();
    };
    reader.readAsText(file);
}

/**
 * 切换模式
 * @param {string} mode - 模式名称 ('file' 或 'text')
 */
function switchMode(mode) {
    const isFileMode = mode === 'file';
    
    DOM.toggleClass(elements.filePanel, 'hidden', !isFileMode);
    DOM.toggleClass(elements.textPanel, 'hidden', isFileMode);
    DOM.toggleClass(elements.modeFileBtn, 'active', isFileMode);
    DOM.toggleClass(elements.modeTextBtn, 'active', !isFileMode);
    
    if (isFileMode) {
        DOM.setText(elements.inputText, '');
    }
}