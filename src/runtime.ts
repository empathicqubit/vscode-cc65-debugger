import * as fs from 'fs';
import * as _ from 'lodash';
import * as TGA from 'tga';
import * as pngjs from 'pngjs';
import { DebugProtocol } from 'vscode-debugprotocol';
import { CallStackManager } from './call-stack-manager';
import * as tmp from 'tmp';
import * as child_process from 'child_process'
import * as disassembly from './disassembly'
import { EventEmitter } from 'events';
import * as compile from './compile';
import * as path from 'path';
import * as util from 'util';
import * as debugUtils from './debug-utils';
import * as debugFile from './debug-file'
import { ViceGrip } from './vice-grip';
import * as mapFile from './map-file';
import * as bin from './binary-dto';
import { VariableManager, VariableData } from './variable-manager';
import * as metrics from './metrics';

export interface CC65ViceBreakpoint {
    id: number;
    line: debugFile.SourceLine;
    viceIndex: number;
    verified: boolean;
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
 * This could be considered the debugger's main "API" and should be kept free of
 * too much VS UI-specific BS. The test harness needs to be able to utilize it
 * easily.
 */
export class Runtime extends EventEmitter {
    private _dbgFile: debugFile.Dbgfile;

    private _dbgFileResolved: (fil: debugFile.Dbgfile) => void;
    private _dbgFileRejected: (err: Error) => void;
    private _dbgFilePromise: Promise<debugFile.Dbgfile> = new Promise((res, rej) => {
        this._dbgFileResolved = res;
        this._dbgFileRejected = rej;
    });

    private _mapFile: mapFile.MapRef[];

    public _currentAddress: number;
    private _currentPosition: debugFile.SourceLine;

    // Monitors the code segment after initialization so that it doesn't accidentally get modified.
    private _codeSegGuardIndex: number = -1;

    private _exitIndexes: number[] = [];
    private _stopOnExit: boolean = false;
    private _exitQueued: boolean = false;

    private _callStackManager: CallStackManager;
    private _variableManager : VariableManager;

    private _breakPoints : CC65ViceBreakpoint[] = [];

    private _registers : Registers;

    // since we want to send breakpoint events, we will assign an id to every event
    // so that the frontend can match events with breakpoints.
    private _breakpointId = 1;

    public viceRunning : boolean = false;
    private _viceStarting : boolean = false;
    public _vice : ViceGrip;

    private _consoleType?: string;
    private _runInTerminalRequest: (args: DebugProtocol.RunInTerminalRequestArguments, timeout: number, cb: (response: DebugProtocol.RunInTerminalResponse) => void) => void;
    private _colorTermPids: [number, number] = [-1, -1];
    private _usePreprocess: boolean;
    private _runAhead: boolean;
    private _bypassStatusUpdates: boolean = false;
    private _screenUpdateTimer: NodeJS.Timeout;
    private _terminated: boolean;
    private _attachProgram: string | undefined;

    private _currentPng: any;
    private _runAheadPng: any;

    private _registerMeta : {[key: string]: bin.SingleRegisterMeta };

    constructor(ritr: (args: DebugProtocol.RunInTerminalRequestArguments, timeout: number, cb: (response: DebugProtocol.RunInTerminalResponse) => void) => void) {
        super();

        this._runInTerminalRequest = ritr;
    }

    /**
    * Build the program using the command specified and try to find the output file with monitoring.
    * @returns The possible output files of types d81, prg, and d64.
    */
    public async build(buildCwd: string, buildCmd: string, preprocessCmd: string) : Promise<string[]> {
        const opts = {
            shell: true,
        };

        const [changedFilenames, usePreprocess] = await Promise.all([
            compile.make(buildCwd, buildCmd, this, opts),
            compile.preProcess(buildCwd, preprocessCmd, opts),
        ]);

        this._usePreprocess = usePreprocess;

        if(changedFilenames.length) {
            return changedFilenames;
        }

        return await compile.guessProgramPath(buildCwd);
    }

