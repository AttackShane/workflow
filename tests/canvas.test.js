import { WorkflowCanvas } from '../src/modules/editor-canvas.js';
import { DOM } from '../src/utils/helpers.js';

jest.mock('../src/utils/helpers.js', () => ({
    DOM: {
        get: jest.fn(() => null),
        on: jest.fn(),
        off: jest.fn(),
        setStyle: jest.fn(),
        setAttr: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
        create: jest.fn(() => ({ style: {}, appendChild: jest.fn() }))
    },
    NodeUtils: {
        getBounds: jest.fn((nodes) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(node => {
                const x = node.x || 0;
                const y = node.y || 0;
                const w = node.width || 200;
                const h = node.height || 100;
                if (node.parentId) {
                    const parent = nodes.find(n => n.id === node.parentId);
                    if (parent) {
                        const absX = (parent.x || 0) + x;
                        const absY = (parent.y || 0) + 56 + y;
                        minX = Math.min(minX, absX);
                        minY = Math.min(minY, absY);
                        maxX = Math.max(maxX, absX + w);
                        maxY = Math.max(maxY, absY + h);
                    }
                } else {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + w);
                    maxY = Math.max(maxY, y + h);
                }
            });
            return { minX, minY, maxX, maxY };
        }),
        translateToCanvasOrigin: jest.fn((nodes, padding = 100) => {
            if (!nodes.length) return;
            let minX = Infinity, minY = Infinity;
            nodes.forEach(node => {
                if (!node.parentId) {
                    minX = Math.min(minX, node.x || 0);
                    minY = Math.min(minY, node.y || 0);
                }
            });
            if (isFinite(minX) && isFinite(minY)) {
                const offsetX = padding - minX;
                const offsetY = padding - minY;
                nodes.forEach(node => {
                    if (!node.parentId) {
                        if (node.x !== undefined) node.x += offsetX;
                        if (node.y !== undefined) node.y += offsetY;
                    }
                });
            }
        })
    }
}));

jest.mock('../src/i18n/i18n.js', () => ({
    t: (key) => key
}));

jest.mock('../src/config/constants.js', () => ({
    APP_CONFIG: {
        ZOOM: { MIN_SCALE: 0.25, MAX_SCALE: 3, ZOOM_FACTOR: 0.1 }
    },
    SELECTORS: {
        EDITOR: {
            CANVAS: 'canvas',
            CANVAS_CONTENT: 'canvasContent',
            SVG_LAYER: 'svgLayer',
            SVG_HIT_LAYER: 'svgHitLayer',
            EMPTY_STATE: 'emptyState'
        }
    }
}));

function createMockCore(nodes = []) {
    return {
        nodes,
        edges: [],
        isContainerNode: () => false
    };
}

function createMockUI(core) {
    return {
        core,
        isMultiSelectMode: false,
        hasDragged: false,
        showSummaryPanel: () => {},
        showDetailPanel: () => {},
        selection: {
            deselectAll: jest.fn(),
            selectNodesInRect: jest.fn()
        },
        updateEdges: jest.fn(),
        node: {
            createElement: () => ({ style: {}, dataset: {} }),
            select: () => {},
            batchMeasureElements: () => {}
        }
    };
}

function setupGlobalDocument() {
    global.document = {
        getElementById: jest.fn(() => null),
        querySelector: jest.fn(() => null),
        querySelectorAll: jest.fn(() => []),
        createElement: jest.fn(() => ({
            style: {},
            dataset: {},
            classList: { add: jest.fn(), remove: jest.fn(), contains: () => false },
            getAttribute: jest.fn(() => null),
            setAttribute: jest.fn(),
            removeAttribute: jest.fn(),
            appendChild: jest.fn(),
            removeChild: jest.fn(),
            closest: jest.fn(() => null),
            getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }))
        })),
        body: {
            style: {},
            appendChild: jest.fn(),
            removeChild: jest.fn()
        },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };
    global.window = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        location: { pathname: '/editor' }
    };
}

