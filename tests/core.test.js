import { StringUtils } from '../src/utils/helpers.js';
import { convertClipboardToYaml } from '../src/modules/reverse.js';
import { WorkflowCore } from '../src/modules/workflow-core.js';
import { highlightJson, highlightYaml } from '../src/modules/highlighter.js';

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
    expect(StringUtils.escapeHtml("it's fine")).toBe("it's fine");
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
          edges: []
        },
        source: { workflowId: '123456' }
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
        source: { workflowId: '789' }
      };

      const result = convertClipboardToYaml(clip);
      expect(result.name).toBe('imported_workflow');
    });

    it('should ensure workflow id is a string', () => {
      const clip = {
        type: 'coze-workflow-clipboard-data',
        json: { name: 'test', nodes: [], edges: [] },
        source: { workflowId: 999 }
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
                outputs: []
              }
            }
          ],
          edges: []
        },
        source: { workflowId: 'test_1' }
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
            { id: 'node_1', type: '2', data: { nodeMeta: { title: 'End', icon: '', description: '' }, inputs: {}, outputs: [] } }
          ],
          edges: []
        },
        source: { workflowId: 'test_2' }
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
          edges: [
            { sourceNodeID: 'n1', targetNodeID: 'n2', sourcePortID: 'output', targetPortID: 'input' }
          ]
        },
        source: { workflowId: 'test_3' }
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
  });

  describe('deleteEdge', () => {
    it('should remove the specified edge only', async () => {
      const n1 = core.createNode('start', 0, 0);
      const n2 = core.createNode('end', 200, 0);
      const n3 = core.createNode('llm', 100, 100);
      const e1 = core.createEdge(n1.id, n2.id);
      await new Promise(r => setTimeout(r, 1)); // avoid Date.now() collision
      core.createEdge(n1.id, n3.id);

      core.deleteEdge(e1.id);
      expect(core.edges.length).toBe(1);
      expect(core.edges[0].source).toBe(n1.id);
      expect(core.edges[0].target).toBe(n3.id);
    });
  });

  describe('saveHistory / undo / redo', () => {
    it('should capture state snapshots on save', () => {
      const node = core.createNode('start', 0, 0);
      core.saveHistory('创建节点');

      expect(core.history.length).toBeGreaterThan(0);
      const last = core.history[core.history.length - 1];
      expect(last.action).toBe('创建节点');
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