/**
 * 完整渲染 question 节点属性面板
 */
jest.mock('../src/i18n/i18n.js', () => ({
    t: jest.fn((key) => key),
    getLocale: jest.fn(() => ({ modelNames: {} })),
    setLanguage: jest.fn(),
    getLanguage: jest.fn(() => 'zh-CN'),
    i18n: { t: (k) => k, getLocale: () => ({ modelNames: {} }) },
}));

import { WorkflowCore } from '../src/modules/editor/editor-core.js';
import { WorkflowNodePanel } from '../src/modules/editor/editor-node-panel.js';

function createMockNode() {
    return {
        core: null,
        ui: {
            showDetailPanel: () => {},
            showSummaryPanel: () => {},
            showMessage: () => {},
            updateEdges: () => {},
            _currentPanelNodeId: null,
        },
        render: { _reRenderNode: () => {} },
        paramEditor: {
            renderMergeGroups: () => '',
            renderLoopVariables: () => '',
            renderLoopIntermediateVariables: () => '',
            renderInputOutputParams: () => '',
            saveDynamicParams: () => {},
            saveMergeGroupVars: () => {},
            saveLoopVariables: () => {},
            saveLoopIntermediateVariables: () => {},
            _paramsFromNodeOutputs: () => [],
            addInputParam: () => {},
            addOutputParam: () => {},
        },
        selector: {
            openConditionRefSelector: () => {},
            clearConditionRef: () => {},
        },
    };
}

describe('Question panel full HTML', () => {
    let core;
    let node;
    let panel;

    beforeEach(() => {
        document.body.innerHTML = '<div id="nodeDetail"></div>';
        core = new WorkflowCore();
        node = createMockNode();
        node.core = core;
        panel = new WorkflowNodePanel(node);
    });

    it('Prints full HTML for default question node', () => {
        const qNode = core.createNode('question', 100, 100);
        core.selectNode(qNode.id);
        const sel = [{ dataset: { nodeId: qNode.id } }];
        const origQSA = document.querySelectorAll;
        document.querySelectorAll = (selector) => {
            if (selector === '.canvas-node.selected') return sel;
            if (selector === '.workflow-edge.selected') return [];
            return origQSA.call(document, selector);
        };
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        console.log('=== FULL HTML ===');
        console.log(detail.innerHTML);
    });

    it('Prints full HTML for question node with options', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: {
                answer_type: 'options',
                options: ['A', 'B', 'C'],
                limit: 3,
            },
        });
        core.selectNode(qNode.id);
        const sel = [{ dataset: { nodeId: qNode.id } }];
        const origQSA = document.querySelectorAll;
        document.querySelectorAll = (selector) => {
            if (selector === '.canvas-node.selected') return sel;
            if (selector === '.workflow-edge.selected') return [];
            return origQSA.call(document, selector);
        };
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        console.log('=== FULL HTML with options ===');
        console.log(detail.innerHTML);
    });
});