describe('WorkflowCanvas', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        setupGlobalDocument();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            expect(canvas.canvasScale).toBe(1);
            expect(canvas.lastMouseX).toBe(0);
            expect(canvas.lastMouseY).toBe(0);
            expect(canvas.isMarqueeSelectionActive).toBe(false);
            expect(canvas.hasDraggedCanvas).toBe(false);
            expect(canvas.visibleNodes).toBeInstanceOf(Set);
            expect(canvas.renderBatchSize).toBe(50);
            expect(canvas.renderThreshold).toBe(50);
        });
    });

    describe('init', () => {
        it('should initialize canvas elements and set up event listeners', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const mockCanvas = { style: {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            const mockContent = { style: {} };
            const mockSvg = { style: {} };
            const mockHit = { style: {} };
            const mockEmpty = { style: {} };

            DOM.get.mockReturnValueOnce(mockCanvas);
            DOM.get.mockReturnValueOnce(mockContent);
            DOM.get.mockReturnValueOnce(mockSvg);
            DOM.get.mockReturnValueOnce(mockHit);
            DOM.get.mockReturnValueOnce(mockEmpty);

            canvas.init();

            expect(canvas.canvas).toBe(mockCanvas);
            expect(canvas.canvasContent).toBe(mockContent);
            expect(canvas.svgLayer).toBe(mockSvg);
            expect(canvas.svgHitLayer).toBe(mockHit);
            expect(canvas.emptyState).toBe(mockEmpty);
        });
    });

    describe('setupEventListeners', () => {
        it('should register event listeners on canvas and window', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };

            canvas.setupEventListeners();

            expect(DOM.on).toHaveBeenCalledWith(canvas.canvas, 'mousemove', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(canvas.canvas, 'wheel', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(canvas.canvas, 'mousedown', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(canvas.canvas, 'click', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(global.window, 'resize', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(canvas.canvas, 'scroll', expect.any(Function));
        });

        it('should invoke resize callback correctly', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            canvas.setupEventListeners();

            const resizeCall = DOM.on.mock.calls.find(c => c[1] === 'resize');
            const resizeCallback = resizeCall[2];
            resizeCallback();

            expect(DOM.setAttr).toHaveBeenCalled();
        });
    });

    describe('getCurrentTransform', () => {
        it('should return default transform when no style', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas.getCurrentTransform();

            expect(result.translateX).toBe(0);
            expect(result.translateY).toBe(0);
            expect(result.scale).toBe(1);
        });

        it('should parse transform from canvasContent style', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasContent = {
                style: { transform: 'translate(100px, 200px) scale(1.5)' }
            };

            const result = canvas.getCurrentTransform();

            expect(result.translateX).toBe(100);
            expect(result.translateY).toBe(200);
            expect(result.scale).toBe(1.5);
        });
    });

    describe('applyTransform', () => {
        it('should apply transform to all layers', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            canvas.applyTransform(100, 200, 1.5);

            const expectedTransform = 'translate(100px, 200px) scale(1.5)';
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvasContent, 'transform', expectedTransform);
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.svgLayer, 'transform', expectedTransform);
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.svgHitLayer, 'transform', expectedTransform);
        });
    });

    describe('setSvgSize', () => {
        it('should set width and height on svg layers', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            canvas.setSvgSize(800, 600);

            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'width', 800);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'height', 600);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgHitLayer, 'width', 800);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgHitLayer, 'height', 600);
        });
    });

    describe('setFixedSvgSize', () => {
        it('should set fixed svg size based on canvas rect', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            canvas.setFixedSvgSize({ width: 500, height: 400 });

            const expectedSize = Math.max(500, 400) * 3;
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'width', expectedSize);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'height', expectedSize);
        });
    });

    describe('setContentSvgSize', () => {
        it('should set svg size based on content bounds', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            canvas.setContentSvgSize(
                { width: 500, height: 400 },
                { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
            );

            expect(DOM.setAttr).toHaveBeenCalled();
        });
    });

    describe('resetView', () => {
        it('should reset to default state', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.resetView();

            expect(canvas.canvasScale).toBe(1);
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvasContent, 'transform', 'translate(0px, 0px) scale(1)');
        });
    });

    describe('updateViewport', () => {
        it('should not crash when canvas is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;

            expect(() => canvas.updateViewport()).not.toThrow();
        });

        it('should update viewport based on canvas rect and transform', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = {
                getBoundingClientRect: () => ({ width: 800, height: 600 })
            };
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(1)' }
            };
            canvas.canvasScale = 1;

            canvas.updateViewport();

            expect(canvas.viewport.left).toBeLessThan(0);
            expect(canvas.viewport.top).toBeLessThan(0);
            expect(canvas.viewport.right).toBeGreaterThan(800);
            expect(canvas.viewport.bottom).toBeGreaterThan(600);
        });
    });

    describe('scheduleRenderUpdate', () => {
        it('should debounce render updates', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = {
                getBoundingClientRect: () => ({ width: 800, height: 600 })
            };
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(1)' }
            };

            canvas.scheduleRenderUpdate();
            canvas.scheduleRenderUpdate();

            jest.advanceTimersByTime(50);

            expect(canvas.renderDebounceTimer).toBeTruthy();
        });
    });

    describe('updateVisibleNodes', () => {
        it('should not crash when core is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = null;

            expect(() => canvas.updateVisibleNodes()).not.toThrow();
        });

        it('should not crash when nodes is empty', () => {
            const core = createMockCore([]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;

            expect(() => canvas.updateVisibleNodes()).not.toThrow();
        });

        it('should update visible nodes set', () => {
            const nodes = [
                { id: '1', x: 100, y: 100, width: 200, height: 100 },
                { id: '2', x: 2000, y: 2000, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 800 };

            canvas.updateVisibleNodes();

            expect(canvas.visibleNodes.has('1')).toBe(true);
        });
    });

    describe('isNodeVisible', () => {
        let canvas;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
        });

        it('should return true when node is within viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should return false when node is above viewport', () => {
            canvas.viewport = { left: 0, top: 500, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is below viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 200 };
            const node = { x: 100, y: 500, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is left of viewport', () => {
            canvas.viewport = { left: 500, top: 0, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is right of viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 300, bottom: 800 };
            const node = { x: 500, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return true when node is partially visible', () => {
            canvas.viewport = { left: 100, top: 100, right: 500, bottom: 500 };
            const node = { x: 400, y: 400, width: 200, height: 200 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should return true when node exactly aligns with viewport edges', () => {
            canvas.viewport = { left: 0, top: 0, right: 200, bottom: 100 };
            const node = { x: 0, y: 0, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should handle child node with valid parent', () => {
            canvas.core = {
                nodes: [
                    { id: 'parent1', x: 50, y: 50, width: 400, height: 300 }
                ]
            };
            canvas.core.nodes.find = Array.prototype.find;
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 800 };
            const node = { x: 10, y: 10, width: 100, height: 50, parentId: 'parent1' };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should handle child node outside viewport via parent offset', () => {
            canvas.core = {
                nodes: [
                    { id: 'parent1', x: 50, y: 50, width: 400, height: 300 }
                ]
            };
            canvas.core.nodes.find = Array.prototype.find;
            canvas.viewport = { left: 500, top: 500, right: 1000, bottom: 800 };
            const node = { x: 10, y: 10, width: 100, height: 50, parentId: 'parent1' };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });
    });

    describe('calculateNodesBounds', () => {
        let canvas;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
        });

        it('should return infinity bounds for empty nodes', () => {
            canvas.core.nodes = [];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(Infinity);
            expect(bounds.minY).toBe(Infinity);
            expect(bounds.maxX).toBe(-Infinity);
            expect(bounds.maxY).toBe(-Infinity);
        });

        it('should calculate bounds for single node', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(100);
            expect(bounds.minY).toBe(200);
            expect(bounds.maxX).toBe(400);
            expect(bounds.maxY).toBe(350);
        });

        it('should calculate bounds for multiple nodes', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 },
                { x: 500, y: 100, width: 200, height: 400 },
                { x: 50, y: 50, width: 100, height: 100 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(50);
            expect(bounds.minY).toBe(50);
            expect(bounds.maxX).toBe(700);
            expect(bounds.maxY).toBe(500);
        });

        it('should skip child nodes with parentId', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 },
                { x: 10, y: 10, width: 50, height: 50, parentId: 'parent_1' },
                { x: 500, y: 100, width: 200, height: 400 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(100);
            expect(bounds.maxX).toBe(700);
        });
    });

    describe('getVisibleNodeCount', () => {
        it('should return count of visible nodes', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set([0, 1, 2]);

            expect(canvas.getVisibleNodeCount()).toBe(3);
        });

        it('should return 0 when no nodes are visible', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set();

            expect(canvas.getVisibleNodeCount()).toBe(0);
        });
    });

    describe('getPerformanceStats', () => {
        it('should return performance stats object', () => {
            const core = createMockCore([
                { x: 0, y: 0, width: 100, height: 100 },
                { x: 200, y: 200, width: 100, height: 100 }
            ]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set([0]);
            canvas.canvasScale = 1.5;

            const stats = canvas.getPerformanceStats();

            expect(stats.totalNodes).toBe(2);
            expect(stats.visibleNodes).toBe(1);
            expect(stats.hiddenNodes).toBe(1);
            expect(stats.canvasScale).toBe('1.50');
            expect(stats.visibilityRatio).toBe('50.0%');
        });
    });

    describe('setEmptyState', () => {
        it('should show empty state', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.emptyState = { style: { display: '' } };

            canvas.setEmptyState(true);

            expect(canvas.emptyState.style.display).toBe('flex');
        });

        it('should hide empty state', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.emptyState = { style: { display: 'flex' } };

            canvas.setEmptyState(false);

            expect(canvas.emptyState.style.display).toBe('none');
        });
    });

    describe('updateSvgSize', () => {
        it('should not crash when svgLayer is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = null;

            expect(() => canvas.updateSvgSize()).not.toThrow();
        });

        it('should set fixed size when no nodes', () => {
            const core = createMockCore([]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvas = { getBoundingClientRect: () => ({ width: 500, height: 400 }) };
            canvas.core = core;

            canvas.updateSvgSize();

            const expectedSize = Math.max(500, 400) * 3;
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'width', expectedSize);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'height', expectedSize);
        });

        it('should set content size when nodes exist', () => {
            const nodes = [{ x: 100, y: 100, width: 200, height: 100 }];
            const core = createMockCore(nodes);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvas = { getBoundingClientRect: () => ({ width: 500, height: 400 }) };
            canvas.core = core;

            canvas.updateSvgSize();

            expect(DOM.setAttr).toHaveBeenCalled();
        });

        it('should set fixed size when bounds are Infinity', () => {
            const nodes = [{ id: 'child1', x: 10, y: 10, width: 100, height: 50, parentId: 'nonexistent' }];
            const core = createMockCore(nodes);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvas = { getBoundingClientRect: () => ({ width: 500, height: 400 }) };
            canvas.core = core;

            canvas.updateSvgSize();

            const expectedSize = Math.max(500, 400) * 3;
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'width', expectedSize);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.svgLayer, 'height', expectedSize);
        });
    });

    describe('onMouseMove', () => {
        it('should update lastMouseX and lastMouseY', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = {
                getBoundingClientRect: () => ({ left: 10, top: 20 })
            };

            canvas.onMouseMove({ clientX: 210, clientY: 220 });

            expect(canvas.lastMouseX).toBe(200);
            expect(canvas.lastMouseY).toBe(200);
        });

        it('should not crash when canvas is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;

            expect(() => canvas.onMouseMove({ clientX: 100, clientY: 100 })).not.toThrow();
        });
    });

    describe('onCanvasClick', () => {
        it('should deselect when clicking empty area', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.ui.selection = { deselectAll: jest.fn() };
            canvas.isMarqueeSelectionActive = false;
            canvas.hasDraggedCanvas = false;
            canvas.ui.hasDragged = false;

            canvas.onCanvasClick({ target: { closest: () => null, tagName: 'DIV' } });

            expect(canvas.ui.selection.deselectAll).toHaveBeenCalled();
        });

        it('should not deselect when marquee is active', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.ui.selection = { deselectAll: jest.fn() };
            canvas.isMarqueeSelectionActive = true;

            canvas.onCanvasClick({ target: { closest: () => null, tagName: 'DIV' } });

            expect(canvas.ui.selection.deselectAll).not.toHaveBeenCalled();
        });

        it('should not deselect when canvas was dragged', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.ui.selection = { deselectAll: jest.fn() };
            canvas.hasDraggedCanvas = true;

            canvas.onCanvasClick({ target: { closest: () => null, tagName: 'DIV' } });

            expect(canvas.ui.selection.deselectAll).not.toHaveBeenCalled();
            expect(canvas.hasDraggedCanvas).toBe(false);
        });
    });

    describe('onCanvasMouseDown', () => {
        it('should not crash when clicking on canvas', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            expect(() => canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                target: { tagName: 'DIV', closest: () => null }
            })).not.toThrow();
        });

        it('should return early when dataTransfer is present', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            const result = canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                ctrlKey: false,
                metaKey: false,
                dataTransfer: { types: ['text/plain'] },
                target: { tagName: 'DIV', closest: () => null }
            });

            expect(result).toBeUndefined();
        });

        it('should start canvas drag on non-marquee canvas click', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = {};
            canvas.svgHitLayer = {};

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                ctrlKey: false,
                metaKey: false,
                target: { tagName: 'DIV', closest: () => null }
            });

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'grabbing');
        });

        it('should start marquee selection on shift+click canvas', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                shiftKey: true,
                target: { tagName: 'DIV', closest: () => null }
            });

            expect(canvas.isMarqueeSelectionActive).toBe(true);
        });
    });

    describe('onCanvasWheel', () => {
        it('should not zoom when ctrlKey is not pressed', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas.onCanvasWheel({ ctrlKey: false, metaKey: false, preventDefault: jest.fn() });

            expect(result).toBeUndefined();
        });

        it('should zoom when ctrlKey is pressed', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };

            const e = { ctrlKey: true, metaKey: false, deltaY: 100, clientX: 400, clientY: 300, preventDefault: jest.fn() };
            canvas.onCanvasWheel(e);

            expect(e.preventDefault).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThan(1);
        });
    });

    describe('centerView', () => {
        it('should reset view when no nodes', () => {
            const core = createMockCore([]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.centerView();

            expect(canvas.canvasScale).toBe(1);
        });

        it('should center view around nodes', () => {
            const nodes = [
                { x: 100, y: 100, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.centerView();

            expect(canvas.canvasScale).toBeLessThan(2);
        });
    });

    describe('handleCanvasDrag', () => {
        it('should start canvas drag', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = {};
            canvas.svgHitLayer = {};

            canvas.handleCanvasDrag(100, 100);

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'grabbing');
            expect(DOM.on).toHaveBeenCalledWith(global.document, 'mousemove', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(global.document, 'mouseup', expect.any(Function));
        });
    });

    describe('screenToCanvas', () => {
        it('should convert screen coordinates to canvas coordinates', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasContent = { style: { transform: 'translate(100px, 200px) scale(1.5)' } };

            const result = canvas.screenToCanvas(400, 500);

            expect(result.canvasX).toBeCloseTo(200);
            expect(result.canvasY).toBeCloseTo(200);
        });

        it('should return same coordinates when no transform', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas.screenToCanvas(100, 200);

            expect(result.canvasX).toBe(100);
            expect(result.canvasY).toBe(200);
        });
    });

    describe('handleMarqueeSelection', () => {
        it('should set marquee active and cursor to crosshair', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };

            canvas.handleMarqueeSelection(100, 100);

            expect(canvas.isMarqueeSelectionActive).toBe(true);
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'crosshair');
            expect(DOM.create).toHaveBeenCalledWith('div', expect.objectContaining({ className: 'marquee-selection' }));
            expect(global.document.body.appendChild).toHaveBeenCalled();
            expect(DOM.on).toHaveBeenCalledWith(global.document, 'mousemove', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(global.document, 'mouseup', expect.any(Function));
        });

        it('should update marquee position on mousemove', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100);

            const onMouseMove = DOM.on.mock.calls.find(c => c[1] === 'mousemove')[2];
            onMouseMove({ clientX: 200, clientY: 150 });

            expect(DOM.setStyle).toHaveBeenCalledWith(marqueeEl, 'left', '100px');
            expect(DOM.setStyle).toHaveBeenCalledWith(marqueeEl, 'top', '100px');
            expect(DOM.setStyle).toHaveBeenCalledWith(marqueeEl, 'width', '100px');
            expect(DOM.setStyle).toHaveBeenCalledWith(marqueeEl, 'height', '50px');
            expect(canvas.hasDraggedCanvas).toBe(true);
        });

        it('should not set hasDragged for small mouse movements', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100);

            const onMouseMove = DOM.on.mock.calls.find(c => c[1] === 'mousemove')[2];
            onMouseMove({ clientX: 101, clientY: 101 });

            expect(canvas.hasDraggedCanvas).toBe(false);
        });

        it('should select nodes on mouseup when drag is large enough', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.ui.selection = { selectNodesInRect: jest.fn() };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100);

            const onMouseUp = DOM.on.mock.calls.find(c => c[1] === 'mouseup')[2];
            onMouseUp({ clientX: 200, clientY: 200 });

            expect(canvas.ui.selection.selectNodesInRect).toHaveBeenCalledWith(100, 100, 100, 100, false, null);
            expect(global.document.body.removeChild).toHaveBeenCalledWith(marqueeEl);
            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'default');
            expect(DOM.off).toHaveBeenCalledWith(global.document, 'mousemove', expect.any(Function));
            expect(DOM.off).toHaveBeenCalledWith(global.document, 'mouseup', expect.any(Function));
        });

        it('should not select nodes when drag is too small', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.ui.selection = { selectNodesInRect: jest.fn() };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100);

            const onMouseUp = DOM.on.mock.calls.find(c => c[1] === 'mouseup')[2];
            onMouseUp({ clientX: 105, clientY: 105 });

            expect(canvas.ui.selection.selectNodesInRect).not.toHaveBeenCalled();
            expect(global.document.body.removeChild).toHaveBeenCalledWith(marqueeEl);
        });

        it('should pass containerId to selectNodesInRect', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.ui.selection = { selectNodesInRect: jest.fn() };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100, false, 'container_1');

            const onMouseUp = DOM.on.mock.calls.find(c => c[1] === 'mouseup')[2];
            onMouseUp({ clientX: 200, clientY: 200 });

            expect(canvas.ui.selection.selectNodesInRect).toHaveBeenCalledWith(100, 100, 100, 100, false, 'container_1');
        });

        it('should set isMarqueeSelectionActive to false after timeout', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            const marqueeEl = { style: {} };
            DOM.create.mockReturnValueOnce(marqueeEl);

            canvas.handleMarqueeSelection(100, 100);

            const onMouseUp = DOM.on.mock.calls.find(c => c[1] === 'mouseup')[2];
            onMouseUp({ clientX: 200, clientY: 200 });

            expect(canvas.isMarqueeSelectionActive).toBe(true);

            jest.advanceTimersByTime(100);

            expect(canvas.isMarqueeSelectionActive).toBe(false);
        });
    });

    describe('handleCanvasDrag callbacks', () => {
        let canvas, core, ui;

        beforeEach(() => {
            core = createMockCore();
            ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = {};
            canvas.svgHitLayer = {};
            canvas.canvasScale = 1;
        });

        it('should set hasDraggedCanvas on significant mousemove', () => {
            canvas.handleCanvasDrag(100, 100);

            const onMouseMove = DOM.on.mock.calls.find(c => c[1] === 'mousemove')[2];
            onMouseMove({ clientX: 110, clientY: 110 });

            expect(canvas.hasDraggedCanvas).toBe(true);
        });

        it('should not set hasDraggedCanvas on small mousemove', () => {
            canvas.handleCanvasDrag(100, 100);

            const onMouseMove = DOM.on.mock.calls.find(c => c[1] === 'mousemove')[2];
            onMouseMove({ clientX: 101, clientY: 101 });

            expect(canvas.hasDraggedCanvas).toBe(false);
        });

        it('should apply transform on mousemove', () => {
            canvas.handleCanvasDrag(100, 100);

            const onMouseMove = DOM.on.mock.calls.find(c => c[1] === 'mousemove')[2];
            onMouseMove({ clientX: 150, clientY: 200 });

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvasContent, 'transform', 'translate(50px, 100px) scale(1)');
        });

        it('should reset cursor and clean up on mouseup', () => {
            canvas.handleCanvasDrag(100, 100);

            const onMouseUp = DOM.on.mock.calls.find(c => c[1] === 'mouseup')[2];
            onMouseUp();

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'default');
            expect(DOM.off).toHaveBeenCalledWith(global.document, 'mousemove', expect.any(Function));
            expect(DOM.off).toHaveBeenCalledWith(global.document, 'mouseup', expect.any(Function));
        });
    });

    describe('updateNodeVisibility', () => {
        it('should return early when search input has value', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            global.document.getElementById.mockReturnValueOnce({ value: 'search term' });

            canvas.updateNodeVisibility(new Set(['node1', 'node2']));

            expect(global.document.querySelectorAll).not.toHaveBeenCalled();
        });

        it('should update node display based on visibility', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            global.document.getElementById.mockReturnValueOnce(null);
            const nodeEl = { dataset: { nodeId: 'node1' }, style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([nodeEl]);

            canvas.updateNodeVisibility(new Set(['node1']));

            expect(DOM.setStyle).toHaveBeenCalledWith(nodeEl, 'display', '');
        });

        it('should hide node not in visible set', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            global.document.getElementById.mockReturnValueOnce(null);
            const nodeEl = { dataset: { nodeId: 'node2' }, style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([nodeEl]);

            canvas.updateNodeVisibility(new Set(['node1']));

            expect(DOM.setStyle).toHaveBeenCalledWith(nodeEl, 'display', 'none');
        });
    });

    describe('updateEdgeVisibility', () => {
        it('should return early when search input has value', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce({ value: 'search' });

            canvas.updateEdgeVisibility(new Set(['node1']));

            expect(global.document.querySelectorAll).not.toHaveBeenCalled();
        });

        it('should show edge when source node is visible', () => {
            const core = createMockCore();
            core.edges = [{ id: 'edge1', source: 'node1', target: 'node2' }];
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce(null);
            const edgeEl = { getAttribute: jest.fn(() => 'edge1'), style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([edgeEl]);

            canvas.updateEdgeVisibility(new Set(['node1']));

            expect(DOM.setStyle).toHaveBeenCalledWith(edgeEl, 'display', '');
        });

        it('should show edge when target node is visible', () => {
            const core = createMockCore();
            core.edges = [{ id: 'edge1', source: 'node1', target: 'node2' }];
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce(null);
            const edgeEl = { getAttribute: jest.fn(() => 'edge1'), style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([edgeEl]);

            canvas.updateEdgeVisibility(new Set(['node2']));

            expect(DOM.setStyle).toHaveBeenCalledWith(edgeEl, 'display', '');
        });

        it('should hide edge when neither source nor target is visible', () => {
            const core = createMockCore();
            core.edges = [{ id: 'edge1', source: 'node1', target: 'node2' }];
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce(null);
            const edgeEl = { getAttribute: jest.fn(() => 'edge1'), style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([edgeEl]);

            canvas.updateEdgeVisibility(new Set(['node3']));

            expect(DOM.setStyle).toHaveBeenCalledWith(edgeEl, 'display', 'none');
        });

        it('should skip edge element without edge id', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce(null);
            const edgeEl = { getAttribute: jest.fn(() => null), style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([edgeEl]);

            canvas.updateEdgeVisibility(new Set(['node1']));

            expect(DOM.setStyle).not.toHaveBeenCalledWith(edgeEl, 'display', expect.anything());
        });

        it('should skip edge element when edge not found in core', () => {
            const core = createMockCore();
            core.edges = [];
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            global.document.getElementById.mockReturnValueOnce(null);
            const edgeEl = { getAttribute: jest.fn(() => 'edge1'), style: {} };
            global.document.querySelectorAll.mockReturnValueOnce([edgeEl]);

            canvas.updateEdgeVisibility(new Set(['node1']));

            expect(DOM.setStyle).not.toHaveBeenCalledWith(edgeEl, 'display', expect.anything());
        });
    });

    describe('forceVisibilityUpdate', () => {
        it('should update viewport and visible nodes', () => {
            const core = createMockCore([{ id: '1', x: 100, y: 100, width: 200, height: 100 }]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core = core;
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            expect(() => canvas.forceVisibilityUpdate()).not.toThrow();
        });
    });

    describe('centerView boundary checks', () => {
        it('should reset view when rect is null', () => {
            const core = createMockCore([{ x: 100, y: 100, width: 200, height: 100 }]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.centerView();

            expect(canvas.canvasScale).toBe(1);
        });
    });

    describe('onCanvasMouseDown container body detection', () => {
        it('should handle direct container body click on canvas', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = {};
            canvas.svgHitLayer = {};

            const containerNodeEl = { dataset: { nodeId: 'container_1' } };
            const containerBody = { closest: jest.fn(() => containerNodeEl) };

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                shiftKey: false,
                target: {
                    tagName: 'DIV',
                    closest: jest.fn((selector) => {
                        if (selector === '.canvas-node') return null;
                        if (selector === '.container-body') return containerBody;
                        return null;
                    }),
                    getAttribute: jest.fn(() => null)
                }
            });

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'grabbing');
        });

        it('should handle direct container body click with marquee', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            const containerNodeEl = { dataset: { nodeId: 'container_1' } };
            const containerBody = { closest: jest.fn(() => containerNodeEl) };

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                shiftKey: true,
                target: {
                    tagName: 'DIV',
                    closest: jest.fn((selector) => {
                        if (selector === '.canvas-node') return null;
                        if (selector === '.container-body') return containerBody;
                        return null;
                    }),
                    getAttribute: jest.fn(() => null)
                }
            });

            expect(canvas.isMarqueeSelectionActive).toBe(true);
        });

        it('should detect container body via querySelectorAll fallback', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = {};
            canvas.svgHitLayer = {};

            const containerBody = {
                getBoundingClientRect: () => ({ left: 50, top: 50, right: 250, bottom: 150 })
            };
            const containerNodeEl = {
                dataset: { nodeId: 'container_1' },
                querySelector: jest.fn(() => containerBody)
            };

            global.document.querySelectorAll.mockReturnValueOnce([containerNodeEl]);

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                target: {
                    tagName: 'DIV',
                    closest: jest.fn(() => null)
                }
            });

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.canvas, 'cursor', 'grabbing');
        });

        it('should start marquee on shift+click in container body', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };

            const containerBody = {
                getBoundingClientRect: () => ({ left: 50, top: 50, right: 250, bottom: 150 })
            };
            const containerNodeEl = {
                dataset: { nodeId: 'container_1' },
                querySelector: jest.fn(() => containerBody)
            };

            global.document.querySelectorAll.mockReturnValueOnce([containerNodeEl]);

            canvas.onCanvasMouseDown({
                clientX: 100,
                clientY: 100,
                ctrlKey: false,
                metaKey: false,
                shiftKey: true,
                target: {
                    tagName: 'DIV',
                    closest: jest.fn(() => null)
                }
            });

            expect(canvas.isMarqueeSelectionActive).toBe(true);
        });
    });

    describe('onCanvasClick ui.hasDragged', () => {
        it('should return early and reset ui.hasDragged', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.ui.hasDragged = true;
            canvas.ui.selection = { deselectAll: jest.fn() };
            canvas.isMarqueeSelectionActive = false;
            canvas.hasDraggedCanvas = false;

            canvas.onCanvasClick({ target: { closest: () => null, tagName: 'DIV' } });

            expect(canvas.ui.hasDragged).toBe(false);
            expect(canvas.ui.selection.deselectAll).not.toHaveBeenCalled();
        });
    });

    describe('calculateNodesBounds child nodes', () => {
        it('should handle child nodes with valid parent', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core.nodes = [
                { id: 'parent1', x: 50, y: 50, width: 400, height: 300 },
                { id: 'child1', x: 10, y: 10, width: 100, height: 50, parentId: 'parent1' }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(50);
            expect(bounds.minY).toBe(50);
            expect(bounds.maxX).toBe(450);
            expect(bounds.maxY).toBe(350);
        });

        it('should skip child nodes when parent not found', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.core.nodes = [
                { id: 'child1', x: 10, y: 10, width: 100, height: 50, parentId: 'nonexistent' }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(Infinity);
            expect(bounds.minY).toBe(Infinity);
            expect(bounds.maxX).toBe(-Infinity);
            expect(bounds.maxY).toBe(-Infinity);
        });
    });

    describe('autoOptimizeLayout', () => {
        it('should reset view when no nodes', () => {
            const core = createMockCore([]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(canvas.canvasScale).toBe(1);
        });

        it('should reset view when core is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;
            canvas.core = null;

            canvas.autoOptimizeLayout();

            expect(canvas.canvasScale).toBe(1);
        });

        it('should layout nodes with edges and save history', () => {
            const nodes = [
                { id: 'node1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'node2', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [{ source: 'node1', target: 'node2' }];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should layout nodes without edges', () => {
            const nodes = [
                { id: 'node1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'node2', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should handle container nodes with children', () => {
            const childNodes = [
                { id: 'child1', x: 0, y: 0, width: 100, height: 50 },
                { id: 'child2', x: 0, y: 0, width: 100, height: 50 }
            ];
            const nodes = [
                { id: 'container1', x: 0, y: 0, width: 300, height: 200, type: 'container' },
                { id: 'node1', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [];
            core.nodeTypeInfo = {
                container: { hasContainer: true, containerMinWidth: 300, containerMinHeight: 200 }
            };
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn((containerId) => {
                if (containerId === 'container1') return childNodes;
                return [];
            });
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should handle container with no children', () => {
            const nodes = [
                { id: 'container1', x: 0, y: 0, width: 300, height: 200, type: 'container' }
            ];
            const core = createMockCore(nodes);
            core.edges = [];
            core.nodeTypeInfo = {
                container: { hasContainer: true, containerMinWidth: 300, containerMinHeight: 200 }
            };
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
        });

        it('should layout multiple disconnected node groups', () => {
            const nodes = [
                { id: 'a1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'a2', x: 0, y: 0, width: 200, height: 100 },
                { id: 'b1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'b2', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [
                { source: 'a1', target: 'a2' },
                { source: 'b1', target: 'b2' }
            ];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should handle nodes with custom width and height', () => {
            const nodes = [
                { id: 'node1', x: 0, y: 0, width: 300, height: 200 },
                { id: 'node2', x: 0, y: 0, width: 400, height: 150 }
            ];
            const core = createMockCore(nodes);
            core.edges = [{ source: 'node1', target: 'node2' }];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should handle node with multiple predecessors', () => {
            const nodes = [
                { id: 'src1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'src2', x: 0, y: 0, width: 200, height: 100 },
                { id: 'target', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [
                { source: 'src1', target: 'target' },
                { source: 'src2', target: 'target' }
            ];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });

        it('should resolve vertical overlaps in same level', () => {
            const nodes = [
                { id: 'src', x: 0, y: 0, width: 200, height: 100 },
                { id: 'tgt1', x: 0, y: 0, width: 200, height: 100 },
                { id: 'tgt2', x: 0, y: 0, width: 200, height: 100 },
                { id: 'tgt3', x: 0, y: 0, width: 200, height: 100 }
            ];
            const core = createMockCore(nodes);
            core.edges = [
                { source: 'src', target: 'tgt1' },
                { source: 'src', target: 'tgt2' },
                { source: 'src', target: 'tgt3' }
            ];
            core.nodeTypeInfo = {};
            core.saveHistory = jest.fn();
            core.getChildNodes = jest.fn(() => []);
            const ui = createMockUI(core);
            ui.refreshCanvas = jest.fn();
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 2;

            canvas.autoOptimizeLayout();

            expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
            expect(ui.refreshCanvas).toHaveBeenCalled();
            expect(canvas.canvasScale).toBeLessThanOrEqual(1);
        });
    });

    describe('_createAlignmentGuides', () => {
        it('should return null when canvas is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;

            const result = canvas._createAlignmentGuides();

            expect(result).toBeNull();
        });

        it('should return null when canvas.appendChild is not a function', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = {};

            const result = canvas._createAlignmentGuides();

            expect(result).toBeNull();
        });

        it('should create SVG element and append to canvas', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            const mockCanvas = { appendChild: jest.fn() };
            canvas.canvas = mockCanvas;

            const result = canvas._createAlignmentGuides();

            expect(result).toBeDefined();
            expect(result.setAttribute).toHaveBeenCalledWith('class', 'alignment-guides');
            expect(result.setAttribute).toHaveBeenCalledWith('id', 'alignmentGuides');
            expect(mockCanvas.appendChild).toHaveBeenCalledWith(result);
        });
    });

    describe('setupZoomControls', () => {
        it('should register click handlers on zoom buttons when they exist', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };

            const mockZoomInBtn = {};
            const mockZoomOutBtn = {};
            const mockZoomFitBtn = {};
            const mockZoomLevel = {};

            global.document.getElementById
                .mockReturnValueOnce(mockZoomInBtn)
                .mockReturnValueOnce(mockZoomOutBtn)
                .mockReturnValueOnce(mockZoomFitBtn)
                .mockReturnValueOnce(mockZoomLevel);

            canvas.setupZoomControls();

            expect(DOM.on).toHaveBeenCalledWith(mockZoomInBtn, 'click', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(mockZoomOutBtn, 'click', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(mockZoomFitBtn, 'click', expect.any(Function));
            expect(DOM.on).toHaveBeenCalledWith(mockZoomLevel, 'click', expect.any(Function));
        });

        it('should not crash when buttons are missing', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { style: {} };

            global.document.getElementById.mockReturnValue(null);

            expect(() => canvas.setupZoomControls()).not.toThrow();
        });
    });

    describe('zoomIn', () => {
        it('should zoom in from center', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 1;

            canvas.zoomIn();

            expect(canvas.canvasScale).toBeGreaterThan(1);
        });

        it('should not zoom beyond max scale', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(3)' } };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 3;

            canvas.zoomIn();

            expect(canvas.canvasScale).toBe(3);
        });

        it('should return early when canvas rect is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;

            canvas.zoomIn();

            expect(canvas.canvasScale).toBe(1);
        });
    });

    describe('zoomOut', () => {
        it('should zoom out from center', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(1)' } };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 1;

            canvas.zoomOut();

            expect(canvas.canvasScale).toBeLessThan(1);
        });

        it('should not zoom below min scale', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            canvas.canvasContent = { style: { transform: 'translate(0px, 0px) scale(0.25)' } };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.canvasScale = 0.25;

            canvas.zoomOut();

            expect(canvas.canvasScale).toBe(0.25);
        });

        it('should return early when canvas rect is null', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvas = null;

            canvas.zoomOut();

            expect(canvas.canvasScale).toBe(1);
        });
    });

    describe('updateZoomLevel', () => {
        it('should update zoom level text content when element exists', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasScale = 1.5;
            const mockZoomLevel = { textContent: '' };
            global.document.getElementById.mockReturnValue(mockZoomLevel);

            canvas.updateZoomLevel();

            expect(mockZoomLevel.textContent).toBe('150%');
        });

        it('should not crash when zoomLevel element does not exist', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasScale = 1;
            global.document.getElementById.mockReturnValue(null);

            expect(() => canvas.updateZoomLevel()).not.toThrow();
        });
    });

    describe('applyTransform with alignmentGuides', () => {
        it('should apply transform to alignmentGuides when present', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.canvasContent = { style: {} };
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.alignmentGuides = { style: {} };

            canvas.applyTransform(100, 200, 1.5);

            expect(DOM.setStyle).toHaveBeenCalledWith(canvas.alignmentGuides, 'transform', 'translate(100px, 200px) scale(1.5)');
        });
    });

    describe('setSvgSize with alignmentGuides', () => {
        it('should set size on alignmentGuides when present', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { style: {} };
            canvas.svgHitLayer = { style: {} };
            canvas.alignmentGuides = { style: {} };

            canvas.setSvgSize(800, 600);

            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.alignmentGuides, 'width', 800);
            expect(DOM.setAttr).toHaveBeenCalledWith(canvas.alignmentGuides, 'height', 600);
        });
    });

    describe('_escapeXml', () => {
        it('should escape XML special characters', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas._escapeXml('<div class="test">&amp;</div>');

            expect(result).toBe('&lt;div class=&quot;test&quot;&gt;&amp;amp;&lt;/div&gt;');
        });

        it('should return same string when no special chars', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas._escapeXml('hello world');

            expect(result).toBe('hello world');
        });

        it('should convert non-string to string', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            const result = canvas._escapeXml(123);

            expect(result).toBe('123');
        });
    });

    describe('_rgb', () => {
        it('should return color when valid', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            expect(canvas._rgb('#ff0000')).toBe('#ff0000');
            expect(canvas._rgb('rgb(255,0,0)')).toBe('rgb(255,0,0)');
        });

        it('should return null for transparent', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);

            expect(canvas._rgb('transparent')).toBeNull();
            expect(canvas._rgb('rgba(0, 0, 0, 0)')).toBeNull();
            expect(canvas._rgb('')).toBeNull();
            expect(canvas._rgb(null)).toBeNull();
            expect(canvas._rgb()).toBeNull();
        });
    });

    describe('_downloadBlob', () => {
        it('should create download link and click it', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            const mockA = {
                href: '',
                download: '',
                click: jest.fn()
            };
            global.document.createElement.mockReturnValueOnce(mockA);
            global.URL.createObjectURL = jest.fn(() => 'blob:test');
            global.URL.revokeObjectURL = jest.fn();

            canvas._downloadBlob('test data', 'test.txt', 'text/plain');

            expect(mockA.href).toBe('blob:test');
            expect(mockA.download).toBe('test.txt');
            expect(mockA.click).toHaveBeenCalled();
            expect(global.document.body.appendChild).toHaveBeenCalledWith(mockA);
            expect(global.document.body.removeChild).toHaveBeenCalledWith(mockA);
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
        });
    });

    describe('exportAsImage', () => {
        it('should return early when svgLayer is null', async () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = null;

            const result = await canvas.exportAsImage();

            expect(result).toBeUndefined();
        });

        it('should return early when canvasContent is null', async () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = {};
            canvas.canvasContent = null;

            const result = await canvas.exportAsImage();

            expect(result).toBeUndefined();
        });

        it('should return early when no nodes on canvas', async () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = {};
            canvas.canvasContent = { querySelectorAll: jest.fn(() => []) };

            const result = await canvas.exportAsImage();

            expect(result).toBeUndefined();
        });

        it('should export as SVG format', async () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = { querySelectorAll: jest.fn(() => []) };
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(1)' },
                querySelectorAll: jest.fn(() => [
                    {
                        getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }),
                        classList: { contains: () => false },
                        querySelector: jest.fn(() => null),
                        querySelectorAll: jest.fn(() => [])
                    }
                ])
            };
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };

            global.getComputedStyle = () => ({
                getPropertyValue: () => '#1a1a2e'
            });
            global.window.getComputedStyle = () => ({
                backgroundColor: 'rgb(42, 42, 62)',
                borderColor: 'rgb(68, 68, 68)',
                color: 'rgb(224, 224, 224)'
            });

            canvas._downloadBlob = jest.fn();

            await canvas.exportAsImage('svg');

            expect(canvas._downloadBlob).toHaveBeenCalled();
        });

        it('should export as SVG format with edges and container nodes', async () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.svgLayer = {
                querySelectorAll: jest.fn(() => [
                    {
                        getBBox: () => ({ x: 50, y: 50, width: 100, height: 2 }),
                        outerHTML: '<path d="M0 0 L100 0" />'
                    }
                ])
            };
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(1)' },
                querySelectorAll: jest.fn(() => [
                    {
                        getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }),
                        classList: { contains: (cls) => cls === 'container' },
                        querySelector: jest.fn(() => ({ textContent: 'Container' })),
                        querySelectorAll: jest.fn(() => [])
                    },
                    {
                        getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }),
                        classList: { contains: (cls) => cls === 'loop' },
                        querySelector: jest.fn(() => null),
                        querySelectorAll: jest.fn(() => [])
                    },
                    {
                        getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }),
                        classList: { contains: (cls) => cls === 'batch' },
                        querySelector: jest.fn(() => null),
                        querySelectorAll: jest.fn(() => [])
                    },
                    {
                        getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }),
                        classList: { contains: () => false },
                        querySelector: jest.fn(() => null),
                        querySelectorAll: jest.fn(() => [])
                    }
                ])
            };
            canvas.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };

            global.getComputedStyle = () => ({
                getPropertyValue: () => '#1a1a2e'
            });
            global.window.getComputedStyle = () => ({
                backgroundColor: 'rgb(42, 42, 62)',
                borderColor: 'rgb(68, 68, 68)',
                color: 'rgb(224, 224, 224)'
            });

            canvas._downloadBlob = jest.fn();

            await canvas.exportAsImage('svg');

            expect(canvas._downloadBlob).toHaveBeenCalled();
        });
    });
});