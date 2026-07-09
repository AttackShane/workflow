import { WorkflowEdge } from '../src/modules/editor-edge.js';

function createMockElement(attrs = {}) {
    const el = {
        _attrs: { ...attrs },
        _children: [],
        _events: {},
        _text: '',
        dataset: {},
        get textContent() { return this._text; },
        set textContent(val) { this._text = val; },
        classList: {
            _classes: new Set(),
            add: function(c) { this._classes.add(c); },
            remove: function(c) { this._classes.delete(c); },
            toggle: function(c, force) {
                if (force === true) this._classes.add(c);
                else if (force === false) this._classes.delete(c);
                else this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c);
            },
            contains: function(c) { return this._classes.has(c); }
        },
        setAttribute: function(name, value) { this._attrs[name] = value; },
        getAttribute: function(name) { return this._attrs[name] || null; },
        appendChild: function(child) { this._children.push(child); },
        remove: function() {},
        addEventListener: function(event, handler) { this._events[event] = handler; },
        removeEventListener: function() {},
        getBoundingClientRect: function() { return { left: 0, top: 0, width: 10, height: 10 }; },
        closest: function() { return null; },
        querySelectorAll: function() { return []; },
        querySelector: function() { return null; }
    };
    return el;
}

function createMockSVGLayer() {
    const children = [];
    return {
        _children: children,
        querySelector: function(selector) {
            for (const child of children) {
                const id = child.getAttribute('data-edge-id');
                if (id && selector.includes(id)) return child;
            }
            return null;
        },
        querySelectorAll: function(selector) {
            return children.filter(child => {
                const id = child.getAttribute('data-edge-id');
                return id && (selector.includes('workflow-edge') || selector.includes('data-edge-id'));
            });
        },
        appendChild: function(el) { children.push(el); },
        removeChild: function(el) {
            const idx = children.indexOf(el);
            if (idx >= 0) children.splice(idx, 1);
        },
        _reset: function() { children.length = 0; },
        _findByTag: function(tag) {
            return children.filter(c => c._tag === tag);
        },
        _findById: function(id) {
            return children.find(c => c.getAttribute('data-edge-id') === id);
        }
    };
}

function createMockCore(nodes = [], edges = []) {
    const containerNodes = new Set();
    const coreNodes = nodes;
    return {
        get nodes() { return coreNodes; },
        set nodes(val) { coreNodes.length = 0; coreNodes.push(...val); },
        edges,
        selectNode: jest.fn(),
        selectEdge: jest.fn(),
        deleteEdge: jest.fn(),
        createEdge: jest.fn(),
        saveHistory: jest.fn(),
        isContainerNode: (id) => containerNodes.has(id),
        getChildNodes: (id) => coreNodes.filter(n => n.parentId === id),
        _containerNodes: containerNodes
    };
}

function createMockUI(core) {
    const svgLayer = createMockSVGLayer();
    const svgHitLayer = createMockSVGLayer();
    return {
        core,
        canvas: {
            svgLayer,
            svgHitLayer,
            canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
            screenToCanvas: (x, y) => ({ canvasX: x, canvasY: y })
        },
        isMultiSelectMode: false,
        showSummaryPanel: jest.fn(),
        showDetailPanel: jest.fn(),
        showMessage: jest.fn(),
        propertyContent: null,
        svgPath: null,
        connectingFrom: null,
        connectingFromPort: ''
    };
}

