// @ts-nocheck
/**
 * 工作流搜索模块
 * 负责画布节点搜索和高亮筛选
 */
import { DOM } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

const NODE_TYPES = [
    'start', 'end', 'llm', 'plugin', 'code', 'condition',
    'http', 'text', 'image_generate', 'knowledge_query',
    'question', 'loop', 'async_task', 'comment',
    'output', 'input', 'variable_merge', 'intent',
    'batch', 'video_generation', 'workflow', 'sql_exec',
    'canvas', 'knowledge_write', 'knowledge_delete', 'clear_conversation',
    'create_conversation', 'db_update', 'db_select', 'db_delete',
    'db_insert', 'update_conversation', 'delete_conversation', 'list_conversation',
    'get_conversation_history', 'create_message', 'update_message', 'delete_message',
    'json_serialize', 'json_deserialize', 'video_extract_audio', 'video_extract_frame',
    'memory_write', 'memory_read'
];

let _typeNameMapCache = null;

function getTypeNameMap() {
    if (!_typeNameMapCache) {
        _typeNameMapCache = {};
        for (const type of NODE_TYPES) {
            _typeNameMapCache[type] = t(`nodeTypes.${type}`);
        }
    }
    return _typeNameMapCache;
}

function invalidateTypeNameMapCache() {
    _typeNameMapCache = null;
}

export { invalidateTypeNameMapCache };

/**
 * 搜索相关的 mixin 方法
 * @param {import('./editor-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinSearch(ui) {
    /**
     * 设置节点搜索处理器
     */
    ui.setupSearchHandler = function() {
        const searchInput = DOM.get('nodeSearchInput');
        const searchScope = DOM.get('nodeSearchScope');
        const _searchCount = DOM.get('nodeSearchCount');
        if (!searchInput) return;

        const triggerSearch = () => {
            const term = searchInput.value.trim().toLowerCase();
            this.performSearch(term, searchScope?.value || 'all');
        };

        DOM.on(searchInput, 'input', triggerSearch);

        if (searchScope) {
            DOM.on(searchScope, 'change', triggerSearch);
        }

        DOM.on(searchInput, 'keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.performSearch('', 'all');
                searchInput.blur();
            }
        });
    };

    /**
     * 执行节点搜索筛选
     * @param {string} term - 搜索关键词
     * @param {string} scope - 搜索范围: 'all' | 'name' | 'description'
     */
    ui.performSearch = function(term, scope = 'all') {
        const searchCount = DOM.get('nodeSearchCount');
        const nodeEls = document.querySelectorAll('.canvas-node');
        const edgeEls = document.querySelectorAll('[data-edge-id]');
        let matchCount = 0;

        if (!term) {
            nodeEls.forEach(el => {
                DOM.removeClass(el, 'search-dimmed');
                DOM.removeClass(el, 'search-highlight');
                DOM.setStyle(el, 'opacity', '');
                DOM.setStyle(el, 'visibility', '');
                DOM.setStyle(el, 'pointerEvents', '');
                DOM.setStyle(el, 'display', '');
            });
            edgeEls.forEach(el => {
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

        function checkNode(node) {
            const name = (node.title || '').toLowerCase();
            const desc = (node.description || '').toLowerCase();
            const type = (node.type || '').toLowerCase();
            const typeName = (typeNameMap[type] || type).toLowerCase();
            const id = (node.id || '').toLowerCase();

            const matchName = name.includes(term) || type.includes(term) || typeName.includes(term) || id.includes(term);
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

            if (this.core.isContainerNode(node.id)) {
                const children = this.core.getChildNodes(node.id);
                children.forEach(child => checkNode.call(this, child));
            }
        }

        nodeEls.forEach(el => {
            const nodeId = el.dataset.nodeId;
            const node = this.core.nodes.find(n => n.id === nodeId);
            if (!node) return;
            nodeElMap.set(nodeId, el);

            checkNode.call(this, node);
        });

        nodeElMap.forEach((el, nodeId) => {
            const isMatch = matchedNodeIds.has(nodeId);
            const node = this.core.nodes.find(n => n.id === nodeId);
            const isContainer = node && this.core.isContainerNode(nodeId);

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

        edgeEls.forEach(el => {
            const edgeId = el.getAttribute('data-edge-id');
            if (!edgeId) return;
            const edge = this.core.edges.find(e => e.id === edgeId);
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

        // 滚动到第一个匹配节点
        if (matchedNodeIds.size > 0) {
            const firstMatchId = matchedNodeIds.values().next().value;
            let targetEl = nodeElMap.get(firstMatchId);
            if (!targetEl) {
                const containerEls = document.querySelectorAll('.canvas-node[data-node-id]');
                for (const el of containerEls) {
                    if (el.dataset.nodeId === firstMatchId) {
                        targetEl = el;
                        break;
                    }
                }
            }
            if (targetEl) {
                const nodeData = this.core.nodes.find(n => n.id === firstMatchId);
                if (nodeData && this.canvas) {
                    const canvasRect = this.canvas.canvas.getBoundingClientRect();
                    const nodeCenterX = nodeData.x + (nodeData.width || 200) / 2;
                    const nodeCenterY = nodeData.y + (nodeData.height || 100) / 2;
                    const scale = this.canvas.canvasScale || 1;
                    const newTranslateX = canvasRect.width / 2 - nodeCenterX * scale;
                    const newTranslateY = canvasRect.height / 2 - nodeCenterY * scale;
                    this.canvas.applyTransform(newTranslateX, newTranslateY, scale);
                    this.canvas.updateSvgSize();
                    this.canvas.scheduleRenderUpdate();
                }
            }
        }
    };
}