    /**
     * Attach to an already running program
     * @param attachPort Binary monitor port
     * @param stopOnEntry Stop after attaching
     * @param consoleType The type of terminal to use when spawning the text monitor
     * @param runAhead Step ahead one frame when stopping
     * @param debugFilePath Manual path to debug file
     * @param mapFilePath Manual path to map file
     */
    public async attach(
        attachPort: number,
        buildCwd: string,
        stopOnEntry: boolean,
        stopOnExit: boolean,
        runAhead: boolean,
        consoleType?: string,
        program?: string,
        debugFilePath?: string,
        mapFilePath?: string
    ) {
        metrics.event('runtime', 'attach');

        this._attachProgram = program;

        await this._preStart(buildCwd, stopOnExit, runAhead, consoleType, program, debugFilePath, mapFilePath);

        console.time('vice')

        await this._vice.connect(attachPort);

        this._vice.once('end', () => this.terminate());

        await this._setupViceDataHandler();

        // Try to determine if we are loaded and wait if not
        await this._attachWait();

        console.timeEnd('vice');

        await this._postStart(stopOnEntry);
    }

    private async _attachWait() : Promise<void> {
        if(!this._dbgFile.codeSeg) {
            return;
        }

        const mainLab = this._dbgFile.mainLab;

        const scopes = this._dbgFile.scopes.filter(x => x.codeSpan && x.name.startsWith("_") && x.size > disassembly.maxOpCodeSize);
        const firstLastScopes = _.uniq([_.first(scopes)!, _.last(scopes)!]);

        if(!await this._validateLoad(firstLastScopes)) {
            this.sendEvent('message', 'warning', 'Waiting for program to start...\n', this._attachProgram ? ['Autostart'] : []);
            await this._vice.withAllBreaksDisabled(async () => {
                const storeCmds = _(firstLastScopes)
                    .map(x => [ x.codeSpan!.absoluteAddress, x.codeSpan!.absoluteAddress + x.codeSpan!.size - 1])
                    .flatten()
                    .map(x => {
                        const val : bin.CheckpointSetCommand = {
                            type: bin.CommandType.checkpointSet,
                            startAddress: x,
                            endAddress: x,
                            stop: true,
                            enabled: true,
                            temporary: false,
                            operation: bin.CpuOperation.store,
                        };
                        return val;
                    })
                    .value();

                const storeReses : bin.CheckpointInfoResponse[] = await this._vice.multiExecBinary(storeCmds);

                this._bypassStatusUpdates = true;
                do {
                    await this.continue();
                    await this._vice.waitForStop();
                } while(!await this._validateLoad(firstLastScopes)) 
                this._bypassStatusUpdates = false;

                const delCmds : bin.CheckpointDeleteCommand[] = storeReses
                    .map(x => ({
                            type: bin.CommandType.checkpointDelete,
                            id: x.id,
                    }));
                await this._vice.multiExecBinary(delCmds);
            });

            this.sendEvent('message', 'information', 'Program started.\n')
        }

        await this.continue();
        await this._vice.ping();
    }

    private async _validateLoad(scopes: debugFile.Scope[]) : Promise<boolean> {
        if(!this._dbgFile.codeSeg) {
            return true;
        }

        if(!scopes.length) {
            return true;
        }

        for(const scope of scopes) {
            const mem = await this._vice.getMemory(scope.codeSpan!.absoluteAddress, scope.size);
            if(!disassembly.verifyScope(this._dbgFile, scope, mem)) {
                return false;
            }
        }

        return true;
    }

    private async _preStart(
        buildCwd: string,
        stopOnExit: boolean, 
        runAhead: boolean, 
        consoleType?: string,
        program?: string,
        debugFilePath?: string,
        mapFilePath?: string
    ) : Promise<void> {
        console.time('preStart');

        this._terminated = false;
        this._stopOnExit = stopOnExit;

        this.sendEvent('message', 'warning', `Any problems? Make sure you're using the version of VICE mentioned in the extension download page.`);

        this._runAhead = !!runAhead;
        this._consoleType = consoleType;
        console.time('loadSource')

        if(program && !debugUtils.programFiletypes.test(program)) {
            throw new Error("File must be a Commodore Disk image or PRoGram.");
        }

        const promises : Promise<any>[] = [];

        if(!debugFilePath) {
            promises.push(debugUtils.getDebugFilePath(program, buildCwd).then(x => debugFilePath = x));
        }

        if(!mapFilePath) {
            promises.push(mapFile.getMapFilePath(program).then(x => mapFilePath = x));
        }

        await Promise.all(promises);

        await Promise.all([
            this._loadDebugFile(debugFilePath, buildCwd),
            this._loadMapFile(mapFilePath),
        ]);

        console.timeEnd('loadSource')

        console.time('preVice');

        this._resetRegisters();

        console.timeEnd('preVice');

        this._vice = new ViceGrip(
            <debugUtils.ExecHandler>((file, args, opts) => this._processExecHandler(file, args, opts)), 
        );

        this._callStackManager = new CallStackManager(this._vice, this._mapFile, this._dbgFile);

        console.time('variableManager');

        const variableManager = new VariableManager(
            this._vice,
            this._dbgFile.codeSeg,
            this._dbgFile.segs.find(x => x.name == "ZEROPAGE"),
            this._dbgFile.labs
        );

        variableManager.preStart(buildCwd, this._dbgFile, this._usePreprocess)

        console.timeEnd('variableManager');

        this._viceStarting = true;

        this._variableManager = variableManager;

        console.timeEnd('preStart');
    }

