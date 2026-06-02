import { REV_TYPE_MAP, NODE_DISPLAY_NAMES, NODE_COLORS } from './types.js';

export class ConversionError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'ConversionError';
        this.code = code;
        this.details = details;
    }
}

export function convertEdges(edges) {
    if (!edges?.length) return [];
    return edges.map(e => ({
        sourceNodeID: String(e.source_node || e.sourceNodeID),
        targetNodeID: String(e.target_node || e.targetNodeID),
        ...(e.source_port !== undefined && { sourcePortID: String(e.source_port) }),
        ...(e.target_port !== undefined && { targetPortID: String(e.target_port) })
    }));
}

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
    // JavaScript 最大安全整数：2^53 - 1 = 9007199254740991
    // 我们处理 16 位以上的数字，确保安全
    const idPattern = /(\b(id|ref_node|source_node|target_node)\s*:\s*)(\d{16,})/g;
    
    return input.replace(idPattern, (match, prefix, key, numStr) => {
        // 将大数字转换为字符串（添加引号）
        return `${prefix}"${numStr}"`;
    });
}

export function validateYamlInput(yaml) {
    if (!yaml) throw new ConversionError('输入为空', 'EMPTY_INPUT');
    if (!yaml.nodes || !Array.isArray(yaml.nodes)) throw new ConversionError('无效YAML:缺少nodes数组', 'INVALID_STRUCTURE');
    for (const node of yaml.nodes) {
        if (node.id === undefined) throw new ConversionError(`节点缺少id字段`, 'MISSING_NODE_ID', { node });
        if (!node.type) throw new ConversionError(`节点${node.id}缺少type字段`, 'MISSING_NODE_TYPE', { node });
    }
}

export function validateClipboardInput(clip) {
    if (!clip) throw new ConversionError('输入为空', 'EMPTY_INPUT');
    if (clip.type !== 'coze-workflow-clipboard-data') throw new ConversionError('无效剪贴板数据', 'INVALID_TYPE');
    if (!clip.json || !clip.json.nodes || !Array.isArray(clip.json.nodes)) {
        throw new ConversionError('JSON结构错误：缺少nodes数组', 'INVALID_STRUCTURE');
    }
}

export function getNodeTypeName(type) {
    const typeName = REV_TYPE_MAP[String(type)];
    return typeName ? NODE_DISPLAY_NAMES[typeName] : (type || '未知');
}

export function getNodeColor(type) {
    const typeName = REV_TYPE_MAP[String(type)];
    return typeName ? NODE_COLORS[typeName] : '#00B2B2';
}