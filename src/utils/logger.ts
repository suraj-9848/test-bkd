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

export function getLogger() {
  return getLoggerByName("SAP");
}

// Performance logging
const logger = getLogger();

const perfObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry: any) => {
    logger.info({
      name: entry.name,
      "time in milli-secs": entry.duration + " SAP ms",
    });
  });
});

perfObserver.observe({ entryTypes: ["measure"], buffered: true });

// Also export performance utils if needed elsewhere
export { performance, PerformanceObserver };