    /**
     * Start running the given program
     * @param program Program path
     * @param buildCwd Build path
     * @param stopOnEntry Stop after hitting main
     * @param viceDirectory The path with all the VICE executables
     * @param viceArgs Extra arguments to pass to VICE
     * @param consoleType How the user wants the terminals to launch
     * @param preferX64OverX64sc Use x64 when appropriate
     * @param runAhead Skip ahead one frame
     * @param debugFilePath Manual path to debug file
     * @param mapFilePath Manual path to map file
     * @param labelFilePath Manual path to label file
     */
    public async start(
        program: string, 
        buildCwd: string, 
        stopOnEntry: boolean, 
        stopOnExit: boolean,
        runAhead: boolean, 
        viceDirectory?: string, 
        viceArgs?: string[], 
        consoleType?: string, 
        preferX64OverX64sc?: boolean,
        debugFilePath?: string,
        mapFilePath?: string,
        labelFilePath?: string
    ) : Promise<void> {
        metrics.event('runtime', 'start');

        await this._preStart(buildCwd, stopOnExit, runAhead, consoleType, program, debugFilePath, mapFilePath)

        console.time('vice');

        if(!labelFilePath) {
            labelFilePath = await this._getLabelsPath(program);
        }

        await this._vice.start(
            this._dbgFile.entryAddress, 
            path.dirname(program),
            await this._getVicePath(viceDirectory, !!preferX64OverX64sc), 
            viceArgs,
            labelFilePath
        )

        this._vice.on('error', (res) => {
            console.error(res);
        })

        this._vice.once('end', () => this.terminate());

        await this._setupViceDataHandler();
        await this._vice.autostart(program);
        await this.continue();
        await this._vice.waitForStop(this._dbgFile.entryAddress, undefined, true);

        console.timeEnd('vice')

        await this._postStart(stopOnEntry);
    }

    private async _postStart(stopOnEntry: boolean) : Promise<void> {
        console.time('postStart')

        if(this._vice.textPort) {
            this._colorTermPids = await this._processExecHandler(process.execPath, [__dirname + '/../dist/monitor.js', '-remotemonitoraddress', `127.0.0.1:${this._vice.textPort}`, `-condensedtrace`], {
                title: 'VICE Monitor',
            });
        }
        
        await Promise.all([
            this._callStackManager.reset(this._currentAddress, this._currentPosition),
            this._setExitGuard(),
            this._guardCodeSeg(),
            this._variableManager.postStart(),
        ]);
        // FIXME await this._setScreenUpdateCheckpoint();

        this._viceStarting = false;

        await this._verifyBreakpoints();

        await this.pause();

        if (stopOnEntry) {
            // We don't do anything here since VICE should already be in the
            // correct position after the startup routine.
            this.sendEvent('stopOnEntry');
        } else {
            // we just start to run until we hit a breakpoint or an exception
            await this.continue();
        }

        const updateLoop = async() => {
            try {
                await this._updateScreen();
            }
            catch(e) {
                console.error(e);
            }

            this._screenUpdateTimer = setTimeout(updateLoop, 1000);
        }
        this._screenUpdateTimer = setTimeout(updateLoop, 1000);

        this.sendEvent('started');

        console.timeEnd('postStart');
    }

