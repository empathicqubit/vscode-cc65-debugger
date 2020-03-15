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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
exports.__esModule = true;
var net = require("net");
var _ = require("lodash");
var getPort = require("get-port");
var tmp = require("tmp");
var stream_1 = require("stream");
var fs = require("fs");
var util = require("util");
var hasbin = require("hasbin");
var waitPort = require('wait-port');
var queue = require('queue');
var MAX_CHUNK = 10;
function fakeStream() {
    return __asyncGenerator(this, arguments, function fakeStream_1() {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 3];
                    return [4 /*yield*/, __await(new Promise(function (res, rej) { return setTimeout(function () { return res('\n(C:$0000) '); }, 1); }))];
                case 1: return [4 /*yield*/, _a.sent()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 0];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var ViceGrip = /** @class */ (function (_super) {
    __extends(ViceGrip, _super);
    function ViceGrip(program, initBreak, cwd, handler, vicePath, viceArgs, consoleHandler) {
        var _this = _super.call(this) || this;
        _this._port = -1;
        _this._initBreak = -1;
        _this._cmdQueue = queue({
            concurrency: 1,
            timeout: 5000,
            autostart: true
        });
        _this._handler = handler;
        _this._consoleHandler = consoleHandler;
        _this._program = program;
        _this._initBreak = initBreak;
        _this._cwd = cwd;
        _this._vicePath = vicePath;
        _this._viceArgs = viceArgs;
        return _this;
    }
    /**
    * This isn't currently used but it is meant to allow commands to be written
    * to a playback file which will be executed when VICE is started for real
    * with start. I was originally doing this because TCP performance was lacking.
    * my new workaround is to jam a bunch of commands together with ; separators.
    */
    ViceGrip.prototype.openBuffer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, write;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, util.promisify(tmp.tmpName)()];
                    case 1:
                        _a._bufferFileName = _b.sent();
                        write = fs.createWriteStream(this._bufferFileName);
                        this._bufferFile = write;
                        this._fakeStream = stream_1.Readable.from(fakeStream());
                        return [2 /*return*/];
                }
            });
        });
    };
    ViceGrip.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fake, buf, _a, args, opts, _b, _c, x64Exec, _d, e_1, connection, _e, tries, e_2;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (this._fakeStream || this._bufferFile) {
                            fake = this._fakeStream;
                            buf = this._bufferFile;
                            this._fakeStream = null;
                            this._bufferFile = null;
                            fake.destroy();
                            buf.end();
                        }
                        _a = this;
                        return [4 /*yield*/, getPort({ port: getPort.makeRange(29170, 29970) })];
                    case 1:
                        _a._port = _f.sent();
                        args = [
                            // Monitor
                            "-nativemonitor",
                            "-remotemonitor", "-remotemonitoraddress", "127.0.0.1:" + this._port,
                            // Hardware
                            "-iecdevice8", "-autostart-warp", "-autostart-handle-tde"
                        ].concat((this._initBreak > -1
                            ? ['-initbreak', this._initBreak.toString()]
                            : []));
                        if (this._viceArgs) {
                            args = args.concat(this._viceArgs, [this._program]);
                        }
                        else {
                            args = args.concat([this._program]);
                        }
                        opts = {
                            shell: false,
                            cwd: this._cwd
                        };
                        if (!this._vicePath) return [3 /*break*/, 7];
                        _f.label = 2;
                    case 2:
                        _f.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, util.promisify(fs.stat)(this._vicePath)];
                    case 3:
                        _f.sent();
                        _b = this;
                        return [4 /*yield*/, this._handler(this._vicePath, args, opts)];
                    case 4:
                        _b._pids = _f.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _c = _f.sent();
                        throw new Error("Could not start VICE using launch.json->viceCommand = \"" + this._vicePath + "\". Make sure it's an absolute path.");
                    case 6: return [3 /*break*/, 11];
                    case 7:
                        _f.trys.push([7, 10, , 11]);
                        return [4 /*yield*/, util.promisify(function (i, cb) { return hasbin.first(i, function (result) { return result ? cb(null, result) : cb(new Error('Missing'), null); }); })(['x64sc', 'x64'])];
                    case 8:
                        x64Exec = _f.sent();
                        _d = this;
                        return [4 /*yield*/, this._handler(x64Exec, args, opts)];
                    case 9:
                        _d._pids = _f.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        e_1 = _f.sent();
                        throw new Error('Could not start either x64 or x64sc. Define your VICE path in your launch.json->viceCommand property');
                    case 11:
                        connection = new net.Socket();
                        _f.label = 12;
                    case 12:
                        _e = this._port;
                        return [4 /*yield*/, getPort({ port: getPort.makeRange(this._port, this._port + 1) })];
                    case 13:
                        if (!(_e == (_f.sent()))) return [3 /*break*/, 14];
                        ;
                        return [3 /*break*/, 12];
                    case 14:
                        tries = 0;
                        _f.label = 15;
                    case 15:
                        tries++;
                        _f.label = 16;
                    case 16:
                        _f.trys.push([16, 18, , 19]);
                        return [4 /*yield*/, waitPort({
                                host: '127.0.0.1',
                                port: this._port,
                                timeout: 10000,
                                interval: 500
                            })];
                    case 17:
                        _f.sent();
                        connection.connect({
                            host: '127.0.0.1',
                            port: this._port
                        });
                        return [3 /*break*/, 19];
                    case 18:
                        e_2 = _f.sent();
                        if (tries > 3) {
                            throw e_2;
                        }
                        return [3 /*break*/, 20];
                    case 19:
                        this._conn = connection;
                        return [3 /*break*/, 21];
                    case 20:
                        if (true) return [3 /*break*/, 15];
                        _f.label = 21;
                    case 21:
                        if (!this._bufferFileName) return [3 /*break*/, 24];
                        return [4 /*yield*/, this.exec("pb \"" + this._bufferFileName + "\"")];
                    case 22:
                        _f.sent();
                        return [4 /*yield*/, util.promisify(fs.unlink)(this._bufferFileName)];
                    case 23:
                        _f.sent();
                        this._bufferFileName = null;
                        _f.label = 24;
                    case 24: return [2 /*return*/];
                }
            });
        });
    };
    ViceGrip.prototype.wait = function (binary) {
        if (binary === void 0) { binary = false; }
        return __awaiter(this, void 0, void 0, function () {
            var conn;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this._fakeStream) {
                            conn = this._fakeStream;
                        }
                        else {
                            conn = this._conn;
                        }
                        return [4 /*yield*/, new Promise(function (res, rej) {
                                var gather = [];
                                var binaryLength = -1;
                                var binaryCount = 0;
                                var binaryGather = [];
                                var waitForViceData = function (d) {
                                    if (binary) {
                                        if (binaryLength == -1) {
                                            binaryLength = d.readUInt32LE(1) + 6; // STX + address + error byte
                                        }
                                        binaryGather.push(d);
                                        binaryCount += d.length;
                                        if (binaryCount >= binaryLength) {
                                            conn.removeListener('data', waitForViceData);
                                            conn.removeListener('error', rej);
                                            res(Buffer.concat(binaryGather));
                                            return;
                                        }
                                    }
                                    var data = d.toString();
                                    gather.push(data);
                                    var match = /^\(C:\$([0-9a-f]+)\)/m.test(data);
                                    if (match) {
                                        conn.off('data', waitForViceData);
                                        conn.off('error', rej);
                                        res(gather.join(''));
                                    }
                                };
                                conn.on('data', waitForViceData);
                                conn.on('error', rej);
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ViceGrip.prototype.multiExec = function (cmds) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(_(cmds).chunk(MAX_CHUNK).map(function (chunk) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.exec(chunk.join(' ; '))];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); }).value())];
                    case 1: return [2 /*return*/, (_a.sent()).join('\n')];
                }
            });
        });
    };
    ViceGrip.prototype.exec = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var conn;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this._bufferFile) {
                            conn = this._bufferFile;
                        }
                        else {
                            conn = this._conn;
                        }
                        if (!(command instanceof Uint8Array)) return [3 /*break*/, 2];
                        return [4 /*yield*/, new Promise(function (res, rej) {
                                _this._cmdQueue.push(function () { return __awaiter(_this, void 0, void 0, function () {
                                    var finish, done, e_3;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _a.trys.push([0, 2, , 3]);
                                                conn.write(Buffer.from(command));
                                                finish = this.wait(true);
                                                return [4 /*yield*/, finish];
                                            case 1:
                                                done = _a.sent();
                                                res(done);
                                                return [3 /*break*/, 3];
                                            case 2:
                                                e_3 = _a.sent();
                                                rej(e_3);
                                                throw e_3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); });
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, new Promise(function (res, rej) {
                            _this._cmdQueue.push(function () { return __awaiter(_this, void 0, void 0, function () {
                                var finish, done, e_4;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            conn.write(command + "\n");
                                            finish = this.wait();
                                            return [4 /*yield*/, finish];
                                        case 1:
                                            done = _a.sent();
                                            res(done);
                                            return [3 /*break*/, 3];
                                        case 2:
                                            e_4 = _a.sent();
                                            rej(e_4);
                                            throw e_4;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); });
                        })];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ViceGrip.prototype.end = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this._pids[1] > -1 && process.kill(this._pids[1], "SIGKILL");
                        this._pids[0] > -1 && process.kill(this._pids[0], "SIGKILL");
                        this.exec("quit");
                        _a = this._conn;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, util.promisify(function (cb) { return _this._conn.end(cb); })()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        _a;
                        this._pids = [-1, -1];
                        this._conn = null;
                        this._cmdQueue.end();
                        return [2 /*return*/];
                }
            });
        });
    };
    ViceGrip.prototype.pipe = function (destination, options) {
        return this._conn.pipe(destination, options);
    };
    ViceGrip.prototype.on = function (event, listener) {
        if (event == 'data') {
            this._conn.on(event, listener);
        }
        else if (event == 'end') {
            this._conn.on('close', listener);
            this._conn.on('finish', listener);
            this._conn.on('end', listener);
        }
        else {
            this._conn.on(event, listener);
        }
        return this;
    };
    ViceGrip.prototype.removeListener = function (event, listener) {
        this._conn.removeListener(event, listener);
        return this;
    };
    return ViceGrip;
}(stream_1.EventEmitter));
exports.ViceGrip = ViceGrip;
