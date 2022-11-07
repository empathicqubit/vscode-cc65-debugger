import _sortBy from 'lodash/fp/sortBy';
import * as path from 'path';

export interface Version {
    major: number;
    minor: number;
}

export interface Scope {
    id: number;
    name: string;
    csyms: CSym[];
    autos: CSym[];
    size: number;
    spanIds: number[];
    spans: DebugSpan[];
    codeSpan: DebugSpan | undefined;
}

export enum sc {
    auto = 0,
    ext = 1,
}

export interface CSym {
    id: number;
    name: string;
    offs: number;
    scopeId: number;
    scope: Scope | undefined;
    sym: Sym | undefined;
    symId : number;
    sc: sc;
}

export interface Sym {
    id: number;
    name: string;
    addrsize: Addrsize;
    seg: Segment | undefined;
    segId: number;
    scope: Scope | undefined;
    scopeId: number;
    size: number;
    def: string;
    ref: number;
    val: number;
    type: string;
}

export enum Addrsize {
    relative = 0,
    absolute = 1
}

export enum Segtype {
    ro = 0,
    rw = 1,
}

export interface Segment {
    name: string;
    oname: string;
    id: number;
    start: number;
    size: number;
    ooffs: number;
    addrsize: Addrsize;
    type: Segtype;
}

export interface DebugSpan {
    seg: Segment | undefined;
    id: number;
    segId: number;
    /** This is the address relative to the segment */
    start: number;
    /** This is the address relative to the entire memory */
    absoluteAddress: number;
    size: number;
    type: number;
    lines: SourceLine[];
}

export interface Mod {
    id: number;
    name: string;
    file: File | undefined;
    fileId: number;
    libId: number;
    lib: Lib | undefined;
}

export interface Lib {
    id: number;
    name: string;
}

export interface SourceLine {
    file: SourceFile | undefined;
    span: DebugSpan | undefined;
    id: number;
    /** From zero, to match VSCode's indices */
    num: number;
    fileId: number;
    spanId: number;
    type: number;
    count: number;
}

export enum SourceFileType {
    Unknown,
    Assembly,
    C,
}

export interface SourceFile {
    mtime: Date;
    type: SourceFileType;
    mod: string;
    name: string;
    id: number;
    size: number;
    lines: SourceLine[];
}

export enum MachineType {
    unknown = 0x00,
    nes,
    c128,
    cbm5x0,
    pet,
    plus4,
    vic20,
    c64,
    apple2,
}

export interface Dbgfile {
    systemLib: Lib | undefined;
    systemLibBaseName: string | undefined;
    machineType: MachineType;
    mainScope: Scope | undefined;
    mainLab: Sym | undefined;
    libs: Lib[];
    mods: Mod[];
    csyms: CSym[];
    scopes: Scope[];
    files: SourceFile[];
    lines: SourceLine[];
    segs: Segment[];
    codeSeg: Segment | undefined;
    entryAddress: number;
    syms: Sym[];
    labs: Sym[];
    spans: DebugSpan[];
    version: Version;
}

