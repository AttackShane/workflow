class KeyboardShortcuts {
    constructor() {
        this._elements = {};
    }

    _safeClick(el) {
        if (el) el.click();
    }

    _safeGet(id) {
        return document.getElementById(id);
    }

    initKeyboardShortcuts = () => {
        this._elements = {
            modeFileBtn: this._safeGet('modeFileBtn'),
            convertFileBtn: this._safeGet('convertFileBtn'),
            convertTextBtn: this._safeGet('convertTextBtn'),
            inputText: this._safeGet('inputText'),
            copyOutputBtn: this._safeGet('copyOutputBtn'),
            resetBtn: this._safeGet('resetBtn')
        };

        document.addEventListener('keydown', (e) => {
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

            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement !== this._elements.inputText) {
                e.preventDefault();
                this._safeClick(this._elements.copyOutputBtn);
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this._safeClick(this._elements.resetBtn);
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                if (this._elements.inputText) this._elements.inputText.value = '';
                this._safeClick(this._elements.resetBtn);
            }
        });
    };
}

const _instance = new KeyboardShortcuts();
export const initKeyboardShortcuts = (...args) => _instance.initKeyboardShortcuts(...args);