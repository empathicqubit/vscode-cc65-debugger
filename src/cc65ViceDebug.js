"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var vscode_debugadapter_1 = require("vscode-debugadapter");
var path_1 = require("path");
var debugUtils = require("./debugUtils");
var cc65ViceRuntime_1 = require("./cc65ViceRuntime");
var Subject = require('await-notify').Subject;
var colors = require("colors/safe");
function timeout(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
var VariablesReferenceFlag;
(function (VariablesReferenceFlag) {
    VariablesReferenceFlag[VariablesReferenceFlag["HAS_TYPE"] = 65536] = "HAS_TYPE";
    VariablesReferenceFlag[VariablesReferenceFlag["FOLLOW_TYPE"] = 131072] = "FOLLOW_TYPE";
    VariablesReferenceFlag[VariablesReferenceFlag["FOLLOW_POINTER"] = 262144] = "FOLLOW_POINTER";
    VariablesReferenceFlag[VariablesReferenceFlag["EXPAND_DATA"] = 524288] = "EXPAND_DATA";
    VariablesReferenceFlag[VariablesReferenceFlag["EXPAND_BYTES"] = 1048576] = "EXPAND_BYTES";
    VariablesReferenceFlag[VariablesReferenceFlag["LOCAL"] = 2097152] = "LOCAL";
    VariablesReferenceFlag[VariablesReferenceFlag["GLOBAL"] = 4194304] = "GLOBAL";
    VariablesReferenceFlag[VariablesReferenceFlag["PARAM"] = 8388608] = "PARAM";
    VariablesReferenceFlag[VariablesReferenceFlag["REGISTERS"] = 16777216] = "REGISTERS";
    VariablesReferenceFlag[VariablesReferenceFlag["ADDR_MASK"] = 65535] = "ADDR_MASK";
})(VariablesReferenceFlag || (VariablesReferenceFlag = {}));
var CC65ViceDebugSession = /** @class */ (function (_super) {
    __extends(CC65ViceDebugSession, _super);
    /**
    * Creates a new debug adapter that is used for one debug session.
    * We configure the default implementation of a debug adapter here.
    */
    function CC65ViceDebugSession() {
        var _this = _super.call(this) || this;
        _this._configurationDone = new Subject();
        _this._addressTypes = {};
        // this debugger uses zero-based lines and columns
        _this.setDebuggerLinesStartAt1(false);
        _this.setDebuggerColumnsStartAt1(false);
        _this._runtime = new cc65ViceRuntime_1.CC65ViceRuntime(_this);
        // setup event handlers
        _this._runtime.on('stopOnEntry', function () {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent('entry', CC65ViceDebugSession.THREAD_ID));
        });
        _this._runtime.on('stopOnStep', function () {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent('step', CC65ViceDebugSession.THREAD_ID));
        });
        _this._runtime.on('stopOnBreakpoint', function () {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent('breakpoint', CC65ViceDebugSession.THREAD_ID));
        });
        _this._runtime.on('stopOnDataBreakpoint', function () {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent('data breakpoint', CC65ViceDebugSession.THREAD_ID));
        });
        _this._runtime.on('stopOnException', function () {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent('exception', CC65ViceDebugSession.THREAD_ID));
        });
        _this._runtime.on('breakpointValidated', function (bp) {
            _this.sendEvent(new vscode_debugadapter_1.BreakpointEvent('changed', { verified: bp.verified, id: bp.id }));
        });
        _this._runtime.on('output', function (category, text, filePath, line, column) {
            var e = new vscode_debugadapter_1.OutputEvent(text);
            e.body.category = category;
            if (filePath) {
                e.body.source = _this.createSource(filePath);
            }
            if (line) {
                e.body.line = _this.convertDebuggerLineToClient(line);
            }
            if (column) {
                e.body.column = _this.convertDebuggerColumnToClient(column);
            }
            else {
                e.body.column = 0;
            }
            _this.sendEvent(e);
        });
        _this._runtime.on('end', function () {
            _this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
        });
        return _this;
    }
    /**
    * The 'initialize' request is the first request called by the frontend
    * to interrogate the features the debug adapter provides.
    */
    CC65ViceDebugSession.prototype.initializeRequest = function (response, args) {
        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};
        // the adapter implements the configurationDoneRequest.
        response.body.supportsConfigurationDoneRequest = true;
        // make VS Code to use 'evaluate' when hovering over source
        response.body.supportsEvaluateForHovers = false;
        response.body.supportsStepBack = false;
        // make VS Code to support data breakpoints
        response.body.supportsDataBreakpoints = false;
        // make VS Code to support completion in REPL
        response.body.supportsCompletionsRequest = false;
        response.body.completionTriggerCharacters = [".", "["];
        // make VS Code to send cancelRequests
        response.body.supportsCancelRequest = true;
        // make VS Code send the breakpointLocations request
        response.body.supportsBreakpointLocationsRequest = true;
        this.sendResponse(response);
        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
        // we request them early by sending an 'initializeRequest' to the frontend.
        // The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
    };
    /**
    * Called at the end of the configuration sequence.
    * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
    */
    CC65ViceDebugSession.prototype.configurationDoneRequest = function (response, args) {
        _super.prototype.configurationDoneRequest.call(this, response, args);
        // notify the launchRequest that configuration has finished
        this._configurationDone.notify();
    };
    CC65ViceDebugSession.prototype.launchRequest = function (response, args) {
        return __awaiter(this, void 0, void 0, function () {
            var buildCwd, possibles, _a, program, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        vscode_debugadapter_1.logger.setup(args.trace ? vscode_debugadapter_1.Logger.LogLevel.Verbose : vscode_debugadapter_1.Logger.LogLevel.Stop, false);
                        return [4 /*yield*/, this._configurationDone.wait(3000)];
                    case 1:
                        _b.sent();
                        buildCwd = args.buildCwd || ".";
                        possibles = [];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this._runtime.build(buildCwd, args.buildCommand || "make OPTIONS=mapfile,debugfile,labelfile")];
                    case 3:
                        possibles = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _b.sent();
                        throw new Error("Couldn't finish the build successfully. Check the console for details.");
                    case 5:
                        program = args.program || possibles[0];
                        if (!program) {
                            throw new Error('Could not find any output files that matched. Use the launch.json->program property to specify explicitly.');
                        }
                        // start the program in the runtime
                        return [4 /*yield*/, this._runtime.start(program, buildCwd, !!args.stopOnEntry, args.viceCommand, args.viceArgs, args.console)];
                    case 6:
                        // start the program in the runtime
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        e_1 = _b.sent();
                        response.success = false;
                        response.message = e_1.stack.toString();
                        return [3 /*break*/, 8];
                    case 8:
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.setBreakPointsRequest = function (response, args) {
        return __awaiter(this, void 0, void 0, function () {
            var path, clientLines, actualBreakpoints;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = args.source.path;
                        clientLines = args.lines || [];
                        return [4 /*yield*/, this._runtime.clearBreakpoints(path)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, Promise.all(clientLines.map(function (l) { return __awaiter(_this, void 0, void 0, function () {
                                var brk, verified, line, id, bp;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this._runtime.setBreakPoint(path, this.convertClientLineToDebugger(l))];
                                        case 1:
                                            brk = _a.sent();
                                            if (!brk) {
                                                return [2 /*return*/, null];
                                            }
                                            verified = brk.verified, line = brk.line, id = brk.id;
                                            bp = new vscode_debugadapter_1.Breakpoint(verified, this.convertDebuggerLineToClient(line.num));
                                            bp.id = id;
                                            return [2 /*return*/, bp];
                                    }
                                });
                            }); }))];
                    case 2:
                        actualBreakpoints = (_a.sent()).filter(function (x) { return x; });
                        // send back the actual breakpoint positions
                        response.body = {
                            breakpoints: actualBreakpoints
                        };
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.terminateRequest = function (response, args, request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._runtime.terminate()];
                    case 1:
                        _a.sent();
                        this._addressTypes = {};
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.breakpointLocationsRequest = function (response, args, request) {
        var _this = this;
        if (args.source.path) {
            var bps = this._runtime.getBreakpoints(args.source.path, this.convertClientLineToDebugger(args.line));
            response.body = {
                breakpoints: bps.map(function (col) {
                    return {
                        line: args.line,
                        column: _this.convertDebuggerColumnToClient(col)
                    };
                })
            };
        }
        else {
            response.body = {
                breakpoints: []
            };
        }
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.threadsRequest = function (response) {
        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [
                new vscode_debugadapter_1.Thread(CC65ViceDebugSession.THREAD_ID, "thread 1")
            ]
        };
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.stackTraceRequest = function (response, args) {
        return __awaiter(this, void 0, void 0, function () {
            var startFrame, maxLevels, endFrame, stk;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
                        maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
                        endFrame = startFrame + maxLevels;
                        return [4 /*yield*/, this._runtime.stack(startFrame, endFrame)];
                    case 1:
                        stk = _a.sent();
                        response.body = {
                            stackFrames: stk.frames.map(function (f) { return new vscode_debugadapter_1.StackFrame(f.index, f.name, _this.createSource(f.file), _this.convertDebuggerLineToClient(f.line)); }),
                            totalFrames: stk.count
                        };
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.scopesRequest = function (response, args) {
        response.body = {
            scopes: [
                new vscode_debugadapter_1.Scope("Registers", VariablesReferenceFlag.REGISTERS, false),
                new vscode_debugadapter_1.Scope("Local", VariablesReferenceFlag.LOCAL, false),
                new vscode_debugadapter_1.Scope("Global", VariablesReferenceFlag.GLOBAL, true),
            ]
        };
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype._pointerMenu = function (pointerVal, idx) {
        var name;
        var val;
        var helpText = "Mem @ 0x" + pointerVal.toString(16).padStart(4, '0') + " (Pointer Dest)";
        if (typeof idx === 'undefined') {
            name = helpText;
            val = "";
        }
        else {
            name = idx.toString();
            val = helpText;
        }
        return {
            name: name,
            value: val,
            variablesReference: VariablesReferenceFlag.FOLLOW_POINTER | pointerVal,
            presentationHint: {
                kind: 'virtual'
            }
        };
    };
    CC65ViceDebugSession.prototype.variablesRequest = function (response, args, request) {
        return __awaiter(this, void 0, void 0, function () {
            var variables, ref, regs, k, vars, _i, vars_1, v, buf, i, val, vars, _a, vars_2, v, val, i, pointerVal, addr, buf, i, val, fields, _b, fields_1, field, val, pointerVal, e_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        variables = [];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 17, , 18]);
                        ref = args.variablesReference;
                        if (!(ref & VariablesReferenceFlag.REGISTERS)) return [3 /*break*/, 2];
                        regs = this._runtime.getRegisters();
                        for (k in regs) {
                            variables.push({
                                name: k.toUpperCase(),
                                value: '0x' + regs[k].toString(16).padStart(2, '0'),
                                variablesReference: 0
                            });
                        }
                        return [3 /*break*/, 16];
                    case 2:
                        if (!(ref & VariablesReferenceFlag.LOCAL)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this._runtime.getScopeVariables()];
                    case 3:
                        vars = _c.sent();
                        for (_i = 0, vars_1 = vars; _i < vars_1.length; _i++) {
                            v = vars_1[_i];
                            this._addressTypes[v.addr.toString(16)] = v.type || '';
                            variables.push({
                                name: v.name,
                                value: v.value,
                                type: v.type,
                                memoryReference: v.addr.toString(16),
                                variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0)
                            });
                        }
                        return [3 /*break*/, 16];
                    case 4:
                        if (!(ref & VariablesReferenceFlag.PARAM)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this._runtime.getParamStack()];
                    case 5:
                        buf = _c.sent();
                        for (i = 0; i < buf.length; i += 8) {
                            val = buf.slice(i, i + 8);
                            variables.push({
                                name: i.toString(16),
                                value: debugUtils.rawBufferHex(val),
                                variablesReference: 0,
                                presentationHint: {
                                    kind: "data"
                                }
                            });
                        }
                        return [3 /*break*/, 16];
                    case 6:
                        if (!(ref & VariablesReferenceFlag.GLOBAL)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this._runtime.getGlobalVariables()];
                    case 7:
                        vars = _c.sent();
                        for (_a = 0, vars_2 = vars; _a < vars_2.length; _a++) {
                            v = vars_2[_a];
                            this._addressTypes[v.addr.toString(16)] = v.type || '';
                            variables.push({
                                name: v.name,
                                value: v.value,
                                type: v.type,
                                memoryReference: v.addr.toString(16),
                                variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0)
                            });
                        }
                        return [3 /*break*/, 16];
                    case 8:
                        if (!(ref > 0)) return [3 /*break*/, 16];
                        if (!(ref & (VariablesReferenceFlag.EXPAND_BYTES))) return [3 /*break*/, 10];
                        return [4 /*yield*/, this._runtime.getMemory(args.variablesReference & VariablesReferenceFlag.ADDR_MASK, 9)];
                    case 9:
                        val = _c.sent();
                        for (i = 0; i < val.length - 1; i++) {
                            pointerVal = val.readUInt16LE(i);
                            variables.push(this._pointerMenu(pointerVal, i));
                        }
                        return [3 /*break*/, 16];
                    case 10:
                        if (!(ref & (VariablesReferenceFlag.EXPAND_DATA | VariablesReferenceFlag.FOLLOW_POINTER))) return [3 /*break*/, 12];
                        addr = ref & VariablesReferenceFlag.ADDR_MASK;
                        return [4 /*yield*/, this._runtime.getMemory(addr, 128)];
                    case 11:
                        buf = _c.sent();
                        for (i = 0; i < buf.length; i += 8) {
                            val = buf.slice(i, i + 8);
                            variables.push({
                                name: (addr + i).toString(16),
                                value: debugUtils.rawBufferHex(val),
                                variablesReference: VariablesReferenceFlag.EXPAND_BYTES | (addr + i),
                                presentationHint: {
                                    kind: "data"
                                }
                            });
                        }
                        return [3 /*break*/, 16];
                    case 12:
                        if (!(ref & VariablesReferenceFlag.FOLLOW_TYPE)) return [3 /*break*/, 14];
                        return [4 /*yield*/, this._runtime.getTypeFields(ref & VariablesReferenceFlag.ADDR_MASK, this._addressTypes[(ref & VariablesReferenceFlag.ADDR_MASK).toString(16)])];
                    case 13:
                        fields = _c.sent();
                        for (_b = 0, fields_1 = fields; _b < fields_1.length; _b++) {
                            field = fields_1[_b];
                            this._addressTypes[field.addr.toString(16)] = field.type || '';
                            variables.push({
                                type: field.type,
                                name: field.name,
                                value: field.value,
                                memoryReference: field.addr.toString(16),
                                variablesReference: field.addr | (field.type ? VariablesReferenceFlag.HAS_TYPE : 0)
                            });
                        }
                        return [3 /*break*/, 16];
                    case 14: return [4 /*yield*/, this._runtime.getMemory(ref & VariablesReferenceFlag.ADDR_MASK, 2)];
                    case 15:
                        val = _c.sent();
                        pointerVal = val.readUInt16LE(0);
                        if (ref & VariablesReferenceFlag.HAS_TYPE) {
                            variables.push({
                                name: "Type at this address",
                                value: "",
                                variablesReference: VariablesReferenceFlag.FOLLOW_TYPE | ref,
                                presentationHint: {
                                    kind: 'virtual'
                                }
                            });
                        }
                        variables.push(this._pointerMenu(pointerVal));
                        variables.push({
                            name: "Mem @ 0x" + ref.toString(16).padStart(4, '0') + " (Direct)",
                            value: "",
                            variablesReference: VariablesReferenceFlag.EXPAND_DATA | ref,
                            presentationHint: {
                                kind: 'virtual'
                            }
                        });
                        _c.label = 16;
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        e_2 = _c.sent();
                        console.error(e_2);
                        variables.push({
                            name: "Error",
                            value: e_2.toString(),
                            variablesReference: 0
                        });
                        return [3 /*break*/, 18];
                    case 18:
                        response.body = {
                            variables: variables
                        };
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.continueRequest = function (response, args) {
        this._runtime["continue"]();
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.reverseContinueRequest = function (response, args) {
        this._runtime["continue"](true);
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.nextRequest = function (response, args) {
        this._runtime.step();
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.stepInRequest = function (response, args, request) {
        this._runtime.stepIn();
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.stepOutRequest = function (response, args, request) {
        this._runtime.stepOut();
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.stepBackRequest = function (response, args) {
        throw new Error('Not supported');
    };
    CC65ViceDebugSession.prototype.pauseRequest = function (response, args, request) {
        this._runtime.pause();
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.evaluateRequest = function (response, args) {
        return __awaiter(this, void 0, void 0, function () {
            var reply, vars, _a, _b, v;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        reply = undefined;
                        if (!(args.context == "hover")) return [3 /*break*/, 3];
                        return [4 /*yield*/, this._runtime.getScopeVariables()];
                    case 1:
                        _b = (_a = (_c.sent())).concat;
                        return [4 /*yield*/, this._runtime.getGlobalVariables()];
                    case 2:
                        vars = _b.apply(_a, [_c.sent()]);
                        v = vars.find(function (x) { return x.name == args.expression; });
                        if (v) {
                            reply = v.value;
                        }
                        _c.label = 3;
                    case 3:
                        if (args.context === 'repl') {
                            reply = "Please use the monitor from the terminal tab. It can do colors and stuff.";
                        }
                        reply = reply || "No command entered.";
                        reply = reply.replace(/(\s+LDA\s+)/g, colors.green("$1"));
                        response.body = {
                            result: reply,
                            variablesReference: 0
                        };
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceDebugSession.prototype.setDataBreakpointsRequest = function (response, args) {
        // clear all data breakpoints
        this._runtime.clearAllDataBreakpoints();
        response.body = {
            breakpoints: []
        };
        for (var _i = 0, _a = args.breakpoints; _i < _a.length; _i++) {
            var dbp = _a[_i];
            // assume that id is the "address" to break on
            var ok = this._runtime.setDataBreakpoint(dbp.dataId);
            response.body.breakpoints.push({
                verified: ok
            });
        }
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.completionsRequest = function (response, args) {
        response.body = {
            targets: [
                {
                    label: "item 10",
                    sortText: "10"
                },
                {
                    label: "item 1",
                    sortText: "01"
                },
                {
                    label: "item 2",
                    sortText: "02"
                }
            ]
        };
        this.sendResponse(response);
    };
    CC65ViceDebugSession.prototype.cancelRequest = function (response, args) {
    };
    CC65ViceDebugSession.prototype.disconnectRequest = function (response, args, request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._runtime.terminate()];
                    case 1:
                        _a.sent();
                        this._addressTypes = {};
                        this.sendResponse(response);
                        return [2 /*return*/];
                }
            });
        });
    };
    //---- helpers
    CC65ViceDebugSession.prototype.createSource = function (filePath) {
        return new vscode_debugadapter_1.Source(path_1.basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'mock-adapter-data');
    };
    // we don't support multiple threads, so we can use a hardcoded ID for the default thread
    CC65ViceDebugSession.THREAD_ID = 1;
    return CC65ViceDebugSession;
}(vscode_debugadapter_1.LoggingDebugSession));
exports.CC65ViceDebugSession = CC65ViceDebugSession;
