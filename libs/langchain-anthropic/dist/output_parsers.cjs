"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractToolCalls = exports.AnthropicToolsOutputParser = void 0;
const output_parsers_1 = require("@langchain/core/output_parsers");
class AnthropicToolsOutputParser extends output_parsers_1.BaseLLMOutputParser {
    static lc_name() {
        return "AnthropicToolsOutputParser";
    }
    constructor(params) {
        super(params);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "anthropic", "output_parsers"]
        });
        Object.defineProperty(this, "returnId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        /** The type of tool calls to return. */
        Object.defineProperty(this, "keyName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Whether to return only the first tool call. */
        Object.defineProperty(this, "returnSingle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "zodSchema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.keyName = params.keyName;
        this.returnSingle = params.returnSingle ?? this.returnSingle;
        this.zodSchema = params.zodSchema;
    }
    async _validateResult(result) {
        let parsedResult = result;
        if (typeof result === "string") {
            try {
                parsedResult = JSON.parse(result);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (e) {
                throw new output_parsers_1.OutputParserException(`Failed to parse. Text: "${JSON.stringify(result, null, 2)}". Error: ${JSON.stringify(e.message)}`, result);
            }
        }
        else {
            parsedResult = result;
        }
        if (this.zodSchema === undefined) {
            return parsedResult;
        }
        const zodParsedResult = await this.zodSchema.safeParseAsync(parsedResult);
        if (zodParsedResult.success) {
            return zodParsedResult.data;
        }
        else {
            throw new output_parsers_1.OutputParserException(`Failed to parse. Text: "${JSON.stringify(result, null, 2)}". Error: ${JSON.stringify(zodParsedResult.error.errors)}`, JSON.stringify(parsedResult, null, 2));
        }
    }
    async parseResult(generations) {
        const tools = generations.flatMap((generation) => {
            const { message } = generation;
            if (!Array.isArray(message.content)) {
                return [];
            }
            const tool = extractToolCalls(message.content)[0];
            return tool;
        });
        if (tools[0] === undefined) {
            throw new Error("No parseable tool calls provided to AnthropicToolsOutputParser.");
        }
        const [tool] = tools;
        const validatedResult = await this._validateResult(tool.args);
        return validatedResult;
    }
}
exports.AnthropicToolsOutputParser = AnthropicToolsOutputParser;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractToolCalls(content) {
    const toolCalls = [];
    for (const block of content) {
        if (block.type === "tool_use") {
            toolCalls.push({
                name: block.name,
                args: block.input,
                id: block.id,
                type: "tool_call",
            });
        }
    }
    return toolCalls;
}
exports.extractToolCalls = extractToolCalls;
