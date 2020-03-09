import * as fs from 'fs';
import * as _ from 'lodash';
import * as readdir from 'recursive-readdir';
import * as child_process from 'child_process'
import { EventEmitter } from 'events';
import * as path from 'path';
import * as clangQuery from './clangQuery';
import * as util from 'util';
import * as debugUtils from './debugUtils';
import * as dbgfile from './debugFile'
import watch from 'node-watch';
import { ViceGrip } from './viceGrip';
import { CC65ViceDebugSession } from './cc65ViceDebug';
import { VicesWonderfulWorldOfColor } from './vicesWonderfulWorldOfColor';
import * as mapFile from './mapFile';

export interface CC65ViceBreakpoint {
    id: number;
    line: dbgfile.SourceLine;
    viceIndex: number;
    verified: boolean;
}

export interface VariableData {
    name : string;
    value: string;
    addr: number;
    type: string;
}

export interface Registers {
    a: number;
    x: number;
    y: number;
    sp: number;
    "00": number;
    "01": number;
    nvbdizc: number;
}

/**
 * A CC65Vice runtime with minimal debugger functionality.
 */
export class CC65ViceRuntime extends EventEmitter {
    private _dbgFile: dbgfile.Dbgfile;

    private _currentAddress: number;

    private _paramStackBottom: number = -1;
    private _paramStackTop: number = -1;
    private _paramStackPointer: number = -1;

    private _cpuStackBottom: number = 0x1ff;
    private _cpuStackTop: number = 0x1ff;

    private _memoryData : Buffer = Buffer.alloc(0xffff);

    private _codeSegAddress: number = -1;
    private _codeSegLength: number = -1;
    // Monitors the code segment after initialization so that it doesn't accidentally get modified.
    private _codeSegGuardIndex: number = -1;

    private _entryAddress: number = -1;

    private _breakPoints : CC65ViceBreakpoint[] = [];

    private _stackFrameStarts : { [address: string]: dbgfile.Scope } = {};
    private _stackFrameEnds : { [address: string]: dbgfile.Scope } = {};

    private _stackFrames : {line: dbgfile.SourceLine, scope: dbgfile.Scope}[];

    private _registers : Registers;

    // since we want to send breakpoint events, we will assign an id to every event
    // so that the frontend can match events with breakpoints.
    private _breakpointId = 1;

    private _viceRunning : boolean = false;
    private _vice : ViceGrip;

    private _currentPosition: dbgfile.SourceLine;
    private _session: CC65ViceDebugSession;
    private _consoleType?: string;
    private _colorTerm: VicesWonderfulWorldOfColor;
    private _mapFile: mapFile.MapRef[];
    private _localTypes: { [typename: string]: clangQuery.ClangTypeInfo[]; } | undefined;

    constructor(sesh: CC65ViceDebugSession) {
        super();
        this._session = sesh;
    }

    /**
    * Executes a monitor command in VICE.
    * @param cmd The command to send to VICE
    */
    public async exec(cmd: string) : Promise<string | Buffer> {
        return await this._vice.exec(cmd);
    }

    /**
    * Build the program using the command specified and try to find the output file with monitoring.
    * @returns The possible output files of types d81, prg, and d64.
    */
    public async build(workspaceDir: string, cmd: string) : Promise<string[]> {
        const builder = new Promise((res, rej) => {
            const process = child_process.spawn(cmd, {
                shell: true,
                cwd: workspaceDir,
            })

            process.stdout.on('data', (d) => {
                this.sendEvent('output', 'stdout', d.toString());
            });

            process.stderr.on('data', (d) => {
                this.sendEvent('output', 'stderr', d.toString());
            });

            process.on('close', (code) => {
                if(code) {
                    rej(code);
                }

                res(code);
            })
        });

        let filenames : string[] = [];
        const watcher = watch(workspaceDir, {
            recursive: true,
            filter: f => debugUtils.programFiletypes.test(f),
        }, (evt, filename) => {
            filenames.push(filename);
        });

        await builder;

        watcher.close();
        if(filenames.length) {
            return filenames;
        }

        filenames = await readdir(workspaceDir)

        filenames = filenames.filter(x => debugUtils.programFiletypes.test(x))

        const files = await Promise.all(filenames.map(async filename => {
            const fileStats = await util.promisify(fs.stat)(filename);
            let listingLength : number = 0;
            const ext = path.extname(filename).toLowerCase();
            if (/^\.d[0-9]{2}$/.test(ext)) {
                try {
                    const res = await util.promisify(child_process.execFile)('c1541', ['-attach', filename, '-list'])
                    listingLength = (res.stdout.match(/[\r\n]+/g) || '').length
                }
                catch {}
            }

            return {
                fileStats,
                filename,
                listingLength,
            };
        }));

        filenames = _(files)
            .orderBy([x => x.fileStats.mtime, x => x.listingLength], ['desc', 'desc'])
            .map(x => x.filename)
            .value();

        return filenames;
    }

