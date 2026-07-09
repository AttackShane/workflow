import { t } from '../i18n/i18n.js';
import { mixinNodeRender } from './editor-node-render.js';
import { mixinContainerRender } from './editor-container-render.js';
import { mixinNodePanel } from './editor-node-panel.js';
import { mixinNodeSelector } from './editor-node-selector.js';
import { mixinParamEditor } from './editor-param-editor.js';

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