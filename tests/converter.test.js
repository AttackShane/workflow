import { convertYamlToClipboard, convertNode } from '../src/modules/converter.js';

describe('Converter Module', () => {
  describe('convertNode', () => {
    it('should convert a basic start node', () => {
      const node = {
        id: 'node_1',
        type: 'start',
        title: '开始节点',
        position: { x: 100, y: 100 }
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(result.id).toBe('node_1');
      expect(result.type).toBe('1');
      expect(result.meta.position).toEqual({ x: 100, y: 100 });
      expect(result.data.nodeMeta.title).toBe('开始节点');
    });

    it('should convert a basic end node', () => {
      const node = {
        id: 'node_2',
        type: 'end',
        title: '结束节点',
        position: { x: 300, y: 100 }
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(result.id).toBe('node_2');
      expect(result.type).toBe('2');
      expect(result.meta.position).toEqual({ x: 300, y: 100 });
    });

    it('should convert a LLM node', () => {
      const node = {
        id: 'node_3',
        type: 'llm',
        title: 'AI助手',
        position: { x: 200, y: 100 },
        parameters: {
          prompt: '你好',
          modelName: 'gpt-4'
        }
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(result.id).toBe('node_3');
      expect(result.type).toBe('3');
    });

    it('should handle nodes without position', () => {
      const node = {
        id: 'node_4',
        type: 'text',
        title: '文本节点'
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(result.meta.position).toEqual({ x: 0, y: 0 });
    });

    it('should convert node id to string', () => {
      const node = {
        id: 1234567890123,
        type: 'start',
        title: '开始'
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(typeof result.id).toBe('string');
      expect(result.id).toBe('1234567890123');
    });

    it('should convert comment node with note field', () => {
      const node = {
        id: 'node_comment_1',
        type: 'comment',
        title: '注释',
        position: { x: 100, y: 200 },
        note: '诶嘿'
      };
      const outputMap = new Map();
      
      const result = convertNode(node, outputMap);
      
      expect(result.type).toBe('31');
      expect(result.data.inputs).toEqual({
        schemaType: 'slate',
        note: '诶嘿'
      });
      expect(result.data.nodeMeta.title).toBe('注释');
      expect(result.data.outputs).toEqual([]);
    });
  });

  describe('convertYamlToClipboard', () => {
    it('should convert complete workflow', () => {
      const yaml = {
        id: 'workflow_001',
        name: '测试工作流',
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 0, y: 0 } },
          { id: 'node_2', type: 'end', title: '结束', position: { x: 200, y: 0 } }
        ],
        edges: [
          { source_node: 'node_1', target_node: 'node_2' }
        ]
      };
      
      const result = convertYamlToClipboard(yaml);
      
      expect(result.type).toBe('coze-workflow-clipboard-data');
      expect(result.source.workflowId).toBe('workflow_001');
      expect(result.json.name).toBe('测试工作流');
      expect(result.json.nodes.length).toBe(2);
      expect(result.json.edges.length).toBe(1);
    });

    it('should handle empty workflow name', () => {
      const yaml = {
        id: 'workflow_002',
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      
      const result = convertYamlToClipboard(yaml);
      
      expect(result.json.name).toBe('workflow_002');
    });

    it('should calculate bounds correctly', () => {
      const yaml = {
        id: 'workflow_003',
        name: '边界测试',
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 50, y: 50 } },
          { id: 'node_2', type: 'end', title: '结束', position: { x: 250, y: 150 } }
        ],
        edges: []
      };
      
      const result = convertYamlToClipboard(yaml);
      
      expect(result.bounds.x).toBeLessThan(50);
      expect(result.bounds.y).toBeLessThan(50);
      expect(result.bounds.width).toBeGreaterThan(200);
      expect(result.bounds.height).toBeGreaterThan(100);
    });

    it('should handle workflow without edges', () => {
      const yaml = {
        id: 'workflow_004',
        name: '无边工作流',
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 0, y: 0 } },
          { id: 'node_2', type: 'llm', title: 'AI', position: { x: 200, y: 0 } }
        ]
      };
      
      const result = convertYamlToClipboard(yaml);
      
      expect(result.json.edges).toEqual([]);
    });

    it('should handle workflow without id', () => {
      const yaml = {
        name: '无ID工作流',
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      
      const result = convertYamlToClipboard(yaml);
      
      expect(result.source.workflowId).toBe('imported_workflow');
    });
  });
});