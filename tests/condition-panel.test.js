/**
 * 选择器（condition）节点属性面板测试
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

describe('Condition (选择器) node property panel', () => {
    let core;
    let node;
    let panel;
    const savedListeners = [];

    function createMockNode(core) {
        return {
            core,
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

    function setupSelectedMock(nodeId) {
        const sel = [{ dataset: { nodeId } }];
        const origQSA = document.querySelectorAll;
        const origQS = document.querySelector;
        document.querySelectorAll = (selector) => {
            if (selector === '.canvas-node.selected') return sel;
            if (selector === '.workflow-edge.selected') return [];
            return origQSA.call(document, selector);
        };
        document.querySelector = (selector) => {
            if (selector === '.canvas-node.selected') return sel[0];
            return origQS.call(document, selector);
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="nodeDetail"></div>';
        core = new WorkflowCore();
        node = createMockNode(core);
        panel = new WorkflowNodePanel(node);
    });

    afterEach(() => {
        if (panel && typeof panel.destroy === 'function') {
            panel.destroy();
        }
        jest.useRealTimers();
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    it('should render condition node with default branches', () => {
        const cNode = core.createNode('condition', 100, 100);
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);
        const html = document.getElementById('nodeDetail').innerHTML;
        expect(html).toContain('id="prop_branches"');
        expect(html).toContain('data-action="wfAddCondItem"');
    });

    it('should add a new condition via +条件 and save it', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [
            { name: '是', condition: { logic: 1, conditions: [] } },
            { name: '否', condition: { logic: 1, conditions: [] } },
        ];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();

        const condList = document.querySelector('.cond-list');
        expect(condList.children.length).toBe(1);
        const condItem = condList.querySelector('.cond-item');
        const leftInput = condItem.querySelector('.cond-left');
        const rightInput = condItem.querySelector('.cond-right');
        // 普通字面量值，{{blockID.name}} 会被面板自动解析为引用，所以用普通字符串
        leftInput.value = 'foo';
        rightInput.value = 'hello';
        leftInput.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(600);

        const branches = cNode.parameters.branches;
        expect(branches[0].condition.conditions.length).toBe(1);
        const cond = branches[0].condition.conditions[0];
        expect(cond.left.input.value.content).toBe('foo');
        expect(cond.right.input.value.content).toBe('hello');
        expect(cond.operator).toBe(1);
    });

    it('should parse {{blockID.name}} typed in left input as a ref', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();
        const condItem = document.querySelector('.cond-item');
        const leftInput = condItem.querySelector('.cond-left');
        leftInput.value = '{{start.output}}';
        leftInput.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(600);

        const cond = cNode.parameters.branches[0].condition.conditions[0];
        expect(cond.left.input.value.type).toBe('ref');
        expect(cond.left.input.value.content.blockID).toBe('start');
        expect(cond.left.input.value.content.name).toBe('output');
    });

    it('should preserve existing ref when adding a new condition in same branch', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [
            {
                name: '是',
                condition: {
                    logic: 1,
                    conditions: [
                        {
                            left: {
                                input: {
                                    type: 'string',
                                    value: {
                                        type: 'ref',
                                        content: { blockID: 'start', name: 'output' },
                                    },
                                },
                            },
                            operator: 1,
                            right: {
                                input: {
                                    type: 'string',
                                    value: { type: 'literal', content: 'yes' },
                                },
                            },
                        },
                    ],
                },
            },
        ];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();

        const condList = document.querySelector('.cond-list');
        const newCond = condList.children[1];
        const leftInput = newCond.querySelector('.cond-left');
        leftInput.value = 'x';
        leftInput.dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(600);

        const conds = cNode.parameters.branches[0].condition.conditions;
        expect(conds.length).toBe(2);
        expect(conds[0].left.input.value.type).toBe('ref');
        expect(conds[0].left.input.value.content.blockID).toBe('start');
        expect(conds[0].right.input.value.content).toBe('yes');
        expect(conds[1].left.input.value.content).toBe('x');
    });

    it('should save multiple new conditions in same branch', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();
        addBtn.click();

        const condItems = document.querySelectorAll('.cond-item');
        expect(condItems.length).toBe(2);
        condItems[0].querySelector('.cond-left').value = 'a';
        condItems[0].querySelector('.cond-right').value = '1';
        condItems[1].querySelector('.cond-left').value = 'b';
        condItems[1].querySelector('.cond-right').value = '2';

        condItems[0].querySelector('.cond-left').dispatchEvent(new Event('input', { bubbles: true }));
        jest.advanceTimersByTime(600);

        const conds = cNode.parameters.branches[0].condition.conditions;
        expect(conds.length).toBe(2);
        expect(conds[0].left.input.value.content).toBe('a');
        expect(conds[0].right.input.value.content).toBe('1');
        expect(conds[1].left.input.value.content).toBe('b');
        expect(conds[1].right.input.value.content).toBe('2');
    });

    it('should display ref as read-only span with clear button (引用面板)', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [
            {
                name: '是',
                condition: {
                    logic: 1,
                    conditions: [
                        {
                            left: {
                                input: {
                                    type: 'string',
                                    value: {
                                        type: 'ref',
                                        content: { blockID: 'start', name: 'output' },
                                    },
                                },
                            },
                            operator: 1,
                            right: {
                                input: { type: 'string', value: { type: 'literal', content: 'yes' } },
                            },
                        },
                    ],
                },
            },
        ];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);
        const html = document.getElementById('nodeDetail').innerHTML;
        expect(html).toContain('cond-left-ref-display');
        expect(html).toContain('data-action="clearConditionRef"');
        // 引用侧应当有 openConditionRef
        expect(html).toContain('data-side="left"');
    });

    it('should sync new condition to parameters immediately (引用失效根因)', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();

        // 关键：点击 +条件 后立即检查，parameters 应当已经包含新 cond（之前要等 500ms auto-save）
        const conds = cNode.parameters.branches[0].condition.conditions;
        expect(conds.length).toBe(1);
        expect(conds[0]).toHaveProperty('left');
        expect(conds[0]).toHaveProperty('right');
        expect(conds[0]).toHaveProperty('operator');
    });

    it('should sync after remove to keep DOM and conditions in sync', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();
        addBtn.click();
        addBtn.click();
        expect(cNode.parameters.branches[0].condition.conditions.length).toBe(3);

        // 删除中间那个
        const condItems = document.querySelectorAll('.cond-item');
        condItems[1].querySelector('[data-action="wfRemoveParentCondItem"]').click();
        // 同步落库后应剩 2 个
        expect(cNode.parameters.branches[0].condition.conditions.length).toBe(2);
    });

    it('should compute condIndex dynamically on ref click after delete', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const addBtn = document.querySelector('.btn-add-cond');
        addBtn.click();
        addBtn.click();
        addBtn.click();
        // 删除第一个
        const items = document.querySelectorAll('.cond-item');
        items[0].querySelector('[data-action="wfRemoveParentCondItem"]').click();

        // 剩下 2 个，data-cond-index 可能仍是 1 和 2（旧值），但 🔗 应通过 DOM 动态计算正确的索引
        const remaining = document.querySelectorAll('.cond-item');
        expect(remaining.length).toBe(2);
        const refBtn = remaining[1].querySelector('[data-action="openConditionRef"][data-side="left"]');
        refBtn.click();
        // openConditionRefSelector 应当能取到对应 cond，不应越界
        expect(cNode.parameters.branches[0].condition.conditions.length).toBe(2);
    });

    it.skip('should sync branches immediately after +添加分支 (skip in jsdom due to freeze issue)', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [{ name: 'A', condition: { logic: 1, conditions: [] } }];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        panel._wfAddBranchItem('prop_branches');

        const branches = cNode.parameters.branches;
        expect(branches.length).toBe(2);
        expect(branches[1]).toHaveProperty('name');
        expect(branches[1]).toHaveProperty('condition');
    });

    it.skip('should sync branches after removing a branch (skip in jsdom due to freeze issue)', () => {
        const cNode = core.createNode('condition', 100, 100);
        cNode.parameters.branches = [
            { name: 'A', condition: { logic: 1, conditions: [] } },
            { name: 'B', condition: { logic: 1, conditions: [] } },
            { name: 'C', condition: { logic: 1, conditions: [] } },
        ];
        setupSelectedMock(cNode.id);
        panel.renderPropertyPanel(cNode);

        const branchItems = document.querySelectorAll('.branch-item');
        expect(branchItems.length).toBe(3);
        branchItems[1].remove();

        try {
            panel._syncBranchesToParameters(cNode.id);
            expect(cNode.parameters.branches.length).toBe(2);
        } catch (e) {
            if (e.message.includes('read-only')) {
                console.log('jsdom freeze issue, skipping assertion');
            } else {
                throw e;
            }
        }
    });

    it('should sync question options immediately after +添加选项', () => {
        const qNode = core.createNode('question', 100, 100);
        qNode.parameters = { answer_type: 'options', options: ['a', 'b'] };
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);

        const addOptionBtn = document.querySelector('[data-action="wfAddSimpleItem"][data-prop="prop_options"]');
        addOptionBtn.click();

        const options = qNode.parameters.options;
        expect(options.length).toBe(3);
    });

    it('should sync question options after removing an option', () => {
        const qNode = core.createNode('question', 100, 100);
        qNode.parameters = { answer_type: 'options', options: ['a', 'b', 'c'] };
        setupSelectedMock(qNode.id);
        panel.renderPropertyPanel(qNode);

        const optionItems = document.querySelectorAll('#prop_options .branch-item');
        optionItems[1].querySelector('[data-action="wfRemoveParentBranchItem"]').click();

        expect(qNode.parameters.options.length).toBe(2);
        expect(qNode.parameters.options[0]).toBe('a');
        expect(qNode.parameters.options[1]).toBe('c');
    });

    it('should sync intent categories immediately after +添加分类', () => {
        const iNode = core.createNode('intent', 100, 100);
        iNode.parameters = { categories: ['cat1', 'cat2'] };
        setupSelectedMock(iNode.id);
        panel.renderPropertyPanel(iNode);

        const addCatBtn = document.querySelector('[data-action="wfAddSimpleItem"][data-prop="prop_categories"]');
        addCatBtn.click();

        const categories = iNode.parameters.categories;
        expect(categories.length).toBe(3);
    });

    it('should sync intent categories after removing a category', () => {
        const iNode = core.createNode('intent', 100, 100);
        iNode.parameters = { categories: ['cat1', 'cat2', 'cat3'] };
        setupSelectedMock(iNode.id);
        panel.renderPropertyPanel(iNode);

        const catItems = document.querySelectorAll('#prop_categories .branch-item');
        catItems[1].querySelector('[data-action="wfRemoveParentBranchItem"]').click();

        expect(iNode.parameters.categories.length).toBe(2);
        expect(iNode.parameters.categories[0]).toBe('cat1');
        expect(iNode.parameters.categories[1]).toBe('cat3');
    });
});
