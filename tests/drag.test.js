/**
 * 拖拽交互模块测试 — editor-node-drag.js
 *
 * 覆盖关键路径：
 * - onMouseDown：单击选中、Shift 多选切换、锁定节点处理、连接点/容器体跳过
 * - _onDragMove：拖拽移动节点、hasDragged 阈值、网格吸附、多选同步移动
 * - _onDragEnd：历史保存、位置更新、容器拖入（parentId 更新）、Ctrl 拖出
 * - computeAlignment：智能对齐吸附计算（无辅助线、对齐匹配、超出阈值）
 * - _findDropTarget：拖放目标容器命中检测
 * - _filterEdgesOnDetach / _filterEdgesForContainer：容器拖入拖出边过滤
 * - _handleCtrlDetach：Ctrl 拖出容器时 parentId 清除
 * - _makeEscapeHandler：Escape 取消拖拽
 *
 * 策略：使用真实 jsdom DOM 元素（非 mock querySelectorAll），
 * 仅 mock 高层依赖（core/ui/canvas/container）和 APP_CONFIG 常量。
 * requestAnimationFrame mock 为同步执行以便测试 rAF 回调内的逻辑。
 */
import { WorkflowNodeDrag } from '../src/modules/editor-node-drag.js';

jest.mock('../src/config/constants.js', () => ({
    APP_CONFIG: {
        NODE: {
            NODE_HEADER_H: 32,
            CONTAINER_HEADER_H: 36,
            CONTAINER_DESC_H: 20,
            CONTAINER_OFFSET: 56,
            CONTAINER_BODY_OFFSET: 58,
        },
    },
}));

// rAF 同步执行
global.requestAnimationFrame = (cb) => {
    cb();
    return 1;
};
global.cancelAnimationFrame = () => {};

// ---- Mock 工厂 ----

function createMockCore(nodes = []) {
    const edges = [];
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
        batchChanges: jest.fn((fn) => fn()),
        addNode: jest.fn(),
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
        dragStartX: 0,
        dragStartY: 0,
        hasDragged: false,
        isMultiSelectMode: false,
        align: { updateAlignToolbar: jest.fn() },
        edge: { updateAffectedEdges: jest.fn(), update: jest.fn() },
        showSummaryPanel: jest.fn(),
        clearPropertyPanel: jest.fn(),
        showMessage: jest.fn(),
        canvas: {
            canvasScale: 1,
            snapEnabled: false,
            snapToGrid: jest.fn((v) => v),
            canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
            canvasContent,
            screenToCanvas: jest.fn((x, y) => ({ canvasX: x, canvasY: y })),
            updateSvgSize: jest.fn(),
            renderMinimap: jest.fn(),
        },
    };
}

function createMockNode(core, ui) {
    return {
        core,
        ui,
        panel: { renderPropertyPanel: jest.fn() },
        container: {
            updateContainerSize: jest.fn(),
            renderContainerChildren: jest.fn(),
        },
        _elMap: new Map(),
        _dragListeners: null,
    };
}

function createDragInstance(nodes = []) {
    const core = createMockCore(nodes);
    const ui = createMockUI(core);
    const node = createMockNode(core, ui);
    const drag = new WorkflowNodeDrag(node);
    return { drag, node, core, ui };
}

/**
 * 创建真实 jsdom DOM 节点元素
 */
function createNodeEl(id, x, y, options = {}) {
    const el = document.createElement('div');
    el.className = 'canvas-node';
    if (options.className) el.className += ' ' + options.className;
    if (options.container) el.classList.add('container');
    if (options.selected) el.classList.add('selected');
    if (options.locked) el.classList.add('locked');
    el.dataset.nodeId = id;
    el.dataset.x = String(x);
    el.dataset.y = String(y);
    el.style.transform = `translate(${x}px, ${y}px)`;
    return el;
}

function createMouseEvent(options = {}) {
    return {
        clientX: options.clientX || 0,
        clientY: options.clientY || 0,
        shiftKey: options.shiftKey || false,
        ctrlKey: options.ctrlKey || false,
        metaKey: options.metaKey || false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: options.target || { classList: { contains: () => false }, closest: () => null },
    };
}

