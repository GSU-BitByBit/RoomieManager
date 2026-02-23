"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequestId = resolveRequestId;
const node_crypto_1 = require("node:crypto");
function resolveRequestId(request) {
    const fromId = request.id;
    if (typeof fromId === 'string' && fromId.length > 0) {
        return fromId;
    }
    if (typeof fromId === 'number') {
        return String(fromId);
    }
    const headerValue = request.headers['x-request-id'];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
        return headerValue;
    }
    if (Array.isArray(headerValue) && headerValue.length > 0) {
        return headerValue[0];
    }
    return (0, node_crypto_1.randomUUID)();
}
