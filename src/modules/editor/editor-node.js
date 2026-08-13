import { WorkflowNodeRender } from './editor-node-render.js';
import { WorkflowContainerRender } from './editor-container-render.js';
import { WorkflowNodePanel } from './editor-node-panel.js';
import { WorkflowNodeSelector } from './editor-node-selector.js';
import { WorkflowParamEditor } from './editor-param-editor.js';

/**
 * 工作流节点类（组合模式入口）
 * @property {import('./editor-ui.js').WorkflowUI} ui
 * @property {import('./editor-core.js').WorkflowCore} core
 * @property {{ onMouseMove: Function, onMouseUp: Function, onKeyDown: Function }|null} [_dragListeners] - 拖拽监听器缓存
 */
export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;

        this.render = new WorkflowNodeRender(this);
        this.container = new WorkflowContainerRender(this);
        this.panel = new WorkflowNodePanel(this);
        this.selector = new WorkflowNodeSelector(this);
        this.paramEditor = new WorkflowParamEditor(this);
    }
}
