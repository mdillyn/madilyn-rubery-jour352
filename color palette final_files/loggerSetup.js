!function(){const loggableURLS=["phtauri://localhost","https://phtauri.localhost","https://phcode.dev","https://create.phcode.dev","https://dev.phcode.dev","https://staging.phcode.dev"];let isBugsnagLoggableURL=!1;for(let loggableURL of loggableURLS)if(window.location.href.startsWith(loggableURL)){isBugsnagLoggableURL=!0;break}const urlParams=new URLSearchParams(window.location.search||""),isBugsnagEnabled=!window.testEnvironment&&isBugsnagLoggableURL,MAX_ERR_SENT_RESET_INTERVAL=6e4,MAX_ERR_SENT_FIRST_MINUTE=10,MAX_ERR_ALLOWED_IN_MINUTE=2;let firstMinuteElapsed=!1,errorsSentThisMinute=0;class CustomBugSnagError extends Error{constructor(message,err){super(message+(err&&err.message||"")),this.name=err&&err.constructor&&err.constructor.name||this.constructor.name,this.stack=message+" : "+(err&&err.stack)||"stack not available"}}const logger={error:console.error,warn:console.warn,reportError:function(error,message){isBugsnagEnabled&&Bugsnag.notify(message?new CustomBugSnagError(message,error):error)},reportErrorMessage:function(message){isBugsnagEnabled&&Bugsnag.notify(new CustomBugSnagError(message))},leaveTrail:function(message){console.log("[Trail] : ",message),isBugsnagEnabled&&Bugsnag.leaveBreadcrumb(message)},loggingOptions:{LOCAL_STORAGE_KEYS:{LOG_TO_CONSOLE_KEY:"logToConsole",LOG_LIVE_PREVIEW:"logLivePreview"},healthDataDisabled:!1,logLivePreview:!1},livePreview:{log:function(...args){logger.loggingOptions.logLivePreview&&logger.log(...args)}}};function swallowLogs(){}window.logger=logger;const savedLoggingFn=console.log,savedInfoFn=console.info;function _shouldDiscardError(errors=[]){if(!window.Phoenix||!window.Phoenix.VFS)return!1;let fileURL,extensionName,userFsURLFound=!1,userExtensionsFolderURL=window.Phoenix.VFS.getVirtualServingURLForPath(window.Phoenix.VFS.getUserExtensionDir()+"/");for(let error of errors)if(error.stacktrace&&error.stacktrace[0])for(let stack of error.stacktrace){if((fileURL=stack.file||"").startsWith(userExtensionsFolderURL)){extensionName=(extensionName=fileURL.replace(userExtensionsFolderURL,"")).split("/")[0];let supportStatus="Y";return Phoenix.isSupportedBrowser||(supportStatus="N"),window.Metrics.countEvent(window.Metrics.EVENT_TYPE.ERROR,`extn-${supportStatus}-${extensionName}`,error.type),window.Metrics.countEvent(window.Metrics.EVENT_TYPE.ERROR,`extn-${supportStatus}-${extensionName}`,error.errorClass),logger.leaveTrail(`Extension Error for ${extensionName} of type ${error.type} class ${error.errorClass}`),!0}window.Phoenix.VFS.getPathForVirtualServingURL(fileURL)&&(userFsURLFound=!0)}return!!userFsURLFound}function onError(event){try{let reportedStatus="Reported",shouldReport=!0;if(logger.loggingOptions.healthDataDisabled||firstMinuteElapsed&&errorsSentThisMinute>MAX_ERR_ALLOWED_IN_MINUTE?(reportedStatus="Not Reported as health data disabled or max reports per minute breached.",shouldReport=!1):_shouldDiscardError(event.errors)&&(reportedStatus="Not Reported error from user extension or fs.",shouldReport=!1),console.error(`Caught Critical error, ${reportedStatus}: `,event),window.Metrics){let supportStatus="supportedBrowser";Phoenix.isSupportedBrowser||(supportStatus="unsupportedBrowser"),window.Metrics.countEvent(window.Metrics.EVENT_TYPE.ERROR,"uncaught",supportStatus)}return shouldReport&&errorsSentThisMinute++,shouldReport}catch(e){console.error("exception occurred while reposting error: ",e),event.addMetadata("onError","exception",e.message)}}window.setupLogging=function(){const logToConsoleOverride=urlParams.get(logger.loggingOptions.LOCAL_STORAGE_KEYS.LOG_TO_CONSOLE_KEY),logToConsolePref=localStorage.getItem(logger.loggingOptions.LOCAL_STORAGE_KEYS.LOG_TO_CONSOLE_KEY);return logToConsoleOverride&&"true"===logToConsoleOverride.toLowerCase()||logToConsolePref&&"true"===logToConsolePref.toLowerCase()&&!logToConsoleOverride?(console.log=savedLoggingFn,console.info=savedInfoFn,logger.log=console.log,logger.info=console.info,logger.logToConsolePref="true",window.debugMode=!0,!0):(console.info=console.log=swallowLogs,logger.info=logger.log=swallowLogs,logger.logToConsolePref="false",window.debugMode=!1,!1)},window.setupLogging(),window.isLoggingEnabled=function(key){let loggingEnabled;return"true"===(localStorage.getItem(key)||"false").toLowerCase()},window.toggleLoggingKey=function(key){window.isLoggingEnabled(key)?localStorage.setItem(key,"false"):localStorage.setItem(key,"true")},logger.loggingOptions.logLivePreview=window.isLoggingEnabled(logger.loggingOptions.LOCAL_STORAGE_KEYS.LOG_LIVE_PREVIEW);let context="desktop";if(Phoenix.browser.isTablet?context="tablet":Phoenix.browser.isMobile&&(context="mobile"),Phoenix.isNativeApp&&(context=`tauri-${context}`),Phoenix.browser.isMobile||Phoenix.browser.isTablet){let device="unknownDevice";Phoenix.browser.mobile.isAndroid?device="android":Phoenix.browser.mobile.isIos?device="ios":Phoenix.browser.mobile.isWindows&&(device="windows"),context=`${context}-${device}`}if(Phoenix.browser.isDeskTop){let browser="unknownBrowser";Phoenix.browser.desktop.isOperaChromium?browser="operaChrome":Phoenix.browser.desktop.isEdgeChromium?browser="edgeChrome":Phoenix.browser.desktop.isChrome?browser="googleChrome":Phoenix.browser.desktop.isChromeBased?browser="chromeLike":Phoenix.browser.desktop.isFirefox?browser="firefox":Phoenix.browser.desktop.isOpera?browser="operaLegacy":Phoenix.browser.desktop.isSafari?browser="safari":Phoenix.browser.desktop.isWebKit&&(browser="webkit"),context=`${context}-${Phoenix.platform}-${browser}`}context=Phoenix.isSupportedBrowser?`supported-${context}`:`unsupported-${context}`,Phoenix.supportContextName=context,console.log("BugSnag context is - ",context),isBugsnagEnabled?(Bugsnag.start({apiKey:"94ef94f4daf871ca0f2fc912c6d4764d",context:context,appType:Phoenix.browser&&Phoenix.isNativeApp?"tauri":"browser",collectUserIp:!1,appVersion:AppConfig.version,enabledReleaseStages:["development","production","staging","tauri-development","tauri-production","tauri-staging"],releaseStage:window.__TAURI__?"tauri-"+AppConfig.config.bugsnagEnv:AppConfig.config.bugsnagEnv,enabledBreadcrumbTypes:["manual"],maxEvents:10,maxBreadcrumbs:50,onError:onError}),setInterval(()=>{Bugsnag.resetEventCount(),firstMinuteElapsed=!0,errorsSentThisMinute=0},6e4)):console.warn("Logging to Bugsnag is disabled as current environment is localhost.")}();
//# sourceMappingURL=loggerSetup.js.map