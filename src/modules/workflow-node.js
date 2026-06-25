import { t } from '../i18n/i18n.js';
import { mixinNodeRender } from './workflow-node-render.js';
import { mixinContainerRender } from './workflow-container-render.js';
import { mixinNodePanel } from './workflow-node-panel.js';
import { mixinNodeSelector } from './workflow-node-selector.js';
import { mixinParamEditor } from './workflow-param-editor.js';

export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;

        mixinNodeRender(this);
        mixinContainerRender(this);
        mixinNodePanel(this);
        mixinNodeSelector(this);
        mixinParamEditor(this);
    }
}