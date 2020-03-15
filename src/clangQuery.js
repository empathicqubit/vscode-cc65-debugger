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
var dbgfile = require("./debugFile");
var util = require("util");
var child_process = require("child_process");
var path = require("path");
var _ = require("lodash");
var hotel = require("hasbin");
function getLocalTypes(dbgFile) {
    return __awaiter(this, void 0, void 0, function () {
        var clangExec, codeFiles, varrex, globres, structs, globs, globvarmatch, name_1, type, aliasOf, varres, varmatch, vars, _loop_1, recordres, recordrex, recordsplit, i, fields, recordname, fieldres, fieldrex, fieldmatch, name_2, type, aliasOf;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, util.promisify(function (i, cb) { return hotel.first(i, function (result) { return result ? cb(null, result) : cb(new Error('Missing'), null); }); })(['clang-query-10', 'clang-query-9', 'clang-query-8', 'clang-query-7', 'clang-query'])];
                case 1:
                    clangExec = _a.sent();
                    codeFiles = dbgFile.files.filter(function (x) { return /\.(c|h)$/gi.test(x.name); }).map(function (x) { return x.name; });
                    varrex = /VarDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<([^\n\r]+):([0-9]+):([0-9]+),\s+col:([0-9]+)\>\s+col:([0-9]+)\s+used\s+(\w+)\s+'([^']+)'(\s+cinit|:'([\w\s]+)')?$/gim;
                    return [4 /*yield*/, util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match varDecl(isExpansionInMainFile(), hasGlobalStorage())'].concat(codeFiles))];
                case 2:
                    globres = _a.sent();
                    structs = {};
                    globs = [];
                    while (globvarmatch = varrex.exec(globres.stdout)) {
                        name_1 = globvarmatch[9];
                        type = globvarmatch[10].replace('struct ', '');
                        aliasOf = (globvarmatch[12] || '').replace('struct ', '');
                        globs.push({
                            name: name_1,
                            aliasOf: aliasOf,
                            type: type
                        });
                    }
                    structs['__GLOBAL__()'] = globs;
                    return [4 /*yield*/, util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match varDecl(isExpansionInMainFile(), hasAncestor(functionDecl()))'].concat(codeFiles))];
                case 3:
                    varres = _a.sent();
                    varrex.lastIndex = 0;
                    vars = [];
                    _loop_1 = function () {
                        var lineNo = parseInt(varmatch[5]); // Numbered from 1, not 0
                        var filename = path.normalize(varmatch[4]);
                        var name_3 = varmatch[9];
                        var dist = [];
                        var possibleSyms = dbgFile.csyms.filter(function (x) { return x.sc == dbgfile.sc.auto && x.name == name_3; });
                        var sym = _.minBy(possibleSyms, function (sym) {
                            if (!sym.scope || !sym.scope.span || !sym.scope.span.lines.length) {
                                return Number.MAX_SAFE_INTEGER;
                            }
                            var lines = sym.scope.span.lines.filter(function (x) { return x.file && x.file.name == filename; });
                            if (!lines.length) {
                                return Number.MAX_SAFE_INTEGER;
                            }
                            else if (lineNo - 1 < lines[0].num) {
                                return lines[0].num - (lineNo - 1);
                            }
                            else if (lineNo - 1 > _.last(lines).num) {
                                return (lineNo - 1) - _.last(lines).num;
                            }
                            else
                                return 0;
                        });
                        if (!sym) {
                            return "continue";
                        }
                        var scope = sym.scope;
                        var type = varmatch[10].replace('struct ', '');
                        var aliasOf = (varmatch[12] || '').replace('struct ', '');
                        var varObj = {
                            name: name_3,
                            type: type,
                            aliasOf: aliasOf
                        };
                        var vars_1 = structs[scope.name + '()'] || [];
                        vars_1.push(varObj);
                        structs[scope.name + '()'] = vars_1;
                    };
                    while (varmatch = varrex.exec(varres.stdout)) {
                        _loop_1();
                    }
                    return [4 /*yield*/, util.promisify(child_process.execFile)(clangExec, ['-c=set output dump', '-c=match recordDecl(isExpansionInMainFile())'].concat(codeFiles))];
                case 4:
                    recordres = _a.sent();
                    recordrex = /(RecordDecl\s+(0x[0-9a-f]+)\s+(prev\s+(0x[0-9a-f]+)\s+)?\<([^\n\r]+):([0-9]+):([0-9]+),\s+line:([0-9]+):([0-9]+)\>\s+line:([0-9]+):([0-9+])\s+struct\s+(\w+\s+)?definition$)/gim;
                    recordsplit = recordres.stdout.split(recordrex);
                    for (i = 1; i < recordsplit.length; i += 13) {
                        fields = [];
                        recordname = (recordsplit[i + 11] || '').trim();
                        if (!recordname) {
                            continue; // FIXME We can't handle direct typedefs yet because they're complicated
                            // Must declare as bare struct, then typedef that
                        }
                        fieldres = recordsplit[i + 12];
                        fieldrex = /FieldDecl\s+(0x[0-9a-f]+)\s+\<line:([0-9]+):([0-9]+),\s+col:([0-9]+)\>\s+col:([0-9]+)\s+(referenced\s+)?(\w+)\s+'([^']+)'(:'([\w\s]+)')?$/gim;
                        fieldmatch = void 0;
                        while (fieldmatch = fieldrex.exec(fieldres)) {
                            name_2 = fieldmatch[7];
                            type = fieldmatch[8].replace('struct ', '');
                            aliasOf = (fieldmatch[10] || '').replace('struct ', '');
                            fields.push({
                                name: name_2,
                                type: type,
                                aliasOf: aliasOf
                            });
                        }
                        if (!fields.length) {
                            continue;
                        }
                        structs[recordname] = fields;
                    }
                    return [2 /*return*/, structs];
            }
        });
    });
}
exports.getLocalTypes = getLocalTypes;
;
function recurseFieldSize(fields, allTypes) {
    var dataSizes = [];
    for (var _i = 0, fields_1 = fields; _i < fields_1.length; _i++) {
        var field = fields_1[_i];
        var realType = field.aliasOf || field.type;
        if (realType.endsWith(' char')) {
            dataSizes.push(1);
        }
        else if (realType.endsWith(' int') || realType.endsWith('*')) {
            dataSizes.push(2);
        }
        else {
            var type = allTypes[realType];
            if (!type) {
                break; // We can't determine the rest of the fields if one is missing
            }
            dataSizes.push(_.sum(recurseFieldSize(type, allTypes)));
        }
    }
    return dataSizes;
}
exports.recurseFieldSize = recurseFieldSize;
