let elements = {};

function safeClick(el) {
    if (el) el.click();
}

function safeGet(id) {
    return document.getElementById(id);
}

export function initKeyboardShortcuts() {
    elements = {
        modeFileBtn: safeGet('modeFileBtn'),
        convertFileBtn: safeGet('convertFileBtn'),
        convertTextBtn: safeGet('convertTextBtn'),
        inputText: safeGet('inputText'),
        copyOutputBtn: safeGet('copyOutputBtn'),
        resetBtn: safeGet('resetBtn')
    };

    document.addEventListener('keydown', (e) => {
        if (!elements.inputText) return;
        
        // Ctrl/Cmd + Enter 快速转换
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (elements.modeFileBtn && elements.modeFileBtn.classList.contains('active')) {
                safeClick(elements.convertFileBtn);
            } else {
                if (elements.inputText.value && elements.inputText.value.trim()) {
                    safeClick(elements.convertTextBtn);
                }
            }
        }
        
        // Ctrl/Cmd + C 复制结果（当结果区域有内容时）
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement !== elements.inputText) {
            e.preventDefault();
            safeClick(elements.copyOutputBtn);
        }
        
        // Ctrl/Cmd + R 重置
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            safeClick(elements.resetBtn);
        }
        
        // Escape 清空输入
        if (e.key === 'Escape') {
            e.preventDefault();
            if (elements.inputText) elements.inputText.value = '';
            safeClick(elements.resetBtn);
        }
    });
}