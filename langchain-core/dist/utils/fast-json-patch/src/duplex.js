// @ts-nocheck
// Inlined because of ESM import issues
/*!
 * https://github.com/Starcounter-Jack/JSON-Patch
 * (c) 2013-2021 Joachim Wester
 * MIT license
 */
import { _deepClone, _objectKeys, escapePathComponent, hasOwnProperty, } from "./helpers.js";
import { applyPatch } from "./core.js";
var beforeDict = new WeakMap();
class Mirror {
    constructor(obj) {
        Object.defineProperty(this, "obj", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "observers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.obj = obj;
    }
}
class ObserverInfo {
    constructor(callback, observer) {
        Object.defineProperty(this, "callback", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "observer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.callback = callback;
        this.observer = observer;
    }
}
function getMirror(obj) {
    return beforeDict.get(obj);
}
function getObserverFromMirror(mirror, callback) {
    return mirror.observers.get(callback);
}
function removeObserverFromMirror(mirror, observer) {
    mirror.observers.delete(observer.callback);
}
/**
 * Detach an observer from an object
 */
export function unobserve(root, observer) {
    observer.unobserve();
}
/**
 * Observes changes made to an object, which can then be retrieved using generate
 */
export function observe(obj, callback) {
    var patches = [];
    var observer;
    var mirror = getMirror(obj);
    if (!mirror) {
        mirror = new Mirror(obj);
        beforeDict.set(obj, mirror);
    }
    else {
        const observerInfo = getObserverFromMirror(mirror, callback);
        observer = observerInfo && observerInfo.observer;
    }
    if (observer) {
        return observer;
    }
    observer = {};
    mirror.value = _deepClone(obj);
    if (callback) {
        observer.callback = callback;
        observer.next = null;
        var dirtyCheck = () => {
            generate(observer);
        };
        var fastCheck = () => {
            clearTimeout(observer.next);
            observer.next = setTimeout(dirtyCheck);
        };
        if (typeof window !== "undefined") {
            //not Node
            window.addEventListener("mouseup", fastCheck);
            window.addEventListener("keyup", fastCheck);
            window.addEventListener("mousedown", fastCheck);
            window.addEventListener("keydown", fastCheck);
            window.addEventListener("change", fastCheck);
        }
    }
    observer.patches = patches;
    observer.object = obj;
    observer.unobserve = () => {
        generate(observer);
        clearTimeout(observer.next);
        removeObserverFromMirror(mirror, observer);
        if (typeof window !== "undefined") {
            window.removeEventListener("mouseup", fastCheck);
            window.removeEventListener("keyup", fastCheck);
            window.removeEventListener("mousedown", fastCheck);
            window.removeEventListener("keydown", fastCheck);
            window.removeEventListener("change", fastCheck);
        }
    };
    mirror.observers.set(callback, new ObserverInfo(callback, observer));
    return observer;
}
/**
 * Generate an array of patches from an observer
 */
export function generate(observer, invertible = false) {
    var mirror = beforeDict.get(observer.object);
    _generate(mirror.value, observer.object, observer.patches, "", invertible);
    if (observer.patches.length) {
        applyPatch(mirror.value, observer.patches);
    }
    var temp = observer.patches;
    if (temp.length > 0) {
        observer.patches = [];
        if (observer.callback) {
            observer.callback(temp);
        }
    }
    return temp;
}
// Dirty check if obj is different from mirror, generate patches and update mirror
function _generate(mirror, obj, patches, path, invertible) {
    if (obj === mirror) {
        return;
    }
    if (typeof obj.toJSON === "function") {
        obj = obj.toJSON();
    }
    var newKeys = _objectKeys(obj);
    var oldKeys = _objectKeys(mirror);
    var changed = false;
    var deleted = false;
    //if ever "move" operation is implemented here, make sure this test runs OK: "should not generate the same patch twice (move)"
    for (var t = oldKeys.length - 1; t >= 0; t--) {
        var key = oldKeys[t];
        var oldVal = mirror[key];
        if (hasOwnProperty(obj, key) &&
            !(obj[key] === undefined &&
                oldVal !== undefined &&
                Array.isArray(obj) === false)) {
            var newVal = obj[key];
            if (typeof oldVal == "object" &&
                oldVal != null &&
                typeof newVal == "object" &&
                newVal != null &&
                Array.isArray(oldVal) === Array.isArray(newVal)) {
                _generate(oldVal, newVal, patches, path + "/" + escapePathComponent(key), invertible);
            }
            else {
                if (oldVal !== newVal) {
                    changed = true;
                    if (invertible) {
                        patches.push({
                            op: "test",
                            path: path + "/" + escapePathComponent(key),
                            value: _deepClone(oldVal),
                        });
                    }
                    patches.push({
                        op: "replace",
                        path: path + "/" + escapePathComponent(key),
                        value: _deepClone(newVal),
                    });
                }
            }
        }
        else if (Array.isArray(mirror) === Array.isArray(obj)) {
            if (invertible) {
                patches.push({
                    op: "test",
                    path: path + "/" + escapePathComponent(key),
                    value: _deepClone(oldVal),
                });
            }
            patches.push({
                op: "remove",
                path: path + "/" + escapePathComponent(key),
            });
            deleted = true; // property has been deleted
        }
        else {
            if (invertible) {
                patches.push({ op: "test", path, value: mirror });
            }
            patches.push({ op: "replace", path, value: obj });
            changed = true;
        }
    }
    if (!deleted && newKeys.length == oldKeys.length) {
        return;
    }
    for (var t = 0; t < newKeys.length; t++) {
        var key = newKeys[t];
        if (!hasOwnProperty(mirror, key) && obj[key] !== undefined) {
            patches.push({
                op: "add",
                path: path + "/" + escapePathComponent(key),
                value: _deepClone(obj[key]),
            });
        }
    }
}
/**
 * Create an array of patches from the differences in two objects
 */
export function compare(tree1, tree2, invertible = false) {
    var patches = [];
    _generate(tree1, tree2, patches, "", invertible);
    return patches;
}