    private async _updateScreen() {
        const wasRunning = this.viceRunning;

        if(!wasRunning) {
            return;
        }

        this._bypassStatusUpdates = true;
        const displayCmd : bin.DisplayGetCommand = {
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.BGRA,
        };
        const currentRes : bin.DisplayGetResponse = await this._vice.execBinary(displayCmd);

        this._bypassStatusUpdates = false;

        if(wasRunning) {
            await this.continue();
        }

        const current = new TGA(currentRes.imageData);
        if(!this._currentPng) {
            this._currentPng = new pngjs.PNG({
                width: current.width,
                height: current.height
            });
        }

        this._currentPng.data = current.pixels;

        this.sendEvent('current', {
            current: {
                data: Array.from(pngjs.PNG.sync.write(this._currentPng)),
                width: current.width,
                height: current.height,
            },
        });
    }

    public async action(name: string) {
        if(name == 'Autostart' && this._attachProgram) {
            await this._vice.autostart(this._attachProgram);
            await this._vice.waitForStop(this._dbgFile.entryAddress, undefined, true);
        }
        else {
            throw new Error('Invalid action ' + name);
        }
    }

    public async keypress(key: string) : Promise<void> {
        const wasRunning = this.viceRunning;
        this._bypassStatusUpdates = true;
        const cmd : bin.KeyboardFeedCommand = {
            type: bin.CommandType.keyboardFeed,
            text: key,
        }
        await this._vice.execBinary(cmd);
        this._bypassStatusUpdates = false;
        if(wasRunning) {
            await this.continue();
        }
    }

    private async _setExitGuard() : Promise<void> {
        const exitAddresses = await this._callStackManager.getExitAddresses();
        if(!exitAddresses.length) {
            return;
        }

        const exits : bin.CheckpointSetCommand[] = exitAddresses.map(x => ({
            type: bin.CommandType.checkpointSet,
            startAddress: x,
            endAddress: x,
            stop: true,
            enabled: true,
            temporary: false,
            operation: bin.CpuOperation.exec,
        }));
        const resExits = await this._vice.multiExecBinary(exits) as bin.CheckpointInfoResponse[];

        for(const exit of resExits) {
            this._exitIndexes.push(exit.id);
        }
    }

    private async _guardCodeSeg() : Promise<void> {
        if(!this._dbgFile.codeSeg) {
            return;
        }

        const cmd : bin.CheckpointSetCommand = {
            type: bin.CommandType.checkpointSet,
            operation: bin.CpuOperation.store,
            startAddress: this._dbgFile.codeSeg.start,
            endAddress: this._dbgFile.codeSeg.start + this._dbgFile.codeSeg.size - 1,
            enabled: true,
            stop: true,
            temporary: false,
        };
        const res : bin.CheckpointInfoResponse = await this._vice.execBinary(cmd);
        this._codeSegGuardIndex = res.id;
    }

    private async _loadMapFile(filename: string | undefined) : Promise<void> {
        try {
            if(!filename) {
                throw new Error();
            }

            const text = await util.promisify(fs.readFile)(filename, 'utf8');
            this._mapFile = mapFile.parse(text);
        }
        catch {
            throw new Error(
`Could not load map file from cc65. Make sure it's being generated,
or define the location manually with the launch.json->mapFile setting`
            );
        }
    }

    public async monitorToConsole() {
        this.on('data', (d) => {
            console.log(d);
        });
    }

    public async continue(reverse = false) {
        await this._vice.exit();
    }

