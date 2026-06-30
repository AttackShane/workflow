/**
 * 工作流消息模块
 * 负责 Toast 消息提示的创建和显示
 */
import { DOM } from '../utils/helpers.js';

/**
 * 消息相关的 mixin 方法
 * @param {import('./workflow-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinMessages(ui) {
    /**
     * 创建消息容器
     */
    ui.createMessageContainer = function() {
        this.messageContainer = DOM.create('div', {
            className: 'workflow-message-container',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }
        });
        document.body.appendChild(this.messageContainer);
    };

    /**
     * 显示消息提示
     * @param {string} text - 消息文本
     * @param {string} type - 消息类型 ('success', 'error', 'info', 'warning')
     */
    ui.showMessage = function(text, type = 'info') {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        const messageEl = DOM.create('div', {
            className: `workflow-message workflow-message-${type}`,
            style: {
                padding: '12px 20px',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transform: 'translateX(100%)',
                animation: 'slideIn 0.3s ease-out forwards',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '320px',
                backgroundColor: colors[type] || colors.info
            }
        });

        const iconSpan = DOM.create('span', { text: icons[type] || icons.info });
        const textSpan = DOM.create('span', { text: text });
        messageEl.appendChild(iconSpan);
        messageEl.appendChild(textSpan);

        this.messageContainer.appendChild(messageEl);

        setTimeout(() => {
            DOM.setStyle(messageEl, 'animation', 'slideOut 0.3s ease-out forwards');
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }, 3000);
    };
}