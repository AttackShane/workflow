/**
 * 选择操作模块测试 — editor-selection.js
 *
 * 覆盖关键路径：
 * - selectAll：全选节点和边，跳过子节点和锁定节点
 * - deselectAll：取消所有选中
 * - updateSelection：根据 DOM 选中状态更新 core/ui
 * - selectNodesInRect：框选逻辑，含容器内选择、累加模式
 * - deleteSelected：批量删除节点和边，含锁定节点跳过
 * - duplicateSelected：复制选中节点，含 blockID 重映射
 * - _remapBlockIdsForNode：blockID 引用重映射
 *
 * 策略：使用真实 jsdom DOM 元素 + 薄包装 DOM helper（addClass/removeClass
 * 实际操作 classList），使 querySelectorAll 能正确反映选择状态。
 * mock i18n 的 t() 返回键名本身。
 */
import { WorkflowSelection } from '../src/modules/editor/editor-selection.js';

// 薄包装：DOM.addClass/removeClass 实际操作 classList，
// 使 querySelectorAll('.selected') 能正确反映选择状态
// 注意：jest.mock 工厂不能引用 out-of-scope 变量（如 document），
// addClass/removeClass 只用参数 el，不直接引用 document
jest.mock('../src/utils/helpers.js', () => ({
    DOM: {
        get: jest.fn(() => null),
        addClass: jest.fn((el, cls) => {
            if (el) el.classList.add(cls);
        }),
        removeClass: jest.fn((el, cls) => {
            if (el) el.classList.remove(cls);
        }),
        setStyle: jest.fn(),
        setAttr: jest.fn(),
        create: jest.fn(() => ({ style: {}, appendChild: jest.fn() })),
        on: jest.fn(),
        off: jest.fn(),
    },
    deepClone: jest.fn((obj) => (obj == null ? obj : JSON.parse(JSON.stringify(obj)))),
}));

jest.mock('../src/i18n/i18n.js', () => ({
    t: jest.fn((key, params) => {
        if (params && params.count !== undefined) return `${key}:${params.count}`;
        return key;
    }),
}));

// ---- Mock 工厂 ----

function createMockCore(nodes = [], edges = []) {
    return {
        nodes,
        edges,
        selectedNode: null,
        selectedEdge: null,
        nodeTypeInfo: {},
        selectNode: jest.fn(),
        selectEdge: jest.fn(),
        updateNodePosition: jest.fn(),
        saveHistory: jest.fn(),
        isContainerNode: jest.fn(() => false),
        getChildNodes: jest.fn(() => []),
        container: {
            isContainer: jest.fn(() => false),
            getChildren: jest.fn(() => []),
            getAllDescendants: jest.fn(() => []),
            validateContainerPorts: jest.fn(() => ({ valid: true })),
        },
        batchChanges: jest.fn((fn) => fn()),
        addNode: jest.fn(),
        deleteNode: jest.fn(),
        getNode: function (id) {
            return this.nodes.find((n) => n.id === id);
        },
        getEdge: function (id) {
            return this.edges.find((e) => e.id === id);
        },
    };
}

function createMockUI(core) {
    const canvasContent = document.createElement('div');
    canvasContent.id = 'canvasContent';
    return {
        core,
        isMultiSelectMode: false,
        canvas: {
            canvasContent,
            _selectedNodeIds: new Set(),
            renderMinimap: jest.fn(),
        },
        align: { updateAlignToolbar: jest.fn() },
        edge: {
            update: jest.fn(),
            updateAffectedEdges: jest.fn(),
            delete: jest.fn(),
            renderPropertyPanel: jest.fn(),
        },
        node: {
            panel: { renderPropertyPanel: jest.fn() },
            render: {
                delete: jest.fn(),
                createElement: jest.fn((nodeData) => {
                    const el = document.createElement('div');
                    el.className = 'canvas-node';
                    el.dataset.nodeId = nodeData.id;
                    return el;
                }),
            },
        },
        showSummaryPanel: jest.fn(),
        clearPropertyPanel: jest.fn(),
        showMessage: jest.fn(),
        updateEdges: jest.fn(),
    };
}