    public async step(reverse = false, event = 'stopOnStep') : Promise<void> {
        if(this.viceRunning) {
            return;
        }

        await this._vice.withAllBreaksDisabled(async () => {
            // Find the next source line and continue to it.
            const nextLine = this._getNextLine();
            if(!nextLine) {
                await this._vice.execBinary<bin.AdvanceInstructionsCommand, bin.AdvanceInstructionsResponse>({
                    type: bin.CommandType.advanceInstructions,
                    stepOverSubroutines: false,
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

        });

        await this._doRunAhead();

        this.sendEvent(event, 'console')
    }

    private _getNextLine() : debugFile.SourceLine | undefined {
        const currentFile = this._currentPosition.file;
        const currentIdx = currentFile!.lines.indexOf(this._currentPosition);

        return currentFile!.lines.find((x, i) => i >= currentIdx + 1 && x.span);
    }

    private async _setLineGuard(line: debugFile.SourceLine, nextLine?: debugFile.SourceLine) : Promise<bin.CheckpointInfoResponse[] | null> {
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

        const functionLines = currentFunction.codeSpan!.lines.filter(x => x.file == this._currentPosition.file && x.span);
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
        if(!this._dbgFile.codeSeg) {
            return;
        }

        if(this._currentPosition.file && /\.s$/gi.test(this._currentPosition.file.name)) {
            const stepCmd : bin.AdvanceInstructionsCommand = {
                type: bin.CommandType.advanceInstructions,
                stepOverSubroutines: false,
                count: 1,
            };

            await this._vice.execBinary(stepCmd);
        }
        else {
            await this._callStackManager.withFrameBreaksEnabled(async () => {
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
            });
        }

        await this._doRunAhead();

        this.sendEvent('stopOnStep');
    }

    public async stepOut(event = 'stopOnStep') : Promise<void> {
        if(!await this._callStackManager.returnToLastStackFrame(this._vice)) {
            this.sendEvent('message', 'warning', 'Can\'t step out here!\n')
            this.sendEvent('stopOnStep');
            return;
        }

        await this._doRunAhead();

        this.sendEvent(event, 'console')
    }

    public async pause() {
        await this._vice.ping();
        await this._doRunAhead();
        this.sendEvent('stopOnStep');
    }

    public async stack(startFrame: number, endFrame: number): Promise<any> {
        this._callStackManager.flushFrames();
        return await this._callStackManager.prettyStack(
            this._currentAddress, 
            (this._currentPosition.file || {}).name || '', 
            this._currentPosition.num, 
            startFrame, 
            endFrame
        );
    }

    // Clean up all the things
    public async terminate() : Promise<void> {
        if(this._terminated) {
            return;
        }

        this._vice && await this._vice.terminate();

        this._vice = <any>null;

        await this.disconnect();

        this.sendEvent('end');

        this._terminated = true;
    }

    public async disconnect() {
        this._screenUpdateTimer && clearTimeout(this._screenUpdateTimer);

        const pids = this._colorTermPids;
        debugUtils.delay(1000).then(() => {
            try {
                for(const pid of _.uniq(pids)) {
                    pid > -1 && process.kill(pid, 0) && process.kill(pid, "SIGKILL");
                }
            }
            catch {}
        });
        this._colorTermPids = [-1, -1];

        this._vice && await this._vice.disconnect();

        this._vice = <any>undefined;

        this.viceRunning = false;

        this._stopOnExit = false;
        this._exitQueued = false;

        this._callStackManager = <any>undefined;
        this._variableManager = <any>undefined;

        this._currentPng = undefined;
        this._runAheadPng = undefined;

        this._dbgFile = <any>null;
        this._mapFile = <any>null;
        this._dbgFilePromise = new Promise((res, rej) => {
            this._dbgFileResolved = res;
            this._dbgFileRejected = rej;
        });
    }

    public async getMemory(addr: number, length: number) : Promise<Buffer> {
        return await this._vice.getMemory(addr, length);
    }

    // Breakpoints

    private async _verifyBreakpoints() : Promise<void> {
        if(!this._dbgFile || !this._vice || this._viceStarting) {
            return;
        }

        const checkCmds : bin.CheckpointSetCommand[] = [];
        for(const bp of this._breakPoints) {
            const sourceFile = this._dbgFile.files.find(x => x.lines.find(x => x.num == bp.line.num) && !path.relative(x.name, bp.line.file!.name));
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
    }

    public getBreakpointLength() : number {
        return this._breakPoints.length;
    }

    public getBreakpoints(p: string, line: number): number[] {
        return this._breakPoints.filter(x => x.line.num == line && x.line.file && !path.relative(x.line.file.name, p)).map(x => x.line.num);
    }

    public async setBreakPoint(breakPath: string, ...lines: number[]) : Promise<{[key:string]:CC65ViceBreakpoint}> {
        await this._dbgFilePromise;

        let lineSyms : { [key:string]: debugFile.SourceLine | null } = {};
        for(const line of lines) {
            const lineSym = this._dbgFile.lines.find(x => x.num == line && !path.relative(breakPath, x.file!.name));
            if(!lineSym){
                lineSyms[line] = null;
                continue;
            }
            lineSyms[line] = lineSym;
        }

        if(!Object.keys(lineSyms).length) {
            return {};
        }

        const bps : {[key:string]:CC65ViceBreakpoint} = {};
        for(const line in lineSyms) {
            let lineSym = lineSyms[line];

            if(!lineSym) {
                const fil : debugFile.SourceFile = {
                    mtime: new Date(),
                    name: breakPath,
                    mod: "",
                    lines: [],
                    id: 0,
                    size: 0,
                };
                lineSym = {
                    count: 0,
                    id: 0,
                    num: parseInt(line),
                    span: undefined,
                    spanId: 0,
                    file: fil,
                    fileId: 0,
                    type: 0,
                };
            }

            const bp = <CC65ViceBreakpoint> { verified: false, line: lineSym, viceIndex: -1, id: this._breakpointId++ };
            bps[line] = bp;
        }
        this._breakPoints.push(...Object.values(bps))

        await this._verifyBreakpoints();

        return bps;
    }

    public async clearBreakpoints(p : string): Promise<void> {
        let dels : bin.CheckpointDeleteCommand[] = [];
        for(const bp of [...this._breakPoints]) {
            if(path.relative(p, bp.line.file!.name)) {
                continue;
            }

            const index = this._breakPoints.indexOf(bp);
            if(index == -1) {
                continue;
            }
            this._breakPoints.splice(index, 1);

            if(bp.viceIndex <= 0) {
                continue;
            }

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

        }

        dels = _.uniqBy(dels, x => x.id);

        if(dels.length) {
            await this._vice.multiExecBinary(dels);
        }
    }

    public setDataBreakpoint(address: string): boolean {
        return false;
    }

    public clearAllDataBreakpoints(): void {
    }

    public getRegisters() : Registers {
        return this._registers;
    }

    // Variables

    public async getScopeVariables() : Promise<any[]> {
        const currentScope = this._getCurrentScope()
        return await this._variableManager.getScopeVariables(currentScope);
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        return await this._variableManager.getGlobalVariables();
    }

    public async getTypeFields(addr: number, typeName: string) : Promise<VariableData[]> {
        return await this._variableManager.getTypeFields(addr, typeName);
    }

    private _getCurrentScope() : debugFile.Scope | undefined {
        return this._dbgFile.scopes
            .find(x => x.codeSpan && 
                x.codeSpan.absoluteAddress <= this._currentPosition.span!.absoluteAddress
                && this._currentPosition.span!.absoluteAddress < x.codeSpan.absoluteAddress + x.codeSpan.size
            );
    }

    private _processExecHandler : debugUtils.ExecHandler = ((file, args, opts) => {
        const promise = new Promise<[number, number]>((res, rej) => {
            if(!path.isAbsolute(file) && path.dirname(file) != '.') {
                file = path.join(__dirname, file);
            }

            this._runInTerminalRequest({
                args: [file, ...args],
                cwd: opts.cwd || __dirname,
                env: Object.assign({}, <any>opts.env || {}, { ELECTRON_RUN_AS_NODE: "1" }),
                title: opts.title || undefined,
                kind: (this._consoleType || 'integratedConsole').includes('external') ? 'external': 'integrated'
            }, 10000, (response) => {
                if(!response.success) {
                    rej(response);
                }
                else {
                    res([response.body.processId || -1, response.body.shellProcessId || -1]);
                }
            })
        });

        return promise;
    });

    private async _getVicePath(viceDirectory: string | undefined, preferX64OverX64sc: boolean) : Promise<string> {
        let viceBaseName : string;
        const ln = this._dbgFile.systemLibBaseName;
        if(ln == 'c128') {
            viceBaseName = 'x128';
        }
        else if(ln == 'cbm510') {
            viceBaseName = 'xcbm5x0';
        }
        else if(ln == 'pet') {
            viceBaseName = 'xpet';
        }
        else if(ln == 'plus4') {
            viceBaseName = 'xplus4';
        }
        else if(ln == 'vic20') {
            viceBaseName = 'xvic';
        }
        else {
            viceBaseName = preferX64OverX64sc ? 'x64' : 'x64sc';
        }

        let vicePath : string;
        if(viceDirectory) {
            vicePath = path.normalize(path.join(viceDirectory, viceBaseName));
        }
        else {
            vicePath = viceBaseName;
        }

        try {
            await util.promisify(child_process.execFile)(vicePath, ['--help']);
        }
        catch(e) {
            throw new Error("Couldn't find VICE. Make sure your `cc65vice.viceDirectory` user setting is pointing to the directory containing VICE executables.");
        }

        return vicePath;
    }

    // Get the labels file if it exists
    private async _getLabelsPath(program?: string): Promise<string | undefined> {
        if(!program) {
            return undefined;
        }

        const match = debugUtils.programFiletypes.exec(program)!;
        const isATargetExtension = !!match[3]; // For the standard Makefile's wonky targets.
        let filename : string;
        if(isATargetExtension) {
            filename = program + '.lbl';
        }
        else {
            filename = program.replace(debugUtils.programFiletypes, '.lbl');
        }

        try {
            await util.promisify(fs.stat)(filename);
            return filename;
        }
        catch {
            return undefined;
        }
    }

    private async _dataHandler(e: bin.AbstractResponse) : Promise<void> {
        if(this._bypassStatusUpdates) {
            return;
        }
        else if(e.type == bin.ResponseType.checkpointInfo) {
            // Important note: For performance reasons, brk is a shared object.
            // If you add any references to it after 
            // an async call you MUST duplicate it before,
            // otherwise it will be overwritten.
            const brk = <bin.CheckpointInfoResponse>e;

            if(!brk.hit) {
                return;
            }

            const line = () => debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, brk.startAddress);
            this._callStackManager.addFrame(brk, line);

            let index = brk.id;

            // Is a breakpoint
            if(brk.stop) {
                if(this._codeSegGuardIndex == index) {
                    const guard = this._codeSegGuardIndex;
                    this._codeSegGuardIndex = -1;
                    await this._vice.checkpointDelete({
                        type: bin.CommandType.checkpointDelete,
                        id: guard,
                    });
                    this.sendEvent('message', 'error', 'CODE segment was modified. Your program may be broken!\n');
                }
                else if (this._exitIndexes.includes(brk.id)) {
                    if(!this._stopOnExit) {
                        await this.terminate();
                        return;
                    }
                    else {
                        await this._doRunAhead();
                        this._exitQueued = true;
                        this.sendEvent('stopOnExit');
                    }
                }
                else {
                    const userBreak = this._breakPoints.find(x => x.viceIndex == brk.id);
                    if(userBreak) {
                        await this._doRunAhead();
                    }
                }

                this.viceRunning = false;
                this.sendEvent('stopOnBreakpoint');
            }
        }
        else if(e.type == bin.ResponseType.registerInfo) {
            const rr = (<bin.RegisterInfoResponse>e).registers;
            const r = this._registers;
            const meta = this._registerMeta;
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

                    this._callStackManager.setCpuStackTop(0x100 + r.sp);
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
            }
        }
        else if(e.type == bin.ResponseType.stopped) {
            this.viceRunning = false;
            this._currentAddress = (<bin.StoppedResponse>e).programCounter;
            this._currentPosition = debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, this._currentAddress);

            if(!this._viceStarting) {
                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
                this.sendEvent('stopOnStep');
            }
        }
        else if(e.type == bin.ResponseType.resumed) {
            if(this._exitQueued) {
                await this.terminate();
                return;
            }

            this.viceRunning = true;
            this._currentAddress = (<bin.ResumedResponse>e).programCounter;
            this._currentPosition = debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, this._currentAddress);

            if(!this._viceStarting) {
                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }
        }
    }

