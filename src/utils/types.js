import { findRef, clearRefCache } from './refCache.js';
import { Logger } from './logger.js';

// 节点尺寸常量（用于布局计算）
export const NODE_DEFAULT_WIDTH = 360;
export const NODE_DEFAULT_HEIGHT = 112;
export const NODE_QUESTION_HEIGHT = 295;
export const NODE_CENTER_OFFSET = 200;

// 语言类型常量
export const LANG_PYTHON = 5;
export const LANG_JAVASCRIPT = 6;

// 未知节点类型默认映射值（统一为 plugin 节点类型 4）
export const UNKNOWN_NODE_TYPE_DEFAULT = '4';

// 节点类型映射（基于 allnode.json 权威列表）
export const TYPE_MAP = {
    start: '1',
    end: '2',
    llm: '3',
    plugin: '4',
    code: '5',
    knowledge_query: '6',
    condition: '8',
    workflow: '9',
    sql_exec: '12',
    output: '13',
    text: '15',
    image_generate: '16',
    question: '18',
    break: '19',
    loop_set_variable: '20',
    loop: '21',
    intent: '22',
    canvas: '23',
    knowledge_write: '27',
    batch: '28',
    loop_continue: '29',
    input: '30',
    comment: '31',
    variable_merge: '32',
    json_parse: '37',
    clear_conversation: '38',
    create_conversation: '39',
    variable_assign: '40',
    db_update: '42',
    db_select: '43',
    db_delete: '44',
    http: '45',
    db_insert: '46',
    update_conversation: '51',
    delete_conversation: '52',
    list_conversation: '53',
    get_conversation_history: '54',
    create_message: '55',
    update_message: '56',
    delete_message: '57',
    json_serialize: '58',
    json_deserialize: '59',
    knowledge_delete: '60',
    video_extract_audio: '63',
    video_extract_frame: '64',
    video_generation: '65',
    memory_write: '66',
    memory_read: '67',
    async_task: '72',
    delay: '73',
    database: '74',
    email: '75',
    webhook: '76',
};

// 反向类型映射（ID -> 名称）
export const REV_TYPE_MAP = Object.fromEntries(Object.entries(TYPE_MAP).map(([k, v]) => [v, k]));

// 辅助类型映射
export const ASSIST_MAP = {
    image: 2,
    audio: 8,
    video: 10,
    file: 1,
    svg: 11,
    voice: 12,
    doc: 3,
    ppt: 5,
    time: 10000,
};

// 原始类型映射
export const RAW_TYPE = {
    string: 1,
    integer: 2,
    float: 4,
    boolean: 3,
    stringList: 99,
    list: 100,
    objectList: 103,
    image: 7,
    imageList: 104,
    audio: 14,
    audioList: 105,
    video: 16,
    videoList: 107,
};

// 节点能力定义
export const NODE_CAPABILITIES = {
    INHERIT_ASSIST: new Set([
        'llm',
        'code',
        'image_generate',
        'video_generation',
        'condition',
        'loop',
        'batch',
        'intent',
        'knowledge_query',
        'async_task',
    ]),
    HAS_BLOCKS: new Set(['loop', 'batch']),
    HAS_OUTPUTS: new Set([
        'start',
        'llm',
        'code',
        'image_generate',
        'video_generation',
        'condition',
        'variable_merge',
        'plugin',
        'loop',
        'batch',
        'intent',
        'async_task',
        'http',
        'text',
        'output',
        'input',
        'question',
        'delay',
        'variable_assign',
        'knowledge_query',
        'database',
        'email',
        'webhook',
        'json_parse',
        'workflow',
        'sql_exec',
        'db_update',
        'db_select',
        'db_delete',
        'db_insert',
        'clear_conversation',
        'create_conversation',
        'update_conversation',
        'delete_conversation',
        'list_conversation',
        'get_conversation_history',
        'create_message',
        'update_message',
        'delete_message',
        'json_serialize',
        'json_deserialize',
        'knowledge_write',
        'knowledge_delete',
        'video_extract_audio',
        'video_extract_frame',
        'memory_write',
        'memory_read',
        'canvas',
    ]),
};

// 兼容旧代码
export const INHERIT_ASSIST_NODES = NODE_CAPABILITIES.INHERIT_ASSIST;

// 节点名称映射（用于显示）
export const NODE_DISPLAY_NAMES = {
    start: '🚀 开始',
    end: '🏁 结束',
    llm: '🤖 大模型',
    plugin: '🔌 插件',
    code: '💻 代码',
    condition: '🔀 条件',
    http: '🌐 HTTP请求',
    text: '📝 文本',
    image_generate: '🎨 图像生成',
    knowledge_query: '📚 知识库检索',
    knowledge_write: '📝 知识库写入',
    knowledge_delete: '🗑️ 知识库删除',
    question: '❓ 问答',
    loop: '🔄 循环',
    intent: '🧠 意图识别',
    break: '⏹️ 退出循环',
    loop_set_variable: '📦 设置变量',
    canvas: '🎨 画板',
    variable_assign: '📦 变量赋值',
    batch: '📤 批处理',
    comment: '📝 注释',
    loop_continue: '🔄 继续循环',
    variable_merge: '🔗 变量聚合',
    video_generation: '🎬 视频生成',
    async_task: '⏳ 异步任务',
    output: '📤 输出',
    input: '📥 输入',
    delay: '⏱️ 延迟',
    database: '🗄️ 数据库',
    email: '📧 邮件',
    webhook: '🪝 Webhook',
    json_parse: '🔍 JSON解析',
    workflow: '🔗 工作流',
    sql_exec: '🗄️ SQL执行',
    db_update: '🔄 更新数据',
    db_select: '🔍 查询数据',
    db_delete: '🗑️ 删除数据',
    db_insert: '➕ 新增数据',
    clear_conversation: '🗑️ 清空会话',
    create_conversation: '💬 创建会话',
    update_conversation: '✏️ 修改会话',
    delete_conversation: '🗑️ 删除会话',
    list_conversation: '📋 会话列表',
    get_conversation_history: '📜 会话历史',
    create_message: '💬 创建消息',
    update_message: '✏️ 修改消息',
    delete_message: '🗑️ 删除消息',
    json_serialize: '📦 JSON序列化',
    json_deserialize: '📤 JSON反序列化',
    video_extract_audio: '🎵 提取音频',
    video_extract_frame: '🖼️ 视频抽帧',
    memory_write: '🧠 记忆写入',
    memory_read: '📖 记忆检索',
};

// 节点颜色映射
export const NODE_COLORS = {
    start: '#5C62FF',
    end: '#5C62FF',
    llm: '#5C62FF',
    plugin: '#CA61FF',
    code: '#00B2B2',
    condition: '#00B2B2',
    http: '#F59E0B',
    text: '#F59E0B',
    image_generate: '#FF4DC3',
    knowledge_query: '#10B981',
    knowledge_write: '#10B981',
    knowledge_delete: '#EF4444',
    question: '#3071F2',
    loop: '#00B2B2',
    intent: '#00B2B2',
    break: '#00B2B2',
    loop_set_variable: '#00B2B2',
    loop_continue: '#00B2B2',
    canvas: '#FF4DC3',
    variable_assign: '#8B5CF6',
    batch: '#00B2B2',
    comment: '#6B7280',
    variable_merge: '#00B2B2',
    video_generation: '#3071F2',
    async_task: '#3071F2',
    output: '#5C62FF',
    input: '#5C62FF',
    delay: '#059669',
    database: '#059669',
    email: '#F59E0B',
    webhook: '#F59E0B',
    json_parse: '#3B82F6',
    workflow: '#CA61FF',
    sql_exec: '#059669',
    db_update: '#059669',
    db_select: '#059669',
    db_delete: '#EF4444',
    db_insert: '#10B981',
    clear_conversation: '#EF4444',
    create_conversation: '#10B981',
    update_conversation: '#F59E0B',
    delete_conversation: '#EF4444',
    list_conversation: '#3071F2',
    get_conversation_history: '#3071F2',
    create_message: '#10B981',
    update_message: '#F59E0B',
    delete_message: '#EF4444',
    json_serialize: '#F59E0B',
    json_deserialize: '#F59E0B',
    video_extract_audio: '#3071F2',
    video_extract_frame: '#3071F2',
    memory_write: '#8B5CF6',
    memory_read: '#8B5CF6',
};

// 节点高度映射（用于布局计算）
export const NODE_HEIGHTS = {
    start: 86,
    end: 112,
    comment: 150,
    llm: 164,
    code: 112,
    image_generate: 164,
    video_generation: 162,
    condition: 138,
    knowledge_query: 164,
    knowledge_write: 164,
    knowledge_delete: 112,
    question: 164,
    loop: 138,
    batch: 112,
    intent: 176,
    async_task: 164,
    http: 130,
    output: 112,
    input: 86,
    delay: 112,
    variable_assign: 112,
    variable_merge: 112,
    break: 66,
    loop_set_variable: 86,
    loop_continue: 66,
    plugin: 112,
    database: 130,
    email: 164,
    webhook: 130,
    json_parse: 112,
    canvas: 112,
    workflow: 112,
    sql_exec: 112,
    db_update: 112,
    db_select: 112,
    db_delete: 112,
    db_insert: 112,
    clear_conversation: 112,
    create_conversation: 112,
    update_conversation: 112,
    delete_conversation: 112,
    list_conversation: 112,
    get_conversation_history: 112,
    create_message: 112,
    update_message: 112,
    delete_message: 112,
    json_serialize: 112,
    json_deserialize: 112,
    video_extract_audio: 112,
    video_extract_frame: 112,
    memory_write: 112,
    memory_read: 112,
};

export function getAssistFromType(t) {
    return t ? ASSIST_MAP[t.toLowerCase()] : undefined;
}

export function mapLang(l) {
    if (typeof l === 'number') return l;
    if (typeof l === 'string') {
        const ll = l.toLowerCase();
        if (ll === 'python') return LANG_PYTHON;
        if (ll === 'javascript') return LANG_JAVASCRIPT;
    }
    return LANG_PYTHON;
}

export function mapOutType(t) {
    return ['integer', 'float', 'boolean', 'list', 'object'].includes(t) ? t : 'string';
}

export function getMainColor(t) {
    return NODE_COLORS[t?.toLowerCase()] || '#00B2B2';
}

export function getSubTitle(t) {
    const displayName = NODE_DISPLAY_NAMES[t?.toLowerCase()];
    if (displayName) {
        // eslint-disable-next-line no-misleading-character-class
        return displayName.replace(/^[🚀🏁🤖🔌💻🔀🌐📝🎨📚🔄🧠⏹️📦📤🔗🎬⏳📥❓] ?/u, '');
    }
    return '';
}

export function getBounds(node) {
    if (!node) return { x: 0, y: 0, width: NODE_DEFAULT_WIDTH, height: NODE_DEFAULT_HEIGHT };

    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const type = node.type?.toLowerCase() || '';

    const width = NODE_DEFAULT_WIDTH;
    let height = NODE_DEFAULT_HEIGHT;

    if (type === 'question' || type === TYPE_MAP.question) {
        height = NODE_QUESTION_HEIGHT;
    }

    return { x: x - NODE_CENTER_OFFSET, y, width, height };
}

export { findRef, clearRefCache };

/**
 * 解析节点类型对应的数字标识，未知类型时发出告警并返回统一默认值
 * @param {string} type - 节点类型名称
 * @returns {string} 数字标识
 */
export function resolveNodeType(type) {
    const mapped = TYPE_MAP[type];
    if (!mapped) {
        Logger.warn(`Unknown node type "${type}", falling back to default type ${UNKNOWN_NODE_TYPE_DEFAULT} (plugin)`);
        return UNKNOWN_NODE_TYPE_DEFAULT;
    }
    return mapped;
}

const INFER_RAW_CACHE = {
    integer: { type: RAW_TYPE.integer },
    float: { type: RAW_TYPE.float },
    boolean: { type: RAW_TYPE.boolean },
    list: { type: RAW_TYPE.list },
    object: { type: RAW_TYPE.string },
};

export function inferRawMetaFromType(type, assist) {
    if (type && INFER_RAW_CACHE[type]) return INFER_RAW_CACHE[type];
    if (assist === 2) return { type: 7 };
    if (assist === 8) return { type: 14 };
    if (assist === 10) return { type: 16 };
    return { type: 1 };
}

export function inferRawMetaFromValue(val) {
    const t = typeof val;
    if (t === 'number') return { type: val % 1 === 0 ? 2 : 4 };
    if (t === 'boolean') return { type: 3 };
    if (Array.isArray(val)) return { type: RAW_TYPE.list };
    return { type: 1 };
}

export function toValueObject(val) {
    if (val == null) return { type: 'literal', content: '' };

    const ref = findRef(val);
    if (ref) {
        return {
            type: 'ref',
            content: { source: 'block-output', blockID: String(ref.ref_node), name: ref.path },
            rawMeta: ref.rawMeta,
            assistType: ref.assistType,
        };
    }

    const vt = val.type;
    if (vt === 'ref' || vt === 'literal') return val;

    if (vt && val.value !== undefined) {
        return {
            type: vt,
            value: toValueObject(val.value),
        };
    }

    const lit = { type: 'literal', content: val };
    const raw = inferRawMetaFromValue(val);
    if (raw) lit.rawMeta = raw;
    return lit;
}
