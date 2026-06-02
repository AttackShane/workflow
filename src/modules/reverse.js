import { REV_TYPE_MAP } from '../utils/types.js';
import { validateClipboardInput, convertEdgesReverse } from '../utils/utils.js';

const TYPE_PARAMS_MAP = {
    code: ['code', 'language'],
    llm: ['llmParam'],
    image_generate: ['modelSetting', 'prompt', 'references'],
    video_generation: ['duration', 'model', 'prompt', 'cameraFixed', 'generateAudio', 'generateMode', 'firstFrame', 'ratio', 'resolution', 'seed', 'watermark', 'dynamicParameters'],
    condition: ['branches'],
    plugin: ['apiParam'],
    loop: ['loopType', 'loopCount', 'loopItems', 'iterationVariable', 'variableParameters'],
    batch: ['batchSize', 'concurrentSize'],
    comment: ['note', 'schemaType'],
    text: ['concatParams', 'method'],
    variable_merge: ['mergeGroups'],
    variable_assign: ['variableName', 'variableValue'],
    http: ['url', 'method', 'headers', 'body', 'authType', 'authParams'],
    knowledge: ['knowledgeBaseId', 'query', 'topK'],
    intent: ['intentConfig'],
    async_task: ['taskConfig'],
    question: ['llmParam', 'extra_output', 'answer_type', 'option_type', 'dynamic_option', 'options', 'limit'],
    output: ['streamingOutput', 'callTransferVoice', 'chatHistoryWriting', 'content'],
    input: ['outputSchema'],
    common: ['settingOnError']
};

function convertValue(val, options = {}) {
    const { keepLiteral = false, keepRawMeta = false } = options;
    
    if (val === null || val === undefined) return null;
    
    // 处理字符串类型 - 添加特殊字符转义
    if (typeof val === 'string') {
        if (val === '') return '';
        // 如果包含换行符，不使用双引号，让 js-yaml 自动使用块字面量语法
        // 因为 escapeYamlString 会把实际换行符转义为 \n，导致行数不匹配
        if (val.includes('\n')) {
            return val;
        }
        if (needsDoubleQuotes(val)) {
            return `"${escapeYamlString(val)}"`;
        }
        return val;
    }
    
    if (typeof val !== 'object') return val;
    
    // 处理引用类型
    if (val.type === 'ref' && val.content) {
        const result = { path: val.content.name, ref_node: val.content.blockID };
        if (val.content.source) result.source = val.content.source;
        return result;
    }
    
    // 处理字面量类型 - 默认直接返回内容，不包装
    if (val.type === 'literal') {
        if (keepLiteral) {
            return keepRawMeta && val.rawMeta 
                ? { type: 'literal', content: val.content, rawMeta: val.rawMeta }
                : { type: 'literal', content: val.content };
        }
        // 对字面量内容进行转义处理
        const content = val.content;
        if (typeof content === 'string') {
            if (content === '') return '';
            if (needsDoubleQuotes(content)) {
                return `"${escapeYamlString(content)}"`;
            }
        }
        return content;
    }
    
    // 递归处理对象和数组
    if (Array.isArray(val)) {
        return val.map(v => convertValue(v, options));
    }
    
    // 处理普通对象
    const result = {};
    for (const key in val) {
        if (val.hasOwnProperty(key)) {
            result[key] = convertValue(val[key], options);
        }
    }
    return result;
}

function buildOutputDefinition(o) {
    // 处理循环/批处理节点的输出结构（使用 input 字段）
    if (o.input) {
        const input = o.input;
        const def = { type: input.type || 'string', required: o.required || false, description: o.description || '' };
        
        if (input.type === 'list' && input.schema) {
            def.items = { type: input.schema.type || 'string' };
        }
        
        // 处理引用值
        if (input.value && input.value.type === 'ref' && input.value.content) {
            def.value = {
                path: input.value.content.name,
                ref_node: input.value.content.blockID,
                source: input.value.content.source
            };
        } else {
            def.value = null;
        }
        
        return def;
    }
    
    // 处理普通输出结构
    const def = { type: o.type || 'string', required: o.required || false, description: o.description || '' };
    if (o.defaultValue !== undefined) def.default_value = o.defaultValue;
    if (o.schema) {
        def.items = { type: o.schema.type || 'string' };
        if (o.schema.properties) {
            def.items.properties = o.schema.properties;
            Object.keys(def.items.properties).forEach(key => {
                if (def.items.properties[key].value === undefined) {
                    def.items.properties[key].value = null;
                }
            });
        }
    }
    // 添加 value 字段（用于引用）
    if (o.value === null || o.value) {
        def.value = o.value;
    } else {
        def.value = null;
    }
    return def;
}

