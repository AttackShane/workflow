/**
 * 转换器渲染模块
 * 负责转换结果的语法高亮渲染、虚拟滚动、异步渲染
 */
import { highlightJson, highlightYaml } from './highlighter.js';
import { APP_CONFIG, SELECTORS } from '../config/constants.js';
import { DOM, StringUtils } from '../utils/helpers.js';
import { Logger } from '../utils/logger.js';

const ALLOWED_TAGS = ['span', 'br'];

function isHighlightHtmlSafe(html) {
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        if (!ALLOWED_TAGS.includes(tag)) return false;
    }
    const scriptRegex = /<script[\s>]/i;
    return !scriptRegex.test(html);
}

function addToCache(cache, key, value) {
    if (cache.size >= APP_CONFIG.HIGHLIGHT_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, value);
}

function getFromCache(cache, key) {
    if (!cache.has(key)) return undefined;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
}

export function renderWithVirtualScroll(ctrl, data, type, contentKey) {
    const outputWrapper = DOM.get('outputWrapper');
    const outputArea = DOM.get('outputArea');
    const outputBuffer = DOM.get('outputBuffer');
    const lineNumbers = DOM.get('lineNumbers');
    const lineNumbersContent = DOM.get('lineNumbersContent');

    if (!outputWrapper || !outputArea || !lineNumbers || !lineNumbersContent) {
        renderAsync(ctrl, data, type, contentKey);
        return;
    }

    const originalLineCount = data.split('\n').length;

    if (!ctrl._virtualScroll) {
        ctrl._virtualScroll = new ctrl._VirtualScroll({
            container: outputWrapper,
            content: outputArea,
            lineNumbers: lineNumbers,
            lineNumbersContent: lineNumbersContent,
            buffer: outputBuffer
        });
    }

    const lineHeight = parseFloat(document.documentElement.style.getPropertyValue('--code-line-height') || '21');
    const totalHeight = originalLineCount * lineHeight;
    lineNumbersContent.style.height = totalHeight + 'px';

    if (ctrl._highlightCache.has(contentKey)) {
        const cached = getFromCache(ctrl._highlightCache, contentKey);
        ctrl._virtualScroll.setContent(cached, originalLineCount);
        ctrl._virtualScroll.scrollToTop();
        return;
    }

    const currentTaskId = ++ctrl._workerTaskId;

    if (!ctrl._worker) {
        ctrl._worker = new Worker('./modules/highlighter-worker.js', { type: 'module' });
    }

    ctrl._isHighlighting = true;
    outputArea.innerHTML = '<span style="color: #9ca3af;">渲染中...</span>';

    ctrl._worker.postMessage({ id: currentTaskId, text: data, type });

    ctrl._worker.addEventListener('message', function handler(e) {
        if (e.data.id === currentTaskId) {
            ctrl._worker.removeEventListener('message', handler);
            ctrl._isHighlighting = false;
            const result = e.data.result;
            const safe = isHighlightHtmlSafe(result) ? result : StringUtils.escapeHtml(data);
            addToCache(ctrl._highlightCache, contentKey, safe);
            ctrl._virtualScroll.setContent(safe, originalLineCount);
            ctrl._virtualScroll.scrollToTop();
        }
    });
}

export function renderSync(ctrl, data, type, contentKey) {
    const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
    if (!outputArea) return;

    if (ctrl._highlightCache.has(contentKey)) {
        DOM.setHtml(outputArea, getFromCache(ctrl._highlightCache, contentKey));
        return;
    }

    const highlighted = type === 'json'
        ? highlightJson(data)
        : highlightYaml(data);

    addToCache(ctrl._highlightCache, contentKey, highlighted);
    DOM.setHtml(outputArea, highlighted);
}

export async function renderAsync(ctrl, data, type, contentKey) {
    const outputArea = DOM.get(SELECTORS.CONVERTER.OUTPUT_AREA);
    if (!outputArea) return;

    if (ctrl._highlightCache.has(contentKey)) {
        DOM.setHtml(outputArea, getFromCache(ctrl._highlightCache, contentKey));
        return;
    }

    ctrl._isHighlighting = true;
    outputArea.innerHTML = '<span style="color: #9ca3af;">渲染中...</span>';

    const currentTaskId = ++ctrl._workerTaskId;

    try {
        if (!ctrl._worker) {
            ctrl._worker = new Worker('./modules/highlighter-worker.js', { type: 'module' });
        }

        ctrl._worker.postMessage({ id: currentTaskId, text: data, type });

        await new Promise((resolve) => {
            const handler = (e) => {
                if (e.data.id === currentTaskId) {
                    const result = e.data.result;
                    const safe = isHighlightHtmlSafe(result) ? result : StringUtils.escapeHtml(data);
                    addToCache(ctrl._highlightCache, contentKey, safe);
                    outputArea.innerHTML = safe;
                    ctrl._worker.removeEventListener('message', handler);
                    resolve();
                }
            };
            ctrl._worker.addEventListener('message', handler);
        });
    } catch (error) {
        Logger.error('Worker error:', error);
        const highlighted = type === 'json' ? highlightJson(data) : highlightYaml(data);
        addToCache(ctrl._highlightCache, contentKey, highlighted);
        outputArea.innerHTML = highlighted;
    } finally {
        ctrl._isHighlighting = false;
    }
}