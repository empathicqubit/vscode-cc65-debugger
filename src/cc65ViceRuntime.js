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
var fs = require("fs");
var _ = require("lodash");
var readdir = require("recursive-readdir");
var child_process = require("child_process");
var events_1 = require("events");
var path = require("path");
var clangQuery = require("./clangQuery");
var util = require("util");
var debugUtils = require("./debugUtils");
var dbgfile = require("./debugFile");
var node_watch_1 = require("node-watch");
var viceGrip_1 = require("./viceGrip");
var vicesWonderfulWorldOfColor_1 = require("./vicesWonderfulWorldOfColor");
var mapFile = require("./mapFile");
/**
 * A CC65Vice runtime with minimal debugger functionality.
 */
var CC65ViceRuntime = /** @class */ (function (_super) {
    __extends(CC65ViceRuntime, _super);
    function CC65ViceRuntime(sesh) {
        var _this = _super.call(this) || this;
        _this._paramStackBottom = -1;
        _this._paramStackTop = -1;
        _this._paramStackPointer = -1;
        _this._cpuStackBottom = 0x1ff;
        _this._cpuStackTop = 0x1ff;
        _this._memoryData = Buffer.alloc(0xffff);
        _this._codeSegAddress = -1;
        _this._codeSegLength = -1;
        // Monitors the code segment after initialization so that it doesn't accidentally get modified.
        _this._codeSegGuardIndex = -1;
        _this._entryAddress = -1;
        _this._breakPoints = [];
        _this._stackFrameStarts = {};
        _this._stackFrameEnds = {};
        // since we want to send breakpoint events, we will assign an id to every event
        // so that the frontend can match events with breakpoints.
        _this._breakpointId = 1;
        _this._viceRunning = false;
        _this._processExecHandler = (function (file, args, opts) {
            var promise = new Promise(function (res, rej) {
                if (!path.isAbsolute(file) && path.dirname(file) != '.') {
                    file = path.join(__dirname, file);
                }
                _this._session.runInTerminalRequest({
                    args: [file].concat(args),
                    cwd: opts.cwd || __dirname,
                    env: Object.assign({}, opts.env || {}, { ELECTRON_RUN_AS_NODE: "1" }),
                    kind: (_this._consoleType || 'integratedConsole').includes('external') ? 'external' : 'integrated'
                }, 5000, function (response) {
                    if (!response.success) {
                        rej(response);
                    }
                    else {
                        res([response.body.shellProcessId || -1, response.body.processId || -1]);
                    }
                });
            });
            return promise;
        });
        _this._session = sesh;
        return _this;
    }
    /**
    * Executes a monitor command in VICE.
    * @param cmd The command to send to VICE
    */
    CC65ViceRuntime.prototype.exec = function (cmd) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._vice.exec(cmd)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
    * Build the program using the command specified and try to find the output file with monitoring.
    * @returns The possible output files of types d81, prg, and d64.
    */
    CC65ViceRuntime.prototype.build = function (workspaceDir, cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var builder, filenames, watcher, files;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        builder = new Promise(function (res, rej) {
                            var process = child_process.spawn(cmd, {
                                shell: true,
                                cwd: workspaceDir
                            });
                            process.stdout.on('data', function (d) {
                                _this.sendEvent('output', 'stdout', d.toString());
                            });
                            process.stderr.on('data', function (d) {
                                _this.sendEvent('output', 'stderr', d.toString());
                            });
                            process.on('close', function (code) {
                                if (code) {
                                    rej(code);
                                }
                                res(code);
                            });
                        });
                        filenames = [];
                        watcher = node_watch_1["default"](workspaceDir, {
                            recursive: true,
                            filter: function (f) { return debugUtils.programFiletypes.test(f); }
                        }, function (evt, filename) {
                            filenames.push(filename);
                        });
                        return [4 /*yield*/, builder];
                    case 1:
                        _a.sent();
                        watcher.close();
                        if (filenames.length) {
                            return [2 /*return*/, filenames];
                        }
                        return [4 /*yield*/, readdir(workspaceDir)];
                    case 2:
                        filenames = _a.sent();
                        filenames = filenames.filter(function (x) { return debugUtils.programFiletypes.test(x); });
                        return [4 /*yield*/, Promise.all(filenames.map(function (filename) { return __awaiter(_this, void 0, void 0, function () {
                                var fileStats, listingLength, ext, res, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, util.promisify(fs.stat)(filename)];
                                        case 1:
                                            fileStats = _b.sent();
                                            listingLength = 0;
                                            ext = path.extname(filename).toLowerCase();
                                            if (!/^\.d[0-9]{2}$/.test(ext)) return [3 /*break*/, 5];
                                            _b.label = 2;
                                        case 2:
                                            _b.trys.push([2, 4, , 5]);
                                            return [4 /*yield*/, util.promisify(child_process.execFile)('c1541', ['-attach', filename, '-list'])];
                                        case 3:
                                            res = _b.sent();
                                            listingLength = (res.stdout.match(/[\r\n]+/g) || '').length;
                                            return [3 /*break*/, 5];
                                        case 4:
                                            _a = _b.sent();
                                            return [3 /*break*/, 5];
                                        case 5: return [2 /*return*/, {
                                                fileStats: fileStats,
                                                filename: filename,
                                                listingLength: listingLength
                                            }];
                                    }
                                });
                            }); }))];
                    case 3:
                        files = _a.sent();
                        filenames = _(files)
                            .orderBy([function (x) { return x.fileStats.mtime; }, function (x) { return x.listingLength; }], ['desc', 'desc'])
                            .map(function (x) { return x.filename; })
                            .value();
                        return [2 /*return*/, filenames];
                }
            });
        });
    };
    /**
    * Start executing the given program.
    */
    CC65ViceRuntime.prototype.start = function (program, buildCwd, stopOnEntry, vicePath, viceArgs, consoleType) {
        return __awaiter(this, void 0, void 0, function () {
            var startSym;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._consoleType = consoleType;
                        console.time('loadSource');
                        if (!debugUtils.programFiletypes.test(program)) {
                            throw new Error("File must be a Commodore Disk image or PRoGram.");
                        }
                        return [4 /*yield*/, this._loadSource(program, buildCwd)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this._loadMapFile(program)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this._getLocalTypes()];
                    case 3:
                        _a.sent();
                        console.timeEnd('loadSource');
                        console.time('preVice');
                        startSym = this._dbgFile.labs.find(function (x) { return x.name == "_main"; });
                        if (startSym != null) {
                            this._entryAddress = startSym.val;
                        }
                        this._resetRegisters();
                        this._setParamStackPointer();
                        console.timeEnd('preVice');
                        console.time('vice');
                        this._otherHandlers = new events_1.EventEmitter();
                        this._vice = new viceGrip_1.ViceGrip(program, this._entryAddress, path.dirname(program), (function (file, args, opts) { return _this._processExecHandler(file, args, opts); }), vicePath, viceArgs, this._otherHandlers);
                        return [4 /*yield*/, this._vice.start()];
                    case 4:
                        _a.sent();
                        this._vice.on('end', function () { return _this.terminate(); });
                        this._setupViceDataHandler();
                        return [4 /*yield*/, this["continue"]()];
                    case 5:
                        _a.sent();
                        this._viceRunning = false;
                        return [4 /*yield*/, this._vice.wait()];
                    case 6:
                        _a.sent();
                        console.timeEnd('vice');
                        console.time('postVice');
                        return [4 /*yield*/, this._initCodeSeg()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this._setLabels()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, this._resetStackFrames()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, this._setParamStackBottom()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, this._verifyBreakpoints()];
                    case 11:
                        _a.sent();
                        if (!stopOnEntry) return [3 /*break*/, 12];
                        // We don't do anything here since VICE should already be in the
                        // correct position after the startup routine.
                        this.sendEvent('stopOnEntry', 'console');
                        return [3 /*break*/, 14];
                    case 12: 
                    // we just start to run until we hit a breakpoint or an exception
                    return [4 /*yield*/, this["continue"]()];
                    case 13:
                        // we just start to run until we hit a breakpoint or an exception
                        _a.sent();
                        _a.label = 14;
                    case 14:
                        this._colorTerm = new vicesWonderfulWorldOfColor_1.VicesWonderfulWorldOfColor(this._vice, this._otherHandlers, function (f, a, o) { return _this._processExecHandler(f, a, o); });
                        this._colorTerm.main();
                        console.timeEnd('postVice');
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._initCodeSeg = function () {
        return __awaiter(this, void 0, void 0, function () {
            var codeSeg, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        codeSeg = this._dbgFile.segs.find(function (x) { return x.name == "CODE"; });
                        if (!codeSeg) {
                            return [2 /*return*/];
                        }
                        this._codeSegAddress = codeSeg.start;
                        this._codeSegLength = codeSeg.size;
                        return [4 /*yield*/, this._vice.exec("bk store $" + this._codeSegAddress.toString(16) + " $" + (this._codeSegAddress + this._codeSegLength - 1).toString(16))];
                    case 1:
                        res = _a.sent();
                        this._codeSegGuardIndex = this._getBreakpointNum(res);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._loadMapFile = function (program) {
        return __awaiter(this, void 0, void 0, function () {
            var text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(fs.readFile)(program.replace(debugUtils.programFiletypes, '.map'), 'utf8')];
                    case 1:
                        text = _a.sent();
                        this._mapFile = mapFile.parse(text);
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.getTypeFields = function (addr, typename) {
        return __awaiter(this, void 0, void 0, function () {
            var typeParts, isPointer, pointerVal, fields, vars, fieldSizes, totalSize, mem, currentPosition, f, fieldSize, field, typename_1, value;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        typeParts = typename.split(/\s+/g);
                        isPointer = typeParts.length > 1 && _.last(typeParts) == '*';
                        if (!isPointer) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getMemory(addr, 2)];
                    case 1:
                        pointerVal = _a.sent();
                        addr = pointerVal.readUInt16LE(0);
                        _a.label = 2;
                    case 2:
                        if (!this._localTypes) {
                            return [2 /*return*/, []];
                        }
                        fields = this._localTypes[typeParts[0]];
                        vars = [];
                        fieldSizes = clangQuery.recurseFieldSize(fields, this._localTypes);
                        totalSize = _.sum(fieldSizes);
                        return [4 /*yield*/, this.getMemory(addr, totalSize)];
                    case 3:
                        mem = _a.sent();
                        currentPosition = 0;
                        for (f in fieldSizes) {
                            fieldSize = fieldSizes[f];
                            field = fields[f];
                            typename_1 = field.type;
                            if (!this._localTypes[typename_1.split(/\s+/g)[0]]) {
                                typename_1 = '';
                            }
                            value = '';
                            if (fieldSize == 1) {
                                if (field.type.startsWith('signed')) {
                                    0;
                                    value = mem.readInt8(currentPosition).toString(16).padStart(2, '0');
                                }
                                else {
                                    value = mem.readUInt8(currentPosition).toString(16).padStart(2, '0');
                                }
                            }
                            else if (fieldSize == 2) {
                                if (field.type.startsWith('signed')) {
                                    value = mem.readInt16LE(currentPosition).toString(16).padStart(4, '0');
                                }
                                else {
                                    value = mem.readUInt16LE(currentPosition).toString(16).padStart(4, '0');
                                }
                            }
                            else {
                                value = mem.readUInt16LE(currentPosition).toString(16).padStart(4, '0');
                            }
                            vars.push({
                                type: typename_1,
                                name: field.name,
                                value: "0x" + value,
                                addr: addr + currentPosition
                            });
                            currentPosition += fieldSize;
                        }
                        return [2 /*return*/, vars];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.monitorToConsole = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this._vice.on('data', function (d) {
                    _this.sendEvent('output', 'console', d.toString());
                });
                return [2 /*return*/];
            });
        });
    };
    CC65ViceRuntime.prototype["continue"] = function (reverse) {
        if (reverse === void 0) { reverse = false; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._viceRunning = true;
                        return [4 /*yield*/, this._vice.exec('x')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.step = function (reverse, event) {
        if (reverse === void 0) { reverse = false; }
        if (event === void 0) { event = 'stopOnStep'; }
        return __awaiter(this, void 0, void 0, function () {
            var currentFile, currentIdx, span, currentFunction, nextLine, nextAddress, functionLines, currentIdx_1, remainingLines, setBrks, brks, brknums, delBrks;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentFile = this._currentPosition.file;
                        currentIdx = currentFile.lines.indexOf(this._currentPosition);
                        span = this._currentPosition.span;
                        if (span) {
                            currentFunction = this._dbgFile.scopes
                                .find(function (x) { return x.span && x.span.absoluteAddress <= span.absoluteAddress
                                && span.absoluteAddress < x.span.absoluteAddress + x.span.size; });
                        }
                        nextLine = currentFile.lines[currentIdx + 1];
                        if (!!nextLine) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._vice.exec('z')];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 2:
                        nextAddress = nextLine.span.absoluteAddress;
                        if (!currentFunction) return [3 /*break*/, 6];
                        functionLines = currentFunction.span.lines.filter(function (x) { return x.file == currentFile; });
                        currentIdx_1 = functionLines.findIndex(function (x) { return x.num == nextLine.num; });
                        remainingLines = functionLines.slice(currentIdx_1);
                        setBrks = remainingLines.map(function (x) { return "bk $" + x.span.absoluteAddress.toString(16); }).join(' ; ');
                        return [4 /*yield*/, this._vice.exec(setBrks)];
                    case 3:
                        brks = _a.sent();
                        brknums = this._getBreakpointMatches(brks);
                        return [4 /*yield*/, this._vice.exec("x")];
                    case 4:
                        _a.sent();
                        delBrks = brknums.map(function (x) { return "del " + x[0]; }).join(' ; ');
                        return [4 /*yield*/, this._vice.exec(delBrks)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        this._viceRunning = true;
                        return [4 /*yield*/, this._vice.exec("un $" + nextAddress.toString(16))];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        this.sendEvent(event, 'console');
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.stepIn = function () {
        return __awaiter(this, void 0, void 0, function () {
            var thisSpan, thisSegAddress, endCodeSeg, brk, brk2, brknum, brknum2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        thisSpan = this._currentPosition.span;
                        thisSegAddress = thisSpan.absoluteAddress - 1;
                        endCodeSeg = (this._codeSegAddress + this._codeSegLength).toString(16);
                        return [4 /*yield*/, this._vice.exec("watch exec $" + this._codeSegAddress.toString(16) + " $" + thisSegAddress.toString(16))];
                    case 1:
                        brk = _a.sent();
                        return [4 /*yield*/, this._vice.exec("watch exec $" + (thisSegAddress + thisSpan.size).toString(16) + " $" + endCodeSeg)];
                    case 2:
                        brk2 = _a.sent();
                        brknum = this._getBreakpointNum(brk);
                        brknum2 = this._getBreakpointNum(brk2);
                        return [4 /*yield*/, this._vice.exec("x")];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this._vice.exec("del " + brknum)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this._vice.exec("del " + brknum2)];
                    case 5:
                        _a.sent();
                        this.sendEvent('stopOnStep', 'console');
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.stepOut = function (event) {
        if (event === void 0) { event = 'stopOnStep'; }
        return __awaiter(this, void 0, void 0, function () {
            var lastFrame, begin, end, allbrk, allbrkmatch, brk, brknum;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lastFrame = this._stackFrames[this._stackFrames.length - 2];
                        if (!lastFrame) {
                            this.sendEvent('output', 'console', 'Can\'t step out here!');
                            return [2 /*return*/];
                        }
                        begin = lastFrame.scope.span.absoluteAddress;
                        end = lastFrame.scope.span.absoluteAddress + lastFrame.scope.span.size - 1;
                        return [4 /*yield*/, this._vice.exec("bk")];
                    case 1:
                        allbrk = _a.sent();
                        allbrkmatch = this._getBreakpointMatches(allbrk);
                        return [4 /*yield*/, this._vice.multiExec(allbrkmatch.map(function (x) { return "dis " + x[0]; }))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this._vice.exec("watch exec $" + begin.toString(16) + " $" + end.toString(16))];
                    case 3:
                        brk = _a.sent();
                        brknum = this._getBreakpointNum(brk);
                        return [4 /*yield*/, this._vice.exec("x")];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this._vice.exec("del " + brknum)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this._vice.multiExec(allbrkmatch.map(function (x) { return "en " + x[0]; }))];
                    case 6:
                        _a.sent();
                        this.sendEvent(event, 'console');
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.pause = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._vice.exec('r')];
                    case 1:
                        _a.sent();
                        this.sendEvent('stopOnStep', 'console');
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.stack = function (startFrame, endFrame) {
        return __awaiter(this, void 0, void 0, function () {
            var frames, i, _i, _a, frame;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this._setCpuStack()];
                    case 1:
                        _b.sent();
                        frames = new Array();
                        i = startFrame;
                        frames.push({
                            index: i,
                            name: '0x' + this._currentAddress.toString(16),
                            file: this._currentPosition.file.name,
                            line: this._currentPosition.num
                        });
                        i++;
                        for (_i = 0, _a = this._stackFrames.slice().reverse(); _i < _a.length; _i++) {
                            frame = _a[_i];
                            frames.push({
                                index: i,
                                name: frame.scope.name.replace(/^_/g, ''),
                                file: frame.line.file.name,
                                line: frame.line.num
                            });
                            i++;
                        }
                        return [2 /*return*/, {
                                frames: frames,
                                count: frames.length
                            }];
                }
            });
        });
    };
    // Clean up all the things
    CC65ViceRuntime.prototype.terminate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this._colorTerm;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._colorTerm.end()];
                    case 1:
                        _a = (_c.sent());
                        _c.label = 2;
                    case 2:
                        _a;
                        this._colorTerm = null;
                        _b = this._vice;
                        if (!_b) return [3 /*break*/, 4];
                        return [4 /*yield*/, this._vice.end()];
                    case 3:
                        _b = (_c.sent());
                        _c.label = 4;
                    case 4:
                        _b;
                        this._vice = null;
                        this._viceRunning = false;
                        this._dbgFile = null;
                        this._mapFile = null;
                        return [2 /*return*/];
                }
            });
        });
    };
    // Breakpoints
    CC65ViceRuntime.prototype._verifyBreakpoints = function () {
        return __awaiter(this, void 0, void 0, function () {
            var wasRunning, cmds, _loop_1, this_1, _i, _a, bp, res, bpMatches, _loop_2, this_2, _b, bpMatches_1, bpMatch;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this._dbgFile || !this._vice) {
                            return [2 /*return*/];
                        }
                        wasRunning = this._viceRunning;
                        cmds = [];
                        _loop_1 = function (bp) {
                            var sourceFile = this_1._dbgFile.files.find(function (x) { return x.lines.find(function (x) { return x.num == bp.line.num; }) && x.name == bp.line.file.name; });
                            if (!(sourceFile && !bp.verified && bp.line.num <= sourceFile.lines[sourceFile.lines.length - 1].num)) {
                                return "continue";
                            }
                            var srcLine = sourceFile.lines.find(function (x) { return x.num >= bp.line.num; });
                            if (!srcLine) {
                                return "continue";
                            }
                            bp.line = srcLine;
                            cmds.push("bk " + srcLine.span.absoluteAddress.toString(16));
                        };
                        this_1 = this;
                        for (_i = 0, _a = this._breakPoints; _i < _a.length; _i++) {
                            bp = _a[_i];
                            _loop_1(bp);
                        }
                        return [4 /*yield*/, this._vice.multiExec(cmds)];
                    case 1:
                        res = _c.sent();
                        bpMatches = this._getBreakpointMatches(res);
                        cmds = [];
                        _loop_2 = function (bpMatch) {
                            var idx = bpMatch[0];
                            var addr = bpMatch[1];
                            var bp = this_2._breakPoints.find(function (x) { return !x.verified && x.line.span && x.line.span.absoluteAddress == addr; });
                            if (!bp) {
                                return "continue";
                            }
                            bp.viceIndex = idx;
                            bp.verified = true;
                            this_2.sendEvent('breakpointValidated', bp);
                            cmds.push("cond " + idx + " if $574c == $574c");
                        };
                        this_2 = this;
                        for (_b = 0, bpMatches_1 = bpMatches; _b < bpMatches_1.length; _b++) {
                            bpMatch = bpMatches_1[_b];
                            _loop_2(bpMatch);
                        }
                        return [4 /*yield*/, this._vice.multiExec(cmds)];
                    case 2:
                        _c.sent();
                        if (!wasRunning) return [3 /*break*/, 4];
                        return [4 /*yield*/, this["continue"]()];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._clearBreakPoint = function (bp) {
        return __awaiter(this, void 0, void 0, function () {
            var index, bks, _a, _i, bks_1, bk, addr, idx;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        index = this._breakPoints.indexOf(bp);
                        this._breakPoints.splice(index, 1);
                        return [4 /*yield*/, this._vice.exec("del " + bp.viceIndex)];
                    case 1:
                        _b.sent();
                        _a = this._getBreakpointMatches;
                        return [4 /*yield*/, this._vice.exec("bk")];
                    case 2:
                        bks = _a.apply(this, [_b.sent()]);
                        _i = 0, bks_1 = bks;
                        _b.label = 3;
                    case 3:
                        if (!(_i < bks_1.length)) return [3 /*break*/, 6];
                        bk = bks_1[_i];
                        addr = bk[1];
                        idx = bk[0];
                        if (!(addr == bp.line.span.absoluteAddress)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this._vice.exec("del " + idx.toString())];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/, bp];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.getBreakpoints = function (path, line) {
        return [];
    };
    CC65ViceRuntime.prototype.setBreakPoint = function (path, line) {
        return __awaiter(this, void 0, void 0, function () {
            var lineSym, fil, bp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this._dbgFile) {
                            lineSym = this._dbgFile.lines.find(function (x) { return x.num == line && path.includes(x.file.name); });
                            if (!lineSym) {
                                return [2 /*return*/, null];
                            }
                        }
                        if (!lineSym) {
                            fil = {
                                mtime: new Date(),
                                name: path,
                                mod: "",
                                lines: [],
                                id: 0,
                                size: 0
                            };
                            lineSym = {
                                count: 0,
                                id: 0,
                                num: line,
                                span: null,
                                spanId: 0,
                                file: fil,
                                fileId: 0,
                                type: 0
                            };
                        }
                        bp = { verified: false, line: lineSym, viceIndex: -1, id: this._breakpointId++ };
                        this._breakPoints.push(bp);
                        return [4 /*yield*/, this._verifyBreakpoints()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, bp];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.clearBreakpoints = function (p) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, bp;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this._breakPoints.slice();
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        bp = _a[_i];
                        if (!bp.line.file.name.includes(p)) {
                            return [3 /*break*/, 3];
                        }
                        return [4 /*yield*/, this._clearBreakPoint(bp)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.setDataBreakpoint = function (address) {
        return false;
    };
    CC65ViceRuntime.prototype.clearAllDataBreakpoints = function () {
    };
    // Memory access
    CC65ViceRuntime.prototype.getMemory = function (addr, length) {
        return __awaiter(this, void 0, void 0, function () {
            var end, cmd, buf, resLength, i, res, _i, res_1, byt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (length <= 0) {
                            return [2 /*return*/, Buffer.alloc(0)];
                        }
                        end = addr + (length - 1);
                        cmd = new Uint8Array(9);
                        cmd[0] = 0x02; // Binary marker
                        cmd[1] = cmd.length - 3; // Length
                        cmd[2] = 0x01; // memdump, the only binary command
                        cmd[3] = addr & 0x00FF; // Low byte
                        cmd[4] = addr >> 8; // High byte
                        cmd[5] = end & 0x00FF; // Low byte
                        cmd[6] = end >> 8; // High byte
                        cmd[7] = 0x00; // Memory context (Computer)
                        cmd[8] = '\n'.charCodeAt(0); // Memory context (Computer)
                        return [4 /*yield*/, this._vice.exec(cmd)];
                    case 1:
                        buf = (_a.sent());
                        resLength = buf.readUInt32LE(1);
                        i = 0;
                        res = buf.slice(6, 6 + resLength);
                        for (_i = 0, res_1 = res; _i < res_1.length; _i++) {
                            byt = res_1[_i];
                            this._memoryData.writeUInt8(byt, addr + i);
                            i++;
                        }
                        return [2 /*return*/, res];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._getLocalVariableSyms = function (scope) {
        return scope.csyms.filter(function (x) { return x.sc == dbgfile.sc.auto; });
    };
    CC65ViceRuntime.prototype._getCurrentScope = function () {
        var _this = this;
        return this._dbgFile.scopes
            .find(function (x) { return x.span
            && x.span.absoluteAddress <= _this._currentPosition.span.absoluteAddress
            && _this._currentPosition.span.absoluteAddress <= x.span.absoluteAddress + x.span.size; });
    };
    CC65ViceRuntime.prototype.getScopeVariables = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stack, scope, vars, locals, mostOffset, _loop_3, this_3, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getParamStack()];
                    case 1:
                        stack = _a.sent();
                        if (!stack.length) {
                            return [2 /*return*/, []];
                        }
                        scope = this._getCurrentScope();
                        if (!scope) {
                            return [2 /*return*/, []];
                        }
                        vars = [];
                        locals = this._getLocalVariableSyms(scope);
                        mostOffset = locals[0].offs;
                        _loop_3 = function (i) {
                            var csym, nextCsym, seek, seekNext, addr, ptr, val, typename, mem, nullIndex, str;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        csym = locals[i];
                                        nextCsym = locals[i + 1];
                                        seek = -mostOffset + csym.offs;
                                        seekNext = -mostOffset + csym.offs + 2;
                                        if (nextCsym) {
                                            seekNext = -mostOffset + nextCsym.offs;
                                        }
                                        addr = this_3._paramStackTop + seek;
                                        ptr = void 0;
                                        val = void 0;
                                        if (seekNext - seek == 2) {
                                            ptr = stack.readUInt16LE(seek);
                                            val = "0x" + ptr.toString(16).padStart(4, '0');
                                        }
                                        else {
                                            val = "0x" + stack.readUInt8(seek).toString(16).padStart(2, '0');
                                        }
                                        typename = '';
                                        if (!this_3._localTypes) return [3 /*break*/, 3];
                                        typename = (this_3._localTypes[scope.name + '()'].find(function (x) { return x.name == csym.name; }) || {}).type || '';
                                        if (!(ptr && /\bchar\s+\*/g.test(typename))) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this_3.getMemory(ptr, 24)];
                                    case 1:
                                        mem = _a.sent();
                                        nullIndex = mem.indexOf(0x00);
                                        str = mem.slice(0, nullIndex === -1 ? undefined : nullIndex).toString();
                                        val = str + " (" + debugUtils.rawBufferHex(mem) + ")";
                                        _a.label = 2;
                                    case 2:
                                        if (!this_3._localTypes[typename.split(/\s+/g)[0]]) {
                                            typename = '';
                                        }
                                        _a.label = 3;
                                    case 3:
                                        vars.push({
                                            name: csym.name,
                                            value: val,
                                            addr: addr,
                                            type: typename
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_3 = this;
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < locals.length)) return [3 /*break*/, 5];
                        return [5 /*yield**/, _loop_3(i)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, vars];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.getParamStack = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._setParamStackTop()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.getGlobalVariables = function () {
        return __awaiter(this, void 0, void 0, function () {
            var vars, _loop_4, this_4, _i, _a, sym;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        vars = [];
                        _loop_4 = function (sym) {
                            var symName, buf, ptr, val, typename, mem, nullIndex, str;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!sym.name.startsWith("_") || (sym.seg && sym.seg.name == "CODE")) {
                                            return [2 /*return*/, "continue"];
                                        }
                                        symName = sym.name.replace(/^_/g, '');
                                        return [4 /*yield*/, this_4.getMemory(sym.val, 2)];
                                    case 1:
                                        buf = _a.sent();
                                        ptr = buf.readUInt16LE(0);
                                        val = debugUtils.rawBufferHex(buf);
                                        typename = '';
                                        if (!this_4._localTypes) return [3 /*break*/, 4];
                                        typename = (this_4._localTypes['__GLOBAL__()'].find(function (x) { return x.name == symName; }) || {}).type || '';
                                        console.log(this_4._localTypes);
                                        if (!/\bchar\s+\*/g.test(typename)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, this_4.getMemory(ptr, 24)];
                                    case 2:
                                        mem = _a.sent();
                                        nullIndex = mem.indexOf(0x00);
                                        str = mem.slice(0, nullIndex === -1 ? undefined : nullIndex).toString();
                                        val = str + " (" + debugUtils.rawBufferHex(mem) + ")";
                                        _a.label = 3;
                                    case 3:
                                        if (!this_4._localTypes[typename.split(/\s+/g)[0]]) {
                                            typename = '';
                                        }
                                        _a.label = 4;
                                    case 4:
                                        vars.push({
                                            name: symName,
                                            value: val,
                                            addr: sym.val,
                                            type: typename
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_4 = this;
                        _i = 0, _a = this._dbgFile.labs;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        sym = _a[_i];
                        return [5 /*yield**/, _loop_4(sym)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, vars];
                }
            });
        });
    };
    CC65ViceRuntime.prototype.getRegisters = function () {
        return this._registers;
    };
    // We set labels here so the user doesn't have to generate Yet Another File
    CC65ViceRuntime.prototype._setLabels = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._vice.multiExec(this._dbgFile.labs.map(function (lab) {
                            return "al $" + lab.val.toString(16) + " ." + lab.name;
                        }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // FIXME These regexes could be pushed out and you could emit your own events.
    CC65ViceRuntime.prototype._setupViceDataHandler = function () {
        var _this = this;
        var breakpointHit = false;
        this._vice.on('data', function (d) { return __awaiter(_this, void 0, void 0, function () {
            var data, addrexe, r, full, addr, a, x, y, sp, addrParse, regs, r, full, addr, a, x, y, sp, zero, one, nvbdizc, addrParse, memrex, memmatch, addr, i, md, _i, _a, byt, breakrex, breakmatch, addr, index, guard, userBreak, tracerex, tracematch, _loop_5, this_5;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        data = d.toString();
                        this._otherHandlers.emit('data', data);
                        addrexe = /^\.C:([0-9a-f]+)([^\r\n]+\s+A:([0-9a-f]+)\s+X:([0-9a-f]+)\s+Y:([0-9a-f]+)\s+SP:([0-9a-f]+)\s+)/im.exec(data);
                        if (addrexe) {
                            r = this._registers;
                            full = addrexe[0], addr = addrexe[1];
                            if (addrexe.length > 2) {
                                a = addrexe[2], x = addrexe[3], y = addrexe[4], sp = addrexe[5];
                                r.a = parseInt(a, 16);
                                r.x = parseInt(x, 16);
                                r.y = parseInt(y, 16);
                                r.sp = parseInt(sp, 16);
                            }
                            addrParse = parseInt(addr, 16);
                            this._currentAddress = addrParse;
                            this._currentPosition = this._getLineFromAddress(addrParse);
                            this.sendEvent('output', 'console', null, this._currentPosition.file.name, this._currentPosition.num, 0);
                            if (addrexe[3]) {
                                this._cpuStackTop = 0x100 + parseInt(addrexe[3], 16);
                            }
                        }
                        regs = /\s*ADDR\s+A\s+X\s+Y\s+SP\s+00\s+01\s+NV-BDIZC\s+LIN\s+CYC\s+STOPWATCH\s+\.;([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)/im.exec(data);
                        if (regs) {
                            r = this._registers;
                            full = regs[0], addr = regs[1], a = regs[2], x = regs[3], y = regs[4], sp = regs[5], zero = regs[6], one = regs[7], nvbdizc = regs[8];
                            r.a = parseInt(a, 16);
                            r.x = parseInt(x, 16);
                            r.y = parseInt(y, 16);
                            r.sp = parseInt(sp, 16);
                            r["00"] = parseInt(zero, 16);
                            r["01"] = parseInt(one, 16);
                            r.nvbdizc = parseInt(nvbdizc, 16);
                            addrParse = parseInt(regs[1], 16);
                            this._currentAddress = addrParse;
                            this._currentPosition = this._getLineFromAddress(addrParse);
                            this.sendEvent('output', 'console', null, this._currentPosition.file.name, this._currentPosition.num, 0);
                        }
                        memrex = /^\>C:([0-9a-f]+)((\s+[0-9a-f]{2}){1,9})/gim;
                        memmatch = memrex.exec(data);
                        if (memmatch) {
                            do {
                                addr = parseInt(memmatch[1] || "0", 16);
                                i = 0;
                                md = this._memoryData;
                                for (_i = 0, _a = memmatch[2].split(/\s+/g); _i < _a.length; _i++) {
                                    byt = _a[_i];
                                    if (!byt) {
                                        continue;
                                    }
                                    md.writeUInt8(parseInt(byt, 16), addr + i);
                                    i++;
                                }
                            } while (memmatch = memrex.exec(data));
                        }
                        breakrex = /^#([0-9]+)\s+\(Stop\s+on\s+(exec|store)\s+([0-9a-f]+)\)\s+/gim;
                        breakmatch = breakrex.exec(data);
                        if (!breakmatch) return [3 /*break*/, 3];
                        addr = parseInt(breakmatch[3], 16);
                        this._currentAddress = addr;
                        this._currentPosition = this._getLineFromAddress(addr);
                        index = parseInt(breakmatch[1]);
                        if (!(this._codeSegGuardIndex == index)) return [3 /*break*/, 2];
                        guard = this._codeSegGuardIndex;
                        this._codeSegGuardIndex = -1;
                        return [4 /*yield*/, this._vice.exec("del " + guard)];
                    case 1:
                        _b.sent();
                        this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file.name, this._currentPosition.num, 0);
                        this.sendEvent('output', 'console', 'CODE segment was modified. Your program may be broken!');
                        return [3 /*break*/, 3];
                    case 2:
                        userBreak = this._breakPoints.find(function (x) { return x.line.span && x.line.span.absoluteAddress == _this._currentPosition.span.absoluteAddress; });
                        if (userBreak) {
                            this._viceRunning = false;
                            this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file.name, this._currentPosition.num, 0);
                        }
                        _b.label = 3;
                    case 3:
                        tracerex = /^#([0-9]+)\s+\(Trace\s+(\w+)\s+([0-9a-f]+)\)\s+/gim;
                        tracematch = tracerex.exec(data);
                        if (tracematch) {
                            _loop_5 = function () {
                                var index = parseInt(tracematch[1]);
                                if (tracematch[2] != 'exec') {
                                    return "continue";
                                }
                                var addr = tracematch[3].toLowerCase();
                                var scope;
                                if (scope = this_5._stackFrameStarts[addr]) {
                                    var line = this_5._getLineFromAddress(parseInt(addr, 16));
                                    this_5._stackFrames.push({ line: line, scope: scope });
                                }
                                if (scope = this_5._stackFrameEnds[addr]) {
                                    var idx = this_5._stackFrames.slice().reverse().findIndex(function (x) { return x.scope.id == scope.id; });
                                    if (idx > -1) {
                                        this_5._stackFrames.splice(this_5._stackFrames.length - 1 - idx, 1);
                                    }
                                }
                            };
                            this_5 = this;
                            do {
                                _loop_5();
                            } while (tracematch = tracerex.exec(data));
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    };
    CC65ViceRuntime.prototype._loadSource = function (file, buildDir) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        _a = this;
                        return [4 /*yield*/, debugUtils.loadDebugFile(file, buildDir)];
                    case 1: return [2 /*return*/, _a._dbgFile = _c.sent()];
                    case 2:
                        _b = _c.sent();
                        throw new Error("Could not load debug symbols file from cc65. It must nave\nthe same name as your d84/d64/prg file with an .dbg extension.");
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._getParamStackPos = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getMemory(this._paramStackPointer, 2)];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.readUInt16LE(0)];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._setParamStackBottom = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this._getParamStackPos()];
                    case 1:
                        _a._paramStackBottom = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._setParamStackTop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this._getParamStackPos()];
                    case 1:
                        _a._paramStackTop = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._setParamStackPointer = function () {
        var zp = this._dbgFile.segs.find(function (x) { return x.name == 'ZEROPAGE'; });
        if (!zp) {
            return -1;
        }
        this._paramStackPointer = zp.start;
    };
    CC65ViceRuntime.prototype._setCpuStack = function () {
        return __awaiter(this, void 0, void 0, function () {
            var i, _i, _a, byt;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        i = 0;
                        _i = 0;
                        return [4 /*yield*/, this.getMemory(this._cpuStackTop, this._cpuStackBottom - this._cpuStackTop)];
                    case 1:
                        _a = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        byt = _a[_i];
                        this._memoryData.writeUInt8(byt, this._cpuStackTop + i);
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._getLineFromAddress = function (addr) {
        var curSpan = this._dbgFile.spans
            .find(function (x) {
            return x.absoluteAddress <= addr
                && x.lines.length
                && x.lines.find(function (l) { return l.file && /\.c$/gi.test(l.file.name); });
        })
            || this._dbgFile.spans[0];
        return curSpan.lines
            .find(function (x) { return x.file && /\.c$/gi.test(x.file.name); })
            || this._dbgFile.lines[0];
    };
    CC65ViceRuntime.prototype._getBreakpointMatches = function (breakpointText) {
        var rex = /^(BREAK|WATCH|TRACE|UNTIL):\s+([0-9]+)\s+C:\$([0-9a-f]+)/gim;
        var matches = [];
        var match;
        while (match = rex.exec(breakpointText)) {
            matches.push([parseInt(match[2]), parseInt(match[3], 16)]);
        }
        return matches;
    };
    CC65ViceRuntime.prototype._getBreakpointNum = function (breakpointText) {
        return this._getBreakpointMatches(breakpointText)[0][0];
    };
    CC65ViceRuntime.prototype._resetRegisters = function () {
        var _a;
        this._registers = (_a = {
                a: 0xff,
                x: 0xff,
                y: 0xff
            },
            _a["00"] = 0xff,
            _a["01"] = 0xff,
            _a.nvbdizc = 0xff,
            _a.sp = 0xff,
            _a);
    };
    CC65ViceRuntime.prototype._getLocalTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = this;
                        return [4 /*yield*/, clangQuery.getLocalTypes(this._dbgFile)];
                    case 1:
                        _a._localTypes = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _b.sent();
                        this.sendEvent('output', 'stderr', 'Not using Clang tools. Are they installed?');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CC65ViceRuntime.prototype._resetStackFrames = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, scope, span, begin, end, dasm, jmprex, jmpmatch, _loop_6, this_6, finish, start, _b, _c, line;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        this._stackFrameStarts = {};
                        this._stackFrameEnds = {};
                        this._stackFrames = [];
                        _i = 0, _a = this._dbgFile.scopes;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        scope = _a[_i];
                        if (!scope.name.startsWith("_")) {
                            return [3 /*break*/, 3];
                        }
                        span = scope.span;
                        if (!span) {
                            return [3 /*break*/, 3];
                        }
                        begin = span.absoluteAddress;
                        end = begin + span.size;
                        return [4 /*yield*/, this._vice.exec("d $" + begin.toString(16) + " $" + (end - 1).toString(16))];
                    case 2:
                        dasm = _d.sent();
                        jmprex = /^\.([C]):([0-9a-f]{4})\s{2}4c\s(([0-9a-f]+\s){2})\s*JMP\s.*$/gim;
                        jmpmatch = void 0;
                        _loop_6 = function () {
                            var addr = parseInt(jmpmatch[2], 16);
                            var targetBytes = jmpmatch[3].split(/\s+/g).filter(function (x) { return x; });
                            var targetAddr = parseInt(targetBytes[1] + targetBytes[0], 16);
                            var builtin = this_6._mapFile.find(function (x) { return x.functionName.startsWith('incsp') && x.functionAddress == targetAddr; });
                            if (!builtin) {
                                return "continue";
                            }
                            this_6._stackFrameEnds[addr.toString(16)] = scope;
                        };
                        this_6 = this;
                        while (jmpmatch = jmprex.exec(dasm)) {
                            _loop_6();
                        }
                        finish = false;
                        start = this._dbgFile.lines[0];
                        for (_b = 0, _c = this._dbgFile.lines; _b < _c.length; _b++) {
                            line = _c[_b];
                            if (!line.span) {
                                continue;
                            }
                            if (line.span.absoluteAddress < begin) {
                                break;
                            }
                            if (!finish && (line.span.absoluteAddress + line.span.size) <= end) {
                                this._stackFrameEnds[line.span.absoluteAddress.toString(16)] = scope;
                                finish = true;
                            }
                            start = line;
                        }
                        this._stackFrameStarts[start.span.absoluteAddress.toString(16)] = scope;
                        _d.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [4 /*yield*/, this._vice.multiExec(Object.keys(this._stackFrameEnds).concat(Object.keys(this._stackFrameStarts)).map(function (addr) { return "tr exec $" + addr; }))];
                    case 5:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Comm
    CC65ViceRuntime.prototype.sendEvent = function (event) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        setImmediate(function (_) {
            _this.emit.apply(_this, [event].concat(args));
        });
    };
    return CC65ViceRuntime;
}(events_1.EventEmitter));
exports.CC65ViceRuntime = CC65ViceRuntime;