function revNode(node) {
    const id = String(node.id);
    const type = REV_TYPE_MAP[node.type] || `unknown_${node.type}`;
    
    const pos = node.meta?.position || { x: 0, y: 0 };
    const yNode = {
        id, 
        type,
        title: node.data?.nodeMeta?.title || '',
        icon: node.data?.nodeMeta?.icon || '',
        description: node.data?.nodeMeta?.description || '',
        position: {
            x: typeof pos.x === 'number' ? pos.x : 0,
            y: typeof pos.y === 'number' ? pos.y : 0
        }
    };
    
    // 处理 canvasPosition
    if (node.meta?.canvasPosition) yNode.canvas_position = node.meta.canvasPosition;
    
    // 处理节点颜色
    if (node.data?.nodeMeta?.mainColor) yNode.color = node.data.nodeMeta.mainColor;
    
    const params = {};
    const data = node.data || {};

    // 处理输入参数 - 只有当有内容时才添加
    if (data.inputs?.inputParameters && Array.isArray(data.inputs.inputParameters) && data.inputs.inputParameters.length > 0) {
        params.node_inputs = data.inputs.inputParameters.map(ip => ({
            name: ip.name,
            input: { 
                type: ip.input?.type || 'literal', 
                value: convertValue(ip.input?.value) 
            }
        }));
    }
    
    // 处理输出参数 - 保持与原始一致的结构
    if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
        params.node_outputs = {};
        data.outputs.forEach(o => {
            params.node_outputs[o.name] = buildOutputDefinition(o);
        });
    }
    
    // 处理特定类型参数 - 针对 llmParam 等复杂参数进行特殊处理
    (TYPE_PARAMS_MAP[type] || []).forEach(param => {
        if (data.inputs?.[param] !== undefined) {
            const rawValue = data.inputs[param];
            if (Array.isArray(rawValue) && param === 'llmParam') {
                // 处理 llm 节点的 llmParam（数组形式）
                params[param] = rawValue.map(item => ({
                    name: item.name,
                    input: {
                        type: item.input?.type || 'literal',
                        value: convertValue(item.input?.value)
                    }
                }));
            } else if (param === 'llmParam' && typeof rawValue === 'object' && rawValue !== null) {
                // 处理问答节点的 llmParam（对象形式）
                params[param] = convertValue(rawValue);
            } else if ((type === 'loop' && (param === 'loopCount' || param === 'loopItems')) || 
                   (type === 'batch' && (param === 'batchSize' || param === 'concurrentSize'))) {
                // 处理循环节点的 loopCount/loopItems 和批处理节点的 batchSize/concurrentSize
                if (rawValue.type && rawValue.value !== undefined) {
                    // 结构：{ type: "integer", value: { type: "literal", content: 0, rawMeta: {...} } }
                    params[param] = {
                        type: rawValue.type,
                        value: convertValue(rawValue.value, { keepLiteral: true, keepRawMeta: true })
                    };
                } else {
                    params[param] = convertValue(rawValue, { keepLiteral: true, keepRawMeta: true });
                }
            } else {
                params[param] = convertValue(rawValue);
            }
        }
    });
    
    // 处理公共参数
    TYPE_PARAMS_MAP.common.forEach(param => {
        if (data.inputs?.[param] !== undefined) {
            params[param] = convertValue(data.inputs[param]);
        }
    });
    
    // 处理特殊节点类型
    if (type === 'end' && data.inputs?.terminatePlan !== undefined) {
        params.terminatePlan = convertValue(data.inputs.terminatePlan);
    }
    if (type === 'comment' && data.size !== undefined) {
        yNode.size = data.size;
    }
    
    // 处理嵌套节点（循环/批处理）
    if (node.blocks?.length) {
        yNode.nodes = node.blocks.map(b => revNode(b));
    }
    
    // 处理边
    if (node.edges?.length) {
        yNode.edges = node.edges.map(e => {
            const edge = {
                source_node: String(e.sourceNodeID), 
                target_node: String(e.targetNodeID)
            };
            if (e.sourcePortID !== undefined) edge.source_port = String(e.sourcePortID);
            if (e.targetPortID !== undefined) edge.target_port = String(e.targetPortID);
            return edge;
        });
    }
    
    // 只有当 params 有内容时才添加
    if (Object.keys(params).length > 0) {
        yNode.parameters = params;
    }
    
    return yNode;
}

// YAML 特殊字符转义（不包含外层双引号，由调用者添加）
function escapeYamlString(str) {
    // 处理逻辑：
    // 1. 先转义反斜杠，确保字面的 \n 变成 \\n
    // 2. 然后处理实际的特殊字符（实际的换行、回车、制表符）
    // 
    // 在 JavaScript 中：
    // - '\n' 是实际换行符（1个字符）
    // - '\\n' 是字面的反斜杠+n（2个字符）
    // 
    // 在 YAML 双引号字符串中：
    // - '\n' 会被解析为换行符
    // - '\\n' 会被解析为字面的反斜杠+n
    // - '\\\\n' 会被解析为字面的 \\n
    // 
    // 所以需要：
    // - 实际换行符 '\n' -> 转义为 '\\n'（在 YAML 中表示换行）
    // - 字面的 '\\n' -> 转义为 '\\\\n'（在 YAML 中表示字面的 \n）
    
    // 1. 先转义所有反斜杠
    let result = str.replace(/\\/g, '\\\\');
    
    // 2. 然后处理实际的特殊字符
    const escapeMap = {
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '"': '\\"'
    };
    return result.replace(/[\n\r\t"]/g, match => escapeMap[match]);
}

// 判断是否需要双引号
function needsDoubleQuotes(str) {
    // 只匹配 YAML 中真正需要双引号的字符（不包括换行符，换行符使用块字面量）
    // 包括：冒号（在值中）、井号、双引号、反斜杠、制表符
    const specialChars = /[:#"\\\t]/;
    return specialChars.test(str);
}

// 判断是否应该使用块字面量（包含换行符的长字符串）
function needsBlockLiteral(str) {
    return str.includes('\n');
}

// 判断是否包含字面转义序列（如 \n, \t 等）
function hasEscapeSequence(str) {
    // 匹配字面的转义序列（反斜杠后跟字符）
    const escapeSequence = /\\[nrt\\"]/;
    return escapeSequence.test(str);
}

export function convertClipboardToYaml(clip) {
    validateClipboardInput(clip);
    const json = clip.json;
    return {
        schema_version: "1.0.0",
        name: json.name || "imported_workflow",
        id: String(clip.source.workflowId),
        nodes: json.nodes.map(n => revNode(n)),
        edges: convertEdgesReverse(json.edges)
    };
}