    /**
    * Start executing the given program.
    */
    public async start(program: string, buildCwd: string, stopOnEntry: boolean, vicePath?: string, viceArgs?: string[], consoleType?: string) {
        this._consoleType = consoleType;
        console.time('loadSource')

        if(!debugUtils.programFiletypes.test(program)) {
            throw new Error("File must be a Commodore Disk image or PRoGram.");
        }

        await this._loadSource(program, buildCwd);
        await this._loadMapFile(program);
        await this._getLocalTypes();

        console.timeEnd('loadSource')

        console.time('preVice');

        const startSym = this._dbgFile.labs.find(x => x.name == "_main");

        if(startSym != null) {
            this._entryAddress = startSym.val
        }

        this._resetRegisters();
        this._setParamStackPointer();

        console.timeEnd('preVice');

        console.time('vice');

        this._otherHandlers = new EventEmitter();

        this._vice = new ViceGrip(program, this._entryAddress, path.dirname(program), <debugUtils.ExecHandler>((file, args, opts) => this._processExecHandler(file, args, opts)), vicePath, viceArgs, this._otherHandlers);

        await this._vice.start();

        this._vice.on('end', () => this.terminate());

        this._setupViceDataHandler();
        await this.continue();
        this._viceRunning = false;
        await this._vice.wait();

        console.timeEnd('vice')

        console.time('postVice')

        await this._initCodeSeg();
        await this._setLabels();
        await this._resetStackFrames();
        await this._setParamStackBottom();

        await this._verifyBreakpoints();

        if (stopOnEntry) {
            // We don't do anything here since VICE should already be in the
            // correct position after the startup routine.
            this.sendEvent('stopOnEntry', 'console');
        } else {
            // we just start to run until we hit a breakpoint or an exception
            await this.continue();
        }

        this._colorTerm = new VicesWonderfulWorldOfColor(this._vice, this._otherHandlers, (f, a, o) => this._processExecHandler(f, a, o))
        this._colorTerm.main();

        console.timeEnd('postVice')
    }

    private async _initCodeSeg() : Promise<void> {
        const codeSeg = this._dbgFile.segs.find(x => x.name == "CODE");

        if(!codeSeg) {
            return;
        }

        this._codeSegAddress = codeSeg.start;
        this._codeSegLength = codeSeg.size;

        const res = <string>await this._vice.exec(`bk store \$${this._codeSegAddress.toString(16)} \$${(this._codeSegAddress + this._codeSegLength - 1).toString(16)}`);
        this._codeSegGuardIndex = this._getBreakpointNum(res);
    }

    private async _loadMapFile(program: string) : Promise<void> {
        const text = await util.promisify(fs.readFile)(program.replace(debugUtils.programFiletypes, '.map'), 'utf8');
        this._mapFile = mapFile.parse(text);
    }

