class KeyboardShortcuts {
    constructor() {
        this._elements = {};
        this._keydownHandler = null;
    }

    _safeClick(el) {
        if (el) el.click();
    }

    _safeGet(id) {
        return document.getElementById(id);
    }

    _isInputFocused() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        return (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            /** @type {HTMLElement} */ (el).isContentEditable
        );
    }

    initKeyboardShortcuts = () => {
        this._elements = {
            modeFileBtn: this._safeGet('modeFileBtn'),
            convertFileBtn: this._safeGet('convertFileBtn'),
            convertTextBtn: this._safeGet('convertTextBtn'),
            inputText: this._safeGet('inputText'),
            copyOutputBtn: this._safeGet('copyOutputBtn'),
            resetBtn: this._safeGet('resetBtn'),
        };

        this._keydownHandler = (e) => {
            if (!this._elements.inputText) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this._elements.modeFileBtn && this._elements.modeFileBtn.classList.contains('active')) {
                    this._safeClick(this._elements.convertFileBtn);
                } else {
                    if (this._elements.inputText.value && this._elements.inputText.value.trim()) {
                        this._safeClick(this._elements.convertTextBtn);
                    }
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !this._isInputFocused()) {
                e.preventDefault();
                this._safeClick(this._elements.copyOutputBtn);
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !this._isInputFocused()) {
                e.preventDefault();
                this._safeClick(this._elements.resetBtn);
            }

            if (e.key === 'Escape' && !this._isInputFocused()) {
                e.preventDefault();
                if (this._elements.inputText) this._elements.inputText.value = '';
                this._safeClick(this._elements.resetBtn);
            }
        };

        document.addEventListener('keydown', this._keydownHandler);
    };

    destroy() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
    }
}

const _instance = new KeyboardShortcuts();
// @ts-ignore
export const initKeyboardShortcuts = (...args) => _instance.initKeyboardShortcuts(...args);
export const destroyKeyboardShortcuts = () => _instance.destroy();
