import { convertYamlToClipboard, convertNode } from '../src/modules/converter.js';
import { clearRefCache } from '../src/utils/types.js';

describe('Converter Module', () => {
  afterEach(() => {
    clearRefCache();
  });

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

    it('should handle canvas_position', () => {
      const node = {
        id: 'node_canvas',
        type: 'start',
        title: '带画布位置',
        position: { x: 100, y: 200 },
        canvas_position: { x: 500, y: 600 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.meta.canvasPosition).toEqual({ x: 500, y: 600 });
    });

    it('should convert code node', () => {
      const node = {
        id: 'node_code',
        type: 'code',
        title: '代码节点',
        position: { x: 200, y: 200 },
        parameters: { code: 'console.log("hello")' }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_code');
      expect(result.data.nodeMeta.title).toBe('代码节点');
    });

    it('should convert loop node', () => {
      const node = {
        id: 'node_loop',
        type: 'loop',
        title: '循环',
        position: { x: 200, y: 200 },
        parameters: { count: 5 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_loop');
      expect(result.data.nodeMeta.title).toBe('循环');
    });

    it('should convert if node', () => {
      const node = {
        id: 'node_if',
        type: 'if',
        title: '条件',
        position: { x: 200, y: 200 },
        parameters: { condition: 'a > b' }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_if');
      expect(result.data.nodeMeta.title).toBe('条件');
    });

    it('should convert node with icon', () => {
      const node = {
        id: 'node_icon',
        type: 'plugin',
        title: '插件',
        position: { x: 100, y: 100 },
        icon: 'https://example.com/icon.png',
        parameters: {}
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.data.nodeMeta.icon).toBe('https://example.com/icon.png');
      expect(result._temp.externalData.icon).toBe('https://example.com/icon.png');
    });

    it('should convert node with description', () => {
      const node = {
        id: 'node_desc',
        type: 'llm',
        title: 'AI',
        description: '这是一个AI节点',
        position: { x: 100, y: 100 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.data.nodeMeta.description).toBe('这是一个AI节点');
      expect(result._temp.externalData.description).toBe('这是一个AI节点');
    });

    it('should convert node with empty description', () => {
      const node = {
        id: 'node_no_desc',
        type: 'start',
        title: '开始',
        position: { x: 0, y: 0 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.data.nodeMeta.description).toBe('');
    });

    it('should convert node type case-insensitively', () => {
      const node = {
        id: 'node_upper',
        type: 'START',
        title: '开始',
        position: { x: 0, y: 0 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.type).toBe('1');
    });

    it('should convert condition node', () => {
      const node = {
        id: 'node_cond',
        type: 'condition',
        title: '条件判断',
        position: { x: 200, y: 200 },
        parameters: {}
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_cond');
    });

    it('should convert variable node', () => {
      const node = {
        id: 'node_var',
        type: 'variable',
        title: '变量',
        position: { x: 200, y: 200 },
        parameters: {}
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_var');
    });

    it('should convert http node', () => {
      const node = {
        id: 'node_http',
        type: 'http',
        title: 'HTTP请求',
        position: { x: 200, y: 200 },
        parameters: { url: 'https://api.example.com', method: 'GET' }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_http');
      expect(result.data.nodeMeta.title).toBe('HTTP请求');
    });

    it('should convert knowledge node', () => {
      const node = {
        id: 'node_know',
        type: 'knowledge',
        title: '知识库',
        position: { x: 200, y: 200 },
        parameters: {}
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_know');
    });

    it('should convert break node', () => {
      const node = {
        id: 'node_break',
        type: 'break',
        title: '跳出',
        position: { x: 200, y: 200 },
        parameters: {}
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_break');
    });

    it('should convert text node', () => {
      const node = {
        id: 'node_text',
        type: 'text',
        title: '文本',
        position: { x: 200, y: 200 },
        parameters: { content: 'hello' }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_text');
    });

    it('should convert node with node_inputs', () => {
      const node = {
        id: 'node_input',
        type: 'llm',
        title: 'LLM',
        position: { x: 100, y: 100 },
        parameters: {
          node_inputs: {
            prompt: { name: 'prompt', type: 'string', value: 'hello' }
          }
        }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.id).toBe('node_input');
    });

    it('should convert node without title using default', () => {
      const node = {
        id: 'node_no_title',
        type: 'start',
        position: { x: 0, y: 0 }
      };
      const outputMap = new Map();
      const result = convertNode(node, outputMap);
      expect(result.data.nodeMeta.title).toBeDefined();
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

    it('should handle workflow with numeric id', () => {
      const yaml = {
        id: 12345,
        nodes: [
          { id: 'node_1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.source.workflowId).toBe('12345');
    });

    it('should throw error for invalid yaml input', () => {
      expect(() => convertYamlToClipboard(null)).toThrow();
      expect(() => convertYamlToClipboard(undefined)).toThrow();
      expect(() => convertYamlToClipboard({})).toThrow();
    });

    it('should throw enriched error with node info on conversion failure', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'bad_node', type: 1, title: 'Bad' }
        ],
        edges: []
      };
      try {
        convertYamlToClipboard(yaml, '');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.nodeInfo).toBeDefined();
        expect(e.nodeInfo.id).toBe('bad_node');
      }
    });

    it('should handle rawYaml for error line info', () => {
      const rawYaml = 'nodes:\n  - id: node_1\n    type: start\n    title: Start';
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'node_1', type: 'start', title: 'Start', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml, rawYaml);
      expect(result).toBeDefined();
      expect(result.type).toBe('coze-workflow-clipboard-data');
    });

    it('should handle workflow with name only (no id)', () => {
      const yaml = {
        name: 'Named Workflow',
        nodes: [
          { id: 'n1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.name).toBe('Named Workflow');
    });

    it('should handle workflow with neither name nor id', () => {
      const yaml = {
        nodes: [
          { id: 'n1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.name).toBe('imported_workflow');
      expect(result.source.workflowId).toBe('imported_workflow');
    });

    it('should handle node with edges in output', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'n1', type: 'start', title: '开始', position: { x: 0, y: 0 } },
          { id: 'n2', type: 'end', title: '结束', position: { x: 200, y: 0 } }
        ],
        edges: [
          { source_node: 'n1', target_node: 'n2' },
          { source_node: 'n1', target_node: 'n2', source_port: 'true', target_port: 'input' }
        ]
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.edges.length).toBe(2);
    });

    it('should correctly set flowMode, spaceId, isDouyin, host', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'n1', type: 'start', title: '开始', position: { x: 0, y: 0 } }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.source.flowMode).toBe(0);
      expect(result.source.spaceId).toBe('imported_space');
      expect(result.source.isDouyin).toBe(false);
      expect(result.source.host).toBe('www.coze.cn');
    });

    it('should handle plugin node with apiParam containing pluginName and apiName', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'plugin', title: 'Plugin', position: { x: 0, y: 0 },
            parameters: {
              apiParam: [
                { name: 'pluginName', input: { value: { content: 'MyPlugin' } } },
                { name: 'apiName', input: { value: { content: 'myApi' } } }
              ]
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].data.nodeMeta.subTitle).toBe('MyPlugin:myApi');
    });

    it('should handle plugin node with apiParam containing pluginID', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'plugin', title: 'Plugin', position: { x: 0, y: 0 },
            parameters: {
              apiParam: [
                { name: 'pluginID', input: { value: { content: 'pid_123' } } }
              ]
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0]._temp.externalData.pluginID).toBeDefined();
    });

    it('should handle node with canvas_position', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'start', title: 'Start', position: { x: 100, y: 200 },
            canvas_position: { x: 500, y: 600 }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].meta.canvasPosition).toEqual({ x: 500, y: 600 });
    });

    it('should handle node with nested blocks', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'loop', title: 'Loop', position: { x: 0, y: 0 },
            parameters: { loopCount: 3 },
            nodes: [
              { id: 'n2', type: 'code', title: 'Inner', position: { x: 50, y: 50 }, parameters: { code: 'print(1)' } }
            ]
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].blocks).toBeDefined();
      expect(result.json.nodes[0].blocks.length).toBe(1);
      expect(result.json.nodes[0].blocks[0].data.nodeMeta.title).toBe('Inner');
    });

    it('should handle node with internal edges', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'loop', title: 'Loop', position: { x: 0, y: 0 },
            edges: [
              { source_node: 'n2', target_node: 'n3', source_port: 'output', target_port: 'input' }
            ]
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].edges).toBeDefined();
      expect(result.json.nodes[0].edges.length).toBe(1);
    });

    it('should handle node with sorted outputs', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'question', title: 'Question', position: { x: 0, y: 0 },
            parameters: {
              question: 'What?',
              options: ['A', 'B']
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].data.outputs).toBeDefined();
    });

    it('should handle findNodeLineInYaml via error with rawYaml', () => {
      const rawYaml = 'nodes:\n  - id: bad_node\n    type: 1\n    title: Bad';
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'bad_node', type: 1, title: 'Bad' }
        ],
        edges: []
      };
      try {
        convertYamlToClipboard(yaml, rawYaml);
        fail('Should have thrown');
      } catch (e) {
        expect(e.nodeInfo).toBeDefined();
        expect(e.nodeInfo.line).toBe(4);
      }
    });

    it('should handle findNodeLineInYaml via error without rawYaml', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'bad_node', type: 1, title: 'Bad' }
        ],
        edges: []
      };
      try {
        convertYamlToClipboard(yaml);
        fail('Should have thrown');
      } catch (e) {
        expect(e.nodeInfo).toBeDefined();
        expect(e.nodeInfo.line).toBeNull();
      }
    });

    it('should handle findNodeLineInYaml by title', () => {
      const rawYaml = 'nodes:\n  - id: some_id\n    type: start\n    title: MyTitle';
      const yaml = {
        id: 'wf',
        nodes: [
          { id: 'some_id', type: 1, title: 'MyTitle' }
        ],
        edges: []
      };
      try {
        convertYamlToClipboard(yaml, rawYaml);
        fail('Should have thrown');
      } catch (e) {
        expect(e.nodeInfo).toBeDefined();
      }
    });

    it('should handle node with node_inputs as object', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'llm', title: 'LLM', position: { x: 0, y: 0 },
            parameters: {
              node_inputs: {
                prompt: { name: 'prompt', type: 'string', value: 'hello' }
              }
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].data.inputs).toBeDefined();
    });

    it('should handle node with knowledge_query type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'knowledge_query', title: 'Knowledge', position: { x: 0, y: 0 },
            parameters: {
              knowledgeBaseId: 'kb_1',
              query: 'search term',
              topK: 5
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('6');
    });

    it('should handle node with image_generate type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'image_generate', title: 'Image', position: { x: 0, y: 0 },
            parameters: {
              modelSetting: {},
              prompt: 'a cat',
              references: []
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('16');
    });

    it('should handle node with video_generation type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'video_generation', title: 'Video', position: { x: 0, y: 0 },
            parameters: {
              duration: 10,
              model: 'model1',
              prompt: 'generate'
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('65');
    });

    it('should handle node with question type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'question', title: 'Question', position: { x: 0, y: 0 },
            parameters: {
              question: 'What is your name?',
              options: ['A', 'B', 'C'],
              answer_type: 'single',
              option_type: 'text'
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('18');
    });

    it('should handle node with intent type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'intent', title: 'Intent', position: { x: 0, y: 0 },
            parameters: {
              intentConfig: {}
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('22');
    });

    it('should handle node with async_task type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'async_task', title: 'Async', position: { x: 0, y: 0 },
            parameters: {
              taskConfig: {}
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('72');
    });

    it('should handle node with input type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'input', title: 'Input', position: { x: 0, y: 0 },
            parameters: {
              outputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('30');
    });

    it('should handle node with variable_merge type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'variable_merge', title: 'Merge', position: { x: 0, y: 0 },
            parameters: {
              mergeGroups: [{ name: 'group1', variables: [] }]
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('32');
    });

    it('should handle node with loop_set_variable type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'loop_set_variable', title: 'SetVar', position: { x: 0, y: 0 },
            parameters: {
              variableName: 'v1',
              variableValue: 'hello'
            }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('20');
    });

    it('should handle node with canvas type', () => {
      const yaml = {
        id: 'wf',
        nodes: [
          {
            id: 'n1', type: 'canvas', title: 'Canvas', position: { x: 0, y: 0 }
          }
        ],
        edges: []
      };
      const result = convertYamlToClipboard(yaml);
      expect(result.json.nodes[0].type).toBe('23');
    });
  });
});