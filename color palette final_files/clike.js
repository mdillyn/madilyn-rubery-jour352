!function(mod){"object"==typeof exports&&"object"==typeof module?mod(require("../../lib/codemirror")):"function"==typeof define&&define.amd?define(["../../lib/codemirror"],mod):mod(CodeMirror)}(function(CodeMirror){"use strict";function Context(indented,column,type,info,align,prev){this.indented=indented,this.column=column,this.type=type,this.info=info,this.align=align,this.prev=prev}function pushContext(state,col,type,info){var indent=state.indented;return state.context&&"statement"==state.context.type&&"statement"!=type&&(indent=state.context.indented),state.context=new Context(indent,col,type,info,null,state.context)}function popContext(state){var t=state.context.type;return")"!=t&&"]"!=t&&"}"!=t||(state.indented=state.context.indented),state.context=state.context.prev}function typeBefore(stream,state,pos){return"variable"==state.prevToken||"type"==state.prevToken||(!!/\S(?:[^- ]>|[*\]])\s*$|\*$/.test(stream.string.slice(0,pos))||(!(!state.typeAtEndOfLine||stream.column()!=stream.indentation())||void 0))}function isTopScope(context){for(;;){if(!context||"top"==context.type)return!0;if("}"==context.type&&"namespace"!=context.prev.info)return!1;context=context.prev}}function words(str){for(var obj={},words=str.split(" "),i=0;i<words.length;++i)obj[words[i]]=!0;return obj}function contains(words,word){return"function"==typeof words?words(word):words.propertyIsEnumerable(word)}CodeMirror.defineMode("clike",function(config,parserConfig){var indentUnit=config.indentUnit,statementIndentUnit=parserConfig.statementIndentUnit||indentUnit,dontAlignCalls=parserConfig.dontAlignCalls,keywords=parserConfig.keywords||{},types=parserConfig.types||{},builtin=parserConfig.builtin||{},blockKeywords=parserConfig.blockKeywords||{},defKeywords=parserConfig.defKeywords||{},atoms=parserConfig.atoms||{},hooks=parserConfig.hooks||{},multiLineStrings=parserConfig.multiLineStrings,indentStatements=!1!==parserConfig.indentStatements,indentSwitch=!1!==parserConfig.indentSwitch,namespaceSeparator=parserConfig.namespaceSeparator,isPunctuationChar=parserConfig.isPunctuationChar||/[\[\]{}\(\),;\:\.]/,numberStart=parserConfig.numberStart||/[\d\.]/,number=parserConfig.number||/^(?:0x[a-f\d]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(u|ll?|l|f)?/i,isOperatorChar=parserConfig.isOperatorChar||/[+\-*&%=<>!?|\/]/,isIdentifierChar=parserConfig.isIdentifierChar||/[\w\$_\xa1-\uffff]/,isReservedIdentifier=parserConfig.isReservedIdentifier||!1,curPunc,isDefKeyword;function tokenBase(stream,state){var ch=stream.next();if(hooks[ch]){var result=hooks[ch](stream,state);if(!1!==result)return result}if('"'==ch||"'"==ch)return state.tokenize=tokenString(ch),state.tokenize(stream,state);if(numberStart.test(ch)){if(stream.backUp(1),stream.match(number))return"number";stream.next()}if(isPunctuationChar.test(ch))return curPunc=ch,null;if("/"==ch){if(stream.eat("*"))return state.tokenize=tokenComment,tokenComment(stream,state);if(stream.eat("/"))return stream.skipToEnd(),"comment"}if(isOperatorChar.test(ch)){for(;!stream.match(/^\/[\/*]/,!1)&&stream.eat(isOperatorChar););return"operator"}if(stream.eatWhile(isIdentifierChar),namespaceSeparator)for(;stream.match(namespaceSeparator);)stream.eatWhile(isIdentifierChar);var cur=stream.current();return contains(keywords,cur)?(contains(blockKeywords,cur)&&(curPunc="newstatement"),contains(defKeywords,cur)&&(isDefKeyword=!0),"keyword"):contains(types,cur)?"type":contains(builtin,cur)||isReservedIdentifier&&isReservedIdentifier(cur)?(contains(blockKeywords,cur)&&(curPunc="newstatement"),"builtin"):contains(atoms,cur)?"atom":"variable"}function tokenString(quote){return function(stream,state){for(var escaped=!1,next,end=!1;null!=(next=stream.next());){if(next==quote&&!escaped){end=!0;break}escaped=!escaped&&"\\"==next}return(end||!escaped&&!multiLineStrings)&&(state.tokenize=null),"string"}}function tokenComment(stream,state){for(var maybeEnd=!1,ch;ch=stream.next();){if("/"==ch&&maybeEnd){state.tokenize=null;break}maybeEnd="*"==ch}return"comment"}function maybeEOL(stream,state){parserConfig.typeFirstDefinitions&&stream.eol()&&isTopScope(state.context)&&(state.typeAtEndOfLine=typeBefore(stream,state,stream.pos))}return{startState:function(basecolumn){return{tokenize:null,context:new Context((basecolumn||0)-indentUnit,0,"top",null,!1),indented:0,startOfLine:!0,prevToken:null}},token:function(stream,state){var ctx=state.context;if(stream.sol()&&(null==ctx.align&&(ctx.align=!1),state.indented=stream.indentation(),state.startOfLine=!0),stream.eatSpace())return maybeEOL(stream,state),null;curPunc=isDefKeyword=null;var style=(state.tokenize||tokenBase)(stream,state);if("comment"==style||"meta"==style)return style;if(null==ctx.align&&(ctx.align=!0),";"==curPunc||":"==curPunc||","==curPunc&&stream.match(/^\s*(?:\/\/.*)?$/,!1))for(;"statement"==state.context.type;)popContext(state);else if("{"==curPunc)pushContext(state,stream.column(),"}");else if("["==curPunc)pushContext(state,stream.column(),"]");else if("("==curPunc)pushContext(state,stream.column(),")");else if("}"==curPunc){for(;"statement"==ctx.type;)ctx=popContext(state);for("}"==ctx.type&&(ctx=popContext(state));"statement"==ctx.type;)ctx=popContext(state)}else curPunc==ctx.type?popContext(state):indentStatements&&(("}"==ctx.type||"top"==ctx.type)&&";"!=curPunc||"statement"==ctx.type&&"newstatement"==curPunc)&&pushContext(state,stream.column(),"statement",stream.current());if("variable"==style&&("def"==state.prevToken||parserConfig.typeFirstDefinitions&&typeBefore(stream,state,stream.start)&&isTopScope(state.context)&&stream.match(/^\s*\(/,!1))&&(style="def"),hooks.token){var result=hooks.token(stream,state,style);void 0!==result&&(style=result)}return"def"==style&&!1===parserConfig.styleDefs&&(style="variable"),state.startOfLine=!1,state.prevToken=isDefKeyword?"def":style||curPunc,maybeEOL(stream,state),style},indent:function(state,textAfter){if(state.tokenize!=tokenBase&&null!=state.tokenize||state.typeAtEndOfLine&&isTopScope(state.context))return CodeMirror.Pass;var ctx=state.context,firstChar=textAfter&&textAfter.charAt(0),closing=firstChar==ctx.type;if("statement"==ctx.type&&"}"==firstChar&&(ctx=ctx.prev),parserConfig.dontIndentStatements)for(;"statement"==ctx.type&&parserConfig.dontIndentStatements.test(ctx.info);)ctx=ctx.prev;if(hooks.indent){var hook=hooks.indent(state,ctx,textAfter,indentUnit);if("number"==typeof hook)return hook}var switchBlock=ctx.prev&&"switch"==ctx.prev.info;if(parserConfig.allmanIndentation&&/[{(]/.test(firstChar)){for(;"top"!=ctx.type&&"}"!=ctx.type;)ctx=ctx.prev;return ctx.indented}return"statement"==ctx.type?ctx.indented+("{"==firstChar?0:statementIndentUnit):!ctx.align||dontAlignCalls&&")"==ctx.type?")"!=ctx.type||closing?ctx.indented+(closing?0:indentUnit)+(closing||!switchBlock||/^(?:case|default)\b/.test(textAfter)?0:indentUnit):ctx.indented+statementIndentUnit:ctx.column+(closing?0:1)},electricInput:indentSwitch?/^\s*(?:case .*?:|default:|\{\}?|\})$/:/^\s*[{}]$/,blockCommentStart:"/*",blockCommentEnd:"*/",blockCommentContinue:" * ",lineComment:"//",fold:"brace"}});var cKeywords="auto if break case register continue return default do sizeof static else struct switch extern typedef union for goto while enum const volatile inline restrict asm fortran",cppKeywords="alignas alignof and and_eq audit axiom bitand bitor catch class compl concept constexpr const_cast decltype delete dynamic_cast explicit export final friend import module mutable namespace new noexcept not not_eq operator or or_eq override private protected public reinterpret_cast requires static_assert static_cast template this thread_local throw try typeid typename using virtual xor xor_eq",objCKeywords="bycopy byref in inout oneway out self super atomic nonatomic retain copy readwrite readonly strong weak assign typeof nullable nonnull null_resettable _cmd @interface @implementation @end @protocol @encode @property @synthesize @dynamic @class @public @package @private @protected @required @optional @try @catch @finally @import @selector @encode @defs @synchronized @autoreleasepool @compatibility_alias @available",objCBuiltins="FOUNDATION_EXPORT FOUNDATION_EXTERN NS_INLINE NS_FORMAT_FUNCTION  NS_RETURNS_RETAINEDNS_ERROR_ENUM NS_RETURNS_NOT_RETAINED NS_RETURNS_INNER_POINTER NS_DESIGNATED_INITIALIZER NS_ENUM NS_OPTIONS NS_REQUIRES_NIL_TERMINATION NS_ASSUME_NONNULL_BEGIN NS_ASSUME_NONNULL_END NS_SWIFT_NAME NS_REFINED_FOR_SWIFT",basicCTypes=words("int long char short double float unsigned signed void bool"),basicObjCTypes=words("SEL instancetype id Class Protocol BOOL");function cTypes(identifier){return contains(basicCTypes,identifier)||/.+_t$/.test(identifier)}function objCTypes(identifier){return cTypes(identifier)||contains(basicObjCTypes,identifier)}var cBlockKeywords="case do else for if switch while struct enum union",cDefKeywords="struct enum union";function cppHook(stream,state){if(!state.startOfLine)return!1;for(var ch,next=null;ch=stream.peek();){if("\\"==ch&&stream.match(/^.$/)){next=cppHook;break}if("/"==ch&&stream.match(/^\/[\/\*]/,!1))break;stream.next()}return state.tokenize=next,"meta"}function pointerHook(_stream,state){return"type"==state.prevToken&&"type"}function cIsReservedIdentifier(token){return!(!token||token.length<2)&&("_"==token[0]&&("_"==token[1]||token[1]!==token[1].toLowerCase()))}function cpp14Literal(stream){return stream.eatWhile(/[\w\.']/),"number"}function cpp11StringHook(stream,state){if(stream.backUp(1),stream.match(/^(?:R|u8R|uR|UR|LR)/)){var match=stream.match(/^"([^\s\\()]{0,16})\(/);return!!match&&(state.cpp11RawStringDelim=match[1],state.tokenize=tokenRawString,tokenRawString(stream,state))}return stream.match(/^(?:u8|u|U|L)/)?!!stream.match(/^["']/,!1)&&"string":(stream.next(),!1)}function cppLooksLikeConstructor(word){var lastTwo=/(\w+)::~?(\w+)$/.exec(word);return lastTwo&&lastTwo[1]==lastTwo[2]}function tokenAtString(stream,state){for(var next;null!=(next=stream.next());)if('"'==next&&!stream.eat('"')){state.tokenize=null;break}return"string"}function tokenRawString(stream,state){var delim=state.cpp11RawStringDelim.replace(/[^\w\s]/g,"\\$&"),match;return stream.match(new RegExp(".*?\\)"+delim+'"'))?state.tokenize=null:stream.skipToEnd(),"string"}function def(mimes,mode){"string"==typeof mimes&&(mimes=[mimes]);var words=[];function add(obj){if(obj)for(var prop in obj)obj.hasOwnProperty(prop)&&words.push(prop)}add(mode.keywords),add(mode.types),add(mode.builtin),add(mode.atoms),words.length&&(mode.helperType=mimes[0],CodeMirror.registerHelper("hintWords",mimes[0],words));for(var i=0;i<mimes.length;++i)CodeMirror.defineMIME(mimes[i],mode)}function tokenTripleString(stream,state){for(var escaped=!1;!stream.eol();){if(!escaped&&stream.match('"""')){state.tokenize=null;break}escaped="\\"==stream.next()&&!escaped}return"string"}function tokenNestedComment(depth){return function(stream,state){for(var ch;ch=stream.next();){if("*"==ch&&stream.eat("/")){if(1==depth){state.tokenize=null;break}return state.tokenize=tokenNestedComment(depth-1),state.tokenize(stream,state)}if("/"==ch&&stream.eat("*"))return state.tokenize=tokenNestedComment(depth+1),state.tokenize(stream,state)}return"comment"}}function tokenKotlinString(tripleString){return function(stream,state){for(var escaped=!1,next,end=!1;!stream.eol();){if(!tripleString&&!escaped&&stream.match('"')){end=!0;break}if(tripleString&&stream.match('"""')){end=!0;break}next=stream.next(),!escaped&&"$"==next&&stream.match("{")&&stream.skipTo("}"),escaped=!escaped&&"\\"==next&&!tripleString}return!end&&tripleString||(state.tokenize=null),"string"}}def(["text/x-csrc","text/x-c","text/x-chdr"],{name:"clike",keywords:words(cKeywords),types:cTypes,blockKeywords:words(cBlockKeywords),defKeywords:words(cDefKeywords),typeFirstDefinitions:!0,atoms:words("NULL true false"),isReservedIdentifier:cIsReservedIdentifier,hooks:{"#":cppHook,"*":pointerHook},modeProps:{fold:["brace","include"]}}),def(["text/x-c++src","text/x-c++hdr"],{name:"clike",keywords:words(cKeywords+" "+cppKeywords),types:cTypes,blockKeywords:words(cBlockKeywords+" class try catch"),defKeywords:words(cDefKeywords+" class namespace"),typeFirstDefinitions:!0,atoms:words("true false NULL nullptr"),dontIndentStatements:/^template$/,isIdentifierChar:/[\w\$_~\xa1-\uffff]/,isReservedIdentifier:cIsReservedIdentifier,hooks:{"#":cppHook,"*":pointerHook,u:cpp11StringHook,U:cpp11StringHook,L:cpp11StringHook,R:cpp11StringHook,0:cpp14Literal,1:cpp14Literal,2:cpp14Literal,3:cpp14Literal,4:cpp14Literal,5:cpp14Literal,6:cpp14Literal,7:cpp14Literal,8:cpp14Literal,9:cpp14Literal,token:function(stream,state,style){if("variable"==style&&"("==stream.peek()&&(";"==state.prevToken||null==state.prevToken||"}"==state.prevToken)&&cppLooksLikeConstructor(stream.current()))return"def"}},namespaceSeparator:"::",modeProps:{fold:["brace","include"]}}),def("text/x-java",{name:"clike",keywords:words("abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while @interface"),types:words("var byte short int long float double boolean char void Boolean Byte Character Double Float Integer Long Number Object Short String StringBuffer StringBuilder Void"),blockKeywords:words("catch class do else finally for if switch try while"),defKeywords:words("class interface enum @interface"),typeFirstDefinitions:!0,atoms:words("true false null"),number:/^(?:0x[a-f\d_]+|0b[01_]+|(?:[\d_]+\.?\d*|\.\d+)(?:e[-+]?[\d_]+)?)(u|ll?|l|f)?/i,hooks:{"@":function(stream){return!stream.match("interface",!1)&&(stream.eatWhile(/[\w\$_]/),"meta")},'"':function(stream,state){return!!stream.match(/""$/)&&(state.tokenize=tokenTripleString,state.tokenize(stream,state))}},modeProps:{fold:["brace","import"]}}),def("text/x-csharp",{name:"clike",keywords:words("abstract as async await base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in init interface internal is lock namespace new operator out override params private protected public readonly record ref required return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual void volatile while add alias ascending descending dynamic from get global group into join let orderby partial remove select set value var yield"),types:words("Action Boolean Byte Char DateTime DateTimeOffset Decimal Double Func Guid Int16 Int32 Int64 Object SByte Single String Task TimeSpan UInt16 UInt32 UInt64 bool byte char decimal double short int long object sbyte float string ushort uint ulong"),blockKeywords:words("catch class do else finally for foreach if struct switch try while"),defKeywords:words("class interface namespace record struct var"),typeFirstDefinitions:!0,atoms:words("true false null"),hooks:{"@":function(stream,state){return stream.eat('"')?(state.tokenize=tokenAtString,tokenAtString(stream,state)):(stream.eatWhile(/[\w\$_]/),"meta")}}}),def("text/x-scala",{name:"clike",keywords:words("abstract case catch class def do else extends final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try type val var while with yield _ assert assume require print println printf readLine readBoolean readByte readShort readChar readInt readLong readFloat readDouble"),types:words("AnyVal App Application Array BufferedIterator BigDecimal BigInt Char Console Either Enumeration Equiv Error Exception Fractional Function IndexedSeq Int Integral Iterable Iterator List Map Numeric Nil NotNull Option Ordered Ordering PartialFunction PartialOrdering Product Proxy Range Responder Seq Serializable Set Specializable Stream StringBuilder StringContext Symbol Throwable Traversable TraversableOnce Tuple Unit Vector Boolean Byte Character CharSequence Class ClassLoader Cloneable Comparable Compiler Double Exception Float Integer Long Math Number Object Package Pair Process Runtime Runnable SecurityManager Short StackTraceElement StrictMath String StringBuffer System Thread ThreadGroup ThreadLocal Throwable Triple Void"),multiLineStrings:!0,blockKeywords:words("catch class enum do else finally for forSome if match switch try while"),defKeywords:words("class enum def object package trait type val var"),atoms:words("true false null"),indentStatements:!1,indentSwitch:!1,isOperatorChar:/[+\-*&%=<>!?|\/#:@]/,hooks:{"@":function(stream){return stream.eatWhile(/[\w\$_]/),"meta"},'"':function(stream,state){return!!stream.match('""')&&(state.tokenize=tokenTripleString,state.tokenize(stream,state))},"'":function(stream){return stream.match(/^(\\[^'\s]+|[^\\'])'/)?"string-2":(stream.eatWhile(/[\w\$_\xa1-\uffff]/),"atom")},"=":function(stream,state){var cx=state.context;return!("}"!=cx.type||!cx.align||!stream.eat(">"))&&(state.context=new Context(cx.indented,cx.column,cx.type,cx.info,null,cx.prev),"operator")},"/":function(stream,state){return!!stream.eat("*")&&(state.tokenize=tokenNestedComment(1),state.tokenize(stream,state))}},modeProps:{closeBrackets:{pairs:'()[]{}""',triples:'"'}}}),def("text/x-kotlin",{name:"clike",keywords:words("package as typealias class interface this super val operator var fun for is in This throw return annotation break continue object if else while do try when !in !is as? file import where by get set abstract enum open inner override private public internal protected catch finally out final vararg reified dynamic companion constructor init sealed field property receiver param sparam lateinit data inline noinline tailrec external annotation crossinline const operator infix suspend actual expect setparam value"),types:words("Boolean Byte Character CharSequence Class ClassLoader Cloneable Comparable Compiler Double Exception Float Integer Long Math Number Object Package Pair Process Runtime Runnable SecurityManager Short StackTraceElement StrictMath String StringBuffer System Thread ThreadGroup ThreadLocal Throwable Triple Void Annotation Any BooleanArray ByteArray Char CharArray DeprecationLevel DoubleArray Enum FloatArray Function Int IntArray Lazy LazyThreadSafetyMode LongArray Nothing ShortArray Unit"),intendSwitch:!1,indentStatements:!1,multiLineStrings:!0,number:/^(?:0x[a-f\d_]+|0b[01_]+|(?:[\d_]+(\.\d+)?|\.\d+)(?:e[-+]?[\d_]+)?)(u|ll?|l|f)?/i,blockKeywords:words("catch class do else finally for if where try while enum"),defKeywords:words("class val var object interface fun"),atoms:words("true false null this"),hooks:{"@":function(stream){return stream.eatWhile(/[\w\$_]/),"meta"},"*":function(_stream,state){return"."==state.prevToken?"variable":"operator"},'"':function(stream,state){return state.tokenize=tokenKotlinString(stream.match('""')),state.tokenize(stream,state)},"/":function(stream,state){return!!stream.eat("*")&&(state.tokenize=tokenNestedComment(1),state.tokenize(stream,state))},indent:function(state,ctx,textAfter,indentUnit){var firstChar=textAfter&&textAfter.charAt(0);return"}"!=state.prevToken&&")"!=state.prevToken||""!=textAfter?"operator"==state.prevToken&&"}"!=textAfter&&"}"!=state.context.type||"variable"==state.prevToken&&"."==firstChar||("}"==state.prevToken||")"==state.prevToken)&&"."==firstChar?2*indentUnit+ctx.indented:ctx.align&&"}"==ctx.type?ctx.indented+(state.context.type==(textAfter||"").charAt(0)?0:indentUnit):void 0:state.indented}},modeProps:{closeBrackets:{triples:'"'}}}),def(["x-shader/x-vertex","x-shader/x-fragment"],{name:"clike",keywords:words("sampler1D sampler2D sampler3D samplerCube sampler1DShadow sampler2DShadow const attribute uniform varying break continue discard return for while do if else struct in out inout"),types:words("float int bool void vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 mat2 mat3 mat4"),blockKeywords:words("for while do if else struct"),builtin:words("radians degrees sin cos tan asin acos atan pow exp log exp2 sqrt inversesqrt abs sign floor ceil fract mod min max clamp mix step smoothstep length distance dot cross normalize ftransform faceforward reflect refract matrixCompMult lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not texture1D texture1DProj texture1DLod texture1DProjLod texture2D texture2DProj texture2DLod texture2DProjLod texture3D texture3DProj texture3DLod texture3DProjLod textureCube textureCubeLod shadow1D shadow2D shadow1DProj shadow2DProj shadow1DLod shadow2DLod shadow1DProjLod shadow2DProjLod dFdx dFdy fwidth noise1 noise2 noise3 noise4"),atoms:words("true false gl_FragColor gl_SecondaryColor gl_Normal gl_Vertex gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 gl_MultiTexCoord3 gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 gl_FogCoord gl_PointCoord gl_Position gl_PointSize gl_ClipVertex gl_FrontColor gl_BackColor gl_FrontSecondaryColor gl_BackSecondaryColor gl_TexCoord gl_FogFragCoord gl_FragCoord gl_FrontFacing gl_FragData gl_FragDepth gl_ModelViewMatrix gl_ProjectionMatrix gl_ModelViewProjectionMatrix gl_TextureMatrix gl_NormalMatrix gl_ModelViewMatrixInverse gl_ProjectionMatrixInverse gl_ModelViewProjectionMatrixInverse gl_TextureMatrixTranspose gl_ModelViewMatrixInverseTranspose gl_ProjectionMatrixInverseTranspose gl_ModelViewProjectionMatrixInverseTranspose gl_TextureMatrixInverseTranspose gl_NormalScale gl_DepthRange gl_ClipPlane gl_Point gl_FrontMaterial gl_BackMaterial gl_LightSource gl_LightModel gl_FrontLightModelProduct gl_BackLightModelProduct gl_TextureColor gl_EyePlaneS gl_EyePlaneT gl_EyePlaneR gl_EyePlaneQ gl_FogParameters gl_MaxLights gl_MaxClipPlanes gl_MaxTextureUnits gl_MaxTextureCoords gl_MaxVertexAttribs gl_MaxVertexUniformComponents gl_MaxVaryingFloats gl_MaxVertexTextureImageUnits gl_MaxTextureImageUnits gl_MaxFragmentUniformComponents gl_MaxCombineTextureImageUnits gl_MaxDrawBuffers"),indentSwitch:!1,hooks:{"#":cppHook},modeProps:{fold:["brace","include"]}}),def("text/x-nesc",{name:"clike",keywords:words(cKeywords+" as atomic async call command component components configuration event generic implementation includes interface module new norace nx_struct nx_union post provides signal task uses abstract extends"),types:cTypes,blockKeywords:words(cBlockKeywords),atoms:words("null true false"),hooks:{"#":cppHook},modeProps:{fold:["brace","include"]}}),def("text/x-objectivec",{name:"clike",keywords:words(cKeywords+" "+objCKeywords),types:objCTypes,builtin:words(objCBuiltins),blockKeywords:words(cBlockKeywords+" @synthesize @try @catch @finally @autoreleasepool @synchronized"),defKeywords:words(cDefKeywords+" @interface @implementation @protocol @class"),dontIndentStatements:/^@.*$/,typeFirstDefinitions:!0,atoms:words("YES NO NULL Nil nil true false nullptr"),isReservedIdentifier:cIsReservedIdentifier,hooks:{"#":cppHook,"*":pointerHook},modeProps:{fold:["brace","include"]}}),def("text/x-objectivec++",{name:"clike",keywords:words(cKeywords+" "+objCKeywords+" "+cppKeywords),types:objCTypes,builtin:words(objCBuiltins),blockKeywords:words(cBlockKeywords+" @synthesize @try @catch @finally @autoreleasepool @synchronized class try catch"),defKeywords:words(cDefKeywords+" @interface @implementation @protocol @class class namespace"),dontIndentStatements:/^@.*$|^template$/,typeFirstDefinitions:!0,atoms:words("YES NO NULL Nil nil true false nullptr"),isReservedIdentifier:cIsReservedIdentifier,hooks:{"#":cppHook,"*":pointerHook,u:cpp11StringHook,U:cpp11StringHook,L:cpp11StringHook,R:cpp11StringHook,0:cpp14Literal,1:cpp14Literal,2:cpp14Literal,3:cpp14Literal,4:cpp14Literal,5:cpp14Literal,6:cpp14Literal,7:cpp14Literal,8:cpp14Literal,9:cpp14Literal,token:function(stream,state,style){if("variable"==style&&"("==stream.peek()&&(";"==state.prevToken||null==state.prevToken||"}"==state.prevToken)&&cppLooksLikeConstructor(stream.current()))return"def"}},namespaceSeparator:"::",modeProps:{fold:["brace","include"]}}),def("text/x-squirrel",{name:"clike",keywords:words("base break clone continue const default delete enum extends function in class foreach local resume return this throw typeof yield constructor instanceof static"),types:cTypes,blockKeywords:words("case catch class else for foreach if switch try while"),defKeywords:words("function local class"),typeFirstDefinitions:!0,atoms:words("true false null"),hooks:{"#":cppHook},modeProps:{fold:["brace","include"]}});var stringTokenizer=null;function tokenCeylonString(type){return function(stream,state){for(var escaped=!1,next,end=!1;!stream.eol();){if(!escaped&&stream.match('"')&&("single"==type||stream.match('""'))){end=!0;break}if(!escaped&&stream.match("``")){stringTokenizer=tokenCeylonString(type),end=!0;break}next=stream.next(),escaped="single"==type&&!escaped&&"\\"==next}return end&&(state.tokenize=null),"string"}}def("text/x-ceylon",{name:"clike",keywords:words("abstracts alias assembly assert assign break case catch class continue dynamic else exists extends finally for function given if import in interface is let module new nonempty object of out outer package return satisfies super switch then this throw try value void while"),types:function(word){var first=word.charAt(0);return first===first.toUpperCase()&&first!==first.toLowerCase()},blockKeywords:words("case catch class dynamic else finally for function if interface module new object switch try while"),defKeywords:words("class dynamic function interface module object package value"),builtin:words("abstract actual aliased annotation by default deprecated doc final formal late license native optional sealed see serializable shared suppressWarnings tagged throws variable"),isPunctuationChar:/[\[\]{}\(\),;\:\.`]/,isOperatorChar:/[+\-*&%=<>!?|^~:\/]/,numberStart:/[\d#$]/,number:/^(?:#[\da-fA-F_]+|\$[01_]+|[\d_]+[kMGTPmunpf]?|[\d_]+\.[\d_]+(?:[eE][-+]?\d+|[kMGTPmunpf]|)|)/i,multiLineStrings:!0,typeFirstDefinitions:!0,atoms:words("true false null larger smaller equal empty finished"),indentSwitch:!1,styleDefs:!1,hooks:{"@":function(stream){return stream.eatWhile(/[\w\$_]/),"meta"},'"':function(stream,state){return state.tokenize=tokenCeylonString(stream.match('""')?"triple":"single"),state.tokenize(stream,state)},"`":function(stream,state){return!(!stringTokenizer||!stream.match("`"))&&(state.tokenize=stringTokenizer,stringTokenizer=null,state.tokenize(stream,state))},"'":function(stream){return stream.eatWhile(/[\w\$_\xa1-\uffff]/),"atom"},token:function(_stream,state,style){if(("variable"==style||"type"==style)&&"."==state.prevToken)return"variable-2"}},modeProps:{fold:["brace","import"],closeBrackets:{triples:'"'}}})});
//# sourceMappingURL=clike.js.map