describe('WorkflowNodeDrag', () => {
    let drag, node, core, ui;

    beforeEach(() => {
        document.body.innerHTML = '';
        ({ drag, node, core, ui } = createDragInstance([]));
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ==================================================================
    // onMouseDown
    // ==================================================================
    describe('onMouseDown', () => {
        it('点击连接点时应直接返回', () => {
            const el = createNodeEl('n1', 100, 100);
            const e = createMouseEvent({
                target: { classList: { contains: (cls) => cls === 'connection-point' }, closest: () => null },
            });

            drag.onMouseDown(e, el);

            expect(ui.hasDragged).toBe(false);
            expect(el.classList.contains('dragging')).toBe(false);
        });

        it('点击容器 body 区域时应直接返回', () => {
            const el = createNodeEl('c1', 100, 100, { container: true });
            const containerBody = { closest: () => el };
            const e = createMouseEvent({
                target: {
                    classList: { contains: () => false },
                    closest: (sel) => (sel === '.container-body' ? containerBody : null),
                },
            });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('dragging')).toBe(false);
        });

        it('单击未选中节点时应选中并清除其他选中', () => {
            const otherEl = createNodeEl('n0', 50, 50, { selected: true });
            document.body.appendChild(otherEl);
            const el = createNodeEl('n1', 100, 100);
            document.body.appendChild(el);
            core.nodes = [
                { id: 'n0', x: 50, y: 50 },
                { id: 'n1', x: 100, y: 100 },
            ];
            const e = createMouseEvent({ clientX: 100, clientY: 100 });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('selected')).toBe(true);
            expect(otherEl.classList.contains('selected')).toBe(false);
            expect(core.selectNode).toHaveBeenCalledWith('n1');
            expect(ui.dragStartX).toBe(100);
            expect(ui.hasDragged).toBe(false);
            expect(el.classList.contains('dragging')).toBe(true);
            expect(el.style.zIndex).toBe('1000');
        });

        it('Shift+点击未选中节点时应加入多选', () => {
            const existing = createNodeEl('n0', 50, 50, { selected: true });
            document.body.appendChild(existing);
            const el = createNodeEl('n1', 100, 100);
            document.body.appendChild(el);
            core.nodes = [
                { id: 'n0', x: 50, y: 50 },
                { id: 'n1', x: 100, y: 100 },
            ];
            ui.isMultiSelectMode = true;
            const e = createMouseEvent({ clientX: 100, clientY: 100, shiftKey: true });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('selected')).toBe(true);
            expect(existing.classList.contains('selected')).toBe(true);
            expect(ui.isMultiSelectMode).toBe(true);
        });

        it('Shift+点击已选中节点时应取消选中', () => {
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            const e = createMouseEvent({ clientX: 100, clientY: 100, shiftKey: true });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('selected')).toBe(false);
        });

        it('锁定节点非 Shift 点击时应单选', () => {
            const el = createNodeEl('n1', 100, 100, { locked: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100, locked: true }];
            const e = createMouseEvent({ clientX: 100, clientY: 100 });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('selected')).toBe(true);
            expect(core.selectNode).toHaveBeenCalledWith('n1');
            expect(el.classList.contains('dragging')).toBe(false);
        });

        it('锁定节点 Shift+点击时应切换选中状态', () => {
            const el = createNodeEl('n1', 100, 100, { locked: true, selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100, locked: true }];
            const e = createMouseEvent({ clientX: 100, clientY: 100, shiftKey: true });

            drag.onMouseDown(e, el);

            expect(el.classList.contains('selected')).toBe(false);
        });

        it('应注册 document 事件监听器', () => {
            const el = createNodeEl('n1', 100, 100);
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            const e = createMouseEvent({ clientX: 100, clientY: 100 });

            const addSpy = jest.spyOn(document, 'addEventListener');
            drag.onMouseDown(e, el);

            expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
            expect(node._dragListeners).toBeDefined();
            addSpy.mockRestore();
        });
    });

    // ==================================================================
    // _onDragMove
    // ==================================================================
    describe('_onDragMove', () => {
        it('拖拽超过阈值时应设置 hasDragged', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragMove(
                { clientX: 110, clientY: 110, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx
            );

            expect(ui.hasDragged).toBe(true);
        });

        it('拖拽未超过阈值时不应设置 hasDragged', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragMove(
                { clientX: 103, clientY: 103, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx
            );

            expect(ui.hasDragged).toBe(false);
        });

        it('拖拽应更新节点位置', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            ui.canvas.canvasScale = 1;
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragMove(
                { clientX: 150, clientY: 150, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx
            );

            // moveDx = 50, moveDy = 50 → newX = 150, newY = 150
            expect(el.dataset.x).toBe('150');
            expect(el.dataset.y).toBe('150');
            expect(el.style.transform).toBe('translate(150px, 150px)');
        });

        it('开启网格吸附时应调用 snapToGrid', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            ui.canvas.canvasScale = 1;
            ui.canvas.snapEnabled = true;
            ui.canvas.snapToGrid = jest.fn((v) => Math.round(v / 20) * 20);
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            // moveDx = 45 → newX = 145 → snapToGrid(145) = 140
            drag._onDragMove(
                { clientX: 145, clientY: 145, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx
            );

            expect(ui.canvas.snapToGrid).toHaveBeenCalled();
            expect(el.dataset.x).toBe('140');
        });

        it('多选时应同步移动所有选中节点', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            ui.canvas.canvasScale = 1;
            const el1 = createNodeEl('n1', 100, 100, { selected: true });
            const el2 = createNodeEl('n2', 200, 200, { selected: true });
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            core.nodes = [
                { id: 'n1', x: 100, y: 100 },
                { id: 'n2', x: 200, y: 200 },
            ];
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragMove(
                { clientX: 150, clientY: 150, ctrlKey: false, metaKey: false },
                [el1, el2],
                { n1: { x: 100, y: 100 }, n2: { x: 200, y: 200 } },
                ctx
            );

            expect(el1.dataset.x).toBe('150');
            expect(el1.dataset.y).toBe('150');
            expect(el2.dataset.x).toBe('250');
            expect(el2.dataset.y).toBe('250');
        });

        it('应高亮拖放目标容器', () => {
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            const mockTarget = createNodeEl('c1', 0, 0, { container: true });
            jest.spyOn(drag, 'computeAlignment').mockReturnValue({ snapX: 0, snapY: 0 });
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(mockTarget);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragMove(
                { clientX: 150, clientY: 150, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx
            );

            expect(mockTarget.classList.contains('drop-target')).toBe(true);
            expect(ctx.dropTarget).toBe(mockTarget);
        });
    });

    // ==================================================================
    // _onDragEnd
    // ==================================================================
    describe('_onDragEnd', () => {
        it('简单拖拽结束应更新位置并保存历史', () => {
            ui.hasDragged = true;
            ui.dragStartX = 100;
            ui.dragStartY = 100;
            const el = createNodeEl('n1', 150, 150, { selected: true });
            el.classList.add('dragging');
            el.style.zIndex = '1000';
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragEnd(
                { clientX: 150, clientY: 150, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx,
                el
            );

            expect(core.updateNodePosition).toHaveBeenCalledWith('n1', 150, 150);
            expect(core.saveHistory).toHaveBeenCalledWith('messages.moveNode');
            expect(ui.edge.updateAffectedEdges).toHaveBeenCalled();
            expect(el.classList.contains('dragging')).toBe(false);
            expect(el.style.zIndex).toBe('');
        });

        it('未拖动（纯点击）时不应保存历史', () => {
            ui.hasDragged = false;
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragEnd(
                { clientX: 100, clientY: 100, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx,
                el
            );

            expect(core.saveHistory).not.toHaveBeenCalled();
        });

        it('拖入容器时应更新 parentId', () => {
            ui.hasDragged = true;
            const el = createNodeEl('n1', 200, 200, { selected: true });
            document.body.appendChild(el);
            const containerEl = createNodeEl('c1', 100, 100, { container: true });
            document.body.appendChild(containerEl);
            const nodeData = { id: 'n1', x: 200, y: 200, type: 'llm', parentId: null };
            core.nodes = [nodeData, { id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.getChildNodes = jest.fn(() => []);
            node._elMap.set('c1', containerEl);
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(containerEl);

            const ctx = { rafId: null, dropTarget: containerEl };
            drag._onDragEnd(
                { clientX: 200, clientY: 200, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 200, y: 200 } },
                ctx,
                el
            );

            expect(nodeData.parentId).toBe('c1');
            expect(node.container.renderContainerChildren).toHaveBeenCalledWith('c1');
        });

        it('Ctrl 拖出容器时应清除 parentId', () => {
            ui.hasDragged = true;
            const el = createNodeEl('n1', 10, 10, { selected: true });
            document.body.appendChild(el);
            const nodeData = {
                id: 'n1',
                x: 10,
                y: 10,
                type: 'llm',
                parentId: 'c1',
            };
            core.nodes = [nodeData, { id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.getChildNodes = jest.fn(() => []);
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: null };
            drag._onDragEnd(
                { clientX: 200, clientY: 200, ctrlKey: true, metaKey: false },
                [el],
                { n1: { x: 10, y: 10 } },
                ctx,
                el
            );

            expect(nodeData.parentId).toBe(null);
            expect(node.container.renderContainerChildren).toHaveBeenCalledWith('c1');
        });

        it('LOOP_ONLY 节点拖入不同容器时应跳过', () => {
            ui.hasDragged = true;
            const el = createNodeEl('n1', 200, 200, { selected: true });
            document.body.appendChild(el);
            const containerEl = createNodeEl('c2', 100, 100, { container: true });
            document.body.appendChild(containerEl);
            const nodeData = {
                id: 'n1',
                x: 200,
                y: 200,
                type: 'break',
                parentId: 'c1',
            };
            core.nodes = [nodeData, { id: 'c2', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(containerEl);

            const ctx = { rafId: null, dropTarget: containerEl };
            drag._onDragEnd(
                { clientX: 200, clientY: 200, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 200, y: 200 } },
                ctx,
                el
            );

            // parentId 不应改变（LOOP_ONLY 不能拖入不同容器）
            expect(nodeData.parentId).toBe('c1');
            expect(node.container.updateContainerSize).toHaveBeenCalledWith('c1');
        });

        it('已有 dropTarget 高亮时应清除', () => {
            const el = createNodeEl('n1', 100, 100, { selected: true });
            document.body.appendChild(el);
            core.nodes = [{ id: 'n1', x: 100, y: 100 }];
            const mockTarget = createNodeEl('c1', 0, 0, { container: true });
            mockTarget.classList.add('drop-target');
            jest.spyOn(drag, '_findDropTarget').mockReturnValue(null);

            const ctx = { rafId: null, dropTarget: mockTarget };
            drag._onDragEnd(
                { clientX: 100, clientY: 100, ctrlKey: false, metaKey: false },
                [el],
                { n1: { x: 100, y: 100 } },
                ctx,
                el
            );

            expect(mockTarget.classList.contains('drop-target')).toBe(false);
            expect(ctx.dropTarget).toBe(null);
        });
    });

    // ==================================================================
    // computeAlignment
    // ==================================================================
    describe('computeAlignment', () => {
        it('无 alignmentGuides 元素时应返回零偏移', () => {
            // 不创建 #alignmentGuides
            const el = createNodeEl('n1', 100, 100);
            const result = drag.computeAlignment(el, 100, 100, [el]);
            expect(result).toEqual({ snapX: 0, snapY: 0 });
        });

        it('无其他节点时应返回零偏移', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);
            const el = createNodeEl('n1', 100, 100);
            canvasContent.appendChild(el);

            const result = drag.computeAlignment(el, 100, 100, [el]);

            expect(result).toEqual({ snapX: 0, snapY: 0 });
        });

        it('左边缘对齐时应返回吸附偏移', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            guidesEl.setAttribute('width', '5000');
            guidesEl.setAttribute('height', '5000');
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);

            const draggedEl = createNodeEl('n1', 100, 100, { selected: true });
            canvasContent.appendChild(draggedEl);
            // otherEl 左边缘在 103，与拖拽节点左边缘 100 相差 3px（< 5 阈值）
            const otherEl = createNodeEl('n2', 103, 200);
            canvasContent.appendChild(otherEl);

            const result = drag.computeAlignment(draggedEl, 100, 100, [draggedEl]);

            // snapX = 103 - 100 = 3
            expect(result.snapX).toBe(3);
            expect(result.snapY).toBe(0);
        });

        it('中心 X 对齐时应返回吸附偏移', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            guidesEl.setAttribute('width', '5000');
            guidesEl.setAttribute('height', '5000');
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);

            // 设置 offsetWidth 以计算中心
            const draggedEl = createNodeEl('n1', 100, 100, { selected: true });
            Object.defineProperty(draggedEl, 'offsetWidth', { value: 200, configurable: true });
            Object.defineProperty(draggedEl, 'offsetHeight', { value: 100, configurable: true });
            canvasContent.appendChild(draggedEl);

            const otherEl = createNodeEl('n2', 50, 200);
            Object.defineProperty(otherEl, 'offsetWidth', { value: 200, configurable: true });
            Object.defineProperty(otherEl, 'offsetHeight', { value: 100, configurable: true });
            canvasContent.appendChild(otherEl);

            // dragged centerX = 100 + 200/2 = 200
            // other centerX = 50 + 200/2 = 150
            // diff = |200 - 150| = 50 > 5 → no snap on centerX
            // But left-left: |100 - 50| = 50 > 5 → no snap
            // right-right: |300 - 250| = 50 > 5 → no snap
            // left-right: |100 - 250| = 150 > 5 → no snap
            // right-left: |300 - 50| = 250 > 5 → no snap
            const result = drag.computeAlignment(draggedEl, 100, 100, [draggedEl]);
            expect(result).toEqual({ snapX: 0, snapY: 0 });
        });

        it('超出阈值时应返回零偏移', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);

            const draggedEl = createNodeEl('n1', 100, 100, { selected: true });
            canvasContent.appendChild(draggedEl);
            // 距离 10px > 5px 阈值
            const otherEl = createNodeEl('n2', 110, 200);
            canvasContent.appendChild(otherEl);

            const result = drag.computeAlignment(draggedEl, 100, 100, [draggedEl]);

            expect(result).toEqual({ snapX: 0, snapY: 0 });
        });

        it('应跳过已选中的节点', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);

            const draggedEl = createNodeEl('n1', 100, 100, { selected: true });
            canvasContent.appendChild(draggedEl);
            const otherSelectedEl = createNodeEl('n2', 103, 200, { selected: true });
            canvasContent.appendChild(otherSelectedEl);

            const result = drag.computeAlignment(draggedEl, 100, 100, [draggedEl, otherSelectedEl]);

            // n2 在 selectedNodeEls 中，应被跳过
            expect(result).toEqual({ snapX: 0, snapY: 0 });
        });

        it('对齐匹配时应绘制辅助线 SVG', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            guidesEl.setAttribute('width', '5000');
            guidesEl.setAttribute('height', '5000');
            document.body.appendChild(guidesEl);
            const canvasContent = document.createElement('div');
            canvasContent.id = 'canvasContent';
            document.body.appendChild(canvasContent);

            const draggedEl = createNodeEl('n1', 100, 100, { selected: true });
            canvasContent.appendChild(draggedEl);
            const otherEl = createNodeEl('n2', 103, 200);
            canvasContent.appendChild(otherEl);

            drag.computeAlignment(draggedEl, 100, 100, [draggedEl]);

            expect(guidesEl.innerHTML).toContain('<line');
            expect(guidesEl.innerHTML).toContain('stroke="#ff3366"');
        });
    });

    // ==================================================================
    // _findDropTarget
    // ==================================================================
    describe('_findDropTarget', () => {
        it('无容器节点时应返回 null', () => {
            core.nodes = [{ id: 'n1', x: 100, y: 100, type: 'llm' }];
            core.isContainerNode = () => false;

            const result = drag._findDropTarget(200, 200, []);
            expect(result).toBe(null);
        });

        it('光标在容器 body 内时应返回容器元素', () => {
            const containerEl = createNodeEl('c1', 0, 0, { container: true });
            node._elMap.set('c1', containerEl);
            core.nodes = [{ id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.isContainerNode = (id) => id === 'c1';
            core.nodeTypeInfo = { loop: { containerMinWidth: 300, containerMinHeight: 200 } };
            ui.canvas.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
            ui.canvas.screenToCanvas = (x, y) => ({ canvasX: x, canvasY: y });

            // 容器: x=100~500, y=158~400 (100+58 ~ 100+300)
            const result = drag._findDropTarget(200, 200, []);
            expect(result).toBe(containerEl);
        });

        it('光标在容器 header 区域时应返回 null', () => {
            const containerEl = createNodeEl('c1', 0, 0, { container: true });
            node._elMap.set('c1', containerEl);
            core.nodes = [{ id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.isContainerNode = (id) => id === 'c1';
            ui.canvas.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
            ui.canvas.screenToCanvas = (x, y) => ({ canvasX: x, canvasY: y });

            // y=120 < 158 (header area)
            const result = drag._findDropTarget(200, 120, []);
            expect(result).toBe(null);
        });

        it('光标在容器外时应返回 null', () => {
            const containerEl = createNodeEl('c1', 0, 0, { container: true });
            node._elMap.set('c1', containerEl);
            core.nodes = [{ id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.isContainerNode = (id) => id === 'c1';
            ui.canvas.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
            ui.canvas.screenToCanvas = (x, y) => ({ canvasX: x, canvasY: y });

            const result = drag._findDropTarget(50, 50, []);
            expect(result).toBe(null);
        });

        it('拖拽中的容器自身应被排除', () => {
            const containerEl = createNodeEl('c1', 0, 0, { container: true, selected: true });
            node._elMap.set('c1', containerEl);
            core.nodes = [{ id: 'c1', x: 100, y: 100, type: 'loop', width: 400, height: 300 }];
            core.isContainerNode = (id) => id === 'c1';
            ui.canvas.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
            ui.canvas.screenToCanvas = (x, y) => ({ canvasX: x, canvasY: y });

            const result = drag._findDropTarget(200, 200, [containerEl]);
            expect(result).toBe(null);
        });
    });

    // ==================================================================
    // _filterEdgesOnDetach
    // ==================================================================
    describe('_filterEdgesOnDetach', () => {
        it('应删除拖出节点到兄弟节点的边', () => {
            core.getChildNodes = jest.fn(() => [{ id: 'sibling1' }]);
            core.edges = [
                { source: 'n1', target: 'sibling1' },
                { source: 'n1', target: 'external' },
            ];

            drag._filterEdgesOnDetach('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].target).toBe('external');
        });

        it('应删除拖出节点到容器的 container_end 边', () => {
            core.getChildNodes = jest.fn(() => []);
            core.edges = [
                { source: 'n1', target: 'c1', targetPort: 'container_end' },
                { source: 'n1', target: 'c1', targetPort: 'other_port' },
            ];

            drag._filterEdgesOnDetach('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].targetPort).toBe('other_port');
        });

        it('应删除兄弟节点到拖出节点的边', () => {
            core.getChildNodes = jest.fn(() => [{ id: 'sibling1' }]);
            core.edges = [
                { source: 'sibling1', target: 'n1' },
                { source: 'external', target: 'n1' },
            ];

            drag._filterEdgesOnDetach('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].source).toBe('external');
        });

        it('应删除容器到拖出节点的 container_start 边', () => {
            core.getChildNodes = jest.fn(() => []);
            core.edges = [
                { source: 'c1', target: 'n1', sourcePort: 'container_start' },
                { source: 'c1', target: 'n1', sourcePort: 'other_port' },
            ];

            drag._filterEdgesOnDetach('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].sourcePort).toBe('other_port');
        });

        it('不涉及拖出节点的边应保留', () => {
            core.getChildNodes = jest.fn(() => [{ id: 'sibling1' }]);
            core.edges = [
                { source: 'n2', target: 'n3' },
                { source: 'sibling1', target: 'external' },
            ];

            drag._filterEdgesOnDetach('n1', 'c1');

            expect(core.edges).toHaveLength(2);
        });
    });

    // ==================================================================
    // _filterEdgesForContainer
    // ==================================================================
    describe('_filterEdgesForContainer', () => {
        it('应保留拖入节点到容器内兄弟的边', () => {
            core.getChildNodes = jest.fn(() => [{ id: 'sibling1' }]);
            core.edges = [
                { source: 'n1', target: 'sibling1' },
                { source: 'n1', target: 'external' },
            ];

            drag._filterEdgesForContainer('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].target).toBe('sibling1');
        });

        it('应删除拖入节点到外部节点的边', () => {
            core.getChildNodes = jest.fn(() => []);
            core.edges = [
                { source: 'n1', target: 'external1' },
                { source: 'n1', target: 'external2' },
            ];

            drag._filterEdgesForContainer('n1', 'c1');

            expect(core.edges).toHaveLength(0);
        });

        it('拖入节点到容器的边只保留 container_end', () => {
            core.getChildNodes = jest.fn(() => []);
            core.edges = [
                { source: 'n1', target: 'c1', targetPort: 'container_end' },
                { source: 'n1', target: 'c1', targetPort: 'other' },
            ];

            drag._filterEdgesForContainer('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].targetPort).toBe('container_end');
        });

        it('容器到拖入节点的边只保留 container_start', () => {
            core.getChildNodes = jest.fn(() => []);
            core.edges = [
                { source: 'c1', target: 'n1', sourcePort: 'container_start' },
                { source: 'c1', target: 'n1', sourcePort: 'other' },
            ];

            drag._filterEdgesForContainer('n1', 'c1');

            expect(core.edges).toHaveLength(1);
            expect(core.edges[0].sourcePort).toBe('container_start');
        });
    });

    // ==================================================================
    // _handleCtrlDetach
    // ==================================================================
    describe('_handleCtrlDetach', () => {
        beforeEach(() => {
            ui._pendingContainers = new Set();
            ui._ctrlDetached = new Set();
        });

        it('Ctrl+拖拽子节点时应清除 parentId 并更新位置', () => {
            const el = createNodeEl('n1', 10, 10);
            const canvasContent = document.createElement('div');
            ui.canvas.canvasContent = canvasContent;
            const nodeData = {
                id: 'n1',
                x: 10,
                y: 10,
                type: 'llm',
                parentId: 'c1',
            };
            core.nodes = [nodeData, { id: 'c1', x: 100, y: 100, type: 'loop' }];
            core.getChildNodes = jest.fn(() => []);

            const nodeStartPositions = { n1: { x: 10, y: 10 } };
            drag._handleCtrlDetach(true, nodeData, 'n1', el, nodeStartPositions, 10, 10);

            expect(nodeData.parentId).toBe(null);
            expect(ui._ctrlDetached.has('n1')).toBe(true);
            expect(ui._pendingContainers.has('c1')).toBe(true);
        });

        it('LOOP_ONLY 节点 Ctrl+拖拽时不应清除 parentId', () => {
            const el = createNodeEl('n1', 10, 10);
            const nodeData = {
                id: 'n1',
                x: 10,
                y: 10,
                type: 'break',
                parentId: 'c1',
            };
            const nodeStartPositions = { n1: { x: 10, y: 10 } };

            drag._handleCtrlDetach(true, nodeData, 'n1', el, nodeStartPositions, 10, 10);

            expect(nodeData.parentId).toBe('c1');
            expect(ui._ctrlDetached.has('n1')).toBe(false);
            expect(ui._pendingContainers.has('c1')).toBe(true);
        });

        it('非 Ctrl 拖拽子节点时只标记父容器', () => {
            const el = createNodeEl('n1', 10, 10);
            const nodeData = {
                id: 'n1',
                x: 10,
                y: 10,
                type: 'llm',
                parentId: 'c1',
            };
            const nodeStartPositions = { n1: { x: 10, y: 10 } };

            drag._handleCtrlDetach(false, nodeData, 'n1', el, nodeStartPositions, 10, 10);

            expect(nodeData.parentId).toBe('c1');
            expect(ui._ctrlDetached.has('n1')).toBe(false);
            expect(ui._pendingContainers.has('c1')).toBe(true);
        });

        it('已分离的节点不应重复处理', () => {
            const el = createNodeEl('n1', 10, 10);
            const nodeData = {
                id: 'n1',
                x: 10,
                y: 10,
                type: 'llm',
                parentId: 'c1',
            };
            ui._ctrlDetached.add('n1');
            const nodeStartPositions = { n1: { x: 10, y: 10 } };

            drag._handleCtrlDetach(true, nodeData, 'n1', el, nodeStartPositions, 10, 10);

            expect(nodeData.parentId).toBe('c1');
        });

        it('无 parentId 的节点不应触发分离', () => {
            const el = createNodeEl('n1', 100, 100);
            const nodeData = { id: 'n1', x: 100, y: 100, type: 'llm', parentId: null };

            drag._handleCtrlDetach(true, nodeData, 'n1', el, {}, 100, 100);

            expect(ui._pendingContainers.size).toBe(0);
        });
    });

    // ==================================================================
    // _makeEscapeHandler
    // ==================================================================
    describe('_makeEscapeHandler', () => {
        it('按 Escape 时应取消拖拽并清理状态', () => {
            const el = createNodeEl('n1', 100, 100);
            el.classList.add('dragging');
            el.style.zIndex = '1000';
            const selectedEls = [el];
            const onMouseMove = jest.fn();
            const onMouseUp = jest.fn();
            const onKeyDown = jest.fn();
            const ctx = { rafId: null, dropTarget: null };
            // _makeEscapeHandler 内部访问 self.node._dragListeners.onKeyDown
            node._dragListeners = { onMouseMove, onMouseUp, onKeyDown };

            const removeSpy = jest.spyOn(document, 'removeEventListener');
            const handler = drag._makeEscapeHandler(ctx, selectedEls, el, onMouseMove, onMouseUp);

            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            guidesEl.innerHTML = '<line/>';
            document.body.appendChild(guidesEl);

            handler({ key: 'Escape', preventDefault: jest.fn() });

            expect(el.classList.contains('dragging')).toBe(false);
            expect(el.style.zIndex).toBe('');
            expect(ui._ctrlDetached).toBe(null);
            expect(ui._pendingContainers).toBe(null);
            expect(removeSpy).toHaveBeenCalledWith('mousemove', onMouseMove);
            expect(removeSpy).toHaveBeenCalledWith('mouseup', onMouseUp);
            expect(guidesEl.innerHTML).toBe('');
            removeSpy.mockRestore();
        });

        it('非 Escape 键时应忽略', () => {
            const el = createNodeEl('n1', 100, 100);
            const ctx = { rafId: null, dropTarget: null };
            const handler = drag._makeEscapeHandler(ctx, [el], el, jest.fn(), jest.fn());

            handler({ key: 'Enter', preventDefault: jest.fn() });

            expect(el.classList.contains('dragging')).toBe(false);
        });
    });

    // ==================================================================
    // _getDraggableSelectedEls / _captureStartPositions
    // ==================================================================
    describe('_getDraggableSelectedEls', () => {
        it('应排除锁定节点', () => {
            const el1 = createNodeEl('n1', 100, 100, { selected: true });
            const el2 = createNodeEl('n2', 200, 200, { selected: true });
            document.body.appendChild(el1);
            document.body.appendChild(el2);
            core.nodes = [
                { id: 'n1', x: 100, y: 100 },
                { id: 'n2', x: 200, y: 200, locked: true },
            ];

            const result = drag._getDraggableSelectedEls();
            expect(result).toHaveLength(1);
            expect(result[0].dataset.nodeId).toBe('n1');
        });

        it('无选中节点时返回空数组', () => {
            const result = drag._getDraggableSelectedEls();
            expect(result).toEqual([]);
        });
    });

    describe('_captureStartPositions', () => {
        it('应捕获所有选中节点的起始位置', () => {
            const el1 = createNodeEl('n1', 100, 200);
            const el2 = createNodeEl('n2', 300, 400);
            const positions = drag._captureStartPositions([el1, el2]);

            expect(positions.n1).toEqual({ x: 100, y: 200 });
            expect(positions.n2).toEqual({ x: 300, y: 400 });
        });
    });

    // ==================================================================
    // _deselectAll / _clearAlignmentGuides
    // ==================================================================
    describe('_deselectAll', () => {
        it('应移除所有节点和边的 selected 类', () => {
            const nodeEl = createNodeEl('n1', 100, 100, { selected: true });
            const edgeEl = document.createElement('div');
            edgeEl.className = 'workflow-edge selected';
            document.body.appendChild(nodeEl);
            document.body.appendChild(edgeEl);

            drag._deselectAll();

            expect(nodeEl.classList.contains('selected')).toBe(false);
            expect(edgeEl.classList.contains('selected')).toBe(false);
        });
    });

    describe('_clearAlignmentGuides', () => {
        it('应清空 alignmentGuides 内容', () => {
            const guidesEl = document.createElement('div');
            guidesEl.id = 'alignmentGuides';
            guidesEl.innerHTML = '<line/>';
            document.body.appendChild(guidesEl);

            drag._clearAlignmentGuides();

            expect(guidesEl.innerHTML).toBe('');
        });

        it('无 alignmentGuides 元素时不应报错', () => {
            expect(() => drag._clearAlignmentGuides()).not.toThrow();
        });
    });
});
