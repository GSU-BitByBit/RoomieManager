"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
exports.mapStatusToErrorCode = mapStatusToErrorCode;
const common_1 = require("@nestjs/common");
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["BadRequest"] = "BAD_REQUEST";
    ErrorCode["Unauthorized"] = "UNAUTHORIZED";
    ErrorCode["Forbidden"] = "FORBIDDEN";
    ErrorCode["NotFound"] = "NOT_FOUND";
    ErrorCode["Conflict"] = "CONFLICT";
    ErrorCode["InternalError"] = "INTERNAL_ERROR";
    ErrorCode["ServiceUnavailable"] = "SERVICE_UNAVAILABLE";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
function mapStatusToErrorCode(status) {
    switch (status) {
        case common_1.HttpStatus.BAD_REQUEST:
            return ErrorCode.BadRequest;
        case common_1.HttpStatus.UNAUTHORIZED:
            return ErrorCode.Unauthorized;
        case common_1.HttpStatus.FORBIDDEN:
            return ErrorCode.Forbidden;
        case common_1.HttpStatus.NOT_FOUND:
            return ErrorCode.NotFound;
        case common_1.HttpStatus.CONFLICT:
            return ErrorCode.Conflict;
        case common_1.HttpStatus.SERVICE_UNAVAILABLE:
            return ErrorCode.ServiceUnavailable;
        default:
            return ErrorCode.InternalError;
    }
}
