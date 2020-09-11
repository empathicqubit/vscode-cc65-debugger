import * as fs from 'fs';
import * as _ from 'lodash';
import * as readdir from 'recursive-readdir';
import { DebugProtocol } from 'vscode-debugprotocol';
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
import * as mapFile from './mapFile';
import * as bin from './binary-dto';

const opcodeSizes = [
    1, 6, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 2, 3, 3, 3,
    3, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    1, 2, 1, 2, 2, 2, 3, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, -1, 3,
    1, 2, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,
    2, 2, 1, 3, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
    2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,
    2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 1, 3, 3, 3, 3, 3,
];

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
    pc: number;
    fl: number;
    line: number;
    cycle: number;
}

/**
 * A CC65Vice runtime with debugging functionality.
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

    private _codeSeg: dbgfile.CodeSeg | undefined;
    // Monitors the code segment after initialization so that it doesn't accidentally get modified.
    private _codeSegGuardIndex: number = -1;

    private _entryAddress: number = 0;
    private _exitAddresses: number[] = [];

    private _breakPoints : CC65ViceBreakpoint[] = [];

    private _stackFrameStarts : { [index: string]: dbgfile.Scope } = {};
    private _stackFrameEnds : { [index: string]: dbgfile.Scope } = {};

    private _stackFrameBreakIndexes : number[] = [];

    private _stackFrames : {line: dbgfile.SourceLine, scope: dbgfile.Scope}[] = [];

    private _registers : Registers;

    // since we want to send breakpoint events, we will assign an id to every event
    // so that the frontend can match events with breakpoints.
    private _breakpointId = 1;

    private _viceRunning : boolean = false;
    private _viceStarting : boolean = false;
    private _vice : ViceGrip;

    private _currentPosition: dbgfile.SourceLine;
    private _consoleType?: string;
    private _mapFile: mapFile.MapRef[];
    private _localTypes: { [typename: string]: clangQuery.ClangTypeInfo[]; } | undefined;
    private _runInTerminalRequest: (args: DebugProtocol.RunInTerminalRequestArguments, timeout: number, cb: (response: DebugProtocol.RunInTerminalResponse) => void) => void;
    private _colorTermPids: [number, number] = [-1, -1];
    private _usePreprocess: boolean;

    constructor(ritr: (args: DebugProtocol.RunInTerminalRequestArguments, timeout: number, cb: (response: DebugProtocol.RunInTerminalResponse) => void) => void) {
        super();
        this._runInTerminalRequest = ritr;
    }

    /**
    * Build the program using the command specified and try to find the output file with monitoring.
    * @returns The possible output files of types d81, prg, and d64.
    */
    public async build(workspaceDir: string, cmd: string, preprocessCmd: string) : Promise<string[]> {
        const opts = {
            shell: true,
            cwd: workspaceDir,
        };
        const builder = new Promise((res, rej) => {
            const process = child_process.spawn(cmd, opts)

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

        this._usePreprocess = false;

        await Promise.all([
            builder,
            preprocessCmd && preprocessCmd.trim()
                ? util.promisify(child_process.exec)(preprocessCmd, {
                    ...opts,
                    shell: undefined,
                }).then(() => this._usePreprocess = true).catch(() => {})
                : Promise.resolve(),
        ]);

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
        await this._getLocalTypes(buildCwd);
        this._initCodeSeg();

        console.timeEnd('loadSource')

        console.time('preVice');

        const startSym = this._dbgFile.labs.find(x => x.name == "_main");

        if(startSym) {
            this._entryAddress = startSym.val;
        }
        else if(this._codeSeg) {
            this._entryAddress = this._codeSeg.start;
        }

        this._resetRegisters();
        this._setParamStackPointer();

        console.timeEnd('preVice');

        console.time('vice');

        this._otherHandlers = new EventEmitter();

        const labelFile = await this._getLabelsPath(program);

        this._vice = new ViceGrip(program, this._entryAddress, path.dirname(program), <debugUtils.ExecHandler>((file, args, opts) => this._processExecHandler(file, args, opts)), vicePath, viceArgs, labelFile);

        this._viceStarting = true;
        await this._vice.start();

        console.log('TEXT PORT: ' + this._vice.textPort);

        this._vice.on('end', () => this.terminate());

        await this._setupViceDataHandler();
        await this._vice.autostart();
        await this.continue();
        await this._vice.waitForStop();
        await this.continue();
        await this._vice.waitForStop(this._entryAddress);

        console.timeEnd('vice')

        console.time('postVice')

        await this._resetStackFrames();
        await this._guardCodeSeg();
        await this._setParamStackBottom();

        this._viceStarting = false;

        await this._verifyBreakpoints();

        await this.pause();

        if (stopOnEntry) {
            // We don't do anything here since VICE should already be in the
            // correct position after the startup routine.
            this.sendEvent('stopOnEntry', 'console');
        } else {
            // we just start to run until we hit a breakpoint or an exception
            await this.continue();
        }

        // FIXME this._colorTermPids = await this._processExecHandler('vice-rainbow-monitor', ['-remotemonitoraddress', `127.0.0.1:${this._vice.textPort}`], { })

        console.timeEnd('postVice')
    }

    private _initCodeSeg() : void {
        const codeSeg = this._dbgFile.segs.find(x => x.name == "CODE");

        if(!codeSeg) {
            return;
        }

        this._codeSeg = codeSeg;
    }

    private async _guardCodeSeg() : Promise<void> {
        if(!this._codeSeg) {
            return;
        }

        const cmd : bin.CheckpointSetCommand = {
            type: bin.CommandType.checkpointSet,
            operation: bin.CpuOperation.store,
            startAddress: this._codeSeg.start,
            endAddress: this._codeSeg.start + this._codeSeg.size - 1,
            enabled: true,
            stop: true,
            temporary: false,
        };
        const res : bin.CheckpointInfoResponse = await this._vice.execBinary(cmd);
        this._codeSegGuardIndex = res.id;
    }

    private async _loadMapFile(program: string) : Promise<void> {
        const progDir = path.dirname(program);
        const progFile = path.basename(program, path.extname(program));

        const possibles = await util.promisify(fs.readdir)(progDir);
        const filename : string | undefined = possibles
            .find(x => path.extname(x) == '.map' && path.basename(x).startsWith(progFile));

        if(!filename) {
            throw new Error("Could not find map file");
        }

        const text = await util.promisify(fs.readFile)(path.join(progDir, filename), 'utf8');
        this._mapFile = mapFile.parse(text);
    }

    public async getTypeFields(addr: number, typeName: string) : Promise<VariableData[]> {
        if(!this._localTypes) {
            return [];
        }

        const arrayParts = /^([^\[]+)\[([0-9]+)\]$/gi.exec(typeName);
        let typeParts : string[];
        if(arrayParts) {
            const itemCount = parseInt(arrayParts[2]);
            const vars : VariableData[] = [];
            const itemSize = clangQuery.recurseFieldSize([{
                aliasOf: '',
                type: arrayParts[1],
                name: '',
            }], this._localTypes)[0];
            for(let i = 0; i < itemCount; i++) {
                vars.push({
                    type: arrayParts[1],
                    name: i.toString(),
                    value: arrayParts[1],
                    addr: addr + i * itemSize,
                });
            }

            return vars;
        }
        else {
            typeParts = typeName.split(/\s+/g);
        }

        let isPointer = typeParts.length > 1 && _.last(typeParts) == '*';

        if(isPointer) {
            const pointerVal = await this.getMemory(addr, 2);
            addr = pointerVal.readUInt16LE(0);
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
                if(field.type.startsWith('signed')) {
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
        this.on('data', (d) => {
            console.log(d);
        });
    }

    public async continue(reverse = false) {
        await this._vice.exit();
    }

    public async step(reverse = false, event = 'stopOnStep') {
        // Find the next source line and continue to it.
        const nextLine = this._getNextLine();
        if(!nextLine) {
            await this._vice.execBinary<bin.AdvanceInstructionsCommand, bin.AdvanceInstructionsResponse>({
                type: bin.CommandType.advanceInstructions,
                subroutines: false,
                count: 1,
            });
        }
        else {
            const nextAddress = nextLine.span!.absoluteAddress;
            let breaks : bin.CheckpointInfoResponse[] | null;
            if(breaks = await this._setLineGuard(this._currentPosition, nextLine)) {
                await this.continue();
                await this._vice.waitForStop();

                const delBrks : bin.CheckpointDeleteCommand[] = breaks.map(x => ({
                    type: bin.CommandType.checkpointDelete,
                    id: x.id,
                }));

                await this._vice.multiExecBinary(delBrks);
            }
            else {
                await this._vice.execBinary<bin.CheckpointSetCommand, bin.CheckpointInfoResponse>({
                    type: bin.CommandType.checkpointSet,
                    startAddress: nextAddress,
                    endAddress: nextAddress,
                    stop: true,
                    temporary: true,
                    enabled: true,
                    operation: bin.CpuOperation.exec,
                })
            }
        }
        this.sendEvent(event, 'console')
    }

    private _getNextLine() : dbgfile.SourceLine {
        const currentFile = this._currentPosition.file;
        const currentIdx = currentFile!.lines.indexOf(this._currentPosition);

        return currentFile!.lines[currentIdx + 1];
    }

    private async _setLineGuard(line: dbgfile.SourceLine, nextLine: dbgfile.SourceLine) : Promise<bin.CheckpointInfoResponse[] | null> {
        if(!nextLine) {
            return null;
        }

        const span = line.span;
        if(!span) {
            return null;
        }

        const currentFunction = this._dbgFile.scopes
            .find(x => x.spans.find(scopeSpan => scopeSpan.absoluteAddress <= span.absoluteAddress
                && span.absoluteAddress < scopeSpan.absoluteAddress + scopeSpan.size));

        if(!currentFunction) {
            return null;
        }

        const functionLines = currentFunction.spans.find(x => x.seg == this._codeSeg)!.lines.filter(x => x.file == this._currentPosition.file);
        const currentIdx = functionLines.findIndex(x => x.num == nextLine.num);
        const remainingLines = functionLines.slice(currentIdx);
        const setBreaks : bin.CheckpointSetCommand[] = remainingLines.map(x => ({
            type: bin.CommandType.checkpointSet,
            startAddress: x.span!.absoluteAddress,
            endAddress: x.span!.absoluteAddress,
            stop: true,
            enabled: true,
            temporary: false,
            operation: bin.CpuOperation.exec,
        }));

        return await this._vice.multiExecBinary(setBreaks);
    }

    public async stepIn() : Promise<void> {
        if(!this._codeSeg) {
            return;
        }

        await this._stackFrameBreakToggle(true);

        const nextLine = this._getNextLine();
        const breaks = await this._setLineGuard(this._currentPosition, nextLine);

        await this.continue();
        await this._vice.waitForStop();

        if(breaks) {
            const delBrks : bin.CheckpointDeleteCommand[] = breaks.map(x => ({
                type: bin.CommandType.checkpointDelete,
                id: x.id,
            }));

            await this._vice.multiExecBinary(delBrks);
        }

        this.sendEvent('stopOnStep', 'console');
    }

    public async stepOut(event = 'stopOnStep') {
        const lastFrame = this._stackFrames[this._stackFrames.length - 2];
        if(!lastFrame) {
            this.sendEvent('output', 'console', 'Can\'t step out here!\n')
            this.sendEvent('stopOnStep', 'console');
            return;
        }

        const begin = lastFrame.scope.spans.find(x => x.seg == this._codeSeg)!.absoluteAddress;
        const end = lastFrame.scope.spans.find(x => x.seg == this._codeSeg)!.absoluteAddress + lastFrame.scope.spans[0].size - 1;

        const allbrk = await this._vice.checkpointList();
        const dis : bin.CheckpointToggleCommand[] = allbrk.related.filter(x => x.stop).map(x => ({
            type: bin.CommandType.checkpointToggle,
            id: x.id,
            enabled: false,
        }));
        await this._vice.multiExecBinary(dis);

        const brk = await this._vice.execBinary<bin.CheckpointSetCommand, bin.CheckpointInfoResponse>({
            type: bin.CommandType.checkpointSet,
            startAddress: begin,
            endAddress: end,
            enabled: true,
            temporary: true,
            stop: true,
            operation: bin.CpuOperation.exec,
        });

        await this._vice.waitForStop(brk.startAddress, brk.endAddress);

        const en : bin.CheckpointToggleCommand[] = allbrk.related.map(x => ({
            type: bin.CommandType.checkpointToggle,
            id: x.id,
            enabled: true,
        }));
        await this._vice.multiExecBinary(en);

        this.sendEvent(event, 'console')
    }

    public async pause() {
        await this._vice.ping();
        this.sendEvent('stopOnStep', 'console');
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
        try {
            this._colorTermPids[1] > -1 && process.kill(this._colorTermPids[1], "SIGKILL");
            this._colorTermPids[0] > -1 && process.kill(this._colorTermPids[0], "SIGKILL");
        }
        catch {}
        this._colorTermPids = [-1, -1];

        try {
            this._vice && await this._vice.end();
        }
        catch {}
        this._vice = <any>null;
        this._viceRunning = false;

        this._dbgFile = <any>null;
        this._mapFile = <any>null;
        this.sendEvent('end');
    }

    // Breakpoints

    private async _verifyBreakpoints() : Promise<void> {
        if(!this._dbgFile || !this._vice || this._viceStarting) {
            return;
        }

        const wasRunning = this._viceRunning;

        const checkCmds : bin.CheckpointSetCommand[] = [];
        for(const bp of this._breakPoints) {
            const sourceFile = this._dbgFile.files.find(x => x.lines.find(x => x.num == bp.line.num) && x.name == bp.line.file!.name);
            if (!(sourceFile && !bp.verified && bp.line.num <= sourceFile.lines[sourceFile.lines.length - 1].num)) {
                continue;
            }

            const srcLine = sourceFile.lines.find(x => x.num >= bp.line.num);

            if(!srcLine || !srcLine.span) {
                continue;
            }

            bp.line = srcLine;

            checkCmds.push({
                type: bin.CommandType.checkpointSet,
                startAddress: srcLine.span!.absoluteAddress,
                endAddress: srcLine.span!.absoluteAddress,
                enabled: true,
                stop: true,
                temporary: false,
                operation: bin.CpuOperation.exec,
            })
        }

        const brks : bin.CheckpointInfoResponse[] = await this._vice.multiExecBinary(checkCmds);

        const condCmds : bin.ConditionSetCommand[] = [];
        for(const brk of brks) {
            const bp = this._breakPoints.find(x => !x.verified && x.line.span && x.line.span.absoluteAddress == brk.startAddress)
            if(!bp) {
                continue;
            }

            bp.viceIndex = brk.id;
            bp.verified = true;
            this.sendEvent('breakpointValidated', bp);

            condCmds.push({
                type: bin.CommandType.conditionSet,
                checkpointId: brk.id,
                condition: '$574c == $574c',
            });
        }

        await this._vice.multiExecBinary(condCmds);

        if(wasRunning) {
            await this.continue();
        }
    }


    private async _clearBreakPoint(bp: CC65ViceBreakpoint) : Promise<CC65ViceBreakpoint | undefined> {
        const index = this._breakPoints.indexOf(bp);
        this._breakPoints.splice(index, 1);

        const dels : bin.CheckpointDeleteCommand[] = [];

        dels.push({
            type: bin.CommandType.checkpointDelete,
            id: bp.viceIndex,
        })

        // Also clean up breakpoints with the same address.
        // FIXME: This smells weird. Reassess and document reasoning.
        const bks = await this._vice.checkpointList();
        for(const bk of bks.related) {
            if(bk.startAddress == bp.line.span!.absoluteAddress) {
                dels.push({
                    type: bin.CommandType.checkpointDelete,
                    id: bk.id,
                });
            }
        }

        await this._vice.multiExecBinary(dels)

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

        const res = await this._vice.execBinary<bin.MemoryGetCommand, bin.MemoryGetResponse>({
            type: bin.CommandType.memoryGet,
            sidefx: false,
            startAddress: addr,
            endAddress: addr + length - 1,
            memspace: bin.ViceMemspace.main,
            bankId: 0,
        });

        return Buffer.from(res.memory);
    }

    private _getLocalVariableSyms(scope: dbgfile.Scope) : dbgfile.CSym[] {
        return scope.csyms.filter(x => x.sc == dbgfile.sc.auto)
    }

    private _getCurrentScope() : dbgfile.Scope | undefined {
        return this._dbgFile.scopes
            .find(x => x.spans.length && x.spans.find(scopeSpan =>
                scopeSpan.absoluteAddress <= this._currentPosition.span!.absoluteAddress
                && this._currentPosition.span!.absoluteAddress <= scopeSpan.absoluteAddress + scopeSpan.size
                ));
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
            if(seekNext - seek == 2 && stack.length > seek + 1) {
                ptr = <any>stack.readUInt16LE(seek);
                val = "0x" + (<any>ptr!.toString(16)).padStart(4, '0');
            }
            else {
                val = "0x" + (<any>stack.readUInt8(seek).toString(16)).padStart(2, '0');
            }

            // FIXME Duplication with globals
            let typename: string = '';
            let clangTypeInfo: clangQuery.ClangTypeInfo[];
            if(this._localTypes && (clangTypeInfo = this._localTypes[scope.name + '()'])) {
                typename = (<any>(clangTypeInfo.find(x => x.name == csym.name) || {})).type || '';

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

        if(vars.length <= 1) {
            const labs = this._dbgFile.labs.filter(x => x.seg && x.seg.name == "BSS" && x.scope == scope)
            this.sendEvent('output', 'console', `Total labs: ${labs.length}\n`);
            for(const lab of labs) {
                vars.push(await this._varFromLab(lab));
            }
        }
        else {
            this.sendEvent('output', 'console', 'We had vars\n');
        }

        return vars;
    }

    public async getParamStack() : Promise<Buffer> {
        await this._setParamStackTop();

        return await this.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)
    }

    private async _varFromLab(sym: dbgfile.Sym) : Promise<VariableData> {
        const symName = sym.name.replace(/^_/g, '')

        const buf = await this.getMemory(sym.val, 2);
        const ptr = buf.readUInt16LE(0);

        let val = debugUtils.rawBufferHex(buf);

        let typename: string = '';
        let clangTypeInfo: clangQuery.ClangTypeInfo[];
        if(this._localTypes && (clangTypeInfo = this._localTypes['__GLOBAL__()'])) {
            typename = (<any>(clangTypeInfo.find(x => x.name == symName) || {})).type || '';

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

        return {
            name: symName,
            value: val,
            addr: sym.val,
            type: typename
        };
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        const vars: VariableData[] = [];
        for(const sym of this._dbgFile.labs) {
            if(!sym.name.startsWith("_") || (sym.seg == this._codeSeg)) {
                continue;
            }

            vars.push(await this._varFromLab(sym));
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

            this._runInTerminalRequest({
                args: [file, ...args],
                cwd: opts.cwd || __dirname,
                env: Object.assign({}, <any>opts.env || {}, { ELECTRON_RUN_AS_NODE: "1" }),
                kind: (this._consoleType || 'integratedConsole').includes('external') ? 'external': 'integrated'
            }, 10000, (response) => {
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

    // Get the labels file if it exists
    private async _getLabelsPath(program: string): Promise<string | null> {
        const match = debugUtils.programFiletypes.exec(program)!;
        let filename : string;
        if(match[1] == 'c64') {
            filename = program + '.lbl';
        }
        else {
            filename = program.replace(debugUtils.programFiletypes, '.lbl');
        }

        try {
            const fileStats = await util.promisify(fs.stat)(filename);
            return filename;
        }
        catch {
            return null;
        }
    }

    private _otherHandlers : EventEmitter;

    private _addStackFrame(brk: bin.CheckpointInfoResponse) {
        if(brk.stop) {
            return;
        }

        if(brk.operation != bin.CpuOperation.exec) {
            return;
        }

        let scope: dbgfile.Scope;
        if(scope = this._stackFrameStarts[brk.id]) {
            const line = this._getLineFromAddress(brk.startAddress);
            this._stackFrames.push({line: line, scope: scope });
        }
        else if(scope = this._stackFrameEnds[brk.id]) {
            const idx = [...this._stackFrames].reverse().findIndex(x => x.scope.id == scope.id);
            if(idx > -1) {
                this._stackFrames.splice(this._stackFrames.length - 1 - idx, 1);
            }
        }
    }

    private async _setupViceDataHandler() {
        let breakpointHit = false;

        const avail = await this._vice.execBinary<bin.RegistersAvailableCommand, bin.RegistersAvailableResponse>({
            type: bin.CommandType.registersAvailable,
        });

        const meta : {[key: string]: bin.SingleRegisterMeta } = {};
        avail.registers.map(x => meta[x.name] = x);

        this._vice.on(0xffffffff.toString(16), async e => {
            if(e.type == bin.ResponseType.registerInfo) {
                const rr = (<bin.RegisterInfoResponse>e).registers;
                const r = this._registers;
                for(const reg of rr) {
                    if(meta['A'].id == reg.id) {
                        r.a = reg.value;
                    }
                    else if(meta['X'].id == reg.id) {
                        r.x = reg.value;
                    }
                    else if(meta['Y'].id == reg.id) {
                        r.y = reg.value;
                    }
                    else if(meta['SP'].id == reg.id) {
                        r.sp = reg.value;

                        this._cpuStackTop = 0x100 + r.sp;
                    }
                    else if(meta['FL'].id == reg.id) {
                        r.fl = reg.value;
                    }
                    else if(meta['LIN'].id == reg.id) {
                        r.line = reg.value;
                    }
                    else if(meta['CYC'].id == reg.id) {
                        r.cycle = reg.value;
                    }
                    else if(meta['PC'].id == reg.id) {
                        r.pc = reg.value;
                    }
                    // FIXME: Double check naming, which ones still exists?
                    // I have doubts about 00, 01, and NV-BDIZC
                }

                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }
            else if(e.type == bin.ResponseType.stopped) {
                this._viceRunning = false;
                this._currentAddress = (<bin.StoppedResponse>e).programCounter;
                this._currentPosition = this._getLineFromAddress(this._currentAddress);

                await this._stackFrameBreakToggle(false);

                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }
            else if(e.type == bin.ResponseType.resumed) {
                this._viceRunning = true;
                this._currentAddress = (<bin.ResumedResponse>e).programCounter;
                this._currentPosition = this._getLineFromAddress(this._currentAddress);

                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }
            else if(e.type == bin.ResponseType.checkpointInfo) {
                const brk = <bin.CheckpointInfoResponse>e;

                if(!brk.hit) {
                    return;
                }

                this._addStackFrame(brk);

                let index = brk.id;

                // Is a breakpoint
                if(brk.stop) {
                    if(this._codeSegGuardIndex == index) {
                        const guard = this._codeSegGuardIndex;
                        this._codeSegGuardIndex = -1;
                        await this._vice.checkpointDelete({
                            type: bin.CommandType.checkpointDelete,
                            id: guard,
                        })
                        this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
                        this.sendEvent('output', 'console', 'CODE segment was modified. Your program may be broken!');
                    }
                    else if (this._exitAddresses.includes(this._currentAddress)) {
                        await this.terminate();
                    }
                    else {
                        const userBreak = this._breakPoints.find(x => x.line.span && x.line.span.absoluteAddress == this._currentPosition.span!.absoluteAddress);
                        if(userBreak) {
                            this._viceRunning = false;
                            this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
                        }
                    }
                }
            }
        });
    }

    private async _loadSource(file: string, buildDir: string) : Promise<dbgfile.Dbgfile> {
        try {
            this._dbgFile = await debugUtils.loadDebugFile(file, buildDir);
        }
        catch {
            throw new Error(
`Could not load debug symbols file from cc65. It must nave
the same name as your d84/d64/prg file with an .dbg extension.`
            );
        }

        if(!this._dbgFile.csyms.length) {
            this.sendEvent('output', 'stderr', `
csyms are missing from your debug file. Did you add the -g switch to your linker
and compiler? (CFLAGS and LDFLAGS at the top of the standard CC65 Makefile)
`);
        }

        return this._dbgFile;
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
        let maybeBreakpoint = this._breakPoints.find(x => x.line.span && x.line.span.absoluteAddress == addr);
        let curSpan : dbgfile.DebugSpan;
        if(maybeBreakpoint) {
            curSpan = maybeBreakpoint.line.span!;
        }
        else {
            curSpan = this._dbgFile.spans
                .find(x =>
                    x.absoluteAddress <= addr
                    && x.lines.length
                    && x.lines.find(l => l.file && /\.c$/gi.test(l.file.name))
                )
                || this._dbgFile.spans[0];
        }

        return curSpan.lines
            .find(x => x.file && /\.c$/gi.test(x.file.name))
            || curSpan.lines[0];
    }

    private _resetRegisters() {
        this._registers = {
            a: 0xff,
            x: 0xff,
            y: 0xff,
            sp: 0xff,
            line: 0xff,
            cycle: 0xff,
            pc: 0xffff,
            fl: 0xff,
        };
    }

    private async _getLocalTypes(buildCwd: string) {
        try {
            this._localTypes = await clangQuery.getLocalTypes(this._dbgFile, this._usePreprocess, buildCwd);
        }
        catch(e) {
            this.sendEvent('output', 'stderr', 'Not using Clang tools. Are they installed?');
        }
    }

    private async _stackFrameBreakToggle(enabled: boolean) {
        const cmd : bin.CheckpointToggleCommand[] =
            this._stackFrameBreakIndexes
            .map(id => ({
                type: bin.CommandType.checkpointToggle,
                enabled,
                id,
            }));

        await this._vice.multiExecBinary(cmd);
    }

    private async _getStackFramesForScope(searchScope: dbgfile.Scope, parentScope: dbgfile.Scope) : Promise<{
    starts: { address: number, scope: dbgfile.Scope }[],
    ends: { address: number, scope: dbgfile.Scope }[]
    } | null> {
        const scopeEndFrames : { address: number, scope: dbgfile.Scope }[] = [];

        if(!parentScope.name.startsWith("_")) {
            return null;
        }

        const span = searchScope.spans.find(x => x.seg == this._codeSeg);
        if(!span) {
            return null;
        }

        const begin = span.absoluteAddress;
        const end = begin + span.size;

        let finish = false;

        const mem = await this.getMemory(begin, span.size);
        const stackManipulations = this._mapFile.filter(x => /^[^_].*sp[0-9]?$/i.test(x.functionName));
        let cmd = 0x100;
        for(let cursor = 0; cursor < mem.length; cursor += opcodeSizes[cmd] || 0) {
            cmd = mem.readUInt8(cursor);
            if(cmd == 0x4c) { // JMP
                const addr = mem.readUInt16LE(cursor + 1);

                const builtin = stackManipulations.find(x => x.functionAddress == addr);
                if(builtin) {
                    scopeEndFrames.push({
                        scope: parentScope,
                        address: begin + cursor,
                    });
                }
                else if(addr < begin || addr >= end) {
                    if(!(this._codeSeg && this._codeSeg.start <= addr && addr <= this._codeSeg.start + this._codeSeg.size)) {
                        continue;
                    }

                    let nextScope = this._dbgFile.scopes.find(x => x.spans.find(x => x.absoluteAddress == addr)) || null;

                    if(!nextScope) {
                        const nextLabel = this._dbgFile.labs.find(x => x.val == addr && x.scope && x.scope != parentScope && x.scope != searchScope);
                        if(!nextLabel) {
                            continue;
                        }

                        nextScope = nextLabel.scope;

                        if(!nextScope) {
                            continue;
                        }
                    }

                    const res = await this._getStackFramesForScope(nextScope!, parentScope);
                    if(!res) {
                        continue;
                    }

                    scopeEndFrames.push(...res.ends);
                }
            }
            else if(cmd == 0x60) { // RTS
                scopeEndFrames.push({
                    scope: parentScope,
                    address: begin + cursor,
                });
            }
        }

        let start : dbgfile.SourceLine = this._dbgFile.lines[0];
        for(const line of this._dbgFile.lines) {
            if(!line.span) {
                continue;
            }

            if(line.span.absoluteAddress < begin) {
                break;
            }

            start = line;
        }

        return {
            starts: [{
                scope: parentScope,
                address: start.span!.absoluteAddress,
            }],
            ends: _.uniqBy(scopeEndFrames, x => x.address),
        }
    }

    private async _resetStackFrames() {
        this._stackFrameStarts = {};
        this._stackFrameEnds = {};
        this._stackFrameBreakIndexes = [];
        this._stackFrames = [];

        const startFrames : { address: number, scope: dbgfile.Scope }[] = [];
        const endFrames : { address: number, scope: dbgfile.Scope }[] = [];

        const reses = await Promise.all(this._dbgFile.scopes.map(x => this._getStackFramesForScope(x, x)))
        for(const res of reses) {
            if(!res) {
                continue;
            }

            startFrames.push(...res.starts);
            endFrames.push(...res.ends);

            if(res.ends[0] && res.ends[0].scope.name == '_main') {
                this._exitAddresses.push(...res.ends.map(x => x.address));
            }
        }

        const [resExits, resStarts, resEnds, brks] = await Promise.all([
            (async() => {
                if(this._exitAddresses.length) {
                    const exits : bin.CheckpointSetCommand[] = this._exitAddresses.map(x => ({
                        type: bin.CommandType.checkpointSet,
                        startAddress: x,
                        endAddress: x,
                        stop: true,
                        enabled: true,
                        temporary: false,
                        operation: bin.CpuOperation.exec,
                    }));
                    return await this._vice.multiExecBinary(exits) as bin.CheckpointInfoResponse[];
                }

                return [];
            })(),
            (async() => {
                const traceStarts : bin.CheckpointSetCommand[] =
                    startFrames.map(frame => ({
                        type: bin.CommandType.checkpointSet,
                        operation: bin.CpuOperation.exec,
                        startAddress: frame.address,
                        endAddress: frame.address,
                        temporary: false,
                        stop: false,
                        enabled: true,
                    }));
                return await this._vice.multiExecBinary(traceStarts) as bin.CheckpointInfoResponse[];
            })(),
            (async() => {
                const traceEnds : bin.CheckpointSetCommand[] =
                    endFrames.map(frame => ({
                        type: bin.CommandType.checkpointSet,
                        operation: bin.CpuOperation.exec,
                        startAddress: frame.address,
                        endAddress: frame.address,
                        temporary: false,
                        stop: false,
                        enabled: true,
                    }));

                return await this._vice.multiExecBinary(traceEnds) as bin.CheckpointInfoResponse[];
            })(),
            (async() => {
                const breakStarts : bin.CheckpointSetCommand[] =
                    startFrames.map(frame => ({
                        type: bin.CommandType.checkpointSet,
                        operation: bin.CpuOperation.exec,
                        startAddress: frame.address,
                        endAddress: frame.address,
                        temporary: false,
                        stop: true,
                        enabled: false,
                    }));

                return await this._vice.multiExecBinary(breakStarts) as bin.CheckpointInfoResponse[];
            })()
        ]);

        for(const brk of brks) {
            this._stackFrameBreakIndexes.push(brk.id);
        }

        for(const start of resStarts) {
            this._stackFrameStarts[start.id] = startFrames.find(x => x.address == start.startAddress)!.scope;
        }

        for(const end of resEnds) {
            const endFrame = endFrames.find(x => x.address == end.startAddress)!;
            this._stackFrameEnds[end.id] = endFrame.scope;
            _.remove(endFrames, x => x == endFrame);
        }

        await this._stackFrameBreakToggle(false);

        this._addStackFrame(resStarts.find(x => x.startAddress == this._currentAddress)!);
    }

    // Comm

    public sendEvent(event: string, ... args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
