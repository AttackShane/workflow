/**
 * 工作流搜索模块
 * 负责画布节点搜索和高亮筛选
 */
import { DOM } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

/**
 * 搜索相关的 mixin 方法
 * @param {import('./workflow-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinSearch(ui) {
    /**
     * 设置节点搜索处理器
     */
    ui.setupSearchHandler = function() {
        const searchInput = DOM.get('nodeSearchInput');
        const searchCount = DOM.get('nodeSearchCount');
        if (!searchInput) return;

        DOM.on(searchInput, 'input', () => {
            const term = searchInput.value.trim().toLowerCase();
            this.performSearch(term);
        });

        DOM.on(searchInput, 'keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.performSearch('');
                searchInput.blur();
            }
        });
    };

    /**
     * 执行节点搜索筛选
     * @param {string} term - 搜索关键词
     */
    ui.performSearch = function(term) {
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
            });
            edgeEls.forEach(el => {
                DOM.removeClass(el, 'search-dimmed');
            });
            if (searchCount) DOM.setStyle(searchCount, 'display', 'none');
            return;
        }

        const typeNameMap = {
            start: t('nodeTypes.start'), end: t('nodeTypes.end'), llm: t('nodeTypes.llm'),
            plugin: t('nodeTypes.plugin'), code: t('nodeTypes.code'), condition: t('nodeTypes.condition'),
            http: t('nodeTypes.http'), text: t('nodeTypes.text'),
            image_generate: t('nodeTypes.image_generate'), knowledge_query: t('nodeTypes.knowledge_query'),
            question: t('nodeTypes.question'), loop: t('nodeTypes.loop'),
            async_task: t('nodeTypes.async_task'), comment: t('nodeTypes.comment'),
            output: t('nodeTypes.output'), input: t('nodeTypes.input'),
            variable_merge: t('nodeTypes.variable_merge'), intent: t('nodeTypes.intent'),
            batch: t('nodeTypes.batch'), video_generation: t('nodeTypes.video_generation'),
            workflow: t('nodeTypes.workflow'), sql_exec: t('nodeTypes.sql_exec'),
            canvas: t('nodeTypes.canvas'), knowledge_write: t('nodeTypes.knowledge_write'),
            knowledge_delete: t('nodeTypes.knowledge_delete'), clear_conversation: t('nodeTypes.clear_conversation'),
            create_conversation: t('nodeTypes.create_conversation'), db_update: t('nodeTypes.db_update'),
            db_select: t('nodeTypes.db_select'), db_delete: t('nodeTypes.db_delete'),
            db_insert: t('nodeTypes.db_insert'), update_conversation: t('nodeTypes.update_conversation'),
            delete_conversation: t('nodeTypes.delete_conversation'), list_conversation: t('nodeTypes.list_conversation'),
            get_conversation_history: t('nodeTypes.get_conversation_history'), create_message: t('nodeTypes.create_message'),
            update_message: t('nodeTypes.update_message'), delete_message: t('nodeTypes.delete_message'),
            json_serialize: t('nodeTypes.json_serialize'), json_deserialize: t('nodeTypes.json_deserialize'),
            video_extract_audio: t('nodeTypes.video_extract_audio'), video_extract_frame: t('nodeTypes.video_extract_frame'),
            memory_write: t('nodeTypes.memory_write'), memory_read: t('nodeTypes.memory_read')
        };

        const nodeElMap = new Map();
        const matchedNodeIds = new Set();
        const containerHasMatch = new Set();

        function checkNode(node) {
            const name = (node.title || '').toLowerCase();
            const type = (node.type || '').toLowerCase();
            const typeName = (typeNameMap[type] || type).toLowerCase();
            const id = (node.id || '').toLowerCase();

            const matches = name.includes(term) || type.includes(term) || typeName.includes(term) || id.includes(term);

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
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };
}