/**
 * 工作流历史记录模块测试
 */
import { WorkflowCore } from '../src/modules/editor/editor-core.js';

describe('WorkflowHistory', () => {
    let core;

    beforeEach(() => {
        core = new WorkflowCore();
    });

    describe('history recording', () => {
        it('should start with empty history', () => {
            expect(core.history).toEqual([]);
            expect(core.historyIndex).toBe(-1);
        });

        it('should record history entry', () => {
            core.nodes = [{ id: 'node_1', type: 'start' }];
            core.saveHistory('test.action');

            expect(core.history).toHaveLength(1);
            expect(core.history[0].actionKey).toBe('test.action');
            expect(core.history[0].nodes).toEqual([{ id: 'node_1', type: 'start' }]);
        });

        it('should record history with params', () => {
            core.saveHistory('test.action', { param: 'value' });
            expect(core.history[0].actionParams).toEqual({ param: 'value' });
        });

        it('should truncate future history when pushing after undo', () => {
            core.saveHistory('action1');
            core.saveHistory('action2');
            core.saveHistory('action3');
            core.historyIndex = 0;

            core.saveHistory('action4');
            expect(core.history).toHaveLength(2);
            expect(core.history[0].actionKey).toBe('action1');
            expect(core.history[1].actionKey).toBe('action4');
        });

        it('should limit history to maxHistory', () => {
            core.maxHistory = 3;
            for (let i = 0; i < 5; i++) {
                core.saveHistory('action' + i);
            }
            expect(core.history.length).toBeLessThanOrEqual(3);
        });
    });

    describe('undo/redo', () => {
        beforeEach(() => {
            core.nodes = [{ id: 'node_1', type: 'start' }];
            core.saveHistory('initial');
            core.nodes = [
                { id: 'node_1', type: 'start' },
                { id: 'node_2', type: 'end' }
            ];
            core.saveHistory('add_node');
        });

        it('should undo last action', () => {
            expect(core.canUndo()).toBe(true);
            core.undo();
            expect(core.nodes).toHaveLength(1);
            expect(core.nodes[0].type).toBe('start');
        });

        it('should redo after undo', () => {
            core.undo();
            expect(core.canRedo()).toBe(true);
            core.redo();
            expect(core.nodes).toHaveLength(2);
        });

        it('should not undo at start of history', () => {
            core.undo();
            core.undo();
            expect(core.canUndo()).toBe(false);
        });

        it('should not redo at end of history', () => {
            expect(core.canRedo()).toBe(false);
        });
    });

    describe('resetHistory', () => {
        it('should reset history with action label', () => {
            core.nodes = [{ id: 'node_1' }];
            core.resetHistory('init');

            expect(core.history).toHaveLength(1);
            expect(core.history[0].actionKey).toBe('init');
            expect(core.historyIndex).toBe(0);
        });
    });
});