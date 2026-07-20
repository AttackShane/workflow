/**
 * 选择器（question）节点属性面板测试
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

describe('Question node property panel', () => {
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

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function setupSelectedMock(nodeId) {
        const sel = [{ dataset: { nodeId } }];
        const origQSA = document.querySelectorAll;
        document.querySelectorAll = (selector) => {
            if (selector === '.canvas-node.selected') return sel;
            if (selector === '.workflow-edge.selected') return [];
            return origQSA.call(document, selector);
        };
    }

    it('should render question node with empty options (text mode)', () => {
        const qNode = core.createNode('question', 100, 100);
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        // text mode 应当显示提示信息，并禁用 options
        expect(html).toContain('id="prop_options"');
        expect(html).toContain('data-question-options="true"');
        expect(html).toContain('option_empty_hint');
        expect(html).toContain('pointer-events:none');
    });

    it('should render question node with array options (options mode)', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: { answer_type: 'options', options: ['A', 'B', 'C'] },
        });
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        expect(html).toContain('value="A"');
        expect(html).toContain('value="B"');
        expect(html).toContain('value="C"');
        // options 模式下不应禁用
        expect(html).not.toContain('pointer-events:none');
    });

    it('should render question node with object options {name, value}', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: {
                answer_type: 'options',
                options: [
                    { name: 'A', value: 'a_val' },
                    { name: 'B', value: 'b_val' },
                ],
            },
        });
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        expect(html).toContain('value="A"');
        expect(html).toContain('value="B"');
        expect(html).toContain('value="a_val"');
        expect(html).toContain('value="b_val"');
    });

    it('should save options as object array when value present', () => {
        const qNode = core.createNode('question', 100, 100);
        qNode.parameters.options = ['A']; // ensure options is treated as an existing field
        qNode.parameters.answer_type = 'options';
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const list = document.getElementById('prop_options');
        list.innerHTML = `
            <div class="branch-item">
                <input class="property-input branch-name" value="A">
                <input class="property-input branch-value" value="a_val">
                <button data-action="wfRemoveParentBranchItem">×</button>
            </div>
            <div class="branch-item">
                <input class="property-input branch-name" value="B">
                <input class="property-input branch-value" value="">
                <button data-action="wfRemoveParentBranchItem">×</button>
            </div>
        `;
        panel.saveNodeDetail(qNode.id);
        expect(qNode.parameters.options).toEqual([{ name: 'A', value: 'a_val' }, 'B']);
    });

    it('should filter empty options', () => {
        const qNode = core.createNode('question', 100, 100);
        qNode.parameters.options = [];
        qNode.parameters.answer_type = 'options';
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const list = document.getElementById('prop_options');
        list.innerHTML = `
            <div class="branch-item">
                <input class="property-input branch-name" value="A">
                <input class="property-input branch-value" value="">
                <button data-action="wfRemoveParentBranchItem">×</button>
            </div>
            <div class="branch-item">
                <input class="property-input branch-name" value="   ">
                <input class="property-input branch-value" value="">
                <button data-action="wfRemoveParentBranchItem">×</button>
            </div>
            <div class="branch-item">
                <input class="property-input branch-name" value="B">
                <input class="property-input branch-value" value="">
                <button data-action="wfRemoveParentBranchItem">×</button>
            </div>
        `;
        panel.saveNodeDetail(qNode.id);
        expect(qNode.parameters.options).toEqual(['A', 'B']);
    });

    it('should render new fields: question, option_type, extra_output, dynamic_option', () => {
        const qNode = core.createNode('question', 100, 100);
        core.selectNode(qNode.id);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        expect(html).toContain('id="prop_question"');
        expect(html).toContain('id="prop_option_type"');
        expect(html).toContain('id="prop_dynamic_option"');
        expect(html).toContain('id="prop_extra_output"');
    });
});
