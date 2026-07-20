/**
 * 共享测试 Mock 工厂函数
 *
 * 提供一组通用的 mock 创建函数，供各测试文件复用。
 * 每个工厂函数都支持 overrides 参数覆盖默认值，实现灵活定制。
 *
 * ## 使用示例
 *
 * ```js
 * import { createMockCore, createMockUI, createMockNode } from './helpers/mockFactories.js';
 *
 * const core = createMockCore({
 *     nodes: [
 *         createMockNode({ id: 'n1', type: 'llm', x: 100, y: 200 }),
 *         createMockNode({ id: 'c1', type: 'loop', x: 50, y: 50 }),
 *     ],
 *     nodeTypeInfo: { loop: { hasContainer: true } },
 * });
 * const ui = createMockUI({ core });
 * ```
 *
 * ## 设计原则
 * - 工厂函数返回全新对象，避免跨测试状态泄漏
 * - 所有 jest.fn() mock 默认返回 undefined / [] / false，可用 overrides 替换
 * - nodes / edges 是可变数组，测试中可直接 push / splice
 * - 不依赖任何外部模块，纯函数实现
 */

/**
 * 创建 mock WorkflowCore
 *
 * 模拟核心数据结构：nodes / edges 数组、nodeTypeInfo 映射、以及常用方法。
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @param {Array} [overrides.nodes=[]] - 节点数组
 * @param {Array} [overrides.edges=[]] - 边数组
 * @param {Object} [overrides.nodeTypeInfo={}] - 节点类型信息映射
 * @returns {Object} mock core 对象
 */
export function createMockCore(overrides = {}) {
    const _nodes = overrides.nodes ?? [];
    const _edges = overrides.edges ?? [];
    const core = {
        get nodes() {
            return _nodes;
        },
        set nodes(val) {
            _nodes.length = 0;
            _nodes.push(...val);
        },
        get edges() {
            return _edges;
        },
        set edges(val) {
            _edges.length = 0;
            _edges.push(...val);
        },
        selectedNode: null,
        selectedEdge: null,
        nodeIdCounter: 100000,
        edgeIdCounter: 100000,
        nodeTypeInfo: overrides.nodeTypeInfo ?? {},
        history: [],
        historyIndex: -1,
        maxHistory: 50,
        _batchMode: false,
        _onChange: null,

        // 方法 mock — getNode 引用 this.nodes 确保与 setter 同步
        selectNode: jest.fn(),
        selectEdge: jest.fn(),
        updateNodePosition: jest.fn(),
        saveHistory: jest.fn(),
        addNode: jest.fn(),
        deleteNode: jest.fn(),
        deleteEdge: jest.fn(),
        createEdge: jest.fn(),
        batchChanges: jest.fn((fn) => fn()),
        getNode: jest.fn((id) => _nodes.find((n) => n.id === id)),
        getEdge: jest.fn((id) => _edges.find((e) => e.id === id)),

        // container mock — 使用 container.getChildren / container.isContainer
        container: {
            getChildren: jest.fn((id) => _nodes.filter((n) => n.parentId === id)),
            isContainer: jest.fn(() => false),
            getAllDescendants: jest.fn(() => []),
            validateContainerPorts: jest.fn(() => ({ valid: true })),
            addToContainer: jest.fn(),
            removeFromContainer: jest.fn(),
            updateContainerSize: jest.fn(),
            renderContainerChildren: jest.fn(),
        },
    };
    // 允许 overrides 覆盖方法
    return Object.assign(core, overrides);
}

/**
 * 创建 mock UI 对象
 *
 * 包含 canvas / node / edge / align 等子模块的 mock。
 * 自动创建 canvasContent 真实 jsdom DOM 元素。
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @param {Object} [overrides.core] - 关联的 core mock（自动创建 if 未提供）
 * @returns {Object} mock ui 对象
 */
