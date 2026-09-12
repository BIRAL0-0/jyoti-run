/**
 * ObjectPool — generic pooling for pre-built Three.js objects
 * (research report §4.2). Never `new`/`dispose` during play:
 * pre-allocate, then acquire/release. Memory stays flat; GC pauses vanish.
 */
export class ObjectPool {
    /**
     * @param {() => THREE.Object3D} factory  creates one instance (adds nothing to scene)
     * @param {number} initialCount           pre-allocate warm
     */
    constructor(factory, initialCount = 16) {
        this.factory = factory;
        this.free = [];
        this.active = new Set();
        for (let i = 0; i < initialCount; i++) this.free.push(factory());
    }

    acquire() {
        const obj = this.free.pop() ?? this.factory();   // grow only under pressure
        this.active.add(obj);
        return obj;
    }

    release(obj) {
        if (!this.active.delete(obj)) return;
        obj.visible = false;
        this.free.push(obj);
    }

    /** Recycle everything that scrolled past the camera (called per-frame). */
    sweep(recycleZ, forEachReleased = () => {}) {
        for (const obj of [...this.active]) {
            if (obj.position.z > recycleZ) {              // world moves +z toward camera
                this.release(obj);
                forEachReleased(obj);
            }
        }
    }

    reset() {
        for (const obj of [...this.active]) this.release(obj);
    }
}