global.document = {
    createElementNS: (ns, tag) => {
        const el = createMockElement();
        el._tag = tag;
        el._ns = ns;
        return el;
    },
    createElement: (tag) => {
        const el = createMockElement();
        el._tag = tag;
        return el;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    elementFromPoint: () => null
};

describe('WorkflowEdge', () => {
    describe('_computeEdgeGeometry', () => {
        let edge;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should return null when source or target node not found', () => {
            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });
            expect(geom).toBeNull();
        });

        it('should compute basic geometry for simple nodes', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom).not.toBeNull();
            expect(geom.x1).toBe(200); // x1 = source.x + source.width
            expect(geom.y1).toBe(50);  // y1 = source.y + source.height / 2
            expect(geom.x2).toBe(300); // x2 = target.x
            expect(geom.y2).toBe(150); // y2 = target.y + target.height / 2
            expect(geom.d).toContain('M');
            expect(geom.d).toContain('C');
            expect(geom.arrowPoints).toBeTruthy();
            expect(geom.labelText).toBe('');
        });

        it('should compute geometry for nodes with different sizes', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 150, height: 80, type: 'code' },
                { id: 'n2', x: 250, y: 50, width: 300, height: 120, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom.x1).toBe(150); // 0 + 150
            expect(geom.y1).toBe(40);  // 0 + 80/2
            expect(geom.x2).toBe(250); // 250
            expect(geom.y2).toBe(110); // 50 + 120/2
        });

        it('should handle container source nodes with container_start port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 400, height: 300, type: 'loop' },
                { id: 'n2', x: 500, y: 100, width: 200, height: 100, type: 'code' }
            ];
            edge.core._containerNodes.add('n1');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'container_start'
            });

            expect(geom.x1).toBe(0);   // source.x (left side of container)
            expect(geom.y1).toBe(178); // source.y + height/2 + 28
            expect(geom.x2).toBe(500);
            expect(geom.y2).toBe(150); // 100 + 100/2
        });

        it('should handle container source nodes with default port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 400, height: 300, type: 'loop' },
                { id: 'n2', x: 500, y: 100, width: 200, height: 100, type: 'code' }
            ];
            edge.core._containerNodes.add('n1');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'container_bottom'
            });

            expect(geom.x1).toBe(400); // source.x + width (right side)
            expect(geom.y1).toBe(30);  // source.y + 30
        });

        it('should handle container target nodes with container_end port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 400, height: 300, type: 'loop' }
            ];
            edge.core._containerNodes.add('n2');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', targetPort: 'container_end'
            });

            expect(geom.x2).toBe(700); // 300 + 400
            expect(geom.y2).toBe(278); // 100 + 300/2 + 28
        });

        it('should handle container target nodes with default port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 400, height: 300, type: 'loop' }
            ];
            edge.core._containerNodes.add('n2');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', targetPort: 'container_top'
            });

            expect(geom.x2).toBe(300); // 300
            expect(geom.y2).toBe(130); // 100 + 30
        });

        it('should handle question node with branch ports', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 295, type: 'question',
                    parameters: { options: ['选项A', '选项B', '选项C'] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });

            const totalPorts = 4; // 3 options + 1 (other)
            expect(geom.y1).toBeCloseTo(295 * 0.5 / totalPorts, 0); // port 0
            expect(geom.labelText).toBe('选项A');
        });

        it('should handle question node with "other" branch', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 295, type: 'question',
                    parameters: { options: ['选项A', '选项B'] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_2'
            });

            expect(geom.labelText).toBe('其他');
        });

        it('should handle condition node with branch ports', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'condition',
                    parameters: { branches: [{ name: 'True' }, { name: 'False' }] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });

            expect(geom.labelText).toBe('True');
        });

        it('should handle condition node with unnamed branches', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'condition',
                    parameters: { branches: [{}, {}] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom0 = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });
            expect(geom0.labelText).toBe('True');

            const geom1 = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_1'
            });
            expect(geom1.labelText).toBe('False');
        });

        it('should generate valid SVG path with cubic bezier', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            const pathRegex = /^M \d+ \d+ C \d+ \d+, \d+ \d+, \d+ \d+$/;
            expect(geom.d).toMatch(pathRegex);
        });

        it('should generate arrow points as triangle', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            const points = geom.arrowPoints.split(' ').filter(p => p.length > 0);
            expect(points.length).toBe(3);
        });

        it('should handle nodes with parentId for absolute positioning', () => {
            edge.core.nodes = [
                { id: 'parent', x: 100, y: 50, width: 500, height: 400, type: 'loop' },
                { id: 'n1', x: 50, y: 100, width: 150, height: 80, type: 'code', parentId: 'parent' },
                { id: 'n2', x: 400, y: 200, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            // n1 absolute: x = 100 + 50 = 150, y = 50 + 56 + 100 = 206
            expect(geom.x1).toBe(300); // 150 + 150
            expect(geom.y1).toBe(246); // 206 + 80/2
            expect(geom.x2).toBe(400);
            expect(geom.y2).toBe(250); // 200 + 100/2
        });

        it('should handle edge label position', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom.labelX).toBe(200 + (300 - 200) * 0.15); // x1 + (x2-x1)*0.15
            expect(geom.labelY).toBe(50 - 8); // y1 - 8
        });
    });

    describe('_upsertEdgeElements', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should create new SVG elements for edge path, arrow, hitPath', () => {
            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, geom);

            const pathEl = ui.canvas.svgLayer._findByTag('path').find(p => p.getAttribute('data-edge-id') === 'e1');
            expect(pathEl).toBeDefined();
            expect(pathEl._attrs.d).toBe(geom.d);
            expect(pathEl.classList.contains('workflow-edge')).toBe(true);

            const arrowEl = ui.canvas.svgLayer._findByTag('polygon').find(p => p.getAttribute('data-edge-id') === 'e1');
            expect(arrowEl).toBeDefined();
            expect(arrowEl._attrs.points).toBe(geom.arrowPoints);
        });

        it('should update existing path element attributes', () => {
            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            const existingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            existingPath.setAttribute('data-edge-id', 'e1');
            existingPath.classList.add('workflow-edge');
            ui.canvas.svgLayer.appendChild(existingPath);

            const newGeom = { ...geom, d: 'M 100 50 C 200 50, 250 100, 300 100' };
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, newGeom);

            expect(existingPath._attrs.d).toBe('M 100 50 C 200 50, 250 100, 300 100');
        });

        it('should handle selected state on edge elements', () => {
            edge.core.selectedEdge = 'e1';
            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, geom);

            const pathEl = ui.canvas.svgLayer._findByTag('path').find(p => p.getAttribute('data-edge-id') === 'e1');
            expect(pathEl.classList.contains('selected')).toBe(true);
        });

        it('should create label element when labelText is present', () => {
            const geom = {
                ...edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' }),
                labelText: 'Test Label',
                labelX: 100,
                labelY: 50
            };
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, geom);

            const labelEl = ui.canvas.svgLayer._findByTag('text').find(t => t.getAttribute('data-edge-id') === 'e1');
            expect(labelEl).toBeDefined();
            expect(labelEl._text).toBe('Test Label');
            expect(labelEl._attrs.x).toBe(100);
            expect(labelEl._attrs.y).toBe(50);
        });

        it('should update existing label text and position', () => {
            const existingLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            existingLabel.setAttribute('data-edge-id', 'e1');
            ui.canvas.svgLayer.appendChild(existingLabel);

            const geom = {
                ...edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' }),
                labelText: 'Updated Label',
                labelX: 200,
                labelY: 60
            };
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, geom);

            expect(existingLabel._text).toBe('Updated Label');
            expect(existingLabel._attrs.x).toBe(200);
            expect(existingLabel._attrs.y).toBe(60);
        });
    });

    describe('update', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should create SVG elements for all edges', () => {
            edge.update();

            const pathEl = ui.canvas.svgLayer._findByTag('path').find(p => p.getAttribute('data-edge-id') === 'e1');
            expect(pathEl).toBeDefined();
        });

        it('should skip edges with no geometry', () => {
            edge.core.edges = [
                { id: 'e_bad', source: 'nonexistent', target: 'n2' }
            ];
            edge.update();

            expect(ui.canvas.svgLayer._findById('e_bad')).toBeUndefined();
        });

        it('should remove orphaned SVG elements', () => {
            const orphanPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            orphanPath.setAttribute('data-edge-id', 'orphan_edge');
            orphanPath.classList.add('workflow-edge');
            ui.canvas.svgLayer.appendChild(orphanPath);

            edge.update();

            const pathEl = ui.canvas.svgLayer._findById('e1');
            expect(pathEl).toBeDefined();
        });
    });

    describe('updateAffectedEdges', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' },
                { id: 'n3', x: 500, y: 200, width: 200, height: 100, type: 'code' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' },
                { id: 'e2', source: 'n2', target: 'n3' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should update only edges connected to specified nodes', () => {
            edge.updateAffectedEdges(['n1']);

            expect(ui.canvas.svgLayer._findById('e1')).toBeDefined();
            expect(ui.canvas.svgLayer._findById('e2')).toBeUndefined();
        });

        it('should include container children in affected set', () => {
            core._containerNodes.add('n1');
            core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 400, height: 300, type: 'loop' },
                { id: 'child1', x: 50, y: 100, width: 150, height: 80, type: 'code', parentId: 'n1' },
                { id: 'n2', x: 500, y: 100, width: 200, height: 100, type: 'code' }
            ];
            core.edges = [
                { id: 'e1', source: 'child1', target: 'n2' }
            ];

            edge.updateAffectedEdges(['n1']);

            expect(ui.canvas.svgLayer._findById('e1')).toBeDefined();
        });

        it('should remove orphaned elements', () => {
            const orphanPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            orphanPath.setAttribute('data-edge-id', 'orphan');
            orphanPath.classList.add('workflow-edge');
            ui.canvas.svgLayer.appendChild(orphanPath);

            edge.updateAffectedEdges(['n1']);

            expect(ui.canvas.svgLayer._findById('e1')).toBeDefined();
        });
    });

    describe('select', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code', title: 'Node1' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code', title: 'Node2' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should select an edge and update property panel', () => {
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('data-edge-id', 'e1');
            pathEl.classList.add('workflow-edge');
            ui.canvas.svgLayer.appendChild(pathEl);

            global.document.querySelector = (sel) => {
                if (sel === 'path[data-edge-id="e1"]') return pathEl;
                return null;
            };
            global.document.querySelectorAll = (sel) => {
                if (sel === '.workflow-edge') return [pathEl];
                if (sel === '.workflow-edge.selected') return [pathEl];
                if (sel === '.canvas-node.selected') return [];
                if (sel === '.canvas-node') return [];
                return [];
            };
            global.document.getElementById = () => ({ innerHTML: '' });

            edge.select('e1');

            expect(core.selectEdge).toHaveBeenCalledWith('e1');
            expect(ui.showDetailPanel).toHaveBeenCalled();
        });

        it('should show summary panel when no edge is selected', () => {
            global.document.querySelectorAll = () => [];
            global.document.querySelector = () => null;

            edge.select('e1');

            expect(core.selectEdge).toHaveBeenCalledWith(null);
            expect(ui.showSummaryPanel).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([], []);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should delete edge with history by default', () => {
            edge.delete('e1');

            expect(core.deleteEdge).toHaveBeenCalledWith('e1');
            expect(core.selectEdge).toHaveBeenCalledWith(null);
            expect(ui.showSummaryPanel).toHaveBeenCalled();
            expect(core.saveHistory).toHaveBeenCalledWith('actions.deleteConnection');
        });

        it('should delete edge without saving history', () => {
            edge.delete('e1', false);

            expect(core.deleteEdge).toHaveBeenCalledWith('e1');
            expect(core.saveHistory).not.toHaveBeenCalled();
        });
    });

    describe('renderPropertyPanel', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'start', title: 'Start' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'end', title: 'End' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2', sourcePortID: 'port_a', targetPortID: 'port_b' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should show summary panel when multiple items selected', () => {
            global.document.querySelectorAll = () => [
                { classList: { contains: () => true } },
                { classList: { contains: () => true } }
            ];

            edge.renderPropertyPanel(core.edges[0]);
            expect(ui.showSummaryPanel).toHaveBeenCalled();
        });

        it('should show summary panel when no edge provided', () => {
            global.document.querySelectorAll = () => [];

            edge.renderPropertyPanel(null);
            expect(ui.showSummaryPanel).toHaveBeenCalled();
        });

        it('should render edge detail when single edge selected', () => {
            global.document.querySelectorAll = (sel) => {
                if (sel === '.canvas-node.selected') return [];
                if (sel === '.workflow-edge.selected') return [{ classList: { contains: () => true } }];
                return [];
            };

            const detailEl = { innerHTML: '' };
            global.document.getElementById = () => detailEl;

            edge.renderPropertyPanel(core.edges[0]);
            expect(ui.showDetailPanel).toHaveBeenCalled();
            expect(detailEl.innerHTML).toContain('Start');
            expect(detailEl.innerHTML).toContain('End');
            expect(detailEl.innerHTML).toContain('port_a');
            expect(detailEl.innerHTML).toContain('port_b');
        });

        it('should handle missing detail container', () => {
            global.document.querySelectorAll = (sel) => {
                if (sel === '.canvas-node.selected') return [];
                if (sel === '.workflow-edge.selected') return [{ classList: { contains: () => true } }];
                return [];
            };
            global.document.getElementById = () => null;

            edge.renderPropertyPanel(core.edges[0]);
            expect(ui.showDetailPanel).toHaveBeenCalled();
        });
    });

    describe('startConnection', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], []);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should set up connection state and SVG path', () => {
            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            expect(ui.connectingFrom).toBe('n1');
            expect(ui.connectingFromPort).toBe('output_1');
            expect(ui.svgPath).toBeDefined();
            expect(ui.svgPath._tag).toBe('path');
        });
    });

    describe('cancelConnection', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([], []);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should remove SVG path and reset state', () => {
            const mockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            ui.svgPath = mockPath;
            ui.connectingFrom = 'n1';
            ui.connectingFromPort = 'output_1';

            edge.cancelConnection();

            expect(ui.svgPath).toBeNull();
            expect(ui.connectingFrom).toBeNull();
            expect(ui.connectingFromPort).toBe('');
        });

        it('should handle already removed SVG path gracefully', () => {
            ui.svgPath = null;
            ui.connectingFrom = 'n1';

            expect(() => edge.cancelConnection()).not.toThrow();
            expect(ui.connectingFrom).toBeNull();
        });
    });

    describe('updateAllEdges', () => {
        it('should call update method', () => {
            const core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]);
            const ui = createMockUI(core);
            const edge = new WorkflowEdge(ui);

            edge.updateAllEdges();

            expect(ui.canvas.svgLayer._findById('e1')).toBeDefined();
        });
    });

    describe('_upsertEdgeElements - hitPath branch', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], [
                { id: 'e1', source: 'n1', target: 'n2' }
            ]);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should update existing hitPath d attribute', () => {
            const existingHitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            existingHitPath.setAttribute('data-edge-id', 'e1');
            existingHitPath.setAttribute('d', 'old_value');
            ui.canvas.svgHitLayer.appendChild(existingHitPath);

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });
            edge._upsertEdgeElements({ id: 'e1', source: 'n1', target: 'n2' }, geom);

            expect(existingHitPath._attrs.d).toBe(geom.d);
        });
    });

    describe('startConnection - mouse events', () => {
        let edge, ui, core;

        beforeEach(() => {
            core = createMockCore([
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ], []);
            ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
            document.addEventListener.mockClear();
            document.removeEventListener.mockClear();
            document.elementFromPoint = () => null;
        });

        it('should handle mousemove and update SVG path', () => {
            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const moveCall = document.addEventListener.mock.calls.find(c => c[0] === 'mousemove');
            expect(moveCall).toBeDefined();
            const onMouseMove = moveCall[1];

            onMouseMove({ clientX: 200, clientY: 150 });

            const d = ui.svgPath.getAttribute('d');
            expect(d).toBeDefined();
            expect(d).toContain('M');
            expect(d).toContain('C');
        });

        it('should handle mousemove when svgPath is null', () => {
            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const moveCall = document.addEventListener.mock.calls.find(c => c[0] === 'mousemove');
            const onMouseMove = moveCall[1];

            ui.svgPath = null;

            expect(() => onMouseMove({ clientX: 200, clientY: 150 })).not.toThrow();
        });

        it('should handle mouseup and create edge when target is input port', () => {
            core.createEdge.mockClear();

            const nodeEl = document.createElement('div');
            nodeEl.classList.add('canvas-node');
            nodeEl.dataset.nodeId = 'n2';

            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.closest = jest.fn(sel => {
                if (sel === '.input-port') return inputPort;
                if (sel === '.canvas-node') return nodeEl;
                return null;
            });
            nodeEl.appendChild(inputPort);

            global.document.elementFromPoint = () => inputPort;

            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const upCall = document.addEventListener.mock.calls.find(c => c[0] === 'mouseup');
            const onMouseUp = upCall[1];

            onMouseUp({ clientX: 300, clientY: 150 });

            expect(core.createEdge).toHaveBeenCalledWith('n1', 'n2', 'output_1');
            expect(core.saveHistory).toHaveBeenCalledWith('actions.createConnection');
            expect(ui.showMessage).toHaveBeenCalled();
        });

        it('should not create edge when source equals target', () => {
            core.createEdge.mockClear();

            const nodeEl = document.createElement('div');
            nodeEl.classList.add('canvas-node');
            nodeEl.dataset.nodeId = 'n1';

            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.closest = jest.fn(sel => {
                if (sel === '.input-port') return inputPort;
                if (sel === '.canvas-node') return nodeEl;
                return null;
            });
            nodeEl.appendChild(inputPort);

            global.document.elementFromPoint = () => inputPort;

            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const upCall = document.addEventListener.mock.calls.find(c => c[0] === 'mouseup');
            const onMouseUp = upCall[1];

            onMouseUp({ clientX: 300, clientY: 150 });

            expect(core.createEdge).not.toHaveBeenCalled();
        });

        it('should not create edge when edge already exists', () => {
            core.edges = [{ source: 'n1', target: 'n2' }];
            core.createEdge.mockClear();

            const nodeEl = document.createElement('div');
            nodeEl.classList.add('canvas-node');
            nodeEl.dataset.nodeId = 'n2';

            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.closest = jest.fn(sel => {
                if (sel === '.input-port') return inputPort;
                if (sel === '.canvas-node') return nodeEl;
                return null;
            });
            nodeEl.appendChild(inputPort);

            global.document.elementFromPoint = () => inputPort;

            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const upCall = document.addEventListener.mock.calls.find(c => c[0] === 'mouseup');
            const onMouseUp = upCall[1];

            onMouseUp({ clientX: 300, clientY: 150 });

            expect(core.createEdge).not.toHaveBeenCalled();
        });

        it('should cancel connection on mouseup without input port', () => {
            const mockEvent = {
                target: {
                    getBoundingClientRect: () => ({ left: 100, top: 50, width: 10, height: 10 })
                }
            };

            edge.startConnection('n1', mockEvent, 'output_1');

            const upCall = document.addEventListener.mock.calls.find(c => c[0] === 'mouseup');
            const onMouseUp = upCall[1];

            onMouseUp({ clientX: 300, clientY: 150 });

            expect(document.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(document.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(ui.connectingFrom).toBeNull();
        });
    });
});