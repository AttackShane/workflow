import { WorkflowNodeRender } from './editor-node-render.js';
import { WorkflowContainerRender } from './editor-container-render.js';
import { WorkflowNodePanel } from './editor-node-panel.js';
import { WorkflowNodeSelector } from './editor-node-selector.js';
import { WorkflowParamEditor } from './editor-param-editor.js';

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
