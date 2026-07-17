/**
 * @fileoverview 工作流核心类型定义
 * @description 使用 JSDoc @typedef 定义工作流的核心数据结构类型
 *              供 jsconfig.json 的 checkJs 进行类型检查
 */

/**
 * 工作流节点数据结构
 * @typedef {Object} WorkflowNode
 * @property {string} id - 节点唯一标识，格式：node_数字
 * @property {string} type - 节点类型（如 'llm', 'start', 'end', 'condition' 等）
 * @property {number} x - 节点在画布上的 X 坐标
 * @property {number} y - 节点在画布上的 Y 坐标
 * @property {string} title - 节点显示标题
 * @property {string} description - 节点描述文本
 * @property {Object.<string, *>} parameters - 节点业务参数（键值对）
 * @property {InputParam[]} inputParams - 输入参数列表
 * @property {OutputParam[]} outputParams - 输出参数列表
 * @property {string|null} parentId - 父容器节点ID，普通节点为 null
 */

/**
 * 输入参数定义
 * @typedef {Object} InputParam
 * @property {string} name - 参数名称
 * @property {string} type - 参数类型（'string', 'number', 'boolean' 等）
 * @property {*} value - 参数值
 * @property {boolean} [required] - 是否必填
 */

/**
 * 输出参数定义
 * @typedef {Object} OutputParam
 * @property {string} name - 参数名称
 * @property {string} type - 参数类型
 * @property {*} [value] - 默认值
 */

/**
 * 工作流边（连线）数据结构
 * @typedef {Object} WorkflowEdge
 * @property {string} id - 边唯一标识，格式：edge_数字
 * @property {string} source - 源节点ID
 * @property {string} target - 目标节点ID
 * @property {string} [sourcePort] - 源端口标识（分支节点、容器节点使用）
 * @property {string} [targetPort] - 目标端口标识（容器节点使用）
 */

/**
 * 历史记录快照
 * @typedef {Object} HistoryState
 * @property {WorkflowNode[]} nodes - 节点数组快照
 * @property {WorkflowEdge[]} edges - 边数组快照
 * @property {string|null} selectedNode - 当前选中的节点ID
 * @property {string|null} selectedEdge - 当前选中的边ID
 * @property {string} actionKey - i18n 操作名称键
 * @property {Object} actionParams - i18n 插值参数
 * @property {number} timestamp - 时间戳（毫秒）
 */

/**
 * 节点类型配置信息
 * @typedef {Object} NodeTypeInfo
 * @property {string} title - 节点类型显示名称（i18n）
 * @property {string} icon - 节点图标（emoji）
 * @property {string} description - 节点类型描述（i18n）
 * @property {boolean} hasInput - 是否有输入端口
 * @property {boolean} hasOutput - 是否有输出端口
 * @property {boolean} [hasContainer] - 是否为容器节点
 * @property {NodeParamConfig[]} [parameters] - 业务参数配置
 */

/**
 * 节点参数配置
 * @typedef {Object} NodeParamConfig
 * @property {string} name - 参数名称
 * @property {string} label - 参数显示标签（i18n 键）
 * @property {string} type - 参数类型（'text', 'textarea', 'select', 'number' 等）
 * @property {*} [defaultValue] - 默认值
 * @property {boolean} [required] - 是否必填
 * @property {Array<{label: string, value: *}>} [options] - 下拉选项
 */

/**
 * 工作流完整数据（用于序列化/持久化）
 * @typedef {Object} WorkflowData
 * @property {WorkflowNode[]} nodes - 节点数组
 * @property {WorkflowEdge[]} edges - 边数组
 * @property {Object} [meta] - 元数据（名称、描述、版本等）
 * @property {number} [nodeIdCounter] - 节点ID计数器
 * @property {number} [edgeIdCounter] - 边ID计数器
 */

/**
 * 变更回调函数类型
 * @callback ChangeCallback
 * @param {string} action - 操作类型（'addNode', 'deleteNode', 'addEdge', 'deleteEdge', 'undo', 'redo', 'batch' 等）
 * @param {*} [data] - 附加数据
 * @returns {void}
 */

export {};
