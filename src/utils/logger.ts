import log4js from "log4js";
import { performance, PerformanceObserver } from "perf_hooks";

const logLevel = process.env.LOG_LEVEL || "info";

export function getLoggerByName(name: string) {
  log4js.configure({
    appenders: {
      everything: {
        type: "stdout",
        layout: {
          type: "pattern",
          pattern: "[%d] [%p] - %c - %f{1}:%l:%o -  %m%n",
        },
      },
    },
    categories: {
      default: {
        appenders: ["everything"],
        level: logLevel,
        enableCallStack: true,
      },
    },
  });

  return log4js.getLogger(name);
}
// Removed redundant require statement for log4js
// Removed redundant local declaration of performance

// Removed duplicate implementation of getLoggerByName

export function getLogger() {
  return getLoggerByName("Trailbliz LMS");
}

// Performance logging
const logger = getLogger();

const perfObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry: any) => {
    logger.info({
      name: entry.name,
      "time in milli-secs": entry.duration + " SAP ms",
    });
  });
});
// Removed duplicate implementation of getLogger

// Also export performance utils if needed elsewhere
export { performance, PerformanceObserver };
perfObserver.observe({ entryTypes: ["measure"], buffered: true });
// Removed duplicate performance logging block
