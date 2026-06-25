import { WorkflowKeyboard } from '../src/modules/workflow-keyboard.js';

function createMockUI() {
    const handlers = {};
    return {
        selection: {
            deleteSelected: jest.fn(),
            duplicateSelected: jest.fn(),
            selectAll: jest.fn()
        },
        clipboard: {
            copy: jest.fn(),
            paste: jest.fn()
        },
        history: {
            undo: jest.fn(),
            redo: jest.fn()
        },
        confirmExit: jest.fn(),
        quickSave: jest.fn(),
        _handlers: handlers
    };
}

function createMockEvent(options = {}) {
    return {
        key: options.key || '',
        ctrlKey: options.ctrlKey || false,
        metaKey: options.metaKey || false,
        shiftKey: options.shiftKey || false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ...options
    };
}

function setupMockDom(activeElementTag = 'BODY') {
    global.document = {
        activeElement: { tagName: activeElementTag, isContentEditable: false },
        querySelector: jest.fn(() => null),
        addEventListener: jest.fn()
    };
}

describe('WorkflowKeyboard', () => {
    let keyboard;
    let mockUI;

    beforeEach(() => {
        mockUI = createMockUI();
        keyboard = new WorkflowKeyboard(mockUI);
        setupMockDom();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('handleKeydown', () => {
        it('should ignore keystrokes when input is focused', () => {
            setupMockDom('INPUT');
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when textarea is focused', () => {
            setupMockDom('TEXTAREA');
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when SELECT is focused', () => {
            setupMockDom('SELECT');
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when contentEditable is true', () => {
            global.document.activeElement = { tagName: 'DIV', isContentEditable: true };
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when modal is open', () => {
            const mockModal = { className: 'node-editor-modal' };
            global.document.querySelector = jest.fn(() => mockModal);
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should handle Delete key', () => {
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).toHaveBeenCalled();
        });

        it('should handle Backspace key', () => {
            const event = createMockEvent({ key: 'Backspace' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).toHaveBeenCalled();
        });

        it('should handle Ctrl+C (copy)', () => {
            const event = createMockEvent({ key: 'c', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.copy).toHaveBeenCalled();
        });

        it('should handle Cmd+C (copy on Mac)', () => {
            const event = createMockEvent({ key: 'c', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.copy).toHaveBeenCalled();
        });

        it('should handle Ctrl+V (paste)', () => {
            const event = createMockEvent({ key: 'v', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.paste).toHaveBeenCalled();
        });

        it('should handle Cmd+V (paste on Mac)', () => {
            const event = createMockEvent({ key: 'v', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.paste).toHaveBeenCalled();
        });

        it('should handle Ctrl+D (duplicate)', () => {
            const event = createMockEvent({ key: 'd', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).toHaveBeenCalled();
        });

        it('should handle Cmd+D (duplicate on Mac)', () => {
            const event = createMockEvent({ key: 'd', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).toHaveBeenCalled();
        });

        it('should handle Ctrl+A (select all)', () => {
            const event = createMockEvent({ key: 'a', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.selectAll).toHaveBeenCalled();
        });

        it('should handle Cmd+A (select all on Mac)', () => {
            const event = createMockEvent({ key: 'a', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.selectAll).toHaveBeenCalled();
        });

        it('should handle Ctrl+Z (undo)', () => {
            const event = createMockEvent({ key: 'z', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.undo).toHaveBeenCalled();
        });

        it('should handle Cmd+Z (undo on Mac)', () => {
            const event = createMockEvent({ key: 'z', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.undo).toHaveBeenCalled();
        });

        it('should not trigger undo with Ctrl+Shift+Z', () => {
            const event = createMockEvent({ key: 'z', ctrlKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(mockUI.history.undo).not.toHaveBeenCalled();
        });

        it('should handle Ctrl+Y (redo)', () => {
            const event = createMockEvent({ key: 'y', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.redo).toHaveBeenCalled();
        });

        it('should handle Cmd+Shift+Z (redo on Mac)', () => {
            const event = createMockEvent({ key: 'Z', metaKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.redo).toHaveBeenCalled();
        });

        it('should handle Escape key', () => {
            const event = createMockEvent({ key: 'Escape' });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.confirmExit).toHaveBeenCalled();
        });

        it('should handle Ctrl+S (save)', () => {
            const event = createMockEvent({ key: 's', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.quickSave).toHaveBeenCalled();
        });

        it('should handle Cmd+S (save on Mac)', () => {
            const event = createMockEvent({ key: 's', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.quickSave).toHaveBeenCalled();
        });

        it('should pass through non-shortcut keys', () => {
            const event = createMockEvent({ key: 'x' });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
            expect(mockUI.clipboard.copy).not.toHaveBeenCalled();
            expect(mockUI.clipboard.paste).not.toHaveBeenCalled();
        });

        it('should not trigger actions for regular key presses with modifiers but wrong key', () => {
            const event = createMockEvent({ key: 'x', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockUI.clipboard.copy).not.toHaveBeenCalled();
            expect(mockUI.clipboard.paste).not.toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).not.toHaveBeenCalled();
            expect(mockUI.selection.selectAll).not.toHaveBeenCalled();
            expect(mockUI.history.undo).not.toHaveBeenCalled();
            expect(mockUI.history.redo).not.toHaveBeenCalled();
            expect(mockUI.quickSave).not.toHaveBeenCalled();
        });
    });
});