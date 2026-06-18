/**
 * 工作流导出和分享模块
 * 负责导出 YAML 文件和生成分享链接
 */
import { Dialog } from './dialog.js';
import { t } from '../i18n/i18n.js';

/**
 * 导出/分享相关的 mixin 方法
 * @param {import('./workflow-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinShare(ui) {
    /**
     * 导出工作流为 YAML 文件
     */
    ui.exportWorkflow = function() {
        const workflowName = document.getElementById('workflowName')?.textContent || '';
        const workflowId = document.getElementById('workflowId')?.textContent || '';
        const workflowDesc = document.getElementById('workflowDescription')?.textContent || '';

        const workflow = this.core.exportWorkflow({
            name: workflowName || 'my_workflow',
            id: workflowId || `workflow_${Date.now()}`,
            description: workflowDesc || 'Created with workflow editor'
        });

        const yamlStr = window.jsyaml.dump(workflow, { indent: 2, lineWidth: 120 });
        const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name}.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage(t('messages.workflowExported'), 'success');
    };

    /**
     * 生成分享链接
     */
    ui.shareLink = async function() {
        const workflowName = document.getElementById('workflowName')?.textContent || '';
        const workflowId = document.getElementById('workflowId')?.textContent || '';
        const workflow = this.core.exportWorkflow({
            name: workflowName || 'my_workflow',
            id: workflowId || `workflow_${Date.now()}`
        });

        const json = JSON.stringify(workflow);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

        if (shareUrl.length > 2000) {
            const proceed = await Dialog.confirm(t('messages.shareLinkTooLong', { length: shareUrl.length }), t('messages.shareLinkTitle'));
            if (!proceed) return;
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            this.showMessage(t('messages.shareLinkCopied'), 'success');
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showMessage(t('messages.shareLinkCopied'), 'success');
        }
    };
}