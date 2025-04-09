"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceObserver = exports.performance = void 0;
var log4js = require('log4js');
const logLevel = process.env.LOG_LEVEL || 'info';
_a = require("perf_hooks"), exports.performance = _a.performance, exports.PerformanceObserver = _a.PerformanceObserver;
module.exports.getLoggerByName = function (name) {
    log4js.configure({
        appenders: {
            everything: { type: "stdout", layout: { type: 'pattern', pattern: '[%d] [%p] - %c - %f{1}:%l:%o -  %m%n' } },
        },
        categories: {
            default: { appenders: ["everything"], level: logLevel, enableCallStack: true },
        },
    });
    const logger = log4js.getLogger(name);
    return logger;
};
module.exports.getLogger = function () {
    return module.exports.getLoggerByName('SAP');
};
const logger = require("../utils/logger").getLogger();
/*
    Log For Performance--> time in millisecs with function name
*/
const perfObserver = new exports.PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        logger.info({ "name": entry.name, "time in milli-secs": entry.duration + " SAP ms" });
    });
});
perfObserver.observe({ entryTypes: ["measure"], buffer: true });
//# sourceMappingURL=logger.js.map