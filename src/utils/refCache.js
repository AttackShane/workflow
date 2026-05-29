export class RefCache {
    constructor() {
        this.cache = new Map();
        this.counter = 0;
        this.objectKeyMap = new WeakMap();
    }

    getObjectKey(obj) {
        if (!this.objectKeyMap.has(obj)) {
            this.objectKeyMap.set(obj, `obj_${++this.counter}`);
        }
        return this.objectKeyMap.get(obj);
    }

    findRef(obj) {
        if (!obj || typeof obj !== 'object') return null;

        const key = this.getObjectKey(obj);
        if (this.cache.has(key)) return this.cache.get(key);

        if (obj.path && obj.ref_node) {
            this.cache.set(key, obj);
            return obj;
        }

        for (const k in obj) {
            const r = this.findRef(obj[k]);
            if (r) {
                this.cache.set(key, r);
                return r;
            }
        }

        this.cache.set(key, null);
        return null;
    }

    clear() {
        this.cache.clear();
        this.counter = 0;
        this.objectKeyMap = new WeakMap();
    }
}

export const refCacheInstance = new RefCache();

export function findRef(obj) {
    return refCacheInstance.findRef(obj);
}

export function clearRefCache() {
    refCacheInstance.clear();
}