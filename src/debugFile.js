"use strict";
exports.__esModule = true;
var path = require("path");
var sc;
(function (sc) {
    sc[sc["auto"] = 0] = "auto";
    sc[sc["ext"] = 1] = "ext";
})(sc = exports.sc || (exports.sc = {}));
var Addrsize;
(function (Addrsize) {
    Addrsize[Addrsize["relative"] = 0] = "relative";
    Addrsize[Addrsize["absolute"] = 1] = "absolute";
})(Addrsize = exports.Addrsize || (exports.Addrsize = {}));
var Segtype;
(function (Segtype) {
    Segtype[Segtype["ro"] = 0] = "ro";
    Segtype[Segtype["rw"] = 1] = "rw";
})(Segtype = exports.Segtype || (exports.Segtype = {}));
function parse(text, buildDir) {
    var dbgFile = {
        libs: [],
        mods: [],
        scopes: [],
        csyms: [],
        syms: [],
        labs: [],
        segs: [],
        spans: [],
        lines: [],
        files: [],
        version: {
            major: -1,
            minor: -1
        }
    };
    var props = "([a-zA-Z]+)\\s*=\\s*\"?([^\n\r,\"]+)\"?\\s*,?";
    var rex = new RegExp("^\\s*(csym|file|info|lib|line|mod|scope|seg|span|sym|type|version)\\s+((" + props + ")+)$", "gim");
    var match = rex.exec(text);
    do {
        if (!match || match.length < 3) {
            throw new Error("Debug file doesn't contain any object definitions");
        }
        var propVals = match[2];
        var propsRex = new RegExp(props, "gim");
        var propMatch = propsRex.exec(propVals);
        if (!propMatch) {
            throw new Error("File does not have any properties");
        }
        var ots = match[1];
        if (ots == "lib") {
            var lib = {
                id: 0,
                name: ""
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id") {
                    lib.id = parseInt(val);
                }
                else if (key == "name") {
                    lib.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.libs.push(lib);
        }
        else if (ots == "mod") {
            var mod = {
                id: 0,
                file: null,
                fileId: -1,
                lib: null,
                libId: -1,
                name: ""
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id") {
                    mod.id = parseInt(val);
                }
                else if (key == "name") {
                    mod.name = val;
                }
                else if (key == "file") {
                    mod.fileId = parseInt(val);
                }
                else if (key == "lib") {
                    mod.libId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.mods.push(mod);
        }
        else if (ots == "scope") {
            var scope = {
                id: 0,
                span: null,
                csyms: [],
                spanId: -1,
                size: 0,
                name: ""
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id" || key == "size") {
                    scope[key] = parseInt(val);
                }
                else if (key == "span") {
                    scope.spanId = parseInt(val);
                }
                else if (key == 'name') {
                    scope.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.scopes.push(scope);
        }
        else if (ots == "csym") {
            var csym = {
                id: 0,
                scopeId: -1,
                sc: sc.auto,
                scope: null,
                sym: null,
                symId: -1,
                offs: 0,
                name: ""
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id" || key == "size" || key == "offs") {
                    csym[key] = parseInt(val);
                }
                else if (key == "scope") {
                    csym.scopeId = parseInt(val);
                }
                else if (key == 'name') {
                    csym.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.csyms.push(csym);
        }
        else if (ots == "sym") {
            var sym = {
                addrsize: Addrsize.absolute,
                size: 0,
                name: "",
                seg: null,
                segId: -1,
                id: 0,
                def: "",
                ref: 0,
                val: 0,
                type: ""
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == 'addrsize') {
                    sym.addrsize = Addrsize[key];
                }
                else if (key == 'id' || key == 'val' || key == 'ref' || key == 'size') {
                    sym[key] = parseInt(val);
                }
                else if (key == 'name' || key == 'type') {
                    sym[key] = val;
                }
                else if (key == 'seg') {
                    sym.segId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.syms.push(sym);
            if (sym.type == "lab") {
                dbgFile.labs.push(sym);
            }
        }
        else if (ots == "file") {
            var fil = {
                mtime: new Date(),
                name: "",
                mod: "",
                lines: [],
                id: 0,
                size: 0
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "size" || key == "id") {
                    fil[key] = parseInt(val);
                }
                else if (key == "mtime") {
                    fil.mtime = new Date(val);
                }
                else if (key == "name") {
                    if (!path.isAbsolute(val)) {
                        fil.name = path.normalize(path.join(buildDir, val));
                    }
                    else {
                        fil.name = val;
                    }
                }
                else if (key == "mod") {
                    fil.mod = val;
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.files.push(fil);
        }
        else if (ots == "seg") {
            var seg = {
                addrsize: Addrsize.relative,
                id: 0,
                name: "",
                oname: "",
                ooffs: 0,
                size: 0,
                start: 0,
                type: 0
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id" || key == "ooffs" || key == "start" || key == "size") {
                    seg[key] = parseInt(val);
                }
                else if (key == "addrsize") {
                    seg.addrsize = Addrsize[val];
                }
                else if (key == "name" || key == "oname") {
                    seg[key] = val;
                }
                else if (key == "type") {
                    seg.type = Segtype[key];
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.segs.push(seg);
        }
        else if (ots == "span") {
            var span = {
                id: 0,
                start: 0,
                size: 0,
                seg: null,
                type: 0,
                segId: -1,
                lines: [],
                absoluteAddress: 0x80D
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id" || key == "size" || key == "start" || key == "type") {
                    span[key] = parseInt(val);
                }
                else if (key == "seg") {
                    span.segId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.spans.push(span);
        }
        else if (ots == "line") {
            var line = {
                count: 0,
                id: 0,
                num: 0,
                span: null,
                spanId: -1,
                file: null,
                fileId: -1,
                type: 0
            };
            do {
                var key = propMatch[1];
                var val = propMatch[2];
                if (key == "id" || key == "count") {
                    line[key] = parseInt(val);
                }
                else if (key == "line") {
                    // VSCode wants zero indexed lines so might as well fix it now.
                    line.num = parseInt(val) - 1;
                }
                else if (key == "span") {
                    line.spanId = parseInt(val);
                }
                else if (key == "file") {
                    line.fileId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));
            dbgFile.lines.push(line);
        }
        else {
            continue;
        }
    } while (match = rex.exec(text));
    for (var _i = 0, _a = dbgFile.mods; _i < _a.length; _i++) {
        var mod = _a[_i];
        if (mod.libId == -1) {
            continue;
        }
        for (var _b = 0, _c = dbgFile.libs; _b < _c.length; _b++) {
            var lib = _c[_b];
            if (lib.id == mod.libId) {
                mod.lib = lib;
                break;
            }
        }
    }
    for (var _d = 0, _e = dbgFile.spans; _d < _e.length; _d++) {
        var span = _e[_d];
        if (span.segId == -1) {
            continue;
        }
        for (var _f = 0, _g = dbgFile.segs; _f < _g.length; _f++) {
            var seg = _g[_f];
            if (seg.id == span.segId) {
                span.seg = seg;
                break;
            }
        }
        if (span.seg) {
            span.absoluteAddress = span.seg.start + span.start;
        }
    }
    for (var _h = 0, _j = dbgFile.csyms; _h < _j.length; _h++) {
        var csym = _j[_h];
        if (csym.scopeId == -1) {
            continue;
        }
        for (var _k = 0, _l = dbgFile.scopes; _k < _l.length; _k++) {
            var scope = _l[_k];
            if (scope.id == csym.scopeId) {
                csym.scope = scope;
                scope.csyms.push(csym);
                break;
            }
        }
    }
    for (var _m = 0, _o = dbgFile.scopes; _m < _o.length; _m++) {
        var scope = _o[_m];
        scope.csyms.sort(function (a, b) { return a.offs - b.offs; });
        if (scope.spanId == -1) {
            continue;
        }
        for (var _p = 0, _q = dbgFile.spans; _p < _q.length; _p++) {
            var span = _q[_p];
            if (span.id == scope.spanId) {
                scope.span = span;
                break;
            }
        }
    }
    for (var _r = 0, _s = dbgFile.lines; _r < _s.length; _r++) {
        var line = _s[_r];
        if (line.fileId != -1) {
            for (var _t = 0, _u = dbgFile.files; _t < _u.length; _t++) {
                var file = _u[_t];
                if (line.fileId == file.id) {
                    line.file = file;
                    file.lines.push(line);
                    break;
                }
            }
        }
        if (line.spanId != -1) {
            for (var _v = 0, _w = dbgFile.spans; _v < _w.length; _v++) {
                var span = _w[_v];
                if (span.id == line.spanId) {
                    line.span = span;
                    span.lines.push(line);
                    break;
                }
            }
        }
        if (line.span) {
            for (var _x = 0, _y = dbgFile.spans; _x < _y.length; _x++) {
                var span = _y[_x];
                if (span.absoluteAddress <= line.span.absoluteAddress && line.span.absoluteAddress < span.absoluteAddress + span.size) {
                    span.lines.push(line);
                }
            }
        }
    }
    for (var _z = 0, _0 = dbgFile.files; _z < _0.length; _z++) {
        var file = _0[_z];
        file.lines.sort(function (a, b) { return a.num - b.num; });
    }
    for (var _1 = 0, _2 = dbgFile.spans; _1 < _2.length; _1++) {
        var span = _2[_1];
        span.lines.sort(function (a, b) { return a.num - b.num; });
    }
    for (var _3 = 0, _4 = dbgFile.syms; _3 < _4.length; _3++) {
        var sym = _4[_3];
        if (sym.segId == -1) {
            continue;
        }
        for (var _5 = 0, _6 = dbgFile.segs; _5 < _6.length; _5++) {
            var seg = _6[_5];
            if (seg.id == sym.segId) {
                sym.seg = seg;
                break;
            }
        }
    }
    var spanSort = function (a, b) { return (b.span && b.span.absoluteAddress) - (a.span && a.span.absoluteAddress); };
    dbgFile.scopes.sort(spanSort);
    dbgFile.lines.sort(spanSort);
    dbgFile.spans.sort(function (a, b) { return b.absoluteAddress - a.absoluteAddress; });
    var segSort = function (a, b) { return b.segId - a.segId; };
    dbgFile.syms.sort(segSort);
    dbgFile.labs.sort(segSort);
    return dbgFile;
}
exports.parse = parse;
