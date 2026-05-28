export class VirtualScroll {
    constructor(options) {
        this.container = options.container;
        this.content = options.content;
        this.lineNumbers = options.lineNumbers;
        this.lineNumbersContent = options.lineNumbersContent;
        this.buffer = options.buffer;
        
        this.lines = [];
        this.lineHeight = 24;
        this.visibleCount = 30;
        this.cacheCount = 5;
        
        this.init();
    }
    
    init() {
        this.updateLineHeight();
        this.visibleCount = Math.ceil(this.container.clientHeight / this.lineHeight) + 5;
        
        this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        this.container.addEventListener('resize', () => {
            this.visibleCount = Math.ceil(this.container.clientHeight / this.lineHeight) + 5;
        });
    }
    
    updateLineHeight() {
        const style = window.getComputedStyle(this.content);
        this.lineHeight = parseFloat(style.lineHeight) || 24;
    }
    
    setContent(text) {
        this.lines = text.split('\n');
        const totalHeight = this.lines.length * this.lineHeight;
        
        this.buffer.innerHTML = `<div style="height:${totalHeight}px;"></div>`;
        
        this.updateVisibleLines(0);
        this.renderLineNumbers();
    }
    
    updateVisibleLines(scrollTop = null) {
        if (this.lines.length === 0) return;
        
        const top = scrollTop !== null ? scrollTop : this.container.scrollTop;
        const startIndex = Math.max(0, Math.floor(top / this.lineHeight) - this.cacheCount);
        const endIndex = Math.min(startIndex + this.visibleCount + this.cacheCount * 2, this.lines.length);
        
        this.content.innerHTML = this.lines.slice(startIndex, endIndex).join('\n');
        this.content.style.transform = `translateY(${startIndex * this.lineHeight}px)`;
    }
    
    renderLineNumbers() {
        const totalLines = this.lines.length;
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
        this.container.removeEventListener('scroll', this.handleScroll.bind(this));
    }
}