let elements = {};

export function initKeyboardShortcuts() {
    // 在 DOM 就绪后获取元素
    elements = {
        modeFileBtn: document.getElementById('modeFileBtn'),
        convertFileBtn: document.getElementById('convertFileBtn'),
        convertTextBtn: document.getElementById('convertTextBtn'),
        inputText: document.getElementById('inputText'),
        copyOutputBtn: document.getElementById('copyOutputBtn'),
        resetBtn: document.getElementById('resetBtn'),
    };

    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter 快速转换
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (elements.modeFileBtn.classList.contains('active')) {
                elements.convertFileBtn.click();
            } else {
                if (elements.inputText.value.trim()) {
                    elements.convertTextBtn.click();
                }
            }
        }
        
        // Ctrl/Cmd + C 复制结果（当结果区域有内容时）
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement !== elements.inputText) {
            e.preventDefault();
            elements.copyOutputBtn.click();
        }
        
        // Ctrl/Cmd + R 重置
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            elements.resetBtn.click();
        }
        
        // Escape 清空输入
        if (e.key === 'Escape') {
            e.preventDefault();
            elements.inputText.value = '';
            elements.resetBtn.click();
        }
    });
}