import { t } from '../i18n/i18n.js';
import { StringUtils } from '../utils/helpers.js';

export class Dialog {
    static #overlay = null;
    static #container = null;
    static #currentResolve = null;
    static #keydownHandler = null;
    static #isClosing = false;
    static #closeTimer = null;
    static #TRANSITION_MS = 200;

    static #init() {
        if (this.#overlay) return;

        this.#overlay = document.createElement('div');
        this.#overlay.className = 'dialog-overlay';
        this.#overlay.setAttribute('role', 'dialog');
        this.#overlay.setAttribute('aria-modal', 'true');
        this.#overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-overlay, rgba(0, 0, 0, 0.5));
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity ${this.#TRANSITION_MS}ms ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.#container = document.createElement('div');
        this.#container.className = 'dialog-container';
        this.#container.setAttribute('role', 'document');
        this.#container.style.cssText = `
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.3));
            min-width: 320px;
            max-width: 480px;
            transform: scale(0.9) translateY(-20px);
            transition: transform ${this.#TRANSITION_MS}ms ease;
            color: var(--text-primary, #1F2937);
        `;
        this.#overlay.appendChild(this.#container);

        this.#overlay.addEventListener('click', (e) => {
            if (e.target === this.#overlay) {
                this.#close(null);
            }
        });

        this.#keydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.#close(null);
            }
        };
    }

    static #ensureSingle() {
        if (this.#currentResolve || this.#isClosing) {
            if (this.#closeTimer) {
                clearTimeout(this.#closeTimer);
                this.#closeTimer = null;
            }
            document.removeEventListener('keydown', this.#keydownHandler);
            if (this.#currentResolve) {
                const oldResolve = this.#currentResolve;
                this.#currentResolve = null;
                oldResolve(null);
            }
            this.#isClosing = false;
            if (this.#container) {
                this.#container.innerHTML = '';
            }
        }
    }

    static #show() {
        this.#overlay.style.transition = 'none';
        this.#container.style.transition = 'none';
        this.#overlay.style.opacity = '0';
        this.#container.style.transform = 'scale(0.9) translateY(-20px)';
        document.body.appendChild(this.#overlay);
        void this.#container.offsetHeight;
        this.#overlay.style.transition = 'opacity ' + this.#TRANSITION_MS + 'ms ease';
        this.#container.style.transition = 'transform ' + this.#TRANSITION_MS + 'ms ease';
        this.#overlay.style.opacity = '1';
        this.#overlay.style.pointerEvents = 'auto';
        this.#container.style.transform = 'scale(1) translateY(0)';
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', this.#keydownHandler);

        const firstBtn = this.#container.querySelector('button');
        if (firstBtn) {
            setTimeout(() => firstBtn.focus(), 50);
        }
    }

    /**
     * @param {*} [result=false]
     */
    static #close(result = null) {
        if (this.#isClosing) return;
        this.#isClosing = true;

        if (this.#closeTimer) {
            clearTimeout(this.#closeTimer);
            this.#closeTimer = null;
        }

        document.removeEventListener('keydown', this.#keydownHandler);
        this.#overlay.style.opacity = '0';
        this.#overlay.style.pointerEvents = 'none';
        this.#container.style.transform = 'scale(0.9) translateY(-20px)';
        document.body.style.overflow = '';

        this.#closeTimer = setTimeout(() => {
            if (this.#container) {
                this.#container.innerHTML = '';
                this.#container.style.maxWidth = '';
                this.#container.style.width = '';
                this.#container.style.boxShadow = '';
                this.#container.style.overflow = '';
            }
            if (this.#overlay && this.#overlay.parentNode) {
                this.#overlay.parentNode.removeChild(this.#overlay);
            }
            if (this.#currentResolve) {
                this.#currentResolve(result);
                this.#currentResolve = null;
            }
            this.#isClosing = false;
            this.#closeTimer = null;
        }, this.#TRANSITION_MS);
    }

    static #buildContent({ icon, iconBg, title, message, buttons }) {
        this.#container.innerHTML = `
            <div style="padding: 24px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <div style="width: 40px; height: 40px; background: ${iconBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                        <span style="font-size: 20px;">${icon}</span>
                    </div>
                    <h3 id="dialog-title" style="font-size: 16px; font-weight: 600; color: var(--text-primary, #1F2937); margin: 0;">${title}</h3>
                </div>
                <p id="dialog-message" style="color: var(--text-secondary, #4B5563); font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${message}</p>
                <div id="dialog-actions" style="display: flex; justify-content: flex-end; gap: 12px;"></div>
            </div>
        `;

        this.#overlay.setAttribute('aria-labelledby', 'dialog-title');
        this.#overlay.setAttribute('aria-describedby', 'dialog-message');

        const actionsDiv = this.#container.querySelector('#dialog-actions');
        for (const btn of buttons) {
            actionsDiv.appendChild(btn);
        }
    }

    static #createButton(text, style = 'primary', onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            padding: 10px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 80px;
        `;

        if (style === 'primary') {
            btn.style.background = 'linear-gradient(135deg, #5C62FF 0%, #7C3AED 100%)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 12px rgba(92, 98, 255, 0.3)';
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 6px 16px rgba(92, 98, 255, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 4px 12px rgba(92, 98, 255, 0.3)';
            });
        } else if (style === 'danger') {
            btn.style.background = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            });
        } else if (style === 'success') {
            btn.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            });
        } else {
            btn.style.background = 'var(--bg-secondary, #f3f4f6)';
            btn.style.color = 'var(--text-primary, #374151)';
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--bg-tertiary, #e5e7eb)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'var(--bg-secondary, #f3f4f6)';
            });
        }

        btn.addEventListener('click', onClick);
        return btn;
    }

    static alert(message, title = t('common.info')) {
        return new Promise((resolve) => {
            this.#init();
            this.#ensureSingle();
            this.#currentResolve = resolve;

            const safeMessage = StringUtils.escapeHtml(message);
            const safeTitle = StringUtils.escapeHtml(title);

            this.#buildContent({
                icon: 'ℹ️',
                iconBg: '#FEF3C7',
                title: safeTitle,
                message: safeMessage,
                buttons: [this.#createButton(t('common.ok'), 'primary', () => this.#close(true))],
            });

            this.#show();
        });
    }

    static confirm(message, title = t('common.confirm'), options = {}) {
        return new Promise((resolve) => {
            this.#init();
            this.#ensureSingle();
            this.#currentResolve = resolve;

            const safeMessage = StringUtils.escapeHtml(message);
            const safeTitle = StringUtils.escapeHtml(title);
            const { okText = t('common.ok'), cancelText = t('common.cancel'), danger = false } = options;

            this.#buildContent({
                icon: danger ? '⚠️' : '❓',
                iconBg: danger ? '#FEE2E2' : '#FEF3C7',
                title: safeTitle,
                message: safeMessage,
                buttons: [
                    this.#createButton(cancelText, 'secondary', () => this.#close(false)),
                    this.#createButton(okText, danger ? 'danger' : 'primary', () => this.#close(true)),
                ],
            });

            this.#show();
        });
    }

    static success(message, title = t('common.success')) {
        return new Promise((resolve) => {
            this.#init();
            this.#ensureSingle();
            this.#currentResolve = resolve;

            const safeMessage = StringUtils.escapeHtml(message);
            const safeTitle = StringUtils.escapeHtml(title);

            this.#buildContent({
                icon: '✅',
                iconBg: '#D1FAE5',
                title: safeTitle,
                message: safeMessage,
                buttons: [this.#createButton(t('common.ok'), 'success', () => this.#close(true))],
            });

            this.#show();
        });
    }

    static error(message, title = t('common.error')) {
        return new Promise((resolve) => {
            this.#init();
            this.#ensureSingle();
            this.#currentResolve = resolve;

            const safeMessage = StringUtils.escapeHtml(message);
            const safeTitle = StringUtils.escapeHtml(title);

            this.#buildContent({
                icon: '❌',
                iconBg: '#FEE2E2',
                title: safeTitle,
                message: safeMessage,
                buttons: [this.#createButton(t('common.ok'), 'danger', () => this.#close(true))],
            });

            this.#show();
        });
    }

    static prompt(title, options = {}) {
        return new Promise((resolve) => {
            this.#init();
            this.#ensureSingle();
            this.#currentResolve = resolve;

            const safeTitle = StringUtils.escapeHtml(title);
            const {
                nameLabel = t('manager.workflowName'),
                namePlaceholder = t('manager.namePlaceholder'),
                nameValue = '',
                descLabel = t('manager.workflowDescription'),
                descPlaceholder = t('manager.descriptionPlaceholder'),
                descValue = '',
                okText = t('manager.save'),
                cancelText = t('manager.cancel'),
            } = options;

            this.#container.style.maxWidth = '500px';
            this.#container.style.width = '90%';
            this.#container.style.boxShadow = 'var(--shadow-xl, 0 10px 40px rgba(0, 0, 0, 0.2))';
            this.#container.style.overflow = 'hidden';

            this.#container.innerHTML = `
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border, #eee); display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="font-size: 1.2rem; color: var(--text-primary, #333); margin: 0; font-weight: 600;">${safeTitle}</h2>
                    <button id="dialog-prompt-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary, #999); padding: 0.25rem; line-height: 1;">×</button>
                </div>
                <div style="padding: 1.5rem;">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.9rem; color: var(--text-primary, #333); margin-bottom: 0.5rem;">${StringUtils.escapeHtml(nameLabel)}</label>
                        <input id="dialog-prompt-name" type="text" value="${StringUtils.escapeHtml(nameValue)}" placeholder="${StringUtils.escapeHtml(namePlaceholder)}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border, #ddd); border-radius: 6px; font-size: 0.9rem; outline: none; box-sizing: border-box; transition: border-color 0.2s ease; background: var(--bg-primary, #fff); color: var(--text-primary, #333);">
                    </div>
                    <div style="margin-bottom: 0;">
                        <label style="display: block; font-size: 0.9rem; color: var(--text-primary, #333); margin-bottom: 0.5rem;">${StringUtils.escapeHtml(descLabel)}</label>
                        <textarea id="dialog-prompt-desc" placeholder="${StringUtils.escapeHtml(descPlaceholder)}" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border, #ddd); border-radius: 6px; font-size: 0.9rem; outline: none; box-sizing: border-box; resize: vertical; transition: border-color 0.2s ease; font-family: inherit; min-height: 100px; background: var(--bg-primary, #fff); color: var(--text-primary, #333);">${StringUtils.escapeHtml(descValue)}</textarea>
                    </div>
                </div>
                <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border, #eee); display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button id="dialog-prompt-cancel" style="padding: 0.5rem 1rem; border: 1px solid var(--border, #ddd); border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500; background: var(--bg-primary, #fff); color: var(--text-secondary, #666); transition: background 0.2s;">${StringUtils.escapeHtml(cancelText)}</button>
                    <button id="dialog-prompt-ok" style="padding: 0.5rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; transition: opacity 0.2s;">${StringUtils.escapeHtml(okText)}</button>
                </div>
            `;

            const nameInput = /** @type {HTMLInputElement} */ (this.#container.querySelector('#dialog-prompt-name'));
            const descInput = /** @type {HTMLInputElement} */ (this.#container.querySelector('#dialog-prompt-desc'));

            nameInput.addEventListener('focus', () => {
                nameInput.style.borderColor = 'var(--accent, #667eea)';
                nameInput.style.boxShadow = '0 0 0 3px var(--accent-light, rgba(102, 126, 234, 0.1))';
            });
            nameInput.addEventListener('blur', () => {
                nameInput.style.borderColor = 'var(--border, #ddd)';
                nameInput.style.boxShadow = 'none';
            });
            descInput.addEventListener('focus', () => {
                descInput.style.borderColor = 'var(--accent, #667eea)';
                descInput.style.boxShadow = '0 0 0 3px var(--accent-light, rgba(102, 126, 234, 0.1))';
            });
            descInput.addEventListener('blur', () => {
                descInput.style.borderColor = 'var(--border, #ddd)';
                descInput.style.boxShadow = 'none';
            });

            const handleConfirm = () => {
                const name = nameInput.value.trim();
                if (!name) {
                    nameInput.style.borderColor = 'var(--danger, #EF4444)';
                    nameInput.style.boxShadow = '0 0 0 3px var(--danger-light, rgba(239, 68, 68, 0.1))';
                    nameInput.focus();
                    return;
                }
                this.#close({ name, description: descInput.value.trim() });
            };

            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleConfirm();
            });
            descInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleConfirm();
                }
            });

            this.#container.querySelector('#dialog-prompt-close').addEventListener('click', () => this.#close(null));
            this.#container.querySelector('#dialog-prompt-cancel').addEventListener('click', () => this.#close(null));
            this.#container.querySelector('#dialog-prompt-ok').addEventListener('click', handleConfirm);

            this.#show();

            setTimeout(() => nameInput.focus(), 100);
        });
    }
}