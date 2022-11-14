import _eachRight from 'lodash/eachRight';
import _findLastIndex from 'lodash/fp/findLastIndex';
import _remove from 'lodash/fp/remove';
import _uniqBy from 'lodash/fp/uniqBy';
import * as bin from './binary-dto';
import * as debugFile from '../lib/debug-file';
import * as disassembly from '../lib/disassembly';
import * as mapFile from '../lib/map-file';
import { AbstractGrip } from './abstract-grip';

export class CallStackManager {

    private _stackFrameJumps: { [index: string]: debugFile.Scope } = {};
    private _stackFrameStarts: { [index: string]: debugFile.Scope } = {};
    private _stackFrameEnds: { [index: string]: debugFile.Scope } = {};

    private _stackFrameBreakIndexes : number[] = [];

    private _stackFrames: {line: debugFile.SourceLine, scope: debugFile.Scope}[] = [];
    private _emulator: AbstractGrip;
    private _mapFile: mapFile.MapRef[];
    private _dbgFile: debugFile.Dbgfile;

    private _queuedFrames: ({id: number, startAddress: number, line: (() => debugFile.SourceLine) | undefined })[] = new Array(1000).fill(undefined).map(() => ({id: -1, startAddress: -1, line: undefined }));
    private _queuedFramesCount = 0;

    private _cpuStackBottom: number = 0x1ff;
    private _cpuStackTop?: number;

    constructor(emulator: AbstractGrip, mpFile: mapFile.MapRef[], dbgFile: debugFile.Dbgfile) {
        this._emulator = emulator;
        this._dbgFile = dbgFile;
        this._mapFile = mpFile;
    }

    private async _getStackFramesForScope(searchScope: debugFile.Scope, parentScope: debugFile.Scope, codeSegMem: Buffer) : Promise<{
        starts: disassembly.ScopeAddress[],
        ends: disassembly.ScopeAddress[],
        jumps: disassembly.ScopeAddress[],
    } | null> {
        const scopeEndFrames : disassembly.ScopeAddress[] = [];
        const scopeStackJumps : disassembly.ScopeAddress[] = [];

        if(!parentScope.name.startsWith("_")) {
            return null;
        }

        const span = searchScope.codeSpan;
        if(!span) {
            return null;
        }

        const begin = span.absoluteAddress;

        const spanMem = codeSegMem.slice(span.start, span.start + span.size);

        const res = await disassembly.findStackChangesForScope(this._mapFile, searchScope, parentScope, spanMem, this._dbgFile.scopes, this._dbgFile.labs, this._dbgFile.codeSeg);
        scopeEndFrames.push(...res.exitAddresses);
        for(const jumpAddress of res.jumpAddresses) {
            const cSpan = this._dbgFile.spans
                .find(x => x.absoluteAddress <= jumpAddress.address && x.lines.find(x => x.file && x.file.type == debugFile.SourceFileType.C));
            if(cSpan) {
                jumpAddress.address = cSpan.absoluteAddress;
            }
        }
        scopeStackJumps.push(...res.jumpAddresses);
        for(const descendant of res.descendants) {
            const desRes = await this._getStackFramesForScope(descendant, parentScope, codeSegMem);
            if(!desRes) {
                continue;
            }

            scopeEndFrames.push(...desRes.ends);
        }

        let start : debugFile.SourceLine = this._dbgFile.lines[0];
        for(const line of this._dbgFile.lines) {
            if(!line.span) {
                continue;
            }

            if(line.span.absoluteAddress < begin) {
                break;
            }

            start = line;
        }

        if(!scopeEndFrames.length && parentScope.codeSpan) {
            const codeSpan = parentScope.codeSpan;
            scopeEndFrames.push({
                scope: parentScope,
                address: this._dbgFile.spans.find(x => codeSpan.absoluteAddress <= x.absoluteAddress && x.absoluteAddress < codeSpan.absoluteAddress + codeSpan.size)!.absoluteAddress,
            });
        }

        return {
            starts: [{
                scope: parentScope,
                address: start.span!.absoluteAddress,
            }],
            ends: _uniqBy(x => x.address, scopeEndFrames),
            jumps: _uniqBy(x => x.address, scopeStackJumps),
        }
    }

