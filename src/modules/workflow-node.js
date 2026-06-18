import { t } from '../i18n/i18n.js';
import { mixinNodeRender } from './workflow-node-render.js';
import { mixinNodePanel } from './workflow-node-panel.js';
import { mixinNodeSelector } from './workflow-node-selector.js';

export class WorkflowNode {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        this.propertyContent = ui.propertyContent;

        mixinNodeRender(this);
        mixinNodePanel(this);
        mixinNodeSelector(this);
    }
}