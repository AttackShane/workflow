/**
 * 选择器节点属性面板深入测试
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

describe('Question node property panel - edge cases', () => {
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

    function setupSelectedMock(nodeId) {
        const sel = [{ dataset: { nodeId } }];
        const origQSA = document.querySelectorAll;
        document.querySelectorAll = (selector) => {
            if (selector === '.canvas-node.selected') return sel;
            if (selector === '.workflow-edge.selected') return [];
            return origQSA.call(document, selector);
        };
    }

    it('should preserve object options {name, value} after save', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: {
                answer_type: 'options',
                options: [
                    { name: 'A', value: 'a_val' },
                    { name: 'B', value: 'b_val' },
                ],
            },
        });
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        // Save without changes - just calling saveNodeDetail
        panel.saveNodeDetail(qNode.id);
        console.log('=== after save ===');
        console.log(JSON.stringify(qNode.parameters, null, 2));
        // 修复后：value 字段必须保留
        expect(qNode.parameters.options).toEqual([
            { name: 'A', value: 'a_val' },
            { name: 'B', value: 'b_val' },
        ]);
    });

    it('should filter empty options after save', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: { answer_type: 'options', options: '[]' },
        });
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
                <input class="property-input branch-name" value="">
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

    it('should handle Coze import with object options', () => {
        // Simulate import from Coze: options is array of {name, value}
        const qNode = core.createNode('question', 100, 100, {
            parameters: {
                options: [
                    { name: '苹果', value: 'apple' },
                    { name: '香蕉', value: 'banana' },
                ],
            },
        });
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        console.log('=== Coze import HTML ===');
        console.log(html.substring(0, 3000));
        // Currently, the UI only shows the name, not the value
        // This is a bug: user can't see or edit the value field
    });

    it('should handle answer_type=text (options should not be editable?)', () => {
        const qNode = core.createNode('question', 100, 100, {
            parameters: { answer_type: 'text', options: ['should-not-show'] },
        });
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const detail = document.getElementById('nodeDetail');
        const html = detail.innerHTML;
        console.log('=== answer_type=text HTML ===');
        console.log(html.substring(0, 3000));
        // The options field is still shown - is this a bug?
    });

    it('should handle wfAddSimpleItem action', () => {
        const qNode = core.createNode('question', 100, 100);
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        // Manually trigger wfAddSimpleItem
        const event = new Event('click', { bubbles: true });
        const target = document.querySelector('[data-action="wfAddSimpleItem"]');
        Object.defineProperty(event, 'target', { value: target, writable: false });
        // Simulate via _handleAction
        panel._handleAction({ target });
        const list = document.getElementById('prop_options');
        console.log('=== after add ===');
        console.log(list.innerHTML);
        expect(list.querySelectorAll('.branch-item').length).toBe(1);
    });

    it('should handle wfRemoveParentBranchItem action', () => {
        const qNode = core.createNode('question', 100, 100, { parameters: { options: ['A', 'B', 'C'] } });
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);
        const list = document.getElementById('prop_options');
        expect(list.querySelectorAll('.branch-item').length).toBe(3);
        const removeBtn = list.querySelector('[data-action="wfRemoveParentBranchItem"]');
        panel._handleAction({ target: removeBtn });
        console.log('=== after remove ===');
        console.log(list.innerHTML);
        expect(list.querySelectorAll('.branch-item').length).toBe(2);
    });
});