export function createMockUI(overrides = {}) {
    const core = overrides.core ?? createMockCore();
    const canvasContent = document.createElement('div');
    canvasContent.id = 'canvasContent';

    return {
        core,
        dragStartX: 0,
        dragStartY: 0,
        hasDragged: false,
        isMultiSelectMode: false,

        canvas: createMockCanvas({ canvasContent }),
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
            _elMap: new Map(),
        },

        showSummaryPanel: jest.fn(),
        clearPropertyPanel: jest.fn(),
        showMessage: jest.fn(),
        updateEdges: jest.fn(),
        ...overrides,
    };
}

/**
 * 创建 mock Canvas 对象
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @returns {Object} mock canvas 对象
 */
export function createMockCanvas(overrides = {}) {
    const canvasContent = overrides.canvasContent ?? document.createElement('div');
    return {
        canvasScale: 1,
        snapEnabled: false,
        snapToGrid: jest.fn((v) => v),
        canvasContent,
        canvas: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        },
        screenToCanvas: jest.fn((x, y) => ({ canvasX: x, canvasY: y })),
        getCurrentTransform: jest.fn(() => ({ x: 0, y: 0, scale: 1 })),
        updateSvgSize: jest.fn(),
        renderMinimap: jest.fn(),
        requestAnimationFrame: jest.fn((cb) => {
            cb();
            return 1;
        }),
        ...overrides,
    };
}

/**
 * 创建 mock Container 对象
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @returns {Object} mock container 对象
 */
export function createMockContainer(overrides = {}) {
    return {
        updateContainerSize: jest.fn(),
        renderContainerChildren: jest.fn(),
        getChildren: jest.fn(() => []),
        isContainer: jest.fn(() => false),
        getAllDescendants: jest.fn(() => []),
        addToContainer: jest.fn(),
        removeFromContainer: jest.fn(),
        ...overrides,
    };
}

/**
 * 创建测试用节点对象
 *
 * 支持自定义 id / type / 位置 / 尺寸 / parentId 等。
 * 默认创建一个 llm 类型、无 parentId 的根节点。
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @param {string} [overrides.id='node-1'] - 节点ID
 * @param {string} [overrides.type='llm'] - 节点类型
 * @param {number} [overrides.x=100] - X 坐标
 * @param {number} [overrides.y=100] - Y 坐标
 * @param {number} [overrides.width=240] - 宽度
 * @param {number} [overrides.height=80] - 高度
 * @param {string|null} [overrides.parentId=null] - 父容器ID
 * @returns {Object} 节点对象
 */
export function createMockNode(overrides = {}) {
    return {
        id: 'node-1',
        type: 'llm',
        x: 100,
        y: 100,
        width: 240,
        height: 80,
        parentId: null,
        title: 'Test Node',
        locked: false,
        inputParams: [],
        parameters: {},
        ...overrides,
    };
}

/**
 * 创建测试用边对象
 *
 * @param {Object} [overrides={}] - 覆盖默认属性
 * @returns {Object} 边对象
 */
export function createMockEdge(overrides = {}) {
    return {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        sourcePort: '',
        targetPort: '',
        ...overrides,
    };
}

/**
 * 创建真实 jsdom DOM 节点元素
 *
 * 用于需要真实 DOM 查询（querySelectorAll / classList 等）的测试。
 *
 * @param {string} id - 节点ID
 * @param {number} [x=0] - 初始 X 位置
 * @param {number} [y=0] - 初始 Y 位置
 * @param {Object} [options={}] - 选项
 * @param {boolean} [options.container=false] - 是否为容器节点
 * @param {boolean} [options.selected=false] - 是否选中
 * @param {boolean} [options.locked=false] - 是否锁定
 * @returns {HTMLDivElement} jsdom DOM 元素
 */
export function createNodeEl(id, x = 0, y = 0, options = {}) {
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

/**
 * 创建 mock 鼠标事件对象
 *
 * @param {Object} [options={}] - 事件属性
 * @returns {Object} mock 鼠标事件
 */
export function createMouseEvent(options = {}) {
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
