/**
 * 引用缓存模块测试
 */
import { RefCache, refCacheInstance, findRef, clearRefCache } from '../src/utils/refCache.js';

describe('RefCache', () => {
    let cache;

    beforeEach(() => {
        cache = new RefCache();
    });

    describe('constructor', () => {
        it('should initialize with empty state', () => {
            const c = new RefCache();
            expect(c.cache).toBeInstanceOf(Map);
            expect(c.cache.size).toBe(0);
            expect(c.counter).toBe(0);
            expect(c.objectKeyMap).toBeInstanceOf(WeakMap);
        });

        it('should create independent instances', () => {
            const c1 = new RefCache();
            const c2 = new RefCache();
            expect(c1).not.toBe(c2);
            expect(c1.cache).not.toBe(c2.cache);
        });
    });

    describe('getObjectKey', () => {
        it('should assign unique keys to objects', () => {
            const obj1 = {};
            const obj2 = {};
            const key1 = cache.getObjectKey(obj1);
            const key2 = cache.getObjectKey(obj2);
            expect(key1).not.toBe(key2);
            expect(key1).toMatch(/^obj_\d+$/);
            expect(key2).toMatch(/^obj_\d+$/);
        });

        it('should return same key for same object', () => {
            const obj = {};
            const key1 = cache.getObjectKey(obj);
            const key2 = cache.getObjectKey(obj);
            expect(key1).toBe(key2);
        });

        it('should increment counter for each new object', () => {
            const c = new RefCache();
            expect(c.counter).toBe(0);
            c.getObjectKey({});
            expect(c.counter).toBe(1);
            c.getObjectKey({});
            expect(c.counter).toBe(2);
            c.getObjectKey({});
            expect(c.counter).toBe(3);
        });

        it('should not increment counter for existing objects', () => {
            const obj = {};
            cache.getObjectKey(obj);
            const counter = cache.counter;
            cache.getObjectKey(obj);
            expect(cache.counter).toBe(counter);
        });
    });

    describe('findRef', () => {
        it('should return null for null input', () => {
            expect(cache.findRef(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(cache.findRef(undefined)).toBeNull();
        });

        it('should return null for primitive values', () => {
            expect(cache.findRef(42)).toBeNull();
            expect(cache.findRef('string')).toBeNull();
            expect(cache.findRef(true)).toBeNull();
        });

        it('should find object with path and ref_node', () => {
            const refObj = { path: 'output.data', ref_node: 'node_123' };
            const result = cache.findRef(refObj);
            expect(result).toBe(refObj);
        });

        it('should cache result for repeated calls', () => {
            const refObj = { path: 'output.data', ref_node: 'node_123' };
            cache.findRef(refObj);
            expect(cache.cache.size).toBeGreaterThan(0);
            const cached = cache.findRef(refObj);
            expect(cached).toBe(refObj);
        });

        it('should find nested ref in object', () => {
            const nested = {
                a: { b: { path: 'output.x', ref_node: 'node_456' } }
            };
            const result = cache.findRef(nested);
            expect(result).toEqual({ path: 'output.x', ref_node: 'node_456' });
        });

        it('should find deeply nested ref', () => {
            const deep = {
                level1: {
                    level2: {
                        level3: {
                            level4: { path: 'deep.path', ref_node: 'deep_node' }
                        }
                    }
                }
            };
            const result = cache.findRef(deep);
            expect(result).toEqual({ path: 'deep.path', ref_node: 'deep_node' });
        });

        it('should return null for object without ref', () => {
            const plain = { a: 1, b: 2, c: { d: 3 } };
            const result = cache.findRef(plain);
            expect(result).toBeNull();
        });

        it('should return null for empty object', () => {
            const result = cache.findRef({});
            expect(result).toBeNull();
        });

        it('should find first ref in object with multiple refs', () => {
            const multi = {
                a: { path: 'first.ref', ref_node: 'first' },
                b: { path: 'second.ref', ref_node: 'second' }
            };
            const result = cache.findRef(multi);
            expect(result).toBeTruthy();
            expect(result.path).toBeDefined();
            expect(result.ref_node).toBeDefined();
        });

        it('should cache null for objects without refs', () => {
            const plain = { a: 1 };
            cache.findRef(plain);
            const key = cache.getObjectKey(plain);
            expect(cache.cache.get(key)).toBeNull();
        });

        it('should handle array with ref objects', () => {
            const arr = [1, 2, { path: 'arr.path', ref_node: 'arr_node' }];
            const result = cache.findRef(arr);
            expect(result).toEqual({ path: 'arr.path', ref_node: 'arr_node' });
        });

        it('should handle array without refs', () => {
            const arr = [1, 2, 3];
            const result = cache.findRef(arr);
            expect(result).toBeNull();
        });
    });

    describe('clear', () => {
        it('should clear all cached data', () => {
            cache.findRef({ path: 'test', ref_node: 'n1' });
            expect(cache.cache.size).toBeGreaterThan(0);

            cache.clear();
            expect(cache.cache.size).toBe(0);
            expect(cache.counter).toBe(0);
        });

        it('should create a new WeakMap after clear', () => {
            const obj = {};
            const keyBefore = cache.getObjectKey(obj);
            cache.clear();
            const keyAfter = cache.getObjectKey(obj);
            expect(keyAfter).toMatch(/^obj_1$/);
        });

        it('should allow reuse after clear', () => {
            cache.findRef({ path: 'p1', ref_node: 'n1' });
            cache.clear();

            const refObj = { path: 'p2', ref_node: 'n2' };
            const result = cache.findRef(refObj);
            expect(result).toBe(refObj);
        });
    });
});

describe('refCacheInstance (singleton)', () => {
    beforeEach(() => {
        refCacheInstance.clear();
    });

    it('should be an instance of RefCache', () => {
        expect(refCacheInstance).toBeInstanceOf(RefCache);
    });

    it('should find refs correctly', () => {
        const refObj = { path: 'singleton.path', ref_node: 'singleton_node' };
        const result = refCacheInstance.findRef(refObj);
        expect(result).toBe(refObj);
    });

    it('should return null for non-ref objects', () => {
        const result = refCacheInstance.findRef({ x: 1 });
        expect(result).toBeNull();
    });
});

describe('findRef (convenience function)', () => {
    beforeEach(() => {
        clearRefCache();
    });

    it('should find ref using singleton instance', () => {
        const refObj = { path: 'conv.path', ref_node: 'conv_node' };
        const result = findRef(refObj);
        expect(result).toBe(refObj);
    });

    it('should return null for null input', () => {
        expect(findRef(null)).toBeNull();
    });

    it('should return null for non-ref objects', () => {
        expect(findRef({ a: 1 })).toBeNull();
    });
});

describe('clearRefCache', () => {
    it('should clear the singleton cache', () => {
        refCacheInstance.findRef({ path: 'p', ref_node: 'n' });
        expect(refCacheInstance.cache.size).toBeGreaterThan(0);

        clearRefCache();
        expect(refCacheInstance.cache.size).toBe(0);
    });
});