    private async _setupViceDataHandler() {
        const avail = await this._vice.execBinary<bin.RegistersAvailableCommand, bin.RegistersAvailableResponse>({
            type: bin.CommandType.registersAvailable,
            memspace: bin.ViceMemspace.main,
        });

        this._registerMeta = {};
        avail.registers.map(x => this._registerMeta[x.name] = x);

        this._vice.on(0xffffffff.toString(16), async e => this._dataHandler(e));
    }

    private async _doRunAhead() : Promise<void>{
        if(!this._runAhead) {
            return;
        }

        const displayCmd : bin.DisplayGetCommand = {
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.BGRA,
        }
        const currentRes : bin.DisplayGetResponse = await this._vice.execBinary(displayCmd);

        const dumpFileName : string = await util.promisify(tmp.tmpName)({ prefix: 'cc65-vice-'});
        const dumpCmd : bin.DumpCommand =  {
            type: bin.CommandType.dump,
            saveDisks: false,
            saveRoms: false,
            filename: dumpFileName,
        }
        await this._vice.execBinary(dumpCmd);

        const oldLine = this._registers.line;
        const oldPosition = this._currentPosition;
        this._bypassStatusUpdates = true;
        await this._vice.withAllBreaksDisabled(async() => {
            const brkCmd : bin.CheckpointSetCommand = {
                type: bin.CommandType.checkpointSet,
                startAddress: 0x0000,
                endAddress: 0xffff,
                stop: true,
                enabled: true,
                operation: bin.CpuOperation.exec,
                temporary: false,
            };
            const brkRes : bin.CheckpointInfoResponse = await this._vice.execBinary(brkCmd);
            const notCmd : bin.ConditionSetCommand = {
                type: bin.CommandType.conditionSet,
                condition: 'RL != $' + oldLine.toString(16),
                checkpointId: brkRes.id,
            };
            await this._vice.execBinary(notCmd);
            await this.continue();
            await this._vice.waitForStop();
            const notNotCmd : bin.ConditionSetCommand = {
                type: bin.CommandType.conditionSet,
                condition: 'RL == $' + oldLine.toString(16),
                checkpointId: brkRes.id,
            };
            await this._vice.execBinary(notNotCmd);
            await this.continue();
            await this._vice.waitForStop();
            const delBrk : bin.CheckpointDeleteCommand = {
                type: bin.CommandType.checkpointDelete,
                id: brkRes.id,
            };
            await this._vice.execBinary(delBrk);
        });
        this._bypassStatusUpdates = false;

        const aheadRes : bin.DisplayGetResponse = await this._vice.execBinary(displayCmd);

        const undumpCmd : bin.UndumpCommand = {
            type: bin.CommandType.undump,
            filename: dumpFileName,
        };
        const undumpRes : bin.UndumpResponse = await this._vice.execBinary(undumpCmd);
        this._currentAddress = undumpRes.programCounter;
        this._currentPosition = debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, this._currentAddress);