function createMockSelection(nodes = [], edges = []) {
    const core = createMockCore(nodes, edges);
    const ui = createMockUI(core);
    const selection = new WorkflowSelection(ui);
    return { selection, ui, core };
}

/**
 * 创建真实 jsdom DOM 节点元素
 */
function createNodeEl(id, options = {}) {
    const el = document.createElement('div');
    el.className = 'canvas-node';
    if (options.container) el.classList.add('container');
    if (options.selected) el.classList.add('selected');
    el.dataset.nodeId = id;
    el.setAttribute('data-node-id', id);
    if (options.getBoundingClientRect) {
        el.getBoundingClientRect = options.getBoundingClientRect;
    }
    return el;
}

function createEdgeEl(id, options = {}) {
    const el = document.createElement('div');
    el.className = 'workflow-edge';
    if (options.selected) el.classList.add('selected');
    el.setAttribute('data-edge-id', id);
    return el;
}

describe('WorkflowSelection', () => {
    let selection, ui, core;

    beforeEach(() => {
        document.body.innerHTML = '';
        ({ selection, ui, core } = createMockSelection([], []));
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ==================================================================
    // selectAll
    // ==================================================================
    describe('selectAll', () => {
        it('应选中所有非子节点、非锁定节点', () => {
            const el1 = createNodeEl('n1');
            const el2 = createNodeEl('n2');
            const elChild = createNodeEl('child1');
            const elLocked = createNodeEl('locked1');
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            document.body.appendChild(elChild);
            document.body.appendChild(elLocked);
            core.nodes = [
                { id: 'n1', x: 0, y: 0 },
                { id: 'n2', x: 100, y: 100 },
                { id: 'child1', x: 10, y: 10, parentId: 'n2' },
                { id: 'locked1', x: 200, y: 200, locked: true },
            ];

            selection.selectAll();

            expect(el1.classList.contains('selected')).toBe(true);
            expect(el2.classList.contains('selected')).toBe(true);
            expect(elChild.classList.contains('selected')).toBe(false);
            expect(elLocked.classList.contains('selected')).toBe(false);
        });

        it('应选中所有非容器内边', () => {
            const edgeEl1 = createEdgeEl('e1');
            const edgeEl2 = createEdgeEl('e2');
            document.body.appendChild(edgeEl1);
            document.body.appendChild(edgeEl2);
            core.nodes = [
                { id: 'n1', x: 0, y: 0 },
                { id: 'n2', x: 100, y: 100 },
                { id: 'n3', x: 200, y: 200, parentId: 'container1' },
                { id: 'container1', x: 50, y: 50 },
            ];
            core.edges = [
                { id: 'e1', source: 'n1', target: 'n2' },
                { id: 'e2', source: 'n1', target: 'n3' },
            ];

            selection.selectAll();

            expect(edgeEl1.classList.contains('selected')).toBe(true);
            // e2 的 target n3 有 parentId，不应选中
            expect(edgeEl2.classList.contains('selected')).toBe(false);
        });

        it('有边时应调用 selectEdge', () => {
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];
            core.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];
            selection.selectAll();

            expect(core.selectEdge).toHaveBeenCalledWith('e1');
        });

        it('多节点时应设置多选模式', () => {
            const el1 = createNodeEl('n1');
            const el2 = createNodeEl('n2');
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            core.nodes = [
                { id: 'n1', x: 0, y: 0 },
                { id: 'n2', x: 100, y: 100 },
            ];

            selection.selectAll();

            expect(ui.isMultiSelectMode).toBe(true);
            expect(ui.align.updateAlignToolbar).toHaveBeenCalled();
            expect(ui.canvas.renderMinimap).toHaveBeenCalled();
        });

        it('单节点时不应设置多选模式', () => {
            const el1 = createNodeEl('n1');
            document.body.appendChild(el1);
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];

            selection.selectAll();

            expect(ui.isMultiSelectMode).toBe(false);
        });

        it('有节点时应渲染属性面板', () => {
            const el1 = createNodeEl('n1');
            document.body.appendChild(el1);
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];

            selection.selectAll();

            expect(ui.node.panel.renderPropertyPanel).toHaveBeenCalled();
        });
    });

    // ==================================================================
    // deselectAll
    // ==================================================================
    describe('deselectAll', () => {
        it('应移除所有节点和边的 selected 类', () => {
            const el1 = createNodeEl('n1', { selected: true });
            const el2 = createNodeEl('n2', { selected: true });
            const edgeEl = createEdgeEl('e1', { selected: true });
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            document.body.appendChild(edgeEl);

            selection.deselectAll();

            expect(el1.classList.contains('selected')).toBe(false);
            expect(el2.classList.contains('selected')).toBe(false);
            expect(edgeEl.classList.contains('selected')).toBe(false);
        });

        it('应重置多选状态和选中引用', () => {
            ui.isMultiSelectMode = true;
            core.selectedNode = { id: 'n1' };
            core.selectedEdge = { id: 'e1' };

            selection.deselectAll();

            expect(ui.isMultiSelectMode).toBe(false);
            expect(core.selectedNode).toBe(null);
            expect(core.selectedEdge).toBe(null);
        });

        it('应调用 clearPropertyPanel 和 edge.update', () => {
            selection.deselectAll();

            expect(ui.clearPropertyPanel).toHaveBeenCalled();
            expect(ui.edge.update).toHaveBeenCalled();
            expect(ui.align.updateAlignToolbar).toHaveBeenCalled();
            expect(ui.canvas.renderMinimap).toHaveBeenCalled();
        });
    });

    // ==================================================================
    // updateSelection
    // ==================================================================
    describe('updateSelection', () => {
        it('选中单个节点时应调用 selectNode 并渲染面板', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 0, y: 0, title: 'Node 1' }];

            selection.updateSelection();

            expect(core.selectNode).toHaveBeenCalledWith('n1');
            expect(ui.node.panel.renderPropertyPanel).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
        });

        it('选中多个节点时应设置多选模式', () => {
            const el1 = createNodeEl('n1', { selected: true });
            const el2 = createNodeEl('n2', { selected: true });
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            core.nodes = [
                { id: 'n1', x: 0, y: 0 },
                { id: 'n2', x: 100, y: 100 },
            ];

            selection.updateSelection();

            expect(ui.isMultiSelectMode).toBe(true);
        });

        it('无选中节点但有选中边时应调用 selectEdge', () => {
            const edgeEl = createEdgeEl('e1', { selected: true });
            document.body.appendChild(edgeEl);
            core.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

            selection.updateSelection();

            expect(core.selectEdge).toHaveBeenCalledWith('e1');
            expect(ui.edge.renderPropertyPanel).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
        });

        it('无选中时应正常处理不报错', () => {
            expect(() => selection.updateSelection()).not.toThrow();
            expect(ui.align.updateAlignToolbar).toHaveBeenCalled();
        });
    });

    // ==================================================================
    // selectNodesInRect
    // ==================================================================
    describe('selectNodesInRect', () => {
        it('应选中矩形区域内的节点', () => {
            const el1 = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            const el2 = createNodeEl('n2', {
                getBoundingClientRect: () => ({
                    left: 500,
                    top: 500,
                    width: 200,
                    height: 100,
                    right: 700,
                    bottom: 600,
                }),
            });
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            core.nodes = [
                { id: 'n1', x: 100, y: 100 },
                { id: 'n2', x: 500, y: 500 },
            ];

            // 框选区域 (50,50) 到 (350,350)，包含 n1 但不包含 n2
            selection.selectNodesInRect(50, 50, 300, 300);

            expect(el1.classList.contains('selected')).toBe(true);
            expect(el2.classList.contains('selected')).toBe(false);
        });

        it('应跳过子节点（有 parentId）', () => {
            const el = createNodeEl('child1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            document.body.appendChild(el);
            core.nodes = [{ id: 'child1', x: 100, y: 100, parentId: 'container1' }];

            selection.selectNodesInRect(50, 50, 300, 300);

            expect(el.classList.contains('selected')).toBe(false);
        });

        it('应跳过锁定节点', () => {
            const el = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100, locked: true }];

            selection.selectNodesInRect(50, 50, 300, 300);

            expect(el.classList.contains('selected')).toBe(false);
        });

        it('指定 containerId 时只选中该容器的子节点', () => {
            const elIn = createNodeEl('child1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            const elOut = createNodeEl('child2', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            document.body.appendChild(elIn);
            document.body.appendChild(elOut);
            core.nodes = [
                { id: 'child1', x: 100, y: 100, parentId: 'c1' },
                { id: 'child2', x: 100, y: 100, parentId: 'c2' },
            ];

            selection.selectNodesInRect(50, 50, 300, 300, false, 'c1');

            expect(elIn.classList.contains('selected')).toBe(true);
            expect(elOut.classList.contains('selected')).toBe(false);
        });

        it('accumulate=true 时应保留已有选中', () => {
            const elExisting = createNodeEl('n0', { selected: true });
            const elNew = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            document.body.appendChild(elExisting);
            document.body.appendChild(elNew);
            core.nodes = [
                { id: 'n0', x: 0, y: 0 },
                { id: 'n1', x: 100, y: 100 },
            ];

            selection.selectNodesInRect(50, 50, 300, 300, true);

            expect(elExisting.classList.contains('selected')).toBe(true);
            expect(elNew.classList.contains('selected')).toBe(true);
        });

        it('accumulate=false 时应先清除已有选中', () => {
            const elExisting = createNodeEl('n0', { selected: true });
            const elNew = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 200,
                    height: 100,
                    right: 300,
                    bottom: 200,
                }),
            });
            document.body.appendChild(elExisting);
            document.body.appendChild(elNew);
            core.nodes = [
                { id: 'n0', x: 0, y: 0 },
                { id: 'n1', x: 100, y: 100 },
            ];

            selection.selectNodesInRect(50, 50, 300, 300, false);

            expect(elExisting.classList.contains('selected')).toBe(false);
            expect(elNew.classList.contains('selected')).toBe(true);
        });

        it('两端的节点都选中时应同时选中连接边', () => {
            const el1 = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 50,
                    top: 50,
                    width: 100,
                    height: 50,
                    right: 150,
                    bottom: 100,
                }),
            });
            const el2 = createNodeEl('n2', {
                getBoundingClientRect: () => ({
                    left: 200,
                    top: 50,
                    width: 100,
                    height: 50,
                    right: 300,
                    bottom: 100,
                }),
            });
            const edgeEl = createEdgeEl('e1');
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            document.body.appendChild(edgeEl);
            core.nodes = [
                { id: 'n1', x: 50, y: 50 },
                { id: 'n2', x: 200, y: 50 },
            ];
            core.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

            selection.selectNodesInRect(0, 0, 400, 200);

            expect(edgeEl.classList.contains('selected')).toBe(true);
        });

        it('只有一端节点选中时不应选中边', () => {
            const el1 = createNodeEl('n1', {
                getBoundingClientRect: () => ({
                    left: 50,
                    top: 50,
                    width: 100,
                    height: 50,
                    right: 150,
                    bottom: 100,
                }),
            });
            const el2 = createNodeEl('n2', {
                getBoundingClientRect: () => ({
                    left: 500,
                    top: 500,
                    width: 100,
                    height: 50,
                    right: 600,
                    bottom: 550,
                }),
            });
            const edgeEl = createEdgeEl('e1');
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            document.body.appendChild(edgeEl);
            core.nodes = [
                { id: 'n1', x: 50, y: 50 },
                { id: 'n2', x: 500, y: 500 },
            ];
            core.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

            selection.selectNodesInRect(0, 0, 200, 200);

            expect(el1.classList.contains('selected')).toBe(true);
            expect(el2.classList.contains('selected')).toBe(false);
            expect(edgeEl.classList.contains('selected')).toBe(false);
        });
    });

    // ==================================================================
    // deleteSelected
    // ==================================================================
    describe('deleteSelected', () => {
        it('无选中时应直接返回', () => {
            selection.deleteSelected();

            expect(core.batchChanges).not.toHaveBeenCalled();
            expect(core.saveHistory).not.toHaveBeenCalled();
        });

        it('应删除选中的节点', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];

            selection.deleteSelected();

            expect(ui.node.render.delete).toHaveBeenCalledWith('n1', false, false);
            expect(core.saveHistory).toHaveBeenCalledWith('messages.deleteSelection');
            expect(ui.showMessage).toHaveBeenCalledWith('messages.deletedSelection', 'success');
        });

        it('应删除选中的边', () => {
            const edgeEl = createEdgeEl('e1', { selected: true });
            document.body.appendChild(edgeEl);
            core.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

            selection.deleteSelected();

            expect(ui.edge.delete).toHaveBeenCalledWith('e1', false, false);
            expect(core.saveHistory).toHaveBeenCalledWith('messages.deleteSelection');
        });

        it('应跳过锁定节点', () => {
            const elLocked = createNodeEl('n1', { selected: true });
            const elNormal = createNodeEl('n2', { selected: true });
            document.body.appendChild(elLocked);
            document.body.appendChild(elNormal);
            core.nodes = [
                { id: 'n1', x: 0, y: 0, locked: true },
                { id: 'n2', x: 100, y: 100 },
            ];

            selection.deleteSelected();

            expect(ui.node.render.delete).not.toHaveBeenCalledWith('n1', false, false);
            expect(ui.node.render.delete).toHaveBeenCalledWith('n2', false, false);
        });

        it('应通过 batchChanges 批量执行', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];

            selection.deleteSelected();

            expect(core.batchChanges).toHaveBeenCalled();
        });

        it('删除后应清除选中引用', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 0, y: 0 }];
            core.selectedNode = { id: 'n1' };
            core.selectedEdge = { id: 'e1' };

            selection.deleteSelected();

            expect(core.selectedNode).toBe(null);
            expect(core.selectedEdge).toBe(null);
        });
    });

    // ==================================================================
    // duplicateSelected
    // ==================================================================
    describe('duplicateSelected', () => {
        beforeEach(() => {
            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
            jest.spyOn(Math, 'random').mockReturnValue(0.123456);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('无选中时应直接返回', () => {
            selection.duplicateSelected();

            expect(core.addNode).not.toHaveBeenCalled();
            expect(core.saveHistory).not.toHaveBeenCalled();
        });

        it('应复制选中节点并偏移 30px', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            const nodeData = { id: 'n1', x: 100, y: 200, title: 'Test', type: 'llm' };
            core.nodes = [nodeData];

            selection.duplicateSelected();

            expect(core.addNode).toHaveBeenCalledTimes(1);
            const newNode = core.addNode.mock.calls[0][0];
            expect(newNode.x).toBe(130);
            expect(newNode.y).toBe(230);
            expect(newNode.id).toMatch(/^node_1234567890_[a-z0-9]{5}$/);
            expect(newNode.title).toBe('Test' + 'messages.duplicateNodeSuffix');
        });

        it('应调用 createElement 并添加到 canvasContent', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            const nodeData = { id: 'n1', x: 100, y: 200, title: 'Test', type: 'llm' };
            core.nodes = [nodeData];
            const newEl = createNodeEl('new1');
            ui.node.render.createElement = jest.fn(() => newEl);

            selection.duplicateSelected();

            expect(ui.node.render.createElement).toHaveBeenCalled();
            expect(newEl.classList.contains('selected')).toBe(true);
        });

        it('应保存历史并显示消息', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 200, title: 'Test', type: 'llm' }];

            selection.duplicateSelected();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.duplicateNodes');
            expect(ui.showMessage).toHaveBeenCalledWith('messages.duplicatedNodes:1', 'success');
        });

        it('应深拷贝节点数据（不修改原节点）', () => {
            const el = createNodeEl('n1', { selected: true });
            document.body.appendChild(el);
            const nodeData = { id: 'n1', x: 100, y: 200, title: 'Original', type: 'llm', inputParams: [] };
            core.nodes = [nodeData];

            selection.duplicateSelected();

            expect(nodeData.id).toBe('n1');
            expect(nodeData.title).toBe('Original');
            const newNode = core.addNode.mock.calls[0][0];
            expect(newNode).not.toBe(nodeData);
        });
    });

    // ==================================================================
    // _remapBlockIdsForNode
    // ==================================================================
    describe('_remapBlockIdsForNode', () => {
        it('应重映射 inputParams 中的 ref blockID', () => {
            const node = {
                inputParams: [
                    { valueType: 'ref', value: { content: { blockID: 'old1' } } },
                    { valueType: 'ref', value: { content: { blockID: 'keep' } } },
                ],
            };
            const idMap = { old1: 'new1' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.inputParams[0].value.content.blockID).toBe('new1');
            expect(node.inputParams[1].value.content.blockID).toBe('keep');
        });

        it('非 ref 类型的 inputParams 不应重映射', () => {
            const node = {
                inputParams: [{ valueType: 'literal', value: { content: { blockID: 'old1' } } }],
            };
            const idMap = { old1: 'new1' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.inputParams[0].value.content.blockID).toBe('old1');
        });

        it('应重映射 parameters._contentRaw 中的 ref blockID', () => {
            const node = {
                parameters: {
                    _contentRaw: { value: { type: 'ref', content: { blockID: 'old1' } } },
                },
            };
            const idMap = { old1: 'new1' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.parameters._contentRaw.value.content.blockID).toBe('new1');
        });

        it('应重映射 parameters.dynamic_option 中的 ref blockID', () => {
            const node = {
                parameters: {
                    dynamic_option: { value: { type: 'ref', content: { blockID: 'old1' } } },
                },
            };
            const idMap = { old1: 'new1' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.parameters.dynamic_option.value.content.blockID).toBe('new1');
        });

        it('loop_set_variable 应重映射 variables 左右两侧 blockID', () => {
            const node = {
                type: 'loop_set_variable',
                parameters: {
                    variables: [
                        {
                            left: { value: { content: { blockID: 'old1' } } },
                            right: { value: { content: { blockID: 'old2' } } },
                        },
                    ],
                },
            };
            const idMap = { old1: 'new1', old2: 'new2' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.parameters.variables[0].left.value.content.blockID).toBe('new1');
            expect(node.parameters.variables[0].right.value.content.blockID).toBe('new2');
        });

        it('idMap 中不存在的 blockID 应保持不变', () => {
            const node = {
                inputParams: [{ valueType: 'ref', value: { content: { blockID: 'unmapped' } } }],
            };
            const idMap = { old1: 'new1' };

            selection._remapBlockIdsForNode(node, idMap);

            expect(node.inputParams[0].value.content.blockID).toBe('unmapped');
        });

        it('无 inputParams 和 parameters 时不应报错', () => {
            const node = {};
            expect(() => selection._remapBlockIdsForNode(node, {})).not.toThrow();
        });
    });
});
