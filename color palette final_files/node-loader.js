function nodeLoader(){const nodeLoadstartTime=Date.now(),phcodeExecHandlerMap={},nodeConnectorIDMap={},pendingExecPromiseMap={};let currentCommandID=1,wssEndpoint,controlSocket,dataSocket;const SOCKET_TYPE_DATA="data",SOCKET_TYPE_CONTROL="control",LARGE_DATA_THRESHOLD=2097152,MAX_RECONNECT_BACKOFF_TIME_MS=1e3,NODE_CONNECTOR_CREATE_TIMEOUT=1e4,MAX_QUEUE_LENGTH=2e3,pendingNodeConnectorExecMap={},pendingNodeConnectorEventMap={},isTimerRunningMap={},WS_COMMAND={RESPONSE:"response",EXEC:"exec",EVENT:"event",LARGE_DATA_SOCKET_ANNOUNCE:"largeDataSock",CONTROL_SOCKET_ANNOUNCE:"controlSock"},WS_ERR_CODES={NO_SUCH_FN:"NoSuchFn"};function mergeMetadataAndArrayBuffer(metadata,bufferData){if(bufferData instanceof ArrayBuffer&&(metadata.hasBufferData=!0),bufferData=bufferData||new ArrayBuffer(0),"object"!=typeof metadata)throw new Error("metadata should be an object, but was "+typeof metadata);if(!(bufferData instanceof ArrayBuffer))throw new Error("Expected bufferData to be an instance of ArrayBuffer, but was "+typeof bufferData);const metadataString=JSON.stringify(metadata),metadataUint8Array=(new TextEncoder).encode(metadataString),metadataBuffer=metadataUint8Array.buffer,sizePrefixLength=4;if(metadataBuffer.byteLength>4294e6)throw new Error("metadata too large. Should be below 4,294MB, but was "+metadataBuffer.byteLength);const concatenatedBuffer=new ArrayBuffer(4+metadataBuffer.byteLength+bufferData.byteLength),concatenatedUint8Array=new Uint8Array(concatenatedBuffer);return new DataView(concatenatedBuffer).setUint32(0,metadataBuffer.byteLength,!0),concatenatedUint8Array.set(metadataUint8Array,4),bufferData.byteLength>0&&concatenatedUint8Array.set(new Uint8Array(bufferData),4+metadataBuffer.byteLength),concatenatedBuffer}function splitMetadataAndBuffer(concatenatedBuffer){if(!(concatenatedBuffer instanceof ArrayBuffer))throw new Error("Expected ArrayBuffer message from websocket");const sizePrefixLength=4,buffer1Length=new DataView(concatenatedBuffer).getUint32(0,!0),buffer1=concatenatedBuffer.slice(4,4+buffer1Length),metadata=JSON.parse((new TextDecoder).decode(buffer1));let buffer2;return concatenatedBuffer.byteLength>4+buffer1Length&&(buffer2=concatenatedBuffer.slice(4+buffer1Length)),!buffer2&&metadata.hasBufferData&&(buffer2=new ArrayBuffer(0)),{metadata:metadata,bufferData:buffer2}}const MAX_PENDING_SEND_BUFFER=1e4;let pendingSendBuffer=[];function _drainPendingSendBuffer(){const copyPendingSendBuffer=pendingSendBuffer;pendingSendBuffer=[];for(let{commandObject:commandObject,dataBuffer:dataBuffer}of copyPendingSendBuffer)_sendWithAppropriateSocket(commandObject,dataBuffer)}function _isSocketOpen(socket){return socket&&socket.readyState===WebSocket.OPEN}function _sendWithAppropriateSocket(commandObject,dataBuffer){let socketToUse=controlSocket||dataSocket;const atleastOneSocketUsable=_isSocketOpen(controlSocket)||_isSocketOpen(dataSocket);if(socketToUse&&atleastOneSocketUsable)(dataBuffer&&dataBuffer.byteLength>LARGE_DATA_THRESHOLD&&dataSocket&&_isSocketOpen(dataSocket)||_isSocketOpen(dataSocket)&&!_isSocketOpen(controlSocket))&&(socketToUse=dataSocket),socketToUse.send(mergeMetadataAndArrayBuffer(commandObject,dataBuffer));else{if(pendingSendBuffer.length>MAX_PENDING_SEND_BUFFER)throw new Error("Too many node ws messages queued before a node connection was established to phnode.");pendingSendBuffer.push({commandObject:commandObject,dataBuffer:dataBuffer})}}function _sendInitCommand(socket,commandCode){const commandID=++currentCommandID;socket.send(mergeMetadataAndArrayBuffer({commandCode:commandCode,commandID:commandID,data:null},null))}function _sendExec(nodeConnectorID,commandID,execHandlerFnName,dataObjectToSend=null,dataBuffer=null){const command={nodeConnectorID:nodeConnectorID,commandID:commandID,execHandlerFnName:execHandlerFnName,commandCode:WS_COMMAND.EXEC,data:dataObjectToSend};_sendWithAppropriateSocket(command,dataBuffer)}function _sendExecResponse(defaultWS,metadata,dataObjectToSend=null,dataBuffer=null){const response={originalCommand:metadata.commandCode,commandCode:WS_COMMAND.RESPONSE,commandID:metadata.commandID,error:metadata.error,data:dataObjectToSend};let socketToUse=defaultWS||controlSocket;dataBuffer&&dataBuffer.byteLength>LARGE_DATA_THRESHOLD&&dataSocket&&(socketToUse=dataSocket),socketToUse.send(mergeMetadataAndArrayBuffer(response,dataBuffer))}function _sendEvent(nodeConnectorID,eventName,dataObjectToSend=null,dataBuffer=null){const event={nodeConnectorID:nodeConnectorID,eventName:eventName,commandCode:WS_COMMAND.EVENT,data:dataObjectToSend};_sendWithAppropriateSocket(event,dataBuffer)}function _sendError(defaultWS,metadata,err={},defaultMessage="Operation failed! "){metadata.error={message:err.message||defaultMessage,code:err.code,stack:err.stack},_sendExecResponse(defaultWS,metadata)}function _isObject(variable){return"object"==typeof variable&&null!==variable}function _extractBuffer(result){if(_isObject(result)&&result.buffer instanceof ArrayBuffer){const buffer=result.buffer;return delete result.buffer,buffer}return null}function _isJSONStringifiable(result){try{return JSON.stringify(result),!0}catch(e){return!1}}function _errNClearQueue(nodeConnectorID){const pendingExecList=pendingNodeConnectorExecMap[nodeConnectorID];pendingNodeConnectorExecMap[nodeConnectorID]=[];for(const{ws:ws,metadata:metadata}of pendingExecList)_sendError(ws,metadata,new Error(`NodeConnector ${nodeConnectorID} not found to exec function ${metadata.execHandlerFnName}`))}function _queueExec(nodeConnectorID,ws,metadata,bufferData){let pendingExecList=pendingNodeConnectorExecMap[nodeConnectorID];pendingExecList||(pendingExecList=[],pendingNodeConnectorExecMap[nodeConnectorID]=pendingExecList),pendingExecList.length>MAX_QUEUE_LENGTH?_sendError(ws,metadata,new Error(`Too Many exec while waiting for NodeConnector ${nodeConnectorID} creation to exec fn ${metadata.execHandlerFnName}`)):(pendingExecList.push({ws:ws,metadata:metadata,bufferData:bufferData}),isTimerRunningMap[nodeConnectorID]||(isTimerRunningMap[nodeConnectorID]=!0,setTimeout(()=>{isTimerRunningMap[nodeConnectorID]=!1,_errNClearQueue(nodeConnectorID)},NODE_CONNECTOR_CREATE_TIMEOUT)))}function _drainExecQueue(nodeConnectorID){let pendingExecList=pendingNodeConnectorExecMap[nodeConnectorID]||[];pendingNodeConnectorExecMap[nodeConnectorID]=[];for(const{ws:ws,metadata:metadata,bufferData:bufferData}of pendingExecList)_execPhcodeConnectorFn(ws,metadata,bufferData)}function _execPhcodeConnectorFn(ws,metadata,dataBuffer){const nodeConnectorID=metadata.nodeConnectorID,execHandlerFnName=metadata.execHandlerFnName,moduleExports=phcodeExecHandlerMap[nodeConnectorID];if(moduleExports)try{if("function"!=typeof moduleExports[execHandlerFnName]){const err=new Error("execHandlerFnName: "+execHandlerFnName+" no such function in node connector module: "+nodeConnectorID);throw err.code=WS_ERR_CODES.NO_SUCH_FN,err}const response=moduleExports[execHandlerFnName](metadata.data,dataBuffer);if(!(response instanceof Promise))throw new Error(`execHandlerFnName: ${nodeConnectorID}::${execHandlerFnName} : `+" is expected to return a promise that resolve to ({data, ?buffer})");response.then(result=>{const buffer=_extractBuffer(result);if(!_isJSONStringifiable(result))throw new Error(`execHandlerFnName: ${nodeConnectorID}::${execHandlerFnName} : `+" is expected to return a promise that resolve to an object that can be JSON.stringify -ed. To pass an array buffer, use resolve({buffer:arrayBufferObj})");_sendExecResponse(ws,metadata,result,buffer)}).catch(err=>{_sendError(ws,metadata,err,`Error executing function in: ${nodeConnectorID}:${execHandlerFnName}`)})}catch(e){_sendError(ws,metadata,e,"Phcode Could not execute function in: "+nodeConnectorID)}else _queueExec(nodeConnectorID,ws,metadata,dataBuffer)}function _queueEvent(nodeConnectorID,ws,metadata,bufferData){let pendingEventList=pendingNodeConnectorEventMap[nodeConnectorID];pendingEventList||(pendingEventList=[],pendingNodeConnectorEventMap[nodeConnectorID]=pendingEventList),pendingEventList.length>MAX_QUEUE_LENGTH?_sendError(ws,metadata,new Error(`Too Many events: ${metadata.eventName} while waiting for NodeConnector ${nodeConnectorID} creation`)):(pendingEventList.push({ws:ws,metadata:metadata,bufferData:bufferData}),isTimerRunningMap[nodeConnectorID]||(isTimerRunningMap[nodeConnectorID]=!0,setTimeout(()=>{isTimerRunningMap[nodeConnectorID]=!1,_errNClearQueue(nodeConnectorID)},NODE_CONNECTOR_CREATE_TIMEOUT)))}function _drainEventQueue(nodeConnectorID){let pendingEventList=pendingNodeConnectorEventMap[nodeConnectorID]||[];pendingNodeConnectorEventMap[nodeConnectorID]=[];for(const{ws:ws,metadata:metadata,bufferData:bufferData}of pendingEventList)_triggerEvent(ws,metadata,bufferData)}function _triggerEvent(ws,metadata,dataBuffer){const nodeConnectorID=metadata.nodeConnectorID,nodeConnector=nodeConnectorIDMap[nodeConnectorID];nodeConnector?nodeConnector.trigger(metadata.eventName,metadata.data,dataBuffer):_queueEvent(nodeConnectorID,ws,metadata,dataBuffer)}function processWSCommand(ws,metadata,dataBuffer){try{switch(metadata.commandCode){case WS_COMMAND.EXEC:return void _execPhcodeConnectorFn(ws,metadata,dataBuffer);case WS_COMMAND.EVENT:return void _triggerEvent(ws,metadata,dataBuffer);case WS_COMMAND.RESPONSE:const commandID=metadata.commandID,pendingExecPromise=pendingExecPromiseMap[commandID];if(!pendingExecPromise)throw new Error("Unable to find response handler for "+JSON.stringify(metadata));if(metadata.error){const error=new Error(metadata.error.message,{cause:metadata.error.stack});error.code=metadata.error.code,error.nodeStack=metadata.error.stack,pendingExecPromise.reject(error)}else{const result=metadata.data;dataBuffer instanceof ArrayBuffer&&(result.buffer=dataBuffer),pendingExecPromise.resolve(result)}delete pendingExecPromiseMap[commandID];break;default:console.error("unknown command: "+metadata)}}catch(e){console.error(e)}}function createNodeConnector(nodeConnectorID,moduleExports){if(nodeConnectorIDMap[nodeConnectorID])throw new Error("A node connector of the name is already registered: "+nodeConnectorID);if(!_isObject(moduleExports)||!nodeConnectorID)throw new Error("Invalid Argument. Expected createNodeConnector(string, module/Object) for "+nodeConnectorID);phcodeExecHandlerMap[nodeConnectorID]=moduleExports;const newNodeConnector={execPeer:function(execHandlerFnName,dataObjectToSend=null,dataBuffer=null){if(dataBuffer&&!(dataBuffer instanceof ArrayBuffer)||dataObjectToSend instanceof ArrayBuffer)throw new Error("execPeer should be called with exactly 3 arguments or less (FnName:string, data:Object|string, buffer:ArrayBuffer)");if(dataBuffer instanceof ArrayBuffer&&!_isObject(dataObjectToSend))throw new Error("execPeer second argument should be an object if sending binary data (FnName:string, data:Object, buffer:ArrayBuffer)");return new Promise((resolve,reject)=>{pendingExecPromiseMap[++currentCommandID]={resolve:resolve,reject:reject},_sendExec(nodeConnectorID,currentCommandID,execHandlerFnName,dataObjectToSend,dataBuffer)})},triggerPeer:function(eventName,dataObjectToSend=null,dataBuffer=null){if(dataBuffer&&!(dataBuffer instanceof ArrayBuffer))throw new Error("triggerPeer should be called with exactly 3 arguments (eventName:string, data:Object|string, buffer:ArrayBuffer)");_sendEvent(nodeConnectorID,eventName,dataObjectToSend,dataBuffer)}};return window.EventDispatcher.makeEventDispatcher(newNodeConnector),nodeConnectorIDMap[nodeConnectorID]=newNodeConnector,setTimeout(()=>{_drainExecQueue(nodeConnectorID),_drainEventQueue(nodeConnectorID)},0),newNodeConnector}function _silentlyCloseSocket(socket){if(socket)try{socket.autoReconnect=!1,socket.close()}catch(e){console.error("node-loader: ",e)}}function _wait(timeMS){return new Promise(resolve=>{setTimeout(resolve,timeMS)})}async function _establishAndMaintainConnection(socketType,firstConnectCB){let ws=new WebSocket(wssEndpoint);ws.binaryType="arraybuffer",ws.autoReconnect=!0;const resolved=!1;for(;ws.autoReconnect;){let wsClosePromiseResolve;const wsClosePromise=new Promise(resolve=>{wsClosePromiseResolve=resolve});socketType===SOCKET_TYPE_CONTROL?controlSocket=ws:(ws.isLargeDataWS=!0,dataSocket=ws),ws.addEventListener("open",()=>{ws.backoffTime=0,firstConnectCB(),ws.isLargeDataWS?_sendInitCommand(ws,WS_COMMAND.LARGE_DATA_SOCKET_ANNOUNCE):_sendInitCommand(ws,WS_COMMAND.CONTROL_SOCKET_ANNOUNCE),_drainPendingSendBuffer()}),ws.addEventListener("message",function(event){const{metadata:metadata,bufferData:bufferData}=splitMetadataAndBuffer(event.data);processWSCommand(ws,metadata,bufferData)}),ws.addEventListener("error",function(event){console.error("PhoenixFS websocket error event: ",event)}),ws.addEventListener("close",function(){wsClosePromiseResolve()}),await wsClosePromise;const backoffTime=Math.min(2*ws.backoffTime,MAX_RECONNECT_BACKOFF_TIME_MS)||1;ws.backoffTime=backoffTime,await _wait(backoffTime),ws.autoReconnect&&((ws=new WebSocket(wssEndpoint)).backoffTime=backoffTime,ws.binaryType="arraybuffer",ws.autoReconnect=!0)}}async function setNodeWSEndpoint(websocketEndpoint){return new Promise((resolve,reject)=>{websocketEndpoint===wssEndpoint&&reject(new Error("A connection on the same websocket address is in progress: "+websocketEndpoint)),_silentlyCloseSocket(controlSocket),controlSocket=null,_silentlyCloseSocket(dataSocket),dataSocket=null,wssEndpoint=websocketEndpoint;let resolved=!1;function firstConnectCB(){resolved||(resolve(),resolved=!0)}_establishAndMaintainConnection(SOCKET_TYPE_CONTROL,firstConnectCB),_establishAndMaintainConnection(SOCKET_TYPE_DATA,firstConnectCB)})}window.nodeSetupDonePromise=new Promise((resolve,reject)=>{const NODE_COMMANDS_TERMINATE="terminate",NODE_COMMANDS_PING="ping",NODE_COMMANDS_SET_DEBUG_MODE="setDebugMode",NODE_COMMANDS_GET_ENDPOINTS="getEndpoints",COMMAND_RESPONSE_PREFIX="phnodeResp_1!5$:",COMMAND_ERROR_PREFIX="phnodeErr_1!5$:";let command,child,resolved=!1,commandID=0,pendingCommands={};const PHNODE_PREFERENCES_KEY="PhNode.Prefs";function setInspectEnabled(enabled){const prefs=JSON.parse(localStorage.getItem(PHNODE_PREFERENCES_KEY)||"{}");prefs.inspectEnabled=enabled,localStorage.setItem(PHNODE_PREFERENCES_KEY,JSON.stringify(prefs))}function isInspectEnabled(){const prefs=JSON.parse(localStorage.getItem(PHNODE_PREFERENCES_KEY)||"{}");return!!prefs.inspectEnabled}function getRandomNumber(min,max){return Math.floor(Math.random()*(max-min+1))+min}let nodeTerminationResolve;const nodeTerminationPromise=new Promise(resolve=>{nodeTerminationResolve=resolve});window.nodeTerminationPromise=nodeTerminationPromise,window.PhNodeEngine={createNodeConnector:createNodeConnector,setInspectEnabled:setInspectEnabled,isInspectEnabled:isInspectEnabled},window.isNodeReady=!1;let nodeErrorLogCount=0;const MAX_NODE_ERROR_LOGS_ALLOWED=10,NODE_ERROR_LOGS_RESET_INTERVAL=2e3;setInterval(()=>{!window.debugMode&&nodeErrorLogCount>10&&console.error("Too many node Errors, some errors were omitted from console.","Please enable `Debug menu> Phoenix code diagnostic tools> enable detailed logs` to view all."),nodeErrorLogCount=0},2e3),window.__TAURI__.path.resolveResource("src-node/index.js").then(async nodeSrcPath=>{if("linux"===Phoenix.platform){const cliArgs=await window.__TAURI__.invoke("_get_commandline_args");nodeSrcPath=`${window.path.dirname(cliArgs[0])}/src-node/index.js`}const inspectPort=Phoenix.isTestWindow?getRandomNumber(5e3,5e4):9229,argsArray=isInspectEnabled()?[`--inspect=${inspectPort}`,nodeSrcPath]:[nodeSrcPath,""];(command=window.__TAURI__.shell.Command.sidecar("phnode",argsArray)).on("close",data=>{window.isNodeTerminated=!0,window.isNodeReady=!1,nodeTerminationResolve(),console.log(`PhNode: command finished with code ${data.code} and signal ${data.signal}`),reject("PhNode: closed - Terminated.")}),command.on("error",error=>{window.isNodeTerminated=!0,window.isNodeReady=!1,nodeTerminationResolve(),console.error(`PhNode: command error: "${error}"`),logger.reportError(error,"PhNode failed to start!"),reject("PhNode: closed - Terminated.")}),command.stdout.on("data",line=>{if(line)if(line.startsWith("phnodeResp_1!5$:")){line=line.replace("phnodeResp_1!5$:","");const jsonMsg=JSON.parse(line);pendingCommands[jsonMsg.commandID].resolve(jsonMsg.message),delete pendingCommands[jsonMsg.commandID]}else if(line.startsWith("phnodeErr_1!5$:")){line=line.replace("phnodeErr_1!5$:","");const err=JSON.parse(line);logger.reportError(err,`PhNode ${err.type}:${err.code?err.code:""}`)}else console.log(`PhNode: ${line}`)}),command.stderr.on("data",line=>{(window.debugMode||nodeErrorLogCount<10)&&console.error(`PhNode: ${line}`),nodeErrorLogCount++}),child=await command.spawn();const execNode=function(commandCode,commandData){if(window.isNodeTerminated)return Promise.reject("Node is terminated! Cannot execute: "+commandCode);const newCommandID=commandID++;let resolveP,rejectP;child.write(JSON.stringify({commandCode:commandCode,commandID:newCommandID,commandData:commandData})+"\n");const promise=new Promise((resolve,reject)=>{resolveP=resolve,rejectP=reject});return pendingCommands[newCommandID]={resolve:resolveP,reject:rejectP},promise};window.PhNodeEngine.terminateNode=function(){return window.isNodeTerminated||execNode(NODE_COMMANDS_TERMINATE),nodeTerminationPromise},window.PhNodeEngine.getInspectPort=function(){return inspectPort},execNode(NODE_COMMANDS_GET_ENDPOINTS).then(message=>{fs.setNodeWSEndpoint(message.phoenixFSURL),fs.forceUseNodeWSEndpoint(!0),setNodeWSEndpoint(message.phoenixNodeURL),window.isNodeReady=!0,resolve(message),window.PhNodeEngine._nodeLoadTime=Date.now()-nodeLoadstartTime}),execNode(NODE_COMMANDS_SET_DEBUG_MODE,window.debugMode)})})}Phoenix.isNativeApp&&nodeLoader();
//# sourceMappingURL=node-loader.js.map