        await util.promisify(fs.unlink)(dumpFileName);

        const ahead = new TGA(aheadRes.imageData);
        const current = new TGA(currentRes.imageData);
        if(!this._runAheadPng) {
            this._runAheadPng = new pngjs.PNG({
                width: ahead.width,
                height: ahead.height
            });
        }
        this._runAheadPng.data = ahead.pixels;
        if(!this._currentPng) {
            this._currentPng = new pngjs.PNG({
                width: current.width,
                height: current.height
            });
        }
        this._currentPng.data = current.pixels;

        this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);

        this.sendEvent('runahead', {
            runAhead: {
                data: Array.from(pngjs.PNG.sync.write(this._runAheadPng)),
                width: ahead.width,
                height: ahead.height,
            },
            current: {
                data: Array.from(pngjs.PNG.sync.write(this._currentPng)),
                width: current.width,
                height: current.height,
            },
        });
    }

    private async _loadDebugFile(filename: string | undefined, buildDir: string) : Promise<debugFile.Dbgfile> {
        try {
            if(!filename) {
                throw new Error();
            }

            const dbgFilePromise = debugUtils.loadDebugFile(filename, buildDir);
            dbgFilePromise
                .then(x => {
                    this._dbgFile = x;
                    this._dbgFileResolved(x);
                })
                .catch(this._dbgFileRejected);
            await this._dbgFilePromise;
        }
        catch {
            throw new Error(
`Could not load debug symbols file from cc65. It must nave
the same name as your d84/d64/prg file with an .dbg extension.
Alternatively, define the location with the launch.json->debugFile setting`
            );
        }

        if(!this._dbgFile.csyms.length) {
            this.sendEvent('message', 'error', `
csyms are missing from your debug file. Did you add the -g switch to your linker
and compiler? (CFLAGS and LDFLAGS at the top of the standard CC65 Makefile)
`);
        }

        return this._dbgFile;
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

    // Comm

    public sendEvent(event: string, ... args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
