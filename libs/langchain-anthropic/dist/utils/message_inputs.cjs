"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._formatMessagesForAnthropic = exports._convertLangChainToolCallToAnthropic = void 0;
/**
 * This util file contains functions for converting LangChain messages to Anthropic messages.
 */
const messages_1 = require("@langchain/core/messages");
function _formatImage(imageUrl) {
    const regex = /^data:(image\/.+);base64,(.+)$/;
    const match = imageUrl.match(regex);
    if (match === null) {
        throw new Error([
            "Anthropic only supports base64-encoded images currently.",
            "Example: data:image/png;base64,/9j/4AAQSk...",
        ].join("\n\n"));
    }
    return {
        type: "base64",
        media_type: match[1] ?? "",
        data: match[2] ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    };
}
function _mergeMessages(messages) {
    // Merge runs of human/tool messages into single human messages with content blocks.
    const merged = [];
    for (const message of messages) {
        if (message._getType() === "tool") {
            if (typeof message.content === "string") {
                const previousMessage = merged[merged.length - 1];
                if (previousMessage?._getType() === "human" &&
                    Array.isArray(previousMessage.content) &&
                    "type" in previousMessage.content[0] &&
                    previousMessage.content[0].type === "tool_result") {
                    // If the previous message was a tool result, we merge this tool message into it.
                    previousMessage.content.push({
                        type: "tool_result",
                        content: message.content,
                        tool_use_id: message.tool_call_id,
                    });
                }
                else {
                    // If not, we create a new human message with the tool result.
                    merged.push(new messages_1.HumanMessage({
                        content: [
                            {
                                type: "tool_result",
                                content: message.content,
                                tool_use_id: message.tool_call_id,
                            },
                        ],
                    }));
                }
            }
            else {
                merged.push(new messages_1.HumanMessage({ content: message.content }));
            }
        }
        else {
            const previousMessage = merged[merged.length - 1];
            if (previousMessage?._getType() === "human" &&
                message._getType() === "human") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let combinedContent;
                if (typeof previousMessage.content === "string") {
                    combinedContent = [{ type: "text", text: previousMessage.content }];
                }
                else {
                    combinedContent = previousMessage.content;
                }
                if (typeof message.content === "string") {
                    combinedContent.push({ type: "text", text: message.content });
                }
                else {
                    combinedContent = combinedContent.concat(message.content);
                }
                previousMessage.content = combinedContent;
            }
            else {
                merged.push(message);
            }
        }
    }
    return merged;
}
function _convertLangChainToolCallToAnthropic(toolCall) {
    if (toolCall.id === undefined) {
        throw new Error(`Anthropic requires all tool calls to have an "id".`);
    }
    return {
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.args,
    };
}
exports._convertLangChainToolCallToAnthropic = _convertLangChainToolCallToAnthropic;
function _formatContent(content) {
    const toolTypes = ["tool_use", "tool_result", "input_json_delta"];
    const textTypes = ["text", "text_delta"];
    if (typeof content === "string") {
        return content;
    }
    else {
        const contentBlocks = content.map((contentPart) => {
            if (contentPart.type === "image_url") {
                let source;
                if (typeof contentPart.image_url === "string") {
                    source = _formatImage(contentPart.image_url);
                }
                else {
                    source = _formatImage(contentPart.image_url.url);
                }
                return {
                    type: "image",
                    source,
                };
            }
            else if (textTypes.find((t) => t === contentPart.type) &&
                "text" in contentPart) {
                // Assuming contentPart is of type MessageContentText here
                return {
                    type: "text",
                    text: contentPart.text,
                };
            }
            else if (toolTypes.find((t) => t === contentPart.type)) {
                const contentPartCopy = { ...contentPart };
                if ("index" in contentPartCopy) {
                    // Anthropic does not support passing the index field here, so we remove it.
                    delete contentPartCopy.index;
                }
                if (contentPartCopy.type === "input_json_delta") {
                    // `input_json_delta` type only represents yielding partial tool inputs
                    // and is not a valid type for Anthropic messages.
                    contentPartCopy.type = "tool_use";
                }
                if ("input" in contentPartCopy) {
                    // Anthropic tool use inputs should be valid objects, when applicable.
                    try {
                        contentPartCopy.input = JSON.parse(contentPartCopy.input);
                    }
                    catch {
                        // no-op
                    }
                }
                // TODO: Fix when SDK types are fixed
                return {
                    ...contentPartCopy,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                };
            }
            else {
                throw new Error("Unsupported message content format");
            }
        });
        return contentBlocks;
    }
}
/**
 * Formats messages as a prompt for the model.
 * @param messages The base messages to format as a prompt.
 * @returns The formatted prompt.
 */
function _formatMessagesForAnthropic(messages) {
    const mergedMessages = _mergeMessages(messages);
    let system;
    if (mergedMessages.length > 0 && mergedMessages[0]._getType() === "system") {
        system = messages[0].content;
    }
    const conversationMessages = system !== undefined ? mergedMessages.slice(1) : mergedMessages;
    const formattedMessages = conversationMessages.map((message) => {
        let role;
        if (message._getType() === "human") {
            role = "user";
        }
        else if (message._getType() === "ai") {
            role = "assistant";
        }
        else if (message._getType() === "tool") {
            role = "user";
        }
        else if (message._getType() === "system") {
            throw new Error("System messages are only permitted as the first passed message.");
        }
        else {
            throw new Error(`Message type "${message._getType()}" is not supported.`);
        }
        if ((0, messages_1.isAIMessage)(message) && !!message.tool_calls?.length) {
            if (typeof message.content === "string") {
                if (message.content === "") {
                    return {
                        role,
                        content: message.tool_calls.map(_convertLangChainToolCallToAnthropic),
                    };
                }
                else {
                    return {
                        role,
                        content: [
                            { type: "text", text: message.content },
                            ...message.tool_calls.map(_convertLangChainToolCallToAnthropic),
                        ],
                    };
                }
            }
            else {
                const { content } = message;
                const hasMismatchedToolCalls = !message.tool_calls.every((toolCall) => content.find((contentPart) => (contentPart.type === "tool_use" ||
                    contentPart.type === "input_json_delta") &&
                    contentPart.id === toolCall.id));
                if (hasMismatchedToolCalls) {
                    console.warn(`The "tool_calls" field on a message is only respected if content is a string.`);
                }
                return {
                    role,
                    content: _formatContent(message.content),
                };
            }
        }
        else {
            return {
                role,
                content: _formatContent(message.content),
            };
        }
    });
    return {
        messages: formattedMessages,
        system,
    };
}
exports._formatMessagesForAnthropic = _formatMessagesForAnthropic;
