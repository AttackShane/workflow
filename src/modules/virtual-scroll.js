import { APP_CONFIG } from '../config/constants.js';

export class VirtualScroll {
    constructor(options) {
        this.container = options.container;
        this.content = options.content;
        this.lineNumbers = options.lineNumbers;
        this.lineNumbersContent = options.lineNumbersContent;
        this.buffer = options.buffer;
        
        this.lines = [];
        this.lineHeight = APP_CONFIG.VIRTUAL_SCROLL.MIN_HEIGHT;
        this.visibleCount = 30;
        this.cacheCount = APP_CONFIG.VIRTUAL_SCROLL.CACHE_COUNT;
        
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundResizeHandler = () => {
            this.visibleCount = Math.ceil(this.container.clientHeight / this.lineHeight) + 5;
        };
        
        this.init();
    }
    
    init() {
        this.updateLineHeight();
        this.visibleCount = Math.ceil(this.container.clientHeight / this.lineHeight) + 5;
        
        this.container.addEventListener('scroll', this.boundHandleScroll, { passive: true });
        this.container.addEventListener('resize', this.boundResizeHandler);
        
        // 禁止行号区域滚动
        this.lineNumbers.style.overflow = 'hidden';
        this.lineNumbers.style.pointerEvents = 'none';
    }
    
    updateLineHeight() {
        const style = window.getComputedStyle(this.content);
        this.lineHeight = parseFloat(style.lineHeight) || 24;
    }
    
    setContent(text, originalLineCount = null) {
        this.lines = text.split('\n');
        // 使用原始行数（如果提供）或高亮后的行数
        const lineCount = originalLineCount !== null ? originalLineCount : this.lines.length;
        const totalHeight = lineCount * this.lineHeight;
        
        this.buffer.innerHTML = `<div style="height:${totalHeight}px;"></div>`;
        
        this.updateVisibleLines(0);
        // 使用原始行数渲染行号
        this.renderLineNumbers(lineCount);
    }
    
    updateVisibleLines(scrollTop = null) {
        if (this.lines.length === 0) return;
        
        const top = scrollTop !== null ? scrollTop : this.container.scrollTop;
        const startIndex = Math.max(0, Math.floor(top / this.lineHeight) - this.cacheCount);
        const endIndex = Math.min(startIndex + this.visibleCount + this.cacheCount * 2, this.lines.length);
        
        this.content.innerHTML = this.lines.slice(startIndex, endIndex).join('\n');
        this.content.style.transform = `translateY(${startIndex * this.lineHeight}px)`;
    }
    
    renderLineNumbers(lineCount = null) {
        // 使用提供的行数或默认使用高亮后的行数
        const totalLines = lineCount !== null ? lineCount : this.lines.length;
        const totalHeight = totalLines * this.lineHeight;
        
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < totalLines; i++) {
            const div = document.createElement('div');
            div.className = 'line-numbers-line';
            fragment.appendChild(div);
        }
        
        this.lineNumbersContent.innerHTML = '';
        this.lineNumbersContent.appendChild(fragment);
        this.lineNumbersContent.style.height = totalHeight + 'px';
    }
    
    handleScroll() {
        const maxScroll = this.buffer.scrollHeight - this.container.clientHeight;
        if (maxScroll <= 0) return;
        
        // 同步行号滚动（单向：内容 → 行号）
        const scrollPercent = this.container.scrollTop / maxScroll;
        const lineNumbersMaxScroll = this.lineNumbers.scrollHeight - this.lineNumbers.clientHeight;
        
        if (lineNumbersMaxScroll > 0) {
            this.lineNumbers.scrollTop = scrollPercent * lineNumbersMaxScroll;
        }
        
        this.updateVisibleLines();
    }
    
    scrollToTop() {
        this.container.scrollTop = 0;
        this.lineNumbers.scrollTop = 0;
        this.updateVisibleLines(0);
    }
    
    updateFontSize() {
        this.updateLineHeight();
        
        if (this.lines.length === 0) {
            return;
        }
        
        const totalHeight = this.lines.length * this.lineHeight;
        this.buffer.innerHTML = `<div style="height:${totalHeight}px;"></div>`;
        this.renderLineNumbers();
        this.updateVisibleLines(this.container.scrollTop);
    }
    
    destroy() {
        this.container.removeEventListener('scroll', this.boundHandleScroll);
        this.container.removeEventListener('resize', this.boundResizeHandler);
        
        this.boundHandleScroll = null;
        this.boundResizeHandler = null;
        
        // 恢复行号区域的样式
        this.lineNumbers.style.overflow = '';
        this.lineNumbers.style.pointerEvents = '';
        
        // 清理 buffer
        this.buffer.innerHTML = '';
        
        // 恢复内容区域的 transform
        this.content.style.transform = '';
        
        // 清理行号内容（重置为初始状态）
        this.lineNumbersContent.innerHTML = '';
        this.lineNumbersContent.style.height = '';
        
        // 清空行数组
        this.lines = [];
    }
}