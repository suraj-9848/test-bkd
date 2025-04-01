var log4js = require('log4js');
const logLevel = process.env.LOG_LEVEL || 'info';
export const { performance, PerformanceObserver } = require("perf_hooks")

module.exports.getLoggerByName = function(name){
	log4js.configure({
		appenders: {
		  everything: { type: "stdout", layout: { type: 'pattern',  pattern: '[%d] [%p] - %c - %f{1}:%l:%o -  %m%n'} },
		},
		categories: {
		  default: { appenders: ["everything"], level: logLevel, enableCallStack : true },
		},
	  });
    const logger = log4js.getLogger(name);
    return logger;
}

module.exports.getLogger = function(){
    return module.exports.getLoggerByName('SAP');
}

const logger = require("../utils/logger").getLogger();


/*
	Log For Performance--> time in millisecs with function name
*/
const perfObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry:any) => {
    logger.info({"name":entry.name,"time in milli-secs":entry.duration + " SAP ms"})
  })
})

perfObserver.observe({ entryTypes: ["measure"], buffer: true })

