export class Dialog {
    static #overlay = null;
    static #container = null;
    static #currentResolve = null;
    static #keydownHandler = null;
    
    static #init() {
        if (this.#overlay) return;
        
        this.#overlay = document.createElement('div');
        this.#overlay.className = 'dialog-overlay';
        this.#overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        document.body.appendChild(this.#overlay);
        
        this.#container = document.createElement('div');
        this.#container.className = 'dialog-container';
        this.#container.style.cssText = `
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            min-width: 320px;
            max-width: 480px;
            transform: scale(0.9) translateY(-20px);
            transition: transform 0.2s ease;
        `;
        this.#overlay.appendChild(this.#container);
        
        this.#overlay.addEventListener('click', (e) => {
            if (e.target === this.#overlay) {
                this.#close(false);
            }
        });
        
        this.#keydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.#close(false);
            }
        };
    }
    
    static #escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }
    
    static #show() {
        this.#overlay.style.opacity = '1';
        this.#container.style.transform = 'scale(1) translateY(0)';
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', this.#keydownHandler);
    }
    
    static #close(result = false) {
        document.removeEventListener('keydown', this.#keydownHandler);
        this.#overlay.style.opacity = '0';
        this.#container.style.transform = 'scale(0.9) translateY(-20px)';
        document.body.style.overflow = '';
        
        setTimeout(() => {
            if (this.#container) {
                this.#container.innerHTML = '';
            }
            if (this.#currentResolve) {
                this.#currentResolve(result);
                this.#currentResolve = null;
            }
        }, 200);
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
        } else {
            btn.style.background = '#f3f4f6';
            btn.style.color = '#374151';
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#e5e7eb';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#f3f4f6';
            });
        }
        
        btn.addEventListener('click', onClick);
        return btn;
    }
    
    static alert(message, title = '提示') {
        return new Promise((resolve) => {
            this.#init();
            this.#currentResolve = resolve;
            
            const safeMessage = this.#escapeHtml(message);
            const safeTitle = this.#escapeHtml(title);
            const btnId = `dialog-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            this.#container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; background: #FEF3C7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="font-size: 20px;">ℹ️</span>
                        </div>
                        <h3 style="font-size: 16px; font-weight: 600; color: #1F2937; margin: 0;">${safeTitle}</h3>
                    </div>
                    <p style="color: #4B5563; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${safeMessage}</p>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="${btnId}" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; min-width: 80px; background: linear-gradient(135deg, #5C62FF 0%, #7C3AED 100%); color: #fff; box-shadow: 0 4px 12px rgba(92, 98, 255, 0.3);">
                            确定
                        </button>
                    </div>
                </div>
            `;
            
            this.#show();
            
            document.getElementById(btnId).addEventListener('click', () => {
                this.#close(true);
            });
        });
    }
    
    static confirm(message, title = '确认', options = {}) {
        return new Promise((resolve) => {
            this.#init();
            this.#currentResolve = resolve;
            
            const safeMessage = this.#escapeHtml(message);
            const safeTitle = this.#escapeHtml(title);
            const { okText = '确定', cancelText = '取消', danger = false } = options;
            const safeOkText = this.#escapeHtml(okText);
            const safeCancelText = this.#escapeHtml(cancelText);
            const btnPrefix = `dialog-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const confirmBtnId = `${btnPrefix}-confirm`;
            const cancelBtnId = `${btnPrefix}-cancel`;
            
            this.#container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; background: ${danger ? '#FEE2E2' : '#FEF3C7'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="font-size: 20px;">${danger ? '⚠️' : '❓'}</span>
                        </div>
                        <h3 style="font-size: 16px; font-weight: 600; color: #1F2937; margin: 0;">${safeTitle}</h3>
                    </div>
                    <p style="color: #4B5563; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${safeMessage}</p>
                    <div style="display: flex; justify-content: flex-end; gap: 12px;">
                        <button id="${cancelBtnId}" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; min-width: 80px; background: #f3f4f6; color: #374151;">
                            ${safeCancelText}
                        </button>
                        <button id="${confirmBtnId}" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; min-width: 80px; background: ${danger ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3)' : 'linear-gradient(135deg, #5C62FF 0%, #7C3AED 100%); box-shadow: 0 4px 12px rgba(92, 98, 255, 0.3)'}; color: #fff;">
                            ${safeOkText}
                        </button>
                    </div>
                </div>
            `;
            
            this.#show();
            
            document.getElementById(cancelBtnId).addEventListener('click', () => {
                this.#close(false);
            });
            
            document.getElementById(confirmBtnId).addEventListener('click', () => {
                this.#close(true);
            });
        });
    }
    
    static success(message, title = '成功') {
        return new Promise((resolve) => {
            this.#init();
            this.#currentResolve = resolve;
            
            const safeMessage = this.#escapeHtml(message);
            const safeTitle = this.#escapeHtml(title);
            const btnId = `dialog-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            this.#container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; background: #D1FAE5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="font-size: 20px;">✅</span>
                        </div>
                        <h3 style="font-size: 16px; font-weight: 600; color: #1F2937; margin: 0;">${safeTitle}</h3>
                    </div>
                    <p style="color: #4B5563; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${safeMessage}</p>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="${btnId}" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; min-width: 80px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                            确定
                        </button>
                    </div>
                </div>
            `;
            
            this.#show();
            
            document.getElementById(btnId).addEventListener('click', () => {
                this.#close(true);
            });
        });
    }
    
    static error(message, title = '错误') {
        return new Promise((resolve) => {
            this.#init();
            this.#currentResolve = resolve;
            
            const safeMessage = this.#escapeHtml(message);
            const safeTitle = this.#escapeHtml(title);
            const btnId = `dialog-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            this.#container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 40px; height: 40px; background: #FEE2E2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="font-size: 20px;">❌</span>
                        </div>
                        <h3 style="font-size: 16px; font-weight: 600; color: #1F2937; margin: 0;">${safeTitle}</h3>
                    </div>
                    <p style="color: #4B5563; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${safeMessage}</p>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="${btnId}" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; min-width: 80px; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: #fff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
                            确定
                        </button>
                    </div>
                </div>
            `;
            
            this.#show();
            
            document.getElementById(btnId).addEventListener('click', () => {
                this.#close(true);
            });
        });
    }
}