    public async getTypeFields(addr: number, typename: string) : Promise<VariableData[]> {
        const typeParts = typename.split(/\s+/g);

        let isPointer = typeParts.length > 1 && _.last(typeParts) == '*';

        if(isPointer) {
            const pointerVal = await this.getMemory(addr, 2);
            addr = pointerVal.readUInt16LE(0);
        }

        if(!this._localTypes) {
            return [];
        }

        const fields = this._localTypes[typeParts[0]];
        const vars : VariableData[] = [];

        const fieldSizes = clangQuery.recurseFieldSize(fields, this._localTypes);

        const totalSize = _.sum(fieldSizes);

        const mem = await this.getMemory(addr, totalSize);

        let currentPosition = 0;
        for(const f in fieldSizes) {
            const fieldSize = fieldSizes[f];
            const field = fields[f];

            let typename = field.type;
            if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                typename = '';
            }

            let value = '';
            if(fieldSize == 1) {
                if(field.type.startsWith('signed')) {0
                    value = (<any>mem.readInt8(currentPosition).toString(16)).padStart(2, '0');
                }
                else {
                    value = (<any>mem.readUInt8(currentPosition).toString(16)).padStart(2, '0');
                }
            }
            else if(fieldSize == 2) {
                if(field.type.startsWith('signed')) {
                    value = (<any>mem.readInt16LE(currentPosition).toString(16)).padStart(4, '0');
                }
                else {
                    value = (<any>mem.readUInt16LE(currentPosition).toString(16)).padStart(4, '0');
                }
            }
            else {
                value = (<any>mem.readUInt16LE(currentPosition).toString(16)).padStart(4, '0');
            }

            vars.push({
                type: typename,
                name: field.name,
                value: "0x" + value,
                addr: addr + currentPosition,
            });

            currentPosition += fieldSize;
        }

        return vars;
    }

    public async monitorToConsole() {
        this._vice.on('data', (d) => {
            this.sendEvent('output', 'console', d.toString());
        });
    }

    public async continue(reverse = false) {
        this._viceRunning = true;
        await this._vice.exec('x');
    }

    public async step(reverse = false, event = 'stopOnStep') {
        // Find the next source line and continue to it.
        const currentFile = this._currentPosition.file;
        const currentIdx = currentFile!.lines.indexOf(this._currentPosition);
        const span = this._currentPosition.span;
        let currentFunction : dbgfile.Scope | undefined;
        if(span) {
            currentFunction = this._dbgFile.scopes
                .find(x => x.span && x.span.absoluteAddress <= span.absoluteAddress
                    && span.absoluteAddress < x.span.absoluteAddress + x.span.size)
        }

        let nextLine = currentFile!.lines[currentIdx + 1];
        if(!nextLine) {
            await this._vice.exec('z');
        }
        else {
            const nextAddress = nextLine.span!.absoluteAddress;
            if(currentFunction) {
                const functionLines = currentFunction.span!.lines.filter(x => x.file == currentFile);
                const currentIdx = functionLines.findIndex(x => x.num == nextLine.num);
                const remainingLines = functionLines.slice(currentIdx);
                const setBrks = remainingLines.map(x => `bk \$${x.span!.absoluteAddress.toString(16)}`).join(' ; ');
                const brks = <string>await this._vice.exec(setBrks);
                const brknums = this._getBreakpointMatches(brks);

                await this._vice.exec(`x`);

                const delBrks = brknums.map(x => `del ${x[0]}`).join(' ; ');

                await this._vice.exec(delBrks);
            }
            else {
                this._viceRunning = true;
                await this._vice.exec(`un \$${nextAddress.toString(16)}`);
            }
        }
        this.sendEvent(event, 'console')
    }

    public async stepIn() {
        const thisSpan = this._currentPosition.span!;
        const thisSegAddress = thisSpan.absoluteAddress - 1;
        const endCodeSeg = (this._codeSegAddress + this._codeSegLength).toString(16);

        const brk = <string>await this._vice.exec(`watch exec \$${this._codeSegAddress.toString(16)} \$${thisSegAddress.toString(16)}`);
        const brk2 = <string>await this._vice.exec(`watch exec \$${(thisSegAddress + thisSpan.size).toString(16)} \$${endCodeSeg}`);

        const brknum = this._getBreakpointNum(brk);
        const brknum2 = this._getBreakpointNum(brk2);

        await this._vice.exec(`x`);

        await this._vice.exec(`del ${brknum}`);
        await this._vice.exec(`del ${brknum2}`);
        this.sendEvent('stopOnStep', 'console')
    }

    public async stepOut(event = 'stopOnStep') {
        const lastFrame = this._stackFrames[this._stackFrames.length - 2];
        if(!lastFrame) {
            this.sendEvent('output', 'console', 'Can\'t step out here!')
            return;
        }

        const begin = lastFrame.scope.span!.absoluteAddress;
        const end = lastFrame.scope.span!.absoluteAddress + lastFrame.scope.span!.size - 1;

        const allbrk = <string>await this._vice.exec(`bk`);
        const allbrkmatch = this._getBreakpointMatches(allbrk);
        await this._vice.multiExec(allbrkmatch.map(x => `dis ${x[0]}`));

        const brk = <string>await this._vice.exec(`watch exec \$${begin.toString(16)} \$${end.toString(16)}`);
        const brknum = this._getBreakpointNum(brk);

        await this._vice.exec(`x`);

        await this._vice.exec(`del ${brknum}`);

        await this._vice.multiExec(allbrkmatch.map(x => `en ${x[0]}`));

        this.sendEvent(event, 'console')
    }

    public async pause() {
        await this._vice.exec('r');
        this.sendEvent('stopOnStep', 'console')
    }

    public async stack(startFrame: number, endFrame: number): Promise<any> {
        await this._setCpuStack();

        const frames = new Array<any>();
        let i = startFrame;

        frames.push({
            index: i,
            name: '0x' + this._currentAddress.toString(16),
            file: this._currentPosition.file!.name,
            line: this._currentPosition.num
        });
        i++;

        for(const frame of [...this._stackFrames].reverse()) {
            frames.push({
                index: i,
                name: frame.scope.name.replace(/^_/g, ''),
                file: frame.line.file!.name,
                line: frame.line.num,
            });
            i++;
        }

        return {
            frames: frames,
            count: frames.length,
        };
    }

    // Clean up all the things
    public async terminate() : Promise<void> {
        this._colorTerm && await this._colorTerm.end();
        this._colorTerm = <any>null;
        this._vice && await this._vice.end();
        this._vice = <any>null;
        this._viceRunning = false;
        this._dbgFile = <any>null;
        this._mapFile = <any>null;
    }

    // Breakpoints

    private async _verifyBreakpoints() : Promise<void> {
        if(!this._dbgFile || !this._vice) {
            return;
        }

        const wasRunning = this._viceRunning;

        let cmds : string[] = [];
        for(const bp of this._breakPoints) {
            const sourceFile = this._dbgFile.files.find(x => x.lines.find(x => x.num == bp.line.num) && x.name == bp.line.file!.name);
            if (sourceFile && !bp.verified && bp.line.num <= sourceFile.lines[sourceFile.lines.length - 1].num) {
                const srcLine = sourceFile.lines.find(x => x.num >= bp.line.num) || sourceFile.lines[sourceFile.lines.length / 2];

                bp.line = srcLine;

                cmds.push(`bk ${srcLine.span!.absoluteAddress.toString(16)}`);
            }
        }

        const res = await this._vice.multiExec(cmds);

        const bpMatches = this._getBreakpointMatches(res);
        cmds = [];
        for(const bpMatch of bpMatches) {
            const idx = bpMatch[0];
            const addr = bpMatch[1];

            const bp = this._breakPoints.find(x => !x.verified && x.line.span && x.line.span.absoluteAddress == addr)
            if(!bp) {
                continue;
            }

            bp.viceIndex = idx;
            bp.verified = true;
            this.sendEvent('breakpointValidated', bp);

            cmds.push(`cond ${idx} if $574c == $574c`);
        }

        await this._vice.multiExec(cmds);

        if(wasRunning) {
            await this.continue();
        }
    }


    private async _clearBreakPoint(bp: CC65ViceBreakpoint) : Promise<CC65ViceBreakpoint | undefined> {
        const index = this._breakPoints.indexOf(bp);
        this._breakPoints.splice(index, 1);

        await this._vice.exec(`del ${bp.viceIndex}`);

        // Also clean up breakpoints with the same address.
        const bks = this._getBreakpointMatches(<string>await this._vice.exec(`bk`));
        for(const bk of bks) {
            const addr = bk[1];
            const idx = bk[0];
            if(addr == bp.line.span!.absoluteAddress) {
                await this._vice.exec(`del ${idx.toString()}`)
            }
        }

        return bp;
    }

    public getBreakpoints(path: string, line: number): number[] {
        return [];
    }

    public async setBreakPoint(path: string, line: number) : Promise<CC65ViceBreakpoint | null> {
        let lineSym : dbgfile.SourceLine | undefined;
        if(this._dbgFile) {
            lineSym = this._dbgFile.lines.find(x => x.num == line && path.includes(x.file!.name))
            if(!lineSym){
                return null;
            }
        }

        if(!lineSym) {
            const fil : dbgfile.SourceFile = {
                mtime: new Date(),
                name: path,
                mod: "",
                lines: [],
                id: 0,
                size: 0,
            };
            lineSym = {
                count: 0,
                id: 0,
                num: line,
                span: null,
                spanId: 0,
                file: fil,
                fileId: 0,
                type: 0,
            };
        }

        const bp = <CC65ViceBreakpoint> { verified: false, line: lineSym, viceIndex: -1, id: this._breakpointId++ };
        this._breakPoints.push(bp);

        await this._verifyBreakpoints();

        return bp;
    }

    public async clearBreakpoints(p : string): Promise<void> {
        for(const bp of [...this._breakPoints]) {
            if(!bp.line.file!.name.includes(p)) {
                continue;
            }

            await this._clearBreakPoint(bp);
        }
    }

    public setDataBreakpoint(address: string): boolean {
        return false;
    }

    public clearAllDataBreakpoints(): void {
    }

    // Memory access

    public async getMemory(addr: number, length: number) : Promise<Buffer> {
        if(length <= 0) {
            return Buffer.alloc(0);
        }

        const end = addr + (length - 1);
        const cmd = new Uint8Array(9);
        cmd[0] = 0x02; // Binary marker
        cmd[1] = cmd.length - 3; // Length
        cmd[2] = 0x01; // memdump, the only binary command
        cmd[3] = addr & 0x00FF // Low byte
        cmd[4] = addr>>8; // High byte
        cmd[5] = end & 0x00FF // Low byte
        cmd[6] = end>>8; // High byte
        cmd[7] = 0x00; // Memory context (Computer)
        cmd[8] = '\n'.charCodeAt(0); // Memory context (Computer)

        const buf : Buffer = <Buffer>(await this._vice.exec(cmd));

        const resLength = buf.readUInt32LE(1);

        let i = 0;
        const res = buf.slice(6, 6 + resLength);
        for(const byt of res) {
            this._memoryData.writeUInt8(byt, addr + i);
            i++;
        }

        return res;
    }

    private _getLocalVariableSyms(scope: dbgfile.Scope) : dbgfile.CSym[] {
        return scope.csyms.filter(x => x.sc == dbgfile.sc.auto)
    }

    private _getCurrentScope() : dbgfile.Scope | undefined {
        return this._dbgFile.scopes
            .find(x => x.span
                && x.span.absoluteAddress <= this._currentPosition.span!.absoluteAddress
                && this._currentPosition.span!.absoluteAddress <= x.span.absoluteAddress + x.span.size);
    }

    public async getScopeVariables() : Promise<any[]> {
        const stack = await this.getParamStack();
        if(!stack.length) {
            return [];
        }

        const scope = this._getCurrentScope();

        if(!scope) {
            return [];
        }

        const vars : VariableData[] = [];
        const locals = this._getLocalVariableSyms(scope)
        const mostOffset = locals[0].offs;
        for(let i = 0; i < locals.length; i++) {
            const csym = locals[i];
            const nextCsym = locals[i+1];

            const seek = -mostOffset+csym.offs;
            let seekNext = -mostOffset+csym.offs+2;
            if(nextCsym) {
                seekNext = -mostOffset+nextCsym.offs
            }

            const addr = this._paramStackTop + seek

            let ptr : number | undefined;

            let val;
            if(seekNext - seek == 2) {
                ptr = <any>stack.readUInt16LE(seek);
                val = "0x" + (<any>ptr!.toString(16)).padStart(4, '0');
            }
            else {
                val = "0x" + (<any>stack.readUInt8(seek).toString(16)).padStart(2, '0');
            }

            // FIXME Duplication with globals
            let typename: string = '';
            if(this._localTypes) {
                typename = (<any>(this._localTypes[scope.name + '()'].find(x => x.name == csym.name) || {})).type || '';

                if(ptr && /\bchar\s+\*/g.test(typename)) {
                    const mem = await this.getMemory(ptr, 24);
                    const nullIndex = mem.indexOf(0x00);
                    const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                    val = `${str} (${debugUtils.rawBufferHex(mem)})`;
                }

                if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                    typename = '';
                }
            }

            vars.push({
                name: csym.name,
                value: val,
                addr: addr,
                type: typename,
            });
        }

        return vars;
    }

    public async getParamStack() : Promise<Buffer> {
        await this._setParamStackTop();

        return await this.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        const vars: VariableData[] = [];
        for(const sym of this._dbgFile.labs) {
            if(!sym.name.startsWith("_") || (sym.seg && sym.seg.name == "CODE")) {
                continue;
            }

            const symName = sym.name.replace(/^_/g, '')

            const buf = await this.getMemory(sym.val, 2);
            const ptr = buf.readUInt16LE(0);

            let val = debugUtils.rawBufferHex(buf);

            let typename: string = '';
            if(this._localTypes) {
                typename = (<any>(this._localTypes['__GLOBAL__()'].find(x => x.name == symName) || {})).type || '';
                console.log(this._localTypes);

                if(/\bchar\s+\*/g.test(typename)) {
                    const mem = await this.getMemory(ptr, 24);
                    const nullIndex = mem.indexOf(0x00);
                    // FIXME PETSCII conversion
                    const str = mem.slice(0, nullIndex === -1 ? undefined: nullIndex).toString();
                    val = `${str} (${debugUtils.rawBufferHex(mem)})`;
                }

                if(!this._localTypes[typename.split(/\s+/g)[0]]) {
                    typename = '';
                }
            }

            vars.push({
                name: symName,
                value: val,
                addr: sym.val,
                type: typename
            });
        }

        return vars;
    }

    public getRegisters() : Registers {
        return this._registers;
    }

    private _processExecHandler = <debugUtils.ExecHandler>((file, args, opts) => {
        const promise = new Promise<[number, number]>((res, rej) => {
            if(!path.isAbsolute(file) && path.dirname(file) != '.') {
                file = path.join(__dirname, file);
            }

            this._session.runInTerminalRequest({
                args: [file, ...args],
                cwd: opts.cwd || __dirname,
                env: Object.assign({}, <any>opts.env || {}, { ELECTRON_RUN_AS_NODE: "1" }),
                kind: (this._consoleType || 'integratedConsole').includes('external') ? 'external': 'integrated'
            }, 5000, (response) => {
                if(!response.success) {
                    rej(response);
                }
                else {
                    res([response.body.shellProcessId || -1, response.body.processId || -1]);
                }
            })
        });

        return promise;
    });

    // We set labels here so the user doesn't have to generate Yet Another File
    private async _setLabels(): Promise<void> {
        await this._vice.multiExec(this._dbgFile.labs.map(lab =>
            `al \$${lab.val.toString(16)} .${lab.name}`
        ));
    }

    private _otherHandlers : EventEmitter;

    // FIXME These regexes could be pushed out and you could emit your own events.
    private _setupViceDataHandler() {
        let breakpointHit = false;

        this._vice.on('data', async (d) => {
            const data = d.toString();

            this._otherHandlers.emit('data', data);

            // Address changes always produce this line.
            // The command line prefix may not match as it
            // changes for others that get executed.
            const addrexe = /^\.C:([0-9a-f]+)([^\r\n]+\s+A:([0-9a-f]+)\s+X:([0-9a-f]+)\s+Y:([0-9a-f]+)\s+SP:([0-9a-f]+)\s+)/im.exec(data);
            if(addrexe) {
                const r = this._registers;
                const [full, addr] = addrexe;

                if(addrexe.length > 2) {
                    const [,, a, x, y, sp] = addrexe;
                    r.a = parseInt(a, 16);
                    r.x = parseInt(x, 16);
                    r.y = parseInt(y, 16);
                    r.sp = parseInt(sp, 16);
                }

                const addrParse = parseInt(addr, 16);
                this._currentAddress = addrParse
                this._currentPosition = this._getLineFromAddress(addrParse);

                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);

                if(addrexe[3]) {
                    this._cpuStackTop = 0x100 + parseInt(addrexe[3], 16)
                }
            }

            // Also handle the register data format
            const regs = /\s*ADDR\s+A\s+X\s+Y\s+SP\s+00\s+01\s+NV-BDIZC\s+LIN\s+CYC\s+STOPWATCH\s+\.;([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)/im.exec(data);
            if(regs) {
                const r = this._registers;
                const [full, addr, a, x, y, sp, zero, one, nvbdizc] = regs;
                r.a = parseInt(a, 16);
                r.x = parseInt(x, 16);
                r.y = parseInt(y, 16);
                r.sp = parseInt(sp, 16);
                r["00"] = parseInt(zero, 16);
                r["01"] = parseInt(one, 16);
                r.nvbdizc = parseInt(nvbdizc, 16);

                const addrParse = parseInt(regs[1], 16);
                this._currentAddress = addrParse
                this._currentPosition = this._getLineFromAddress(addrParse);


                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }

            const memrex =/^\>C:([0-9a-f]+)((\s+[0-9a-f]{2}){1,9})/gim;
            let memmatch = memrex.exec(data);
            if(memmatch) {
                do {
                    const addr = parseInt(memmatch[1]|| "0", 16);
                    let i = 0;
                    const md = this._memoryData;
                    for(const byt of memmatch[2].split(/\s+/g)) {
                        if(!byt) {
                            continue;
                        }

                        md.writeUInt8(parseInt(byt, 16), addr + i);
                        i++;
                    }
                } while(memmatch = memrex.exec(data))
            }

            const breakrex = /^#([0-9]+)\s+\(Stop\s+on\s+(exec|store)\s+([0-9a-f]+)\)\s+/gim;
            let breakmatch = breakrex.exec(data)

            if(breakmatch) {
                // Set the current position only once
                const addr = parseInt(breakmatch[3], 16);
                this._currentAddress = addr
                this._currentPosition = this._getLineFromAddress(addr);

                let index = parseInt(breakmatch[1]);

                if(this._codeSegGuardIndex == index) {
                    const guard = this._codeSegGuardIndex;
                    this._codeSegGuardIndex = -1;
                    await this._vice.exec(`del ${guard}`);
                    this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
                    this.sendEvent('output', 'console', 'CODE segment was modified. Your program may be broken!');
                }
                else {
                    const userBreak = this._breakPoints.find(x => x.line.span && x.line.span.absoluteAddress == this._currentPosition.span!.absoluteAddress);
                    if(userBreak) {
                        this._viceRunning = false;
                        this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
                    }
                }
            }

            const tracerex = /^#([0-9]+)\s+\(Trace\s+(\w+)\s+([0-9a-f]+)\)\s+/gim
            let tracematch = tracerex.exec(data);
            if(tracematch) {
                do {
                    const index = parseInt(tracematch[1]);
                    if(tracematch[2] != 'exec') {
                        continue;
                    }

                    const addr = tracematch[3].toLowerCase();
                    let scope: dbgfile.Scope;
                    if(scope = this._stackFrameStarts[addr]) {
                        const line = this._getLineFromAddress(parseInt(addr, 16));
                        this._stackFrames.push({line: line, scope: scope });
                    }

                    if(scope = this._stackFrameEnds[addr]) {
                        const idx = [...this._stackFrames].reverse().findIndex(x => x.scope.id == scope.id);
                        if(idx > -1) {
                            this._stackFrames.splice(this._stackFrames.length - 1 - idx, 1);
                        }
                    }
                } while(tracematch = tracerex.exec(data));
            }
        })
    }

    private async _loadSource(file: string, buildDir: string) : Promise<dbgfile.Dbgfile> {
        try {
            return this._dbgFile = await debugUtils.loadDebugFile(file, buildDir);
        }
        catch {
            throw new Error(
`Could not load debug symbols file from cc65. It must nave
the same name as your d84/d64/prg file with an .dbg extension.`
            );
        }
    }

    private async _getParamStackPos() : Promise<number> {
        const res = await this.getMemory(this._paramStackPointer, 2);
        return res.readUInt16LE(0);
    }

    private async _setParamStackBottom() {
        this._paramStackBottom = await this._getParamStackPos();
    }

    private async _setParamStackTop() {
        this._paramStackTop = await this._getParamStackPos();
    }

    private _setParamStackPointer() {
        const zp = this._dbgFile.segs.find(x => x.name == 'ZEROPAGE');
        if(!zp) {
            return -1;
        }

        this._paramStackPointer = zp.start;
    }

    private async _setCpuStack() {
        let i = 0;
        for(const byt of await this.getMemory(this._cpuStackTop, this._cpuStackBottom - this._cpuStackTop)){
            this._memoryData.writeUInt8(byt, this._cpuStackTop + i)
        }
    }

    private _getLineFromAddress(addr: number) : dbgfile.SourceLine {
        const curSpan = this._dbgFile.spans
            .find(x =>
                x.absoluteAddress <= addr
                && x.lines.length
                && x.lines.find(l => l.file && /\.c$/gi.test(l.file.name))
            )
            || this._dbgFile.spans[0];

        return curSpan.lines
            .find(x => x.file && /\.c$/gi.test(x.file.name))
            || this._dbgFile.lines[0];
    }

    private _getBreakpointMatches(breakpointText: string) : number[][] {
        const rex = /^(BREAK|WATCH|TRACE|UNTIL):\s+([0-9]+)\s+C:\$([0-9a-f]+)/gim;

        const matches : number[][] = [];
        let match;
        while (match = rex.exec(breakpointText)) {
            matches.push([parseInt(match[2]), parseInt(match[3], 16)]);
        }

        return matches;
    }

    private _getBreakpointNum(breakpointText: string) : number {
        return this._getBreakpointMatches(breakpointText)[0][0];
    }

    private _resetRegisters() {
        this._registers = {
            a: 0xff,
            x: 0xff,
            y: 0xff,
            ["00"]: 0xff,
            ["01"]: 0xff,
            nvbdizc: 0xff,
            sp: 0xff,
        };
    }

    private async _getLocalTypes() {
        try {
            this._localTypes = await clangQuery.getLocalTypes(this._dbgFile);
        }
        catch(e) {
            this.sendEvent('output', 'stderr', 'Not using Clang tools. Are they installed?');
        }
    }

    private async _resetStackFrames() {
        this._stackFrameStarts = {};
        this._stackFrameEnds = {};
        this._stackFrames = [];

        for(const scope of this._dbgFile.scopes) {
            if(!scope.name.startsWith("_")) {
                continue;
            }

            const span = scope.span;
            if(!span) {
                continue;
            }

            const begin = span.absoluteAddress;
            const end = begin + span.size;

            const dasm = <string>await this._vice.exec(`d \$${begin.toString(16)} \$${(end - 1).toString(16)}`);
            const jmprex = /^\.([C]):([0-9a-f]{4})\s{2}4c\s(([0-9a-f]+\s){2})\s*JMP\s.*$/gim
            let jmpmatch : RegExpExecArray | null;
            while(jmpmatch = jmprex.exec(dasm)) {
                const addr = parseInt(jmpmatch[2], 16);
                const targetBytes = jmpmatch[3].split(/\s+/g).filter(x => x);
                const targetAddr = parseInt(targetBytes[1] + targetBytes[0], 16);

                const builtin = this._mapFile.find(x => x.functionName.startsWith('incsp') && x.functionAddress == targetAddr);
                if(!builtin) {
                    continue;
                }

                this._stackFrameEnds[addr.toString(16)] = scope;
            }

            // FIXME May need to rethink the object structure.
            let finish = false;
            let start : dbgfile.SourceLine = this._dbgFile.lines[0];
            for(const line of this._dbgFile.lines) {
                if(!line.span) {
                    continue;
                }

                if(line.span.absoluteAddress < begin) {
                    break;
                }

                if(!finish && (line.span.absoluteAddress + line.span.size) <= end) {
                    this._stackFrameEnds[line.span.absoluteAddress.toString(16)] = scope;
                    finish = true;
                }

                start = line;
            }

            this._stackFrameStarts[start.span!.absoluteAddress.toString(16)] = scope;
        }

        await this._vice.multiExec(
            [
                ...Object.keys(this._stackFrameEnds),
                ...Object.keys(this._stackFrameStarts)
            ].map(addr => `tr exec \$${addr}`)
        );
    }

    // Comm

    private sendEvent(event: string, ... args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