    public async prettyStack(currentAddress: number, currentFile: string, currentLine: number, startFrame: number, endFrame: number): Promise<any> {
        const frames = new Array<any>();
        let i = startFrame;

        if(/\.s$/gi.test(currentFile)) {
            const cLine = this._dbgFile.lines.find(x => x.file && x.file.type == debugFile.SourceFileType.C && x.span && x.span.absoluteAddress <= currentAddress && currentAddress < x.span.absoluteAddress + x.span.size)
            if(cLine) {
                frames.push({
                    index: i,
                    name: '0x' + currentAddress.toString(16).padStart(4, '0'),
                    file: cLine.file && cLine.file.name,
                    line: cLine.num
                });
                i++;
            }
        }

        frames.push({
            index: i,
            name: '0x' + currentAddress.toString(16).padStart(4, '0'),
            file: currentFile,
            line: currentLine
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

    public setCpuStackTop(value: number) {
        this._cpuStackTop = value;
    }

    public async getExitAddresses() : Promise<number[]> {
        const defAddr: number[] = [];
        if(this._cpuStackTop) {
            const returnPointer = await this._emulator.getMemory(this._cpuStackTop + 1, 2);
            defAddr.push(returnPointer.readUInt16LE(0) + 1);
        }

        const codeSeg = this._dbgFile.codeSeg;
        if(!codeSeg) {
            return defAddr;
        }

        if(!this._dbgFile.mainScope) {
            return defAddr;
        }

        const codeSegMem = await this._emulator.getMemory(codeSeg.start, codeSeg.size);

        const mainFrames = await this._getStackFramesForScope(this._dbgFile.mainScope, this._dbgFile.mainScope, codeSegMem);
        if(!mainFrames) {
            return defAddr;
        }
        const exitAddresses = mainFrames.ends.map(x => x.address);

        return exitAddresses;
    }

    public async cleanup() {
        const deletes : bin.CheckpointDeleteCommand[] = [
            ...this._stackFrameBreakIndexes,
            ...Object.keys(this._stackFrameJumps).map(x => parseInt(x)),
            ...Object.keys(this._stackFrameStarts).map(x => parseInt(x)),
            ...Object.keys(this._stackFrameEnds).map(x => parseInt(x)),
        ].map(x => ({
            type: bin.CommandType.checkpointDelete,
            id: x
        }));
    }

    public async reset(currentAddress: number, currentLine: debugFile.SourceLine) : Promise<void> {
        this._stackFrameStarts = {};
        this._stackFrameEnds = {};
        this._stackFrameBreakIndexes = [];
        this._stackFrames = [];
        this._stackFrameJumps = {};

        const startFrames : disassembly.ScopeAddress[] = [];
        const endFrames : disassembly.ScopeAddress[] = [];
        const jumpFrames : disassembly.ScopeAddress[] = [];

        const codeSeg = this._dbgFile.codeSeg;
        if(!codeSeg) {
            return;
        }

        const codeSegMem = await this._emulator.getMemory(codeSeg.start, codeSeg.size);
        const reses = await Promise.all(this._dbgFile.scopes.map(x => this._getStackFramesForScope(x, x, codeSegMem)))
        for(const res of reses) {
            if(!res) {
                continue;
            }

            startFrames.push(...res.starts);
            endFrames.push(...res.ends);
            jumpFrames.push(...res.jumps);
        }

        const [resStarts, resEnds, jumps, brks] = await Promise.all([
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
                return await this._emulator.multiExecBinary(traceStarts) as bin.CheckpointInfoResponse[];
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

                return await this._emulator.multiExecBinary(traceEnds) as bin.CheckpointInfoResponse[];
            })(),
            (async() => {
                const traceJumps : bin.CheckpointSetCommand[] =
                    jumpFrames.map(frame => ({
                        type: bin.CommandType.checkpointSet,
                        operation: bin.CpuOperation.exec,
                        startAddress: frame.address,
                        endAddress: frame.address,
                        temporary: false,
                        stop: false,
                        enabled: true,
                    }));
                return await this._emulator.multiExecBinary(traceJumps) as bin.CheckpointInfoResponse[];
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

                return await this._emulator.multiExecBinary(breakStarts) as bin.CheckpointInfoResponse[];
            })()
        ]);

        for(const brk of brks) {
            this._stackFrameBreakIndexes.push(brk.id);
        }

        for(const jump of jumps) {
            this._stackFrameJumps[jump.id] = jumpFrames.find(x => x.address == jump.startAddress)!.scope;
        }

        for(const start of resStarts) {
            this._stackFrameStarts[start.id] = startFrames.find(x => x.address == start.startAddress)!.scope;
        }

        for(const end of resEnds) {
            const endFrame = endFrames.find(x => x.address == end.startAddress)!;
            this._stackFrameEnds[end.id] = endFrame.scope;
            _remove(x => x == endFrame, endFrames);
        }

        await this._stackFrameBreakToggle(false);

        const current = resStarts.find(x => x.startAddress == currentAddress);
        if(!current) {
            return;
        }

        this.addFrame(current, () => currentLine);
        this.flushFrames();
    }

    public flushFrames() : void {
        outer: for(let f = 0; f < this._queuedFramesCount; f++) {
            const item = this._queuedFrames[f];

            if(item.id == -1 || item.startAddress == -1 || !item.line) {
                continue;
            }

            let scope: debugFile.Scope;
            if(scope = this._stackFrameStarts[item.id]) {
                // Check to see if we've already stepped back out of this function
                let nesting = 1;
                for(let e = f + 1; e < this._queuedFramesCount; e++) {
                    const end = this._queuedFrames[e];
                    if(end.id == -1 || end.startAddress == -1 || !end.line) {
                        continue;
                    }
                    if(this._stackFrameStarts[end.id] == scope) {
                        nesting++;
                        continue;
                    }
                    const endScope = this._stackFrameEnds[end.id];
                    if(endScope == scope) {
                        nesting--;
                        if(!nesting) {
                            end.id = -1;
                            end.startAddress = -1;
                            end.line = undefined;
                            continue outer;
                        }
                    }
                }
                this._stackFrames.push({line: item.line(), scope: scope });
            }
            else if(scope = this._stackFrameEnds[item.id]) {
                const idx = _findLastIndex(x => x.scope.id == scope.id, this._stackFrames);
                if(idx > -1) {
                    this._stackFrames.splice(idx, 1);
                }
                else {
                    //console.error("SCOPE ERROR", scope);
                }
            }
            else if(scope = this._stackFrameJumps[item.id]) {
                _eachRight(this._stackFrames, (frame, f) => {
                    const span = frame.scope.codeSpan;
                    if(span && span.absoluteAddress <= item.startAddress && item.startAddress < span.absoluteAddress + span.size) {
                        frame.line = item.line!();
                        this._stackFrames.splice(f + 1);
                        return false;
                    }
                });
            }
            else {
                //console.error("SCOPE ERROR", scope);
            }
        }

        this._queuedFramesCount = 0;
    }

    public addFrame(info: bin.CheckpointInfoResponse, line: () => debugFile.SourceLine) {
        // FIXME These really need to be clearly marked to keep the user from messing them up
        // by adding their own.
        if(info.stop) {
            return;
        }

        if(info.operation != bin.CpuOperation.exec) {
            return;
        }

        const frame = this._queuedFrames[this._queuedFramesCount++];
        frame.id = info.id;
        frame.startAddress = info.startAddress;
        frame.line = line;

        if(this._queuedFramesCount == this._queuedFrames.length) {
            this.flushFrames();
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

        await this._emulator.multiExecBinary(cmd);
    }

    public async withFrameBreaksEnabled<T>(func: () => Promise<T>) : Promise<T> {
        await this._stackFrameBreakToggle(true);

        const res = await func();

        await this._stackFrameBreakToggle(false);

        return res;
    }

    public async returnToLastStackFrame() : Promise<boolean> {
        this.flushFrames();

        const lastFrame = this._stackFrames[this._stackFrames.length - 2];
        if(!lastFrame) {
            return false;
        }

        const begin = lastFrame.scope.codeSpan!.absoluteAddress;
        const end = lastFrame.scope.codeSpan!.absoluteAddress + lastFrame.scope.codeSpan!.size - 1;

        await this._emulator.withAllBreaksDisabled(async() => {
            const brk = await this._emulator.execBinary({
                type: bin.CommandType.checkpointSet,
                startAddress: begin,
                endAddress: end,
                enabled: true,
                temporary: false,
                stop: true,
                operation: bin.CpuOperation.exec,
            });

            await Promise.all([
                this._emulator.waitForStop(begin, end),
                this._emulator.exit(),
            ]);

            await this._emulator.execBinary({
                type: bin.CommandType.checkpointDelete,
                id: brk.id,
            })
        });

        return true;
    }
}