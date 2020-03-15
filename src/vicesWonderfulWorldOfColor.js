"use strict";
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
var net = require("net");
var colors = require("colors");
var getPort = require("get-port");
var util = require("util");
var contentMangler = function (data) {
    data = data.replace(/[^ -~\s]+/g, '');
    var asmrex = /^\.([C])(:)([0-9a-f]){4}\s{2}(([0-9a-f]+\s){1,4})\s*(\w{3})\s.*$/gim;
    var replacements = {};
    var asmmatch;
    while (asmmatch = asmrex.exec(data)) {
        var cmd = asmmatch[6];
        if (cmd.startsWith('LD')) {
            replacements[asmmatch[0]] = colors.green(asmmatch[0]);
        }
        else if (cmd.startsWith('ST')) {
            replacements[asmmatch[0]] = colors.red(asmmatch[0]);
        }
        else if (cmd.startsWith('J') || cmd.startsWith('B')) {
            replacements[asmmatch[0]] = colors.yellow(asmmatch[0]);
        }
    }
    // FIXME DRY error. Should push all regexes into common location.
    var memrex = /^(\s*>)([C])(:)([0-9a-f]{4})(\s{2}(([0-9a-f]{2}\s){4}\s){4}\s)(.{16})/gim;
    var memmatch;
    var _loop_1 = function () {
        var newString = [];
        newString.push(memmatch[1], memmatch[2], memmatch[3], memmatch[4]);
        var byteColors = [];
        var i = 0;
        var hex = memmatch[5].replace(/[0-9a-f]+\s/g, function (match) {
            var val = parseInt(match, 16);
            var col;
            if (!val) {
                col = colors.gray;
            }
            else {
                col = colors.reset;
            }
            byteColors.push(col(memmatch[8][i]));
            i++;
            return col(match);
        });
        newString.push(hex, byteColors.join(''));
        replacements[memmatch[0]] = newString.join('');
    };
    while (memmatch = memrex.exec(data)) {
        _loop_1();
    }
    for (var orig in replacements) {
        var replacement = replacements[orig];
        data = data.replace(orig, replacement);
    }
    return data;
};
var VicesWonderfulWorldOfColor = /** @class */ (function () {
    function VicesWonderfulWorldOfColor(vice, output, handler) {
        this._output = output;
        this._handler = handler;
        this._vice = vice;
    }
    VicesWonderfulWorldOfColor.prototype.enableFlood = function (sock) {
        return __awaiter(this, void 0, void 0, function () {
            var gather, onData, concat;
            return __generator(this, function (_a) {
                gather = [];
                onData = function (data) {
                    gather.push(data);
                };
                concat = function () {
                    sock.write(contentMangler(gather.join('')));
                    gather = [];
                    setTimeout(concat, 100);
                };
                setTimeout(concat, 100);
                this._output.on('data', onData);
                return [2 /*return*/];
            });
        });
    };
    VicesWonderfulWorldOfColor.prototype.main = function () {
        return __awaiter(this, void 0, void 0, function () {
            var server, port, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        server = new net.Server(function (sock) {
                            sock.write(colors.green("I'm the VICE monitor! I only display responses to your commands, but if you want\nto see everything going on behind the scenes, type the command \"!iwantitall\"\n"));
                            var onData = function (data) { return __awaiter(_this, void 0, void 0, function () {
                                var cmd, res;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            cmd = data.toString().split(/[\r\n]+/g)[0];
                                            if (!/^\s*!\s*iwantitall/gi.test(cmd)) return [3 /*break*/, 1];
                                            sock.write("And I want it now!\n");
                                            this.enableFlood(sock);
                                            return [3 /*break*/, 3];
                                        case 1: return [4 /*yield*/, this._vice.exec(cmd)];
                                        case 2:
                                            res = _a.sent();
                                            sock.write(contentMangler(res));
                                            _a.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); };
                            sock.on('data', onData);
                        });
                        return [4 /*yield*/, getPort({ port: getPort.makeRange(29170, 30000) })];
                    case 1:
                        port = _b.sent();
                        server.listen(port, '127.0.0.1');
                        this._outputServer = server;
                        _a = this;
                        return [4 /*yield*/, this._handler(process.execPath, [__dirname + '/../dist/nc.js', '127.0.0.1', port.toString()], {})];
                    case 2:
                        _a._outputTerminalPids = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VicesWonderfulWorldOfColor.prototype.end = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this._outputTerminalPids[1] > -1 && process.kill(this._outputTerminalPids[1], "SIGKILL");
                        this._outputTerminalPids[0] > -1 && process.kill(this._outputTerminalPids[0], "SIGKILL");
                        _a = this._outputServer;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, util.promisify(function (cb) { return _this._outputServer.close(cb); })()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        _a;
                        this._outputServer = null;
                        this._outputTerminalPids = [-1, -1];
                        return [2 /*return*/];
                }
            });
        });
    };
    return VicesWonderfulWorldOfColor;
}());
exports.VicesWonderfulWorldOfColor = VicesWonderfulWorldOfColor;
