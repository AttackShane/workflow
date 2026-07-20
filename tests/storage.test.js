/**
 * 工作流存储模块测试
 */
import { WorkflowCore } from '../src/modules/editor/editor-core.js';

var mockStorageData;

jest.mock('../src/utils/helpers.js', () => {
    mockStorageData = {};
    const actual = jest.requireActual('../src/utils/helpers.js');
    return {
        __esModule: true,
        ...actual,
        Storage: {
            get: jest.fn((key, defaultValue = null) => {
                const value = mockStorageData[key];
                if (value === undefined) return defaultValue;
                try {
                    return typeof value === 'string' ? JSON.parse(value) : value;
                } catch {
                    return defaultValue;
                }
            }),
            set: jest.fn((key, value) => {
                mockStorageData[key] = JSON.stringify(value);
            }),
            remove: jest.fn((key) => {
                delete mockStorageData[key];
            }),
            clear: jest.fn(() => {
                Object.keys(mockStorageData).forEach((k) => delete mockStorageData[k]);
            }),
            session: {
                get: jest.fn(),
                set: jest.fn(),
                remove: jest.fn(),
            },
        },
    };
});

global.localStorage = {
    _data: mockStorageData,
    getItem: function (key) {
        return this._data[key] !== undefined ? this._data[key] : null;
    },
    setItem: function (key, value) {
        this._data[key] = value;
    },
    removeItem: function (key) {
        delete this._data[key];
    },
    clear: function () {
        Object.keys(this._data).forEach((k) => delete this._data[k]);
    },
};

describe('WorkflowStorage', () => {
    let core;

    beforeEach(() => {
        localStorage.clear();
        core = new WorkflowCore();
        core.nodes = [
            { id: 'node_100001', type: 'start', x: 100, y: 200, title: '开始' },
            { id: 'node_100002', type: 'end', x: 400, y: 200, title: '结束' },
        ];
        core.edges = [{ id: 'edge_1', source: 'node_100001', target: 'node_100002' }];
        core.nodeIdCounter = 100002;
        core.edgeIdCounter = 100001;
    });

    describe('saveToLocalStorage', () => {
        it('should save worklow data to localStorage', () => {
            const result = core.saveToLocalStorage();
            expect(result).toBe(true);

            const stored = JSON.parse(localStorage.getItem('workflow_current'));
            expect(stored.nodes).toHaveLength(2);
            expect(stored.edges).toHaveLength(1);
            expect(stored.nodeIdCounter).toBe(100002);
            expect(stored.edgeIdCounter).toBe(100001);
        });

        it('should save to custom key', () => {
            core.saveToLocalStorage('custom_key');
            expect(localStorage.getItem('custom_key')).not.toBeNull();
        });

        it('should include savedAt timestamp', () => {
            core.saveToLocalStorage();
            const stored = JSON.parse(localStorage.getItem('workflow_current'));
            expect(typeof stored.savedAt).toBe('number');
        });
    });

    describe('loadFromLocalStorage', () => {
        it('should load saved worklow data', () => {
            core.saveToLocalStorage();

            const newCore = new WorkflowCore();
            const result = newCore.loadFromLocalStorage();

            expect(result).toBe(true);
            expect(newCore.nodes).toHaveLength(2);
            expect(newCore.edges).toHaveLength(1);
            expect(newCore.nodeIdCounter).toBe(100002);
            expect(newCore.edgeIdCounter).toBe(100001);
        });

        it('should return false when no data exists', () => {
            const result = core.loadFromLocalStorage('nonexistent');
            expect(result).toBe(false);
        });

        it('should handle empty data gracefully', () => {
            localStorage.setItem('workflow_current', JSON.stringify({}));
            const result = core.loadFromLocalStorage();
            expect(result).toBe(true);
            expect(core.nodes).toEqual([]);
            expect(core.edges).toEqual([]);
        });
    });

    describe('hasSavedWorkflow', () => {
        it('should return false when no workflow saved', () => {
            expect(core.hasSavedWorkflow()).toBe(false);
        });

        it('should return true when workflow is saved', () => {
            core.saveToLocalStorage();
            expect(core.hasSavedWorkflow()).toBe(true);
        });
    });

    describe('clearSavedWorkflow', () => {
        it('should remove saved workflow', () => {
            core.saveToLocalStorage();
            expect(core.hasSavedWorkflow()).toBe(true);

            core.clearSavedWorkflow();
            expect(core.hasSavedWorkflow()).toBe(false);
        });
    });

    describe('syncIdCounters', () => {
        it('should sync counters from node IDs', () => {
            core.nodes = [
                { id: 'node_100005', type: 'start' },
                { id: 'node_200010', type: 'end' },
            ];
            core.edges = [{ id: 'edge_50001', source: 'node_100005', target: 'node_200010' }];
            core.nodeIdCounter = 0;
            core.edgeIdCounter = 0;

            core.syncIdCounters();

            expect(core.nodeIdCounter).toBe(200010);
            expect(core.edgeIdCounter).toBe(50001);
        });

        it('should keep original counter if higher', () => {
            core.nodes = [{ id: 'node_100001', type: 'start' }];
            core.edges = [];
            core.nodeIdCounter = 500000;
            core.edgeIdCounter = 500000;

            core.syncIdCounters();

            expect(core.nodeIdCounter).toBe(500000);
            expect(core.edgeIdCounter).toBe(500000);
        });

        it('should handle non-matching IDs', () => {
            core.nodes = [{ id: 'custom_id', type: 'start' }];
            core.edges = [{ id: 'custom_edge', source: 'custom_id', target: 'none' }];
            core.nodeIdCounter = 100;
            core.edgeIdCounter = 100;

            core.syncIdCounters();

            expect(core.nodeIdCounter).toBe(100);
            expect(core.edgeIdCounter).toBe(100);
        });
    });
});
