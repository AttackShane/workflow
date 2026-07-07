import { REV_TYPE_MAP, NODE_DISPLAY_NAMES, NODE_COLORS } from './types.js';

/**
 * 错误类型常量
 */
export const ERROR_CODES = {
    EMPTY_INPUT: 'EMPTY_INPUT',
    INVALID_STRUCTURE: 'INVALID_STRUCTURE',
    INVALID_TYPE: 'INVALID_TYPE',
    MISSING_NODE_ID: 'MISSING_NODE_ID',
    MISSING_NODE_TYPE: 'MISSING_NODE_TYPE',
    INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
    DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
    INVALID_EDGE: 'INVALID_EDGE',
    CYCLIC_REFERENCE: 'CYCLIC_REFERENCE',
    YAML_PARSE_ERROR: 'YAML_PARSE_ERROR',
    JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
    INVALID_PARAMETER: 'INVALID_PARAMETER',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD'
};

/**
 * 错误消息模板
 */
export const ERROR_MESSAGES = {
    [ERROR_CODES.EMPTY_INPUT]: '输入内容为空，请提供有效的数据',
    [ERROR_CODES.INVALID_STRUCTURE]: '数据结构无效：{details}',
    [ERROR_CODES.INVALID_TYPE]: '数据类型不正确，期望类型：{expected}',
    [ERROR_CODES.MISSING_NODE_ID]: '节点缺少id字段（第{index}个节点）',
    [ERROR_CODES.MISSING_NODE_TYPE]: '节点"{nodeId}"缺少type字段',
    [ERROR_CODES.INVALID_NODE_TYPE]: '节点"{nodeId}"的类型"{type}"无效',
    [ERROR_CODES.DUPLICATE_NODE_ID]: '发现重复的节点ID："{nodeId}"',
    [ERROR_CODES.INVALID_EDGE]: '边连接无效：{source} → {target}',
    [ERROR_CODES.CYCLIC_REFERENCE]: '检测到循环引用',
    [ERROR_CODES.YAML_PARSE_ERROR]: 'YAML解析错误：{message}（行{line}，列{column}）',
    [ERROR_CODES.JSON_PARSE_ERROR]: 'JSON解析错误：{message}',
    [ERROR_CODES.INVALID_PARAMETER]: '参数"{param}"的值无效：{value}',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: '缺少必填字段：{field}'
};

/**
 * 转换错误类
 * 提供详细的错误定位信息和友好的错误消息
 */
export class ConversionError extends Error {
    /**
     * @param {string} message - 错误消息
     * @param {string} code - 错误代码
     * @param {object} [details] - 详细信息
     * @param {number} [line] - 行号
     * @param {number} [column] - 列号
     * @param {string} [nodeId] - 相关节点ID
     */
    constructor(message, code, details = null, line = null, column = null, nodeId = null) {
        super(message);
        this.name = 'ConversionError';
        this.code = code;
        this.details = details;
        this.line = line;
        this.column = column;
        this.nodeId = nodeId;
        this.timestamp = Date.now();
    }

    /**
     * 获取友好的错误消息
     * @returns {string} 格式化的错误消息
     */
    getFriendlyMessage() {
        const template = ERROR_MESSAGES[this.code] || this.message;
        return template.replace(/{(\w+)}/g, (match, key) => {
            if (key === 'details' && this.details) return JSON.stringify(this.details);
            if (key === 'nodeId') return this.nodeId || '未知';
            if (key === 'line') return this.line || '未知';
            if (key === 'column') return this.column || '未知';
            if (this.details && this.details[key] !== undefined) {
                return this.details[key];
            }
            return match;
        });
    }

    /**
     * 获取错误位置信息
     * @returns {string} 位置描述
     */
    getLocation() {
        const parts = [];
        if (this.line !== null) parts.push(`行 ${this.line}`);
        if (this.column !== null) parts.push(`列 ${this.column}`);
        if (this.nodeId) parts.push(`节点 ${this.nodeId}`);
        return parts.length ? `（${parts.join('，')}）` : '';
    }

    /**
     * 转换为JSON表示
     * @returns {object} JSON格式的错误信息
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            friendlyMessage: this.getFriendlyMessage(),
            line: this.line,
            column: this.column,
            nodeId: this.nodeId,
            details: this.details,
            timestamp: this.timestamp
        };
    }

    /**
     * 创建YAML解析错误
     * @param {Error} error - 原始错误
     * @returns {ConversionError} 转换错误实例
     */
    static fromYamlError(error) {
        let line = null;
        let column = null;
        let message = error.message;

        const lineMatch = error.message.match(/at line (\d+)/);
        const columnMatch = error.message.match(/column (\d+)/);
        
        if (lineMatch) line = parseInt(lineMatch[1], 10);
        if (columnMatch) column = parseInt(columnMatch[1], 10);

        if (/** @type {*} */(error).mark) {
            line = /** @type {*} */(error).mark.line + 1;
            column = /** @type {*} */(error).mark.column + 1;
        }

        return new ConversionError(
            message,
            ERROR_CODES.YAML_PARSE_ERROR,
            { originalError: error.message },
            line,
            column
        );
    }

    /**
     * 创建JSON解析错误
     * @param {Error} error - 原始错误
     * @returns {ConversionError} 转换错误实例
     */
    static fromJsonError(error) {
        return new ConversionError(
            error.message,
            ERROR_CODES.JSON_PARSE_ERROR,
            { originalError: error.message }
        );
    }
}

/**
 * 转换边数据
 * @param {Array} edges - 边数组
 * @returns {Array} 转换后的边数组
 */
export function convertEdges(edges) {
    if (!edges?.length) return [];
    return edges.map(e => ({
        sourceNodeID: String(e.source_node || e.sourceNodeID),
        targetNodeID: String(e.target_node || e.targetNodeID),
        ...(e.source_port !== undefined && { sourcePortID: String(e.source_port) }),
        ...(e.target_port !== undefined && { targetPortID: String(e.target_port) })
    }));
}

/**
 * 反向转换边数据
 * @param {Array} edges - 边数组
 * @returns {Array} 转换后的边数组
 */
export function convertEdgesReverse(edges) {
    if (!edges?.length) return [];
    return edges.map(e => ({
        source_node: e.sourceNodeID,
        target_node: e.targetNodeID,
        ...(e.sourcePortID && { source_port: e.sourcePortID }),
        ...(e.targetPortID && { target_port: e.targetPortID })
    }));
}

/**
 * 清理图标 URL 中的特殊字符
 * @param {string} icon - 图标 URL 字符串
 * @returns {string} 清理后的字符串
 */
export function cleanIcon(icon) {
    if (!icon) return "";
    return String(icon).replace(/[`'"\\]/g, '').trim();
}

/**
 * 在 YAML 字符串中，将大数字（超过安全整数范围）转换为字符串
 * @param {string} input - YAML 字符串
 * @returns {string} 处理后的 YAML 字符串
 */
export function convertLargeNumbersToStrings(input) {
    const idPattern = /(\b(id|ref_node|source_node|target_node)\s*:\s*)(\d{16,})/g;
    
    return input.replace(idPattern, (match, prefix, key, numStr) => {
        return `${prefix}"${numStr}"`;
    });
}

/**
 * 验证YAML输入数据
 * @param {object} yaml - YAML解析后的数据
 * @throws {ConversionError} 验证失败时抛出错误
 */
export function validateYamlInput(yaml) {
    if (!yaml) {
        throw new ConversionError('输入为空', ERROR_CODES.EMPTY_INPUT);
    }

    if (typeof yaml !== 'object') {
        throw new ConversionError(
            '无效的数据格式，期望对象类型',
            ERROR_CODES.INVALID_STRUCTURE,
            { expectedType: 'object', actualType: typeof yaml }
        );
    }

    if (!yaml.nodes || !Array.isArray(yaml.nodes)) {
        throw new ConversionError(
            '无效YAML:缺少nodes数组',
            ERROR_CODES.INVALID_STRUCTURE,
            { missingField: 'nodes', expectedType: 'array' }
        );
    }

    const nodeIds = new Set();

    for (let index = 0; index < yaml.nodes.length; index++) {
        const node = yaml.nodes[index];

        if (node.id === undefined || node.id === null) {
            throw new ConversionError(
                `节点缺少id字段（第${index + 1}个节点）`,
                ERROR_CODES.MISSING_NODE_ID,
                { nodeIndex: index },
                null,
                null,
                `node_${index + 1}`
            );
        }

        const nodeId = String(node.id);

        if (nodeIds.has(nodeId)) {
            throw new ConversionError(
                `发现重复的节点ID："${nodeId}"`,
                ERROR_CODES.DUPLICATE_NODE_ID,
                { duplicateId: nodeId, occurrences: Array.from(nodeIds).filter(id => id === nodeId).length + 1 },
                null,
                null,
                nodeId
            );
        }
        nodeIds.add(nodeId);

        if (!node.type) {
            throw new ConversionError(
                `节点"${nodeId}"缺少type字段`,
                ERROR_CODES.MISSING_NODE_TYPE,
                { nodeId },
                null,
                null,
                nodeId
            );
        }
    }

    if (yaml.edges && Array.isArray(yaml.edges)) {
        validateEdges(yaml.edges, nodeIds);
    }
}

/**
 * 验证边数据
 * @param {Array} edges - 边数组
 * @param {Set} nodeIds - 有效的节点ID集合
 * @throws {ConversionError} 验证失败时抛出错误
 */
export function validateEdges(edges, nodeIds) {
    for (const edge of edges) {
        const sourceNode = String(edge.source_node || edge.sourceNodeID);
        const targetNode = String(edge.target_node || edge.targetNodeID);

        if (!sourceNode) {
            throw new ConversionError(
                `边缺少源节点`,
                ERROR_CODES.INVALID_EDGE,
                { edge, missingField: 'source_node' }
            );
        }

        if (!targetNode) {
            throw new ConversionError(
                `边缺少目标节点`,
                ERROR_CODES.INVALID_EDGE,
                { edge, missingField: 'target_node' }
            );
        }

        if (!nodeIds.has(sourceNode)) {
            throw new ConversionError(
                `边连接到不存在的源节点：${sourceNode}`,
                ERROR_CODES.INVALID_EDGE,
                { source: sourceNode, target: targetNode, reason: 'source_node_not_found' },
                null,
                null,
                sourceNode
            );
        }

        if (!nodeIds.has(targetNode)) {
            throw new ConversionError(
                `边连接到不存在的目标节点：${targetNode}`,
                ERROR_CODES.INVALID_EDGE,
                { source: sourceNode, target: targetNode, reason: 'target_node_not_found' },
                null,
                null,
                targetNode
            );
        }
    }
}

/**
 * 验证剪贴板输入数据
 * @param {object} clip - 剪贴板数据
 * @throws {ConversionError} 验证失败时抛出错误
 */
export function validateClipboardInput(clip) {
    if (!clip) {
        throw new ConversionError('输入为空', ERROR_CODES.EMPTY_INPUT);
    }

    if (clip.type !== 'coze-workflow-clipboard-data') {
        throw new ConversionError(
            '无效剪贴板数据',
            ERROR_CODES.INVALID_TYPE,
            { expected: 'coze-workflow-clipboard-data', actual: clip.type }
        );
    }

    if (!clip.json) {
        throw new ConversionError(
            'JSON结构错误：缺少json字段',
            ERROR_CODES.INVALID_STRUCTURE,
            { missingField: 'json' }
        );
    }

    if (!clip.json.nodes || !Array.isArray(clip.json.nodes)) {
        throw new ConversionError(
            'JSON结构错误：缺少nodes数组',
            ERROR_CODES.INVALID_STRUCTURE,
            { missingField: 'json.nodes', expectedType: 'array' }
        );
    }
}

/**
 * 获取节点类型显示名称
 * @param {string|number} type - 节点类型标识
 * @returns {string} 显示名称
 */
export function getNodeTypeName(type) {
    const typeName = REV_TYPE_MAP[String(type)];
    return typeName ? NODE_DISPLAY_NAMES[/** @type {keyof typeof NODE_DISPLAY_NAMES} */ (typeName)] : String(type || 'Unknown');
}

/**
 * 获取节点颜色
 * @param {string|number} type - 节点类型标识
 * @returns {string} 颜色值
 */
export function getNodeColor(type) {
    const typeName = REV_TYPE_MAP[String(type)];
    return typeName ? NODE_COLORS[/** @type {keyof typeof NODE_COLORS} */ (typeName)] : '#00B2B2';
}

/**
 * 格式化错误信息用于显示
 * @param {Error|ConversionError} error - 错误对象
 * @returns {string} 格式化的错误消息
 */
export function formatError(error) {
    if (error instanceof ConversionError) {
        return `${error.getFriendlyMessage()}${error.getLocation()}`;
    }
    return error.message || 'Unknown error';
}

/**
 * 安全解析JSON
 * @param {string} jsonString - JSON字符串
 * @returns {object} 解析结果
 * @throws {ConversionError} 解析失败时抛出错误
 */
export function safeParseJson(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        throw ConversionError.fromJsonError(error);
    }
}

/**
 * 将 UTF-8 字符串编码为 Base64（替代废弃的 btoa(unescape(encodeURIComponent(...))) ）
 * @param {string} str - UTF-8 字符串
 * @returns {string} Base64 编码字符串
 */
export function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * 将 Base64 解码为 UTF-8 字符串（替代废弃的 decodeURIComponent(escape(atob(...))) ）
 * @param {string} base64 - Base64 编码字符串
 * @returns {string} UTF-8 字符串
 */
export function base64ToUtf8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}