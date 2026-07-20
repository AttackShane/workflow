/**
 * 工作流搜索模块
 * 负责画布节点搜索和高亮筛选
 */
import { DOM } from '../utils/helpers.js';
import { TYPE_MAP } from '../utils/types.js';
import { t } from '../i18n/i18n.js';

let _typeNameMapCache = null;

function getTypeNameMap() {
    if (!_typeNameMapCache) {
        _typeNameMapCache = {};
        const types = Object.keys(TYPE_MAP || {});
        for (const type of types) {
            _typeNameMapCache[type] = t(`nodeTypes.${type}`);
        }
    }
    return _typeNameMapCache;
}

function invalidateTypeNameMapCache() {
    _typeNameMapCache = null;
}

export { invalidateTypeNameMapCache };

export class WorkflowSearch {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui - 主 UI 实例
     */
    constructor(ui) {
        this.ui = ui;
    }

    /**
     * 设置节点搜索处理器
     */
    setupSearchHandler() {
        const searchInput = /** @type {HTMLInputElement|null} */ (DOM.get('nodeSearchInput'));
        const searchScope = /** @type {HTMLSelectElement|null} */ (DOM.get('nodeSearchScope'));
        if (!searchInput) return;

        let debounceTimer = null;
        const triggerSearch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const term = searchInput.value.trim().toLowerCase();
                this.performSearch(term, searchScope?.value || 'all');
            }, 300);
        };

        DOM.on(searchInput, 'input', triggerSearch);

        if (searchScope) {
            DOM.on(searchScope, 'change', triggerSearch);
        }

        DOM.on(searchInput, 'keydown', (e) => {
            if (/** @type {KeyboardEvent} */ (e).key === 'Escape') {
                searchInput.value = '';
                this.performSearch('', 'all');
                searchInput.blur();
            }
        });
    }

    /**
     * 执行节点搜索筛选
     * @param {string} term - 搜索关键词
     * @param {string} scope - 搜索范围: 'all' | 'name' | 'description'
     */
    performSearch(term, scope = 'all') {
        const searchCount = DOM.get('nodeSearchCount');
        const nodeEls = document.querySelectorAll('.canvas-node');
        const edgeEls = document.querySelectorAll('[data-edge-id]');
        let matchCount = 0;

        if (!term) {
            nodeEls.forEach((el) => {
                DOM.removeClass(el, 'search-dimmed');
                DOM.removeClass(el, 'search-highlight');
                DOM.setStyle(el, 'opacity', '');
                DOM.setStyle(el, 'visibility', '');
                DOM.setStyle(el, 'pointerEvents', '');
                DOM.setStyle(el, 'display', '');
            });
            edgeEls.forEach((el) => {
                DOM.removeClass(el, 'search-dimmed');
            });
            if (searchCount) DOM.setStyle(searchCount, 'display', 'none');
            return;
        }

        const typeNameMap = getTypeNameMap();
        const noDescText = t('editor.noDescription').toLowerCase();

        const nodeElMap = new Map();
        const matchedNodeIds = new Set();
        const containerHasMatch = new Set();

        const self = this;
        function checkNode(node) {
            const name = (node.title || '').toLowerCase();
            const desc = (node.description || '').toLowerCase();
            const type = (node.type || '').toLowerCase();
            const typeName = (typeNameMap[type] || type).toLowerCase();
            const id = (node.id || '').toLowerCase();

            const matchName =
                name.includes(term) || type.includes(term) || typeName.includes(term) || id.includes(term);
            const matchDesc = desc.includes(term) || (!desc && noDescText.includes(term));

            let matches;
            if (scope === 'name') {
                matches = matchName;
            } else if (scope === 'description') {
                matches = matchDesc;
            } else {
                matches = matchName || matchDesc;
            }

            if (matches) {
                matchedNodeIds.add(node.id);
                if (node.parentId) {
                    containerHasMatch.add(node.parentId);
                }
            }

            if (self.ui.core.container.isContainer(node.id)) {
                const children = self.ui.core.container.getChildren(node.id);
                children.forEach((child) => checkNode(child));
            }
        }

        nodeEls.forEach((el) => {
            const nodeId = /** @type {HTMLElement} */ (el).dataset.nodeId;
            const node = self.ui.core.getNode(nodeId);
            if (!node) return;
            nodeElMap.set(nodeId, el);

            checkNode(node);
        });

        nodeElMap.forEach((el, nodeId) => {
            const isMatch = matchedNodeIds.has(nodeId);
            const node = self.ui.core.getNode(nodeId);
            const isContainer = node && self.ui.core.container.isContainer(nodeId);

            if (isMatch) {
                DOM.removeClass(el, 'search-dimmed');
                DOM.addClass(el, 'search-highlight');
                DOM.setStyle(el, 'opacity', '');
                DOM.setStyle(el, 'visibility', '');
                DOM.setStyle(el, 'pointerEvents', '');
                DOM.setStyle(el, 'display', '');
                matchCount++;
            } else {
                DOM.removeClass(el, 'search-highlight');
                if (isContainer && containerHasMatch.has(nodeId)) {
                    DOM.removeClass(el, 'search-dimmed');
                } else {
                    DOM.addClass(el, 'search-dimmed');
                }
                DOM.setStyle(el, 'opacity', '');
                DOM.setStyle(el, 'visibility', '');
                DOM.setStyle(el, 'pointerEvents', '');
                DOM.setStyle(el, 'display', '');
            }
        });

        edgeEls.forEach((el) => {
            const edgeId = el.getAttribute('data-edge-id');
            if (!edgeId) return;
            const edge = self.ui.core.getEdge(edgeId);
            if (!edge) return;

            const isVisible = matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target);
            if (isVisible) {
                DOM.removeClass(el, 'search-dimmed');
            } else {
                DOM.addClass(el, 'search-dimmed');
            }
        });

        if (searchCount) {
            DOM.setStyle(searchCount, 'display', 'inline');
            DOM.setText(searchCount, `${matchCount}/${nodeEls.length}`);
        }

        if (matchedNodeIds.size > 0) {
            const firstMatchId = matchedNodeIds.values().next().value;
            let targetEl = nodeElMap.get(firstMatchId);
            if (!targetEl) {
                const containerEls = document.querySelectorAll('.canvas-node[data-node-id]');
                for (const el of containerEls) {
                    if (/** @type {HTMLElement} */ (el).dataset.nodeId === firstMatchId) {
                        targetEl = el;
                        break;
                    }
                }
            }
            if (targetEl && self.ui.canvas) {
                const nodeData = self.ui.core.getNode(firstMatchId);
                if (nodeData) {
                    const canvasRect = self.ui.canvas.canvas.getBoundingClientRect();
                    const nodeCenterX = nodeData.x + (nodeData.width || 200) / 2;
                    const nodeCenterY = nodeData.y + (nodeData.height || 100) / 2;
                    const scale = self.ui.canvas.canvasScale || 1;
                    const newTranslateX = canvasRect.width / 2 - nodeCenterX * scale;
                    const newTranslateY = canvasRect.height / 2 - nodeCenterY * scale;
                    self.ui.canvas.applyTransform(newTranslateX, newTranslateY, scale);
                    self.ui.canvas.updateSvgSize();
                    self.ui.canvas.scheduleRenderUpdate();
                }
            }
        }
    }
}
