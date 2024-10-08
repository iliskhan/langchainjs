import { Tiktoken, getEncodingNameForModel, } from "js-tiktoken/lite";
import { AsyncCaller } from "./async_caller.js";
const cache = {};
const caller = /* #__PURE__ */ new AsyncCaller({});
export async function getEncoding(encoding) {
    if (!(encoding in cache)) {
        cache[encoding] = caller
            .fetch(`https://tiktoken.pages.dev/js/${encoding}.json`)
            .then((res) => res.json())
            .then((data) => new Tiktoken(data))
            .catch((e) => {
            delete cache[encoding];
            throw e;
        });
    }
    return await cache[encoding];
}
export async function encodingForModel(model) {
    return getEncoding(getEncodingNameForModel(model));
}
