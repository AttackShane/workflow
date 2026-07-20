/**
 * 语法高亮器模块测试
 */
import { highlightJson, highlightYaml } from '../src/modules/converter/converter-highlighter.js';

describe('Highlighter', () => {
    describe('highlightJson basic functionality', () => {
        it('should highlight keys and string values', () => {
            const result = highlightJson('{"name": "test"}');
            expect(result).toContain('<span class="hl-key">');
            expect(result).toContain('"name":');
            expect(result).toContain('<span class="hl-string">');
            expect(result).toContain('"test"');
        });

        it('should handle numbers', () => {
            const result = highlightJson('{"count": 42}');
            expect(result).toContain('<span class="hl-number">42</span>');
        });

        it('should handle booleans', () => {
            const result = highlightJson('{"active": true}');
            expect(result).toContain('<span class="hl-bool">true</span>');
        });

        it('should handle null', () => {
            const result = highlightJson('{"value": null}');
            expect(result).toContain('<span class="hl-bool">null</span>');
        });

        it('should handle empty strings', () => {
            const result = highlightJson('{"empty": ""}');
            expect(result).toContain('<span class="hl-string">""</span>');
        });

        it('should handle empty objects', () => {
            const result = highlightJson('{}');
            expect(result).toBe('{}');
        });
    });

    describe('highlightJson HTML escaping', () => {
        it('should escape special characters', () => {
            const result = highlightJson('{"<script>": "value"}');
            expect(result).not.toContain('<script>');
        });

        it('should escape special characters in string values', () => {
            const result = highlightJson('{"text": "<b>bold</b>"}');
            expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;');
            expect(result).not.toContain('<b>');
        });

        it('should handle special characters in string values', () => {
            const result = highlightJson('{"text": "hello & world"}');
            expect(result).toContain('&amp;');
        });
    });

    describe('highlightJson multiline', () => {
        it('should correctly highlight multi-line JSON', () => {
            const json = `{
  "name": "John",
  "age": 30,
  "active": true
}`;
            const result = highlightJson(json);
            expect(result).toContain('<span class="hl-key">"name":</span>');
            expect(result).toContain('<span class="hl-string">"John"</span>');
            expect(result).toContain('<span class="hl-number">30</span>');
            expect(result).toContain('<span class="hl-bool">true</span>');
        });
    });

    describe('highlightJson invalid JSON', () => {
        it('should return original text for invalid JSON', () => {
            const result = highlightJson('{ unclosed bracket');
            expect(result).toBe('{ unclosed bracket');
        });

        it('should handle completely empty input', () => {
            expect(highlightJson('')).toBe('');
        });
    });

    describe('highlightYaml', () => {
        it('should highlight list items', () => {
            const result = highlightYaml('- item');
            expect(result).toContain('<span class="hl-list">');
            expect(result).toContain('item');
        });

        it('should highlight keys', () => {
            const result = highlightYaml('name: John');
            expect(result).toContain('<span class="hl-key">name:</span>');
            expect(result).toContain('John');
        });

        it('should highlight string values on new lines', () => {
            const result = highlightYaml('description: |');
            expect(result).toContain('<span class="hl-key">description:</span>');
            expect(result).toContain('|');
        });

        it('should handle quoted strings in YAML', () => {
            const result = highlightYaml('empty: ""');
            expect(result).toContain('<span class="hl-key">empty:</span>');
            expect(result).toContain('<span class="hl-string">');
        });

        it('should handle multiple lines with mixed content', () => {
            const yaml = `name: Test
enabled: true
items:
  - one
  - two`;
            const result = highlightYaml(yaml);
            expect(result).toContain('<span class="hl-key">name:</span>');
            expect(result).toContain('<span class="hl-list">');
            expect(result).toContain('<span class="hl-bool">true</span>');
        });

        it('should handle empty YAML', () => {
            expect(highlightYaml('')).toBe('');
        });
    });

    describe('highlightYaml HTML escaping', () => {
        it('should escape special characters', () => {
            const result = highlightYaml('content: <div>test</div>');
            expect(result).toContain('&lt;div&gt;test&lt;/div&gt;');
            expect(result).not.toContain('<div>');
        });
    });
});