import PQueueMod from "p-queue";
let queue;
/**
 * Creates a queue using the p-queue library. The queue is configured to
 * auto-start and has a concurrency of 1, meaning it will process tasks
 * one at a time.
 */
function createQueue() {
    const PQueue = "default" in PQueueMod ? PQueueMod.default : PQueueMod;
    return new PQueue({
        autoStart: true,
        concurrency: 1,
    });
}
/**
 * Consume a promise, either adding it to the queue or waiting for it to resolve
 * @param promiseFn Promise to consume
 * @param wait Whether to wait for the promise to resolve or resolve immediately
 */
export async function consumeCallback(promiseFn, wait) {
    if (wait === true) {
        await promiseFn();
    }
    else {
        if (typeof queue === "undefined") {
            queue = createQueue();
        }
        void queue.add(promiseFn);
    }
}
/**
 * Waits for all promises in the queue to resolve. If the queue is
 * undefined, it immediately resolves a promise.
 */
export function awaitAllCallbacks() {
    return typeof queue !== "undefined" ? queue.onIdle() : Promise.resolve();
}
