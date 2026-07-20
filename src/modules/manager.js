/**
 * 向后兼容 re-export 包装器。
 * 实际实现已拆分到：
 * - manager-core.js — 核心 CRUD + 列表渲染 + 搜索排序 + 拖拽排序
 * - manager-import.js — zip 导入
 * - manager-export.js — 导出
 * - manager-version.js — 版本管理 + 对比
 */
export { WorkflowManager } from './manager-core.js';
