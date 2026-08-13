/**
 * 工作流消息模块
 * 负责 Toast 消息提示的创建和显示
 */
import { DOM } from '../../utils/helpers.js';

export class WorkflowMessages {
    /**
     * @param {import('./editor-ui.js').WorkflowUI} ui - 主 UI 实例
     */
    constructor(ui) {
        this.ui = ui;
        this.container = null;
    }

    /**
     * 创建消息容器
     */
    createContainer() {
        this.container = DOM.create('div', {
            className: 'workflow-message-container',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            },
        });
        document.body.appendChild(this.container);
    }

    /**
     * 显示消息提示
     * @param {string} text - 消息文本（标题）
     * @param {string} type - 消息类型 ('success', 'error', 'info', 'warning')
     * @param {{ items?: string[] }} [options] - 可选：items 为附加的多行子项（如验证错误列表）
     */
    show(text, type = 'info', options = undefined) {
        if (!this.container) {
            this.createContainer();
        }

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️',
        };

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b',
        };

        const messageEl = DOM.create('div', {
            className: `workflow-message workflow-message-${type}`,
            style: {
                padding: '12px 16px',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15))',
                transform: 'translateX(100%)',
                animation: 'slideIn 0.3s ease-out forwards',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                maxWidth: '360px',
                backgroundColor: colors[type] || colors.info,
            },
        });

        const iconSpan = DOM.create('span', {
            text: icons[type] || icons.info,
            style: { lineHeight: '1.4', flexShrink: 0, paddingTop: '1px' },
        });

        const contentWrap = DOM.create('div', {
            style: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 },
        });
        const titleSpan = DOM.create('span', { text: text, style: { lineHeight: '1.4' } });
        contentWrap.appendChild(titleSpan);

        if (options && Array.isArray(options.items) && options.items.length > 0) {
            const listWrap = DOM.create('div', {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '13px',
                    opacity: 0.92,
                    paddingLeft: '2px',
                    lineHeight: '1.4',
                },
            });
            const maxShow = 8;
            options.items.slice(0, maxShow).forEach((item) => {
                listWrap.appendChild(DOM.create('div', { text: '• ' + item }));
            });
            if (options.items.length > maxShow) {
                const more = options.items.length - maxShow;
                listWrap.appendChild(
                    DOM.create('div', {
                        text: '+ ' + more + ' more',
                        style: { opacity: 0.75, fontStyle: 'italic' },
                    })
                );
            }
            contentWrap.appendChild(listWrap);
        }

        messageEl.appendChild(iconSpan);
        messageEl.appendChild(contentWrap);

        this.container.appendChild(messageEl);

        setTimeout(() => {
            DOM.setStyle(messageEl, 'animation', 'slideOut 0.3s ease-out forwards');
            setTimeout(() => {
                messageEl.remove();
            }, 300);
        }, 3000);
    }
}
