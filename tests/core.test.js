import { StringUtils } from '../src/utils/helpers.js';
import { convertClipboardToYaml } from '../src/modules/converter/converter-reverse.js';
import { WorkflowCore } from '../src/modules/editor/editor-core.js';
import { highlightJson, highlightYaml } from '../src/modules/converter/converter-highlighter.js';

describe('StringUtils.escapeHtml', () => {
    it('should escape < > & " characters', () => {
        expect(StringUtils.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(StringUtils.escapeHtml('a & b')).toBe('a &amp; b');
        expect(StringUtils.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should return empty string for falsy values', () => {
        expect(StringUtils.escapeHtml('')).toBe('');
        expect(StringUtils.escapeHtml(null)).toBe('');
        expect(StringUtils.escapeHtml(undefined)).toBe('');
    });

    it('should not escape safe characters', () => {
        expect(StringUtils.escapeHtml('hello world')).toBe('hello world');
        expect(StringUtils.escapeHtml('中文测试')).toBe('中文测试');
        expect(StringUtils.escapeHtml("it's fine")).toBe('it&#39;s fine');
    });

    it('should escape attribute-breaking chars in user data', () => {
        const malicious = '"><img src=x onerror=alert(1)>';
        const escaped = StringUtils.escapeHtml(malicious);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
        expect(escaped).toContain('&lt;');
        expect(escaped).toContain('&gt;');
    });
});

describe('Reverse Module', () => {
    describe('convertClipboardToYaml', () => {
        it('should convert basic clipboard data to YAML format', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    name: 'test_workflow',
                    nodes: [],
                    edges: [],
                },
                source: { workflowId: '123456' },
            };

            const result = convertClipboardToYaml(clip);
            expect(result.schema_version).toBe('1.0.0');
            expect(result.name).toBe('test_workflow');
            expect(result.id).toBe('123456');
            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
        });

        it('should use fallback name when missing', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: { nodes: [], edges: [] },
                source: { workflowId: '789' },
            };

            const result = convertClipboardToYaml(clip);
            expect(result.name).toBe('imported_workflow');
        });

        it('should ensure workflow id is a string', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: { name: 'test', nodes: [], edges: [] },
                source: { workflowId: 999 },
            };

            const result = convertClipboardToYaml(clip);
            expect(typeof result.id).toBe('string');
            expect(result.id).toBe('999');
        });

        it('should convert nodes with positions', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    name: 'simple',
                    nodes: [
                        {
                            id: 'node_1',
                            type: '1',
                            meta: { position: { x: 100, y: 200 } },
                            data: {
                                nodeMeta: { title: 'Start', icon: '', description: '' },
                                inputs: {},
                                outputs: [],
                            },
                        },
                    ],
                    edges: [],
                },
                source: { workflowId: 'test_1' },
            };

            const result = convertClipboardToYaml(clip);
            expect(result.nodes.length).toBe(1);
            expect(result.nodes[0].id).toBe('node_1');
            expect(result.nodes[0].position.x).toBe(100);
            expect(result.nodes[0].position.y).toBe(200);
            expect(result.nodes[0].title).toBe('Start');
        });

        it('should default position to 0,0 when missing', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    name: 'no_pos',
                    nodes: [
                        {
                            id: 'node_1',
                            type: '2',
                            data: { nodeMeta: { title: 'End', icon: '', description: '' }, inputs: {}, outputs: [] },
                        },
                    ],
                    edges: [],
                },
                source: { workflowId: 'test_2' },
            };

            const result = convertClipboardToYaml(clip);
            expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
        });

        it('should convert edges with port references', () => {
            const clip = {
                type: 'coze-workflow-clipboard-data',
                json: {
                    name: 'with_edges',
                    nodes: [],
                    edges: [{ sourceNodeID: 'n1', targetNodeID: 'n2', sourcePortID: 'output', targetPortID: 'input' }],
                },
                source: { workflowId: 'test_3' },
            };

            const result = convertClipboardToYaml(clip);
            expect(result.edges.length).toBe(1);
            expect(result.edges[0].source_node).toBe('n1');
            expect(result.edges[0].target_node).toBe('n2');
            expect(result.edges[0].source_port).toBe('output');
            expect(result.edges[0].target_port).toBe('input');
        });
    });
});

describe('WorkflowCore', () => {
    let core;

    beforeEach(() => {
        core = new WorkflowCore();
    });

    describe('constructor', () => {
        it('should initialize with empty state', () => {
            expect(core.nodes).toEqual([]);
            expect(core.edges).toEqual([]);
            expect(core.nodeIdCounter).toBe(100000);
            expect(core.edgeIdCounter).toBe(100000);
            expect(core.selectedNode).toBeNull();
            expect(core.selectedEdge).toBeNull();
            expect(core.history).toEqual([]);
            expect(core.historyIndex).toBe(-1);
            expect(core.maxHistory).toBe(50);
        });

        it('should have mixin methods', () => {
            expect(typeof core.importWorkflow).toBe('function');
            expect(typeof core.exportWorkflow).toBe('function');
        });
    });

    describe('onChange callback', () => {
        it('should set and call onChange', () => {
            const spy = jest.fn();
            core.onChange = spy;
            core.createNode('start', 0, 0);
            expect(spy).toHaveBeenCalledWith('addNode', expect.any(Object));
        });

        it('should not call onChange when not set', () => {
            expect(() => core.createNode('start', 0, 0)).not.toThrow();
        });
    });

    describe('batchChanges', () => {
        it('should batch multiple operations and emit once', () => {
            const spy = jest.fn();
            core.onChange = spy;

            core.batchChanges(() => {
                core.createNode('start', 0, 0);
                core.createNode('end', 200, 0);
            });

            expect(core.nodes.length).toBe(2);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('batch', null);
        });

        it('should still emit changes even if callback throws', () => {
            const spy = jest.fn();
            core.onChange = spy;

            expect(() => {
                core.batchChanges(() => {
                    core.createNode('start', 0, 0);
                    throw new Error('test error');
                });
            }).toThrow('test error');

            expect(spy).toHaveBeenCalledWith('batch', null);
            expect(core.nodes.length).toBe(1);
        });
    });

    describe('nodeTypeInfo', () => {
        it('should return node type info', () => {
            const info = core.nodeTypeInfo;
            expect(info).toBeDefined();
            expect(typeof info).toBe('object');
        });
    });

    describe('_getDefaultParameters', () => {
        it('should return defaults for known types', () => {
            const params = core._getDefaultParameters('start');
            expect(typeof params).toBe('object');
        });

        it('should return empty object for unknown types', () => {
            const params = core._getDefaultParameters('nonexistent_type');
            expect(params).toEqual({});
        });
    });

    describe('createNode', () => {
        it('should create a node with all required properties', () => {
            const node = core.createNode('start', 100, 200);
            expect(node.type).toBe('start');
            expect(node.x).toBe(100);
            expect(node.y).toBe(200);
            expect(node.id).toMatch(/^node_\d+$/);
            expect(node.title).toBe('开始');
        });

        it('should assign incremental IDs starting from 100001', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 100, 100);
            expect(n1.id).not.toBe(n2.id);
            expect(n1.id).toBe('node_100001');
            expect(n2.id).toBe('node_100002');
        });

        it('should merge custom data when provided', () => {
            const node = core.createNode('llm', 50, 50, { title: 'Custom LLM', description: 'Test desc' });
            expect(node.title).toBe('Custom LLM');
            expect(node.description).toBe('Test desc');
        });

        it('should provide fallback values for unknown node types', () => {
            const node = core.createNode('nonexistent', 0, 0);
            expect(node.title).toBe('未知节点');
            expect(node.icon).toBeUndefined();
        });
    });

    describe('addNode', () => {
        it('should add a node directly', () => {
            const nodeData = { id: 'node_test', type: 'start', x: 0, y: 0, title: 'Test' };
            const result = core.addNode(nodeData);
            expect(result).toBe(nodeData);
            expect(core.nodes).toContain(nodeData);
        });

        it('should emit addNode event', () => {
            const spy = jest.fn();
            core.onChange = spy;
            core.addNode({ id: 'n1', type: 'start', x: 0, y: 0 });
            expect(spy).toHaveBeenCalledWith('addNode', expect.any(Object));
        });
    });

    describe('deleteNode', () => {
        it('should remove node and its connected edges', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            core.createEdge(n1.id, n2.id);

            expect(core.nodes.length).toBe(2);
            expect(core.edges.length).toBe(1);

            core.deleteNode(n1.id);
            expect(core.nodes.length).toBe(1);
            expect(core.edges.length).toBe(0);
        });

        it('should be safe to call with non-existent id', () => {
            const n1 = core.createNode('start', 0, 0);
            core.deleteNode('nonexistent');
            expect(core.nodes.length).toBe(1);
        });

        it('should clear selectedNode when deleting selected node', () => {
            const n1 = core.createNode('start', 0, 0);
            core.selectNode(n1.id);
            expect(core.selectedNode).toBe(n1.id);
            core.deleteNode(n1.id);
            expect(core.selectedNode).toBeNull();
        });
    });

    describe('getChildNodes', () => {
        it('should return child nodes by parentId', () => {
            core.addNode({ id: 'parent', type: 'loop', x: 0, y: 0 });
            core.addNode({ id: 'child1', type: 'code', x: 10, y: 10, parentId: 'parent' });
            core.addNode({ id: 'child2', type: 'code', x: 20, y: 20, parentId: 'parent' });
            core.addNode({ id: 'orphan', type: 'code', x: 30, y: 30 });

            const children = core.container.getChildren('parent');
            expect(children).toHaveLength(2);
            expect(children[0].id).toBe('child1');
            expect(children[1].id).toBe('child2');
        });

        it('should return empty array for node without children', () => {
            core.addNode({ id: 'single', type: 'start', x: 0, y: 0 });
            expect(core.container.getChildren('single')).toEqual([]);
        });
    });

    describe('isContainerNode', () => {
        it('should return false for non-existent node', () => {
            expect(core.container.isContainer('nonexistent')).toBe(false);
        });

        it('should return false for non-container types', () => {
            core.addNode({ id: 'n1', type: 'start', x: 0, y: 0 });
            expect(core.container.isContainer('n1')).toBe(false);
        });

        it('should return true for loop container', () => {
            core.addNode({ id: 'loop1', type: 'loop', x: 0, y: 0 });
            expect(core.container.isContainer('loop1')).toBe(true);
        });
    });

    describe('updateNodePosition', () => {
        it('should update node position', () => {
            const n1 = core.createNode('start', 0, 0);
            core.updateNodePosition(n1.id, 100, 200);
            expect(n1.x).toBe(100);
            expect(n1.y).toBe(200);
        });

        it('should not throw for non-existent node', () => {
            expect(() => core.updateNodePosition('nonexistent', 0, 0)).not.toThrow();
        });
    });

    describe('updateNodeProperty', () => {
        it('should update node property', () => {
            const n1 = core.createNode('start', 0, 0);
            core.updateNodeProperty(n1.id, 'title', 'New Title');
            expect(n1.title).toBe('New Title');
        });

        it('should not throw for non-existent node', () => {
            expect(() => core.updateNodeProperty('nonexistent', 'title', 'x')).not.toThrow();
        });
    });

    describe('createEdge', () => {
        it('should create a connection between two nodes', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            const edge = core.createEdge(n1.id, n2.id);

            expect(edge.source).toBe(n1.id);
            expect(edge.target).toBe(n2.id);
            expect(edge.id).toMatch(/^edge_\d+$/);
        });

        it('should reject duplicate connections', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            core.createEdge(n1.id, n2.id);
            const dup = core.createEdge(n1.id, n2.id);

            expect(dup).toBeNull();
            expect(core.edges.length).toBe(1);
        });

        it('should create edge with port IDs', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            const edge = core.createEdge(n1.id, n2.id, 'p1', 'p2');

            expect(edge.sourcePort).toBe('p1');
            expect(edge.targetPort).toBe('p2');
        });

        it('should reject duplicate connections with same ports', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            core.createEdge(n1.id, n2.id, 'p1', 'p2');
            const dup = core.createEdge(n1.id, n2.id, 'p1', 'p2');
            expect(dup).toBeNull();
        });

        it('should allow connections with different ports', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            core.createEdge(n1.id, n2.id, 'p1', 'p2');
            const edge = core.createEdge(n1.id, n2.id, 'p3', 'p4');
            expect(edge).not.toBeNull();
            expect(core.edges.length).toBe(2);
        });
    });

    describe('addEdge', () => {
        it('should add an edge directly', () => {
            const edgeData = { id: 'edge_1', source: 'n1', target: 'n2' };
            const result = core.addEdge(edgeData);
            expect(result).toBe(edgeData);
            expect(core.edges).toContain(edgeData);
        });

        it('should reject duplicate edges', () => {
            core.addEdge({ id: 'e1', source: 'n1', target: 'n2' });
            const dup = core.addEdge({ id: 'e2', source: 'n1', target: 'n2' });
            expect(dup).toBeNull();
            expect(core.edges.length).toBe(1);
        });
    });

    describe('deleteEdge', () => {
        it('should remove the specified edge only', async () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            const n3 = core.createNode('llm', 100, 100);
            const e1 = core.createEdge(n1.id, n2.id);
            await new Promise((r) => setTimeout(r, 1)); // avoid Date.now() collision
            core.createEdge(n1.id, n3.id);

            core.deleteEdge(e1.id);
            expect(core.edges.length).toBe(1);
            expect(core.edges[0].source).toBe(n1.id);
            expect(core.edges[0].target).toBe(n3.id);
        });

        it('should clear selectedEdge when deleting selected edge', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            const edge = core.createEdge(n1.id, n2.id);
            core.selectEdge(edge.id);
            expect(core.selectedEdge).toBe(edge.id);
            core.deleteEdge(edge.id);
            expect(core.selectedEdge).toBeNull();
        });
    });

    describe('selectNode', () => {
        it('should select a node and clear edge selection', () => {
            core.selectNode('node_1');
            expect(core.selectedNode).toBe('node_1');
            expect(core.selectedEdge).toBeNull();
        });

        it('should clear selection with null', () => {
            core.selectNode('node_1');
            core.selectNode(null);
            expect(core.selectedNode).toBeNull();
        });
    });

    describe('selectEdge', () => {
        it('should select an edge and clear node selection', () => {
            core.selectEdge('edge_1');
            expect(core.selectedEdge).toBe('edge_1');
            expect(core.selectedNode).toBeNull();
        });

        it('should clear selection with null', () => {
            core.selectEdge('edge_1');
            core.selectEdge(null);
            expect(core.selectedEdge).toBeNull();
        });
    });

    describe('clearAll', () => {
        it('should clear all nodes and edges', () => {
            const n1 = core.createNode('start', 0, 0);
            const n2 = core.createNode('end', 200, 0);
            core.createEdge(n1.id, n2.id);
            core.selectNode(n1.id);

            core.clearAll();
            expect(core.nodes).toEqual([]);
            expect(core.edges).toEqual([]);
            expect(core.selectedNode).toBeNull();
            expect(core.selectedEdge).toBeNull();
        });

        it('should emit clearAll event', () => {
            const spy = jest.fn();
            core.onChange = spy;
            core.clearAll();
            expect(spy).toHaveBeenCalled();
            expect(spy.mock.calls[0][0]).toBe('clearAll');
        });
    });

    describe('getTypeNumber', () => {
        it('should return type number for known type', () => {
            expect(core.getTypeNumber('start')).toBe('1');
            expect(core.getTypeNumber('end')).toBe('2');
            expect(core.getTypeNumber('llm')).toBe('3');
        });

        it('should return default for unknown type', () => {
            expect(core.getTypeNumber('unknown')).toBe('4');
        });
    });

    describe('getTypeFromNumber', () => {
        it('should return type name from number', () => {
            expect(core.getTypeFromNumber('1')).toBe('start');
            expect(core.getTypeFromNumber('2')).toBe('end');
            expect(core.getTypeFromNumber('3')).toBe('llm');
        });

        it('should throw for unknown type number', () => {
            expect(() => core.getTypeFromNumber('99999')).toThrow('Unknown node type number');
        });
    });

    describe('saveHistory / undo / redo', () => {
        it('should capture state snapshots on save', () => {
            const node = core.createNode('start', 0, 0);
            core.saveHistory('创建节点');

            expect(core.history.length).toBeGreaterThan(0);
            const last = core.history[core.history.length - 1];
            expect(last.actionKey).toBe('创建节点');
            expect(last.nodes.length).toBe(1);
        });

        it('should restore previous state on undo', () => {
            core.saveHistory('初始');
            core.createNode('start', 0, 0);
            core.saveHistory('创建');

            expect(core.nodes.length).toBe(1);

            core.undo();
            expect(core.nodes.length).toBe(0);

            core.redo();
            expect(core.nodes.length).toBe(1);
        });

        it('should cap history at max limit (50)', () => {
            for (let i = 0; i < 60; i++) {
                core.saveHistory('op ' + i);
            }
            expect(core.history.length).toBeLessThanOrEqual(50);
        });

        it('should be safe to undo at history boundary', () => {
            core.saveHistory('only');
            core.undo();
            expect(core.history.length).toBe(1);
        });
    });

    describe('validate', () => {
        it('should report missing start and end for empty workflow', () => {
            const result = core.validate();
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('缺少开始节点');
            expect(result.errors).toContain('缺少结束节点');
        });

        it('should pass when start and end are connected', () => {
            core.createNode('start', 0, 0);
            core.createNode('end', 200, 0);
            core.createEdge(core.nodes[0].id, core.nodes[1].id);

            const result = core.validate();
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should warn about disconnected orphan nodes', () => {
            core.createNode('start', 0, 0);
            core.createNode('end', 200, 0);
            core.createNode('llm', 400, 0);
            core.createEdge(core.nodes[0].id, core.nodes[1].id);

            const result = core.validate();
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should warn about multiple start nodes', () => {
            core.createNode('start', 0, 0);
            core.createNode('start', 100, 0);
            core.createNode('end', 200, 0);

            const result = core.validate();
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should return valid result with empty message', () => {
            core.createNode('start', 0, 0);
            core.createNode('end', 200, 0);
            core.createEdge(core.nodes[0].id, core.nodes[1].id);

            const result = core.validate();
            expect(result.valid).toBe(true);
            expect(result.message).toBe('');
        });
    });

    describe('resetHistory', () => {
        it('should reset history and save initial state', () => {
            core.createNode('start', 0, 0);
            core.saveHistory('created');
            expect(core.history.length).toBe(1);

            core.resetHistory('init');
            expect(core.history.length).toBe(1);
            expect(core.history[0].actionKey).toBe('init');
        });
    });

    describe('canUndo / canRedo', () => {
        it('should return false when no history', () => {
            expect(core.canUndo()).toBe(false);
            expect(core.canRedo()).toBe(false);
        });

        it('should return true after saveHistory', () => {
            core.resetHistory('init');
            expect(core.canUndo()).toBe(false);
            core.createNode('start', 0, 0);
            core.saveHistory('create');
            expect(core.canUndo()).toBe(true);
        });
    });
});

describe('Highlighter', () => {
    describe('highlightJson', () => {
        it('should wrap keys and string values in span tags', () => {
            const result = highlightJson('{"name": "test"}');
            expect(result).toContain('<span class="hl-key">');
            expect(result).toContain('<span class="hl-string">');
        });

        it('should handle invalid JSON by escaping', () => {
            const result = highlightJson('{invalid}');
            expect(result).toContain('{invalid}');
            expect(result).not.toContain('<span class="hl-');
        });

        it('should produce safe HTML output', () => {
            const result = highlightJson('{"key": "value"}');
            expect(result).not.toContain('</script>');
            expect(result).toContain('<span class="hl-key">');
            expect(typeof result).toBe('string');
        });
    });

    describe('highlightYaml', () => {
        it('should highlight list items', () => {
            const result = highlightYaml('- item1');
            expect(result).toContain('<span class="hl-list">- </span>');
        });

        it('should produce safe HTML output', () => {
            const result = highlightYaml('- item1');
            expect(result).not.toContain('</script>');
            expect(typeof result).toBe('string');
        });
    });
});