export function parse(text: string, buildDir : string) : Dbgfile {
    const dbgFile : Dbgfile = {
        systemLib: undefined,
        systemLibBaseName: undefined,
        machineType: MachineType.unknown,
        entryAddress: 0,
        codeSeg: undefined,
        mainScope: undefined,
        mainLab: undefined,
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
        },
    };

    const props = "([a-zA-Z]+)\\s*=\\s*\"?([^\n\r,\"]*)\"?\\s*,?";
    let rex = new RegExp("^\\s*(csym|file|info|lib|line|mod|scope|seg|span|sym|type|version)\\s+((" + props + ")+)$", "gim");

    let match = rex.exec(text);

    do {
        if(!match || match.length < 3) {
            throw new Error("Debug file doesn't contain any object definitions");
        }

        const propVals = match[2];
        const propsRex = new RegExp(props, "gim");
        let propMatch = propsRex.exec(propVals);
        if(!propMatch) {
            throw new Error("File does not have any properties")
        }

        const ots = match[1];
        if(ots == "lib") {
            const lib : Lib = {
                id: 0,
                name: "",
            }

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id") {
                    lib.id = parseInt(val);
                }
                else if(key == "name") {
                    lib.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.libs.push(lib);
        }
        else if(ots == "mod") {
            const mod : Mod = {
                id: 0,
                file: undefined,
                fileId: -1,
                lib: undefined,
                libId: -1,
                name: "",
            }

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id") {
                    mod.id = parseInt(val);
                }
                else if(key == "name") {
                    mod.name = val;
                }
                else if(key == "file") {
                    mod.fileId = parseInt(val);
                }
                else if(key == "lib") {
                    mod.libId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.mods.push(mod);
        }
        else if(ots == "scope") {
            const scope : Scope = {
                id: 0,
                spans: [],
                csyms: [],
                autos: [],
                spanIds: [],
                codeSpan: undefined,
                size: 0,
                name: "",
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id" || key == "size") {
                    scope[key] = parseInt(val);
                }
                else if(key == "span") {
                    scope.spanIds = val.split(/\+/g).map(x => parseInt(x));
                }
                else if(key == 'name') {
                    scope.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.scopes.push(scope);
        }
        else if(ots == "csym") {
            const csym : CSym = {
                id: 0,
                scopeId: -1,
                sc: sc.auto,
                scope: undefined,
                sym: undefined,
                symId: -1,
                offs: 0,
                name: "",
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id" || key == "size" || key == "offs") {
                    csym[key] = parseInt(val);
                }
                else if(key == 'sc') {
                    csym.sc = sc[val];
                }
                else if(key == "scope") {
                    csym.scopeId = parseInt(val);
                }
                else if(key == 'name') {
                    csym.name = val;
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.csyms.push(csym);
        }
        else if (ots == "sym") {
            const sym : Sym = {
                addrsize: Addrsize.absolute,
                size: 0,
                name: "",
                seg: undefined,
                segId: -1,
                scope: undefined,
                scopeId: -1,
                id: 0,
                def: "",
                ref: 0,
                val: 0,
                type: "",
            }

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == 'addrsize') {
                    sym.addrsize = Addrsize[val];
                }
                else if(key == 'id' || key == 'val' || key == 'ref' || key == 'size') {
                    sym[key] = parseInt(val);
                }
                else if(key == 'name' || key == 'type') {
                    sym[key] = val
                }
                else if(key == 'scope') {
                    sym.scopeId = parseInt(val);
                }
                else if(key == 'seg') {
                    sym.segId = parseInt(val);
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.syms.push(sym);
            if(sym.type == "lab") {
                dbgFile.labs.push(sym);
            }
        }
        else if (ots == "file") {
            const fil : SourceFile = {
                mtime: new Date(),
                name: "",
                mod: "",
                lines: [],
                id: 0,
                size: 0,
                type: SourceFileType.C,
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "size" || key == "id") {
                    fil[key] = parseInt(val);
                }
                else if (key == "mtime") {
                    fil.mtime = new Date(val);
                }
                else if (key == "name") {
                    if(!path.isAbsolute(val)) {
                        fil.name = path.normalize(path.join(buildDir, val));
                    }
                    else {
                        fil.name = path.normalize(val);
                    }

                    if(/\.(s|asm|inc|a65|mac)$/gi.test(fil.name)) {
                        fil.type = SourceFileType.Assembly;
                    }
                    else {
                        fil.type = SourceFileType.C;
                    }
                }
                else if (key == "mod") {
                    fil.mod = val;
                }
            } while (propMatch = propsRex.exec(propVals));

            dbgFile.files.push(fil);
        }
        else if (ots == "seg") {
            const seg : Segment = {
                addrsize: Addrsize.relative,
                id: 0,
                name: "",
                oname: "",
                ooffs: 0,
                size: 0,
                start: 0,
                type: 0,
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id" || key == "ooffs" || key == "start" || key == "size") {
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
            } while(propMatch = propsRex.exec(propVals));

            dbgFile.segs.push(seg);

            if(seg.name == "CODE") {
                dbgFile.codeSeg = seg;
            }
        }
        else if(ots == "span") {
            const span : DebugSpan = {
                id: 0,
                start: 0,
                size: 0,
                seg: undefined,
                type: 0,
                segId: -1,
                lines: [],
                absoluteAddress: 0x80D,
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id" || key == "size" || key == "start" || key == "type") {
                    span[key] = parseInt(val);
                }
                else if(key == "seg") {
                    span.segId = parseInt(val);
                }
            } while(propMatch = propsRex.exec(propVals));

            dbgFile.spans.push(span);
        }
        else if(ots == "line") {
            const line : SourceLine = {
                count: 0,
                id: 0,
                num: 0,
                span: undefined,
                spanId: -1,
                file: undefined,
                fileId: -1,
                type: 0,
            };

            do {
                const key = propMatch[1];
                const val = propMatch[2];

                if(key == "id" || key == "count") {
                    line[key] = parseInt(val);
                }
                else if (key == "line") {
                    line.num = parseInt(val) - 1;
                }
                else if (key == "span") {
                    line.spanId = parseInt(val);
                }
                else if (key == "file") {
                    line.fileId = parseInt(val);
                }
            } while(propMatch = propsRex.exec(propVals));

            dbgFile.lines.push(line);
        }
        else {
            continue;
        }
    } while(match = rex.exec(text))

    const files = `(apple2enh\\.lib|apple2\\.lib|atari2600\\.lib|atari5200\\.lib|atari\\.lib|atarixl\\.lib|atmos\\.lib|c128\\.lib|c16\\.lib|c64\\.lib|cbm510\\.lib|cbm610\\.lib|creativision\\.lib|gamate\\.lib|geos-apple\\.lib|geos-cbm\\.lib|lynx\\.lib|nes\\.lib|none\\.lib|osic1p\\.lib|pce\\.lib|pet\\.lib|plus4\\.lib|sim6502\\.lib|sim65c02\\.lib|supervision\\.lib|telestrat\\.lib|vic20\\.lib)`;
    const sep = `[/${path.sep.replace('\\', '\\\\')}]`;
    const lib = dbgFile.libs.find(x => new RegExp(`lib${sep}${files}$`, 'gi').test(x.name));
    if(lib) {
        const libPath = lib.name;
        dbgFile.systemLib = lib;
        dbgFile.systemLibBaseName = path.basename(libPath).replace(/\.lib$/gi, '');

        const ln = dbgFile.systemLibBaseName;
        if(ln == 'nes') {
            dbgFile.machineType = MachineType.nes;
        }
        else if(ln == 'c128') {
            dbgFile.machineType = MachineType.c128;
        }
        else if(ln == 'cbm510') {
            dbgFile.machineType = MachineType.cbm5x0;
        }
        else if(ln == 'pet') {
            dbgFile.machineType = MachineType.pet;
        }
        else if(ln == 'plus4') {
            dbgFile.machineType = MachineType.plus4;
        }
        else if(ln == 'vic20') {
            dbgFile.machineType = MachineType.vic20;
        }
        else if(ln == 'apple2') {
            dbgFile.machineType = MachineType.apple2;
        }
        else {
            dbgFile.machineType = MachineType.c64;
        }
    }

    for(const mod of dbgFile.mods) {
        if(mod.libId == -1) {
            continue;
        }
        for(const lib of dbgFile.libs) {
            if(lib.id == mod.libId) {
                mod.lib = lib;
                break;
            }
        }
    }

    for(const span of dbgFile.spans) {
        if(span.segId == -1) {
            continue;
        }

        for(const seg of dbgFile.segs) {
            if(seg.id == span.segId) {
                span.seg = seg
                break
            }
        }

        if(span.seg) {
            span.absoluteAddress = span.seg.start + span.start
        }
    }

    for(const csym of dbgFile.csyms) {
        if(csym.scopeId == -1) {
            continue;
        }

        for(const scope of dbgFile.scopes) {
            if(scope.id == csym.scopeId) {
                csym.scope = scope;
                scope.csyms.push(csym);
                if(csym.sc == sc.auto) {
                    scope.autos.push(csym);
                }
                break;
            }
        }
    }

    for(const scope of dbgFile.scopes) {
        scope.csyms.sort((a, b) => a.offs - b.offs);
        scope.autos.sort((a, b) => a.offs - b.offs);
        if(!scope.spanIds.length) {
            continue;
        }

        for(const span of dbgFile.spans) {
            if(scope.spanIds.includes(span.id)) {
                scope.spans.push(span);
                if(span.seg == dbgFile.codeSeg) {
                    scope.codeSpan = span;
                }

                if(scope.spans.length == scope.spanIds.length) {
                    break;
                }
            }
        }
    }


    for(const line of dbgFile.lines) {
        if(line.fileId != -1) {
            for(const file of dbgFile.files) {
                if(line.fileId == file.id) {
                    line.file = file;
                    file.lines.push(line)
                    break
                }
            }
        }

        if(line.spanId != -1) {
            for(const span of dbgFile.spans) {
                if (span.id == line.spanId) {
                    line.span = span
                    span.lines.push(line)
                    break
                }
            }
        }

        if(line.span) {
            for(const span of dbgFile.spans) {
                if(span.absoluteAddress <= line.span.absoluteAddress && line.span.absoluteAddress < span.absoluteAddress + span.size) {
                    span.lines.push(line);
                }
            }
        }
    }

    for(const file of dbgFile.files) {
        // Prefer C files if they exist.
        file.lines = _sortBy([x => x.file && x.file.type != SourceFileType.C, x => x.num], file.lines);
    }

    for(const span of dbgFile.spans) {
        // Prefer C files if they exist.
        span.lines = _sortBy([x => x.file && x.file.type != SourceFileType.C, x => x.num], span.lines);
    }

    for(const sym of dbgFile.syms) {
        if(sym.segId != -1) {
            for(const seg of dbgFile.segs) {
                if(seg.id == sym.segId) {
                    sym.seg = seg;
                    break;
                }
            }
        }

        if(sym.scopeId != -1) {
            for(const scope of dbgFile.scopes) {
                if(scope.id == sym.scopeId) {
                    sym.scope = scope;
                    break;
                }
            }
        }
    }

    dbgFile.files = _sortBy([x => x.type != SourceFileType.C ], dbgFile.files);
    dbgFile.scopes = _sortBy([x => x.codeSpan, x => x.codeSpan && -x.codeSpan.absoluteAddress, x => x.codeSpan && x.codeSpan.size, x => -x.autos.length], dbgFile.scopes);
    dbgFile.lines = _sortBy([x => x.span, x => x.span && -x.span.absoluteAddress], dbgFile.lines);

    dbgFile.spans = _sortBy([x => -x.absoluteAddress, x => x.size], dbgFile.spans);

    const segSort = (a, b) => b.segId - a.segId;
    dbgFile.syms.sort(segSort)
    dbgFile.labs.sort(segSort);

    dbgFile.mainLab = dbgFile.labs.find(x => x.name == "_main") || undefined;
    dbgFile.mainScope = dbgFile.scopes.find(x => x.name == "_main") || undefined;

    if(dbgFile.mainLab) {
        dbgFile.entryAddress = dbgFile.mainLab.val;
    }
    else if(dbgFile.codeSeg) {
        dbgFile.entryAddress = dbgFile.codeSeg.start;
    }

    return dbgFile;
}
