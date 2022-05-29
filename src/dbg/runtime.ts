import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as hasbin from 'hasbin';
import which from 'which';
import * as typeQuery from '../lib/type-query';
import _first from 'lodash/fp/first';
import _flow from 'lodash/fp/flow';
import _flatten from 'lodash/fp/flatten';
import _last from 'lodash/fp/last';
import _map from 'lodash/fp/map';
import _uniq from 'lodash/fp/uniq';
import _uniqBy from 'lodash/fp/uniqBy';
import * as path from 'path';
import * as tmp from 'tmp';
import * as util from 'util';
import * as bin from './binary-dto';
import { CallStackManager } from './call-stack-manager';
import * as debugFile from '../lib/debug-file';
import * as debugUtils from '../lib/debug-utils';
import * as disassembly from '../lib/disassembly';
import { GraphicsManager } from './graphics-manager';
import * as mapFile from '../lib/map-file';
import * as metrics from '../lib/metrics';
import { VariableData, VariableManager } from './variable-manager';
import { ViceGrip } from './vice-grip';
import { MesenGrip } from './mesen-grip';
import { __basedir } from '../basedir';
import { AbstractGrip } from './abstract-grip';
import { AppleWinGrip } from './applewin-grip';

export interface CC65ViceBreakpoint {
    id: number;
    line: debugFile.SourceLine;
    // FIXME This should probably be preparsed
    logMessage: string | undefined;
    // FIXME This should probably be preparsed
    condition: string | undefined;
    emulatorIndex: number;
    verified: boolean;
}

export interface Registers {
    a: number;
    x: number;
    y: number;
    sp: number;
    pc: number;
    fl: number;
    lin: number;
    cyc: number;
}

const UPDATE_INTERVAL = 1000;

interface _lineData {
    line: number
    logMessage?: string
    condition?: string
}

/**
 * A CC65Vice runtime with debugging functionality.
 * This could be considered the debugger's main "API" and should be kept free of
 * too much VS UI-specific BS. The test harness needs to be able to utilize it
 * easily.
 */
export class Runtime extends EventEmitter {
    public _dbgFile: debugFile.Dbgfile;

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
    private _graphicsManager : GraphicsManager;

    private _breakPoints : CC65ViceBreakpoint[] = [];

    private _registers : Registers;

    // since we want to send breakpoint events, we will assign an id to every event
    // so that the frontend can match events with breakpoints.
    private _breakpointId = 1;

    private _emulatorRunning : boolean = false;
    private _emulatorStarting : boolean = true;
    public _emulator : AbstractGrip;

    private _colorTermPids: [number, number] = [-1, -1];
    private _runAhead: boolean;
    /**
     * Completely prevent events from having any impact on the runtime state.
     * This is used to prevent running the machine state ahead from interfering
     * with the stack trace or registers.
     */
    private _ignoreEvents: boolean = false;

    /**
     * Setting this allows machine events to be properly handled, but will
     * prevent them from updating the execution position in the editor.
     */
    private _silenceEvents: boolean = false;

    private _screenUpdateTimer: NodeJS.Timeout | undefined;
    private _terminated: boolean = false;
    private _attachProgram: string | undefined;

    private _registerMeta : {[key: string]: bin.SingleRegisterMeta };
    private _bankMeta : {[key: string]: bin.SingleBankMeta };
    private _userBreak: CC65ViceBreakpoint | undefined;
    private _execHandler: debugUtils.ExecHandler;
    private _machineType: debugFile.MachineType;
    constructor(execHandler: debugUtils.ExecHandler) {
        super();
        this._execHandler = execHandler;
    }

    /**
     * Attach to an already running program
     * @param port Binary monitor port
     * @param stopOnEntry Stop after attaching
     * @param stopOnExit Stop after hitting the end of main
     * @param program Program path
     * @param runAhead Step ahead one frame when stopping
     * @param machineType Manually set machine type
     * @param debugFilePath Manual path to debug file
     * @param mapFilePath Manual path to map file
     */
    public async attach(
        port: number,
        buildCwd: string,
        stopOnEntry: boolean,
        stopOnExit: boolean,
        runAhead: boolean,
        program?: string,
        machineType?: debugFile.MachineType,
        debugFilePath?: string,
        mapFilePath?: string
    ) {
        metrics.event('runtime', 'attach');

        this._attachProgram = program;

        await this._preStart(buildCwd, stopOnExit, runAhead, program, machineType, debugFilePath, mapFilePath);

        console.time('emulator')

        await this._emulator.connect(port);

        await this._postEmulatorStart();

        // Try to determine if we are loaded and wait if not
        await this._attachWait();

        console.timeEnd('emulator');

        await this._postFullStart(stopOnEntry);
    }

    private async _postEmulatorStart() : Promise<void> {
        this._emulator.on('error', (res) => {
            console.error(res);
        })

        this._emulator.once('end', () => this.terminate());

        const [registersAvailable, banksAvailable] = await Promise.all([
            this._emulator.execBinary({
                type: bin.CommandType.registersAvailable,
                memspace: bin.EmulatorMemspace.main,
            }),
            this._emulator.execBinary({
                type: bin.CommandType.banksAvailable,
            })
        ]);

        registersAvailable.registers.forEach(x => this._registerMeta[x.name] = x);
        banksAvailable.banks.forEach(x => this._bankMeta[x.name] = x);

        await this._graphicsManager.postEmulatorStart(this, this._bankMeta['io'], this._bankMeta['ram'], Object.values(this._bankMeta), Object.values(this._registerMeta)),
        await this._setupEmulatorEventHandler();

        await this._emulator.execBinary({
            type: bin.CommandType.checkpointSet,
            startAddress: this._dbgFile.entryAddress,
            endAddress: this._dbgFile.entryAddress,
            stop: true,
            enabled: true,
            operation: bin.CpuOperation.exec,
            temporary: false,
        });

        await this._updateUI();
    }

    private _updateCurrentAddress(address: number) : void {
        this._currentAddress = address;
        this._currentPosition = debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, address);
    }

    private async _attachWait() : Promise<void> {
        if(!this._dbgFile.codeSeg) {
            return;
        }

        const scopes = this._dbgFile.scopes.filter(x => x.codeSpan && x.name.startsWith("_") && x.size > disassembly.maxOpCodeSize);
        const firstLastScopes = _uniq([_first(scopes)!, _last(scopes)!]);

        if(!await this._validateLoad(firstLastScopes)) {
            this.sendMessage({
                level: debugUtils.ExtensionMessageLevel.information,
                content: 'Waiting for program to start...',
                items: this._attachProgram ? ['Autostart'] : [],
            });
            await this._emulator.withAllBreaksDisabled(async () => {
                const storeCmds = _flow(
                    _map((x: typeof firstLastScopes[0]) => [ x.codeSpan!.absoluteAddress, x.codeSpan!.absoluteAddress + x.codeSpan!.size - 1]),
                    _flatten,
                    _map((x: number) => {
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
                )(firstLastScopes);

                const storeReses : bin.CheckpointInfoResponse[] = await this._emulator.multiExecBinary(storeCmds);

                this._ignoreEvents = true;
                do {
                    await this.continue();
                    await this._emulator.waitForStop();
                } while(!await this._validateLoad(firstLastScopes))
                this._ignoreEvents = false;

                const delCmds : bin.CheckpointDeleteCommand[] = storeReses
                    .map(x => ({
                            type: bin.CommandType.checkpointDelete,
                            id: x.id,
                    }));
                await this._emulator.multiExecBinary(delCmds);
            });

            this.sendMessage({
                level: debugUtils.ExtensionMessageLevel.information,
                content: 'Program started.',
            })
        }

        await this.continue();
        await this._emulator.ping();
    }

    private async _validateLoad(scopes: debugFile.Scope[]) : Promise<boolean> {
        if(!this._dbgFile.codeSeg) {
            return true;
        }

        if(!scopes.length) {
            return true;
        }

        for(const scope of scopes) {
            const mem = await this._emulator.getMemory(scope.codeSpan!.absoluteAddress, scope.size);
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
        program?: string,
        machineType?: debugFile.MachineType,
        debugFilePath?: string,
        mapFilePath?: string
    ) : Promise<void> {
        console.time('preStart');

        this._terminated = false;
        this._stopOnExit = stopOnExit;

        this.sendMessage({
            level: debugUtils.ExtensionMessageLevel.warning,
            content: `To avoid problems, make sure you're using VICE 3.6 or later.`
        });

        this._runAhead = !!runAhead;
        console.time('loadSource');

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

        console.time('parseSource');

        await Promise.all([
            this._loadDebugFile(debugFilePath, buildCwd),
            this._loadMapFile(mapFilePath),
        ]);

        this._machineType = machineType || this._dbgFile.machineType;

        console.log('Entry address: ', this._dbgFile.entryAddress.toString(16))

        console.timeEnd('parseSource');

        console.timeEnd('loadSource');

        console.time('preEmulator');

        this._resetRegisters();

        console.timeEnd('preEmulator');

        if(this._machineType == debugFile.MachineType.apple2) {
            this.sendMessage({
                level: debugUtils.ExtensionMessageLevel.warning,
                content: "Apple2 support is not finished yet!"
            });
            this._runAhead = false;
            this._emulator = new AppleWinGrip(
                <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts)),
            );
        }
        else if(this._machineType == debugFile.MachineType.nes) {
            this._runAhead = false;
            this._emulator = new MesenGrip(
                <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts)),
            );
        }
        else if(this._machineType == debugFile.MachineType.c64) {
            this._emulator = new ViceGrip(
                <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts)),
            );
        }
        else {
            this._runAhead = false;
            this._emulator = new ViceGrip(
                <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts)),
            );
        }

        this._registerMeta = {};
        this._bankMeta = {};

        this._callStackManager = new CallStackManager(this._emulator, this._mapFile, this._dbgFile);

        const graphicsManager = new GraphicsManager(this._emulator, this._machineType);

        const variableManager = new VariableManager(
            this._emulator,
            this._dbgFile.codeSeg,
            this._dbgFile.segs.find(x => x.name == "ZEROPAGE"),
            this._dbgFile.labs
        );

        console.time('graphics+variables');

        const messages = await variableManager.preStart(buildCwd, this._dbgFile);
        for(const msg of messages) {
            this.sendMessage(msg);
        }

        console.timeEnd('graphics+variables');

        this._emulatorStarting = true;

        this._variableManager = variableManager;
        this._graphicsManager = graphicsManager;

        console.timeEnd('preStart');
    }

    /**
     * Start running the given program
     * @param port Binary monitor port
     * @param program Program path
     * @param machineType Manually set machine type
     * @param buildCwd Build path
     * @param stopOnEntry Stop after hitting main
     * @param stopOnExit Stop after hitting the end of main
     * @param runAhead Skip ahead one frame
     * @param viceDirectory The path with all the VICE executables
     * @param mesenDirectory The path with all the Mesen executables
     * @param appleWinDirectory The path with all the AppleWin executables
     * @param emulatorArgs Extra arguments to pass to VICE
     * @param preferX64OverX64sc Use x64 when appropriate
     * @param debugFilePath Manual path to debug file
     * @param mapFilePath Manual path to map file
     * @param labelFilePath Manual path to label file
     */
    public async start(
        port: number,
        program: string,
        buildCwd: string,
        stopOnEntry: boolean,
        stopOnExit: boolean,
        runAhead: boolean,
        machineType?: debugFile.MachineType,
        viceDirectory?: string,
        mesenDirectory?: string,
        appleWinDirectory?: string,
        emulatorArgs?: string[],
        preferX64OverX64sc?: boolean,
        debugFilePath?: string,
        mapFilePath?: string,
        labelFilePath?: string,
    ) : Promise<void> {
        metrics.event('runtime', 'start');

        await this._preStart(buildCwd, stopOnExit, runAhead, program, machineType, debugFilePath, mapFilePath)

        console.time('emulator');

        if(!labelFilePath) {
            labelFilePath = await this._getLabelsPath(program);
        }

        await this._emulator.start(
            port,
            path.dirname(program),
            this._machineType,
            await this._getEmulatorPath(viceDirectory, mesenDirectory, appleWinDirectory, !!preferX64OverX64sc),
            emulatorArgs,
            labelFilePath
        );

        console.timeEnd('emulator');

        try {
            await this._emulator.autostart(program);
        }
        catch {
            throw new Error('Could not autostart program. Do you have the correct path?');
        }

        await this._postEmulatorStart();

        await this.continue();
        await this._emulator.waitForStop(this._dbgFile.entryAddress, undefined, true);

        await this._postFullStart(stopOnEntry);
    }

    private async _postFullStart(stopOnEntry: boolean) : Promise<void> {
        console.time('postStart')

        if(this._emulator.textPort) {
            let command = process.execPath;
            let args = [__basedir + '/../dist/monitor.js', '--ms-enable-electron-run-as-node', '-remotemonitoraddress', `127.0.0.1:${this._emulator.textPort}`, `-condensedtrace`];
            if(process.platform == 'win32') {
                args.unshift(command);
                command = __basedir + '/../dist/mintty/bin_win32_' + process.arch + '/mintty';
            }

            command = path.normalize(command);

            this._colorTermPids = await this._execHandler(command, args, {
                title: 'Text Monitor',
            });
        }

        await Promise.all([
            this._callStackManager.reset(this._currentAddress, this._currentPosition),
            this._setExitGuard(),
            this._guardCodeSeg(),
            this._variableManager.postStart(),
        ]);

        await this.pause();

        this._emulatorStarting = false;

        await this._verifyBreakpoints();

        if (stopOnEntry) {
            // We don't do anything here since the emulator should already be in the
            // correct position after thestartup routine.
            this.sendEvent('stopOnEntry');
        } else {
            // we just start to run until we hit a breakpoint or an exception
            await this.continue();
        }

        this._screenUpdateTimer = setTimeout(() => this._screenUpdateHandler(), UPDATE_INTERVAL);

        this.sendEvent('started');

        console.timeEnd('postStart');
    }

    private async _screenUpdateHandler() : Promise<void> {
        await this._emulator.lock(async() => {
            try {
                const wasRunning = this._emulatorRunning;

                if(wasRunning) {
                    await this._updateUI();
                    await this.continue();
                }
            }
            catch(e) {
                console.error(e);
            }

            this._screenUpdateTimer = setTimeout(() => this._screenUpdateHandler(), UPDATE_INTERVAL);
        });
    }

    private async _silenced<T>(fn: () => Promise<T>) : Promise<T> {
        return new Promise<T>((res, rej) => {
            this._silenceEvents = true;
            const timeout = setTimeout(() => {
                this._silenceEvents = false;
            }, 5000);

            fn().then((t) => {
                this._silenceEvents = false;
                clearTimeout(timeout);
                res(t);
            }, (err) => {
                this._silenceEvents = false;
                clearTimeout(timeout);
                rej(err);
            });
        });
    }

    private async _updateUI() : Promise<void> {
        await this._silenced(async() => {
            await this._emulator.ping();
            await this._graphicsManager.updateUI(this);
        });
    }

    public async updateMemoryOffset(offset: number) {
        const wasRunning = this._emulatorRunning;

        await this._graphicsManager.updateMemoryOffset(offset);
        if(!wasRunning) {
            await this._graphicsManager.updateMemory(this);
        }
    }

    public async updateMemoryBank(bank: number) {
        const wasRunning = this._emulatorRunning;

        await this._graphicsManager.updateMemoryBank(bank);
        if(!wasRunning) {
            await this._graphicsManager.updateMemory(this);
        }
    }

    public async enableStats() : Promise<void> {
        await this._graphicsManager.enableStats();
    }

    public async action(name: string) {
        if(name == 'Autostart' && this._attachProgram) {
            await this._emulator.autostart(this._attachProgram);
            await this.continue();
        }
        else {
            throw new Error('Invalid action ' + name);
        }
    }

    public async keypress(key: string) : Promise<void> {
        const wasRunning = this._emulatorRunning;
        await this._silenced(async() => {
            await this._emulator.execBinary({
                type: bin.CommandType.keyboardFeed,
                text: key,
            });
        });
        if(wasRunning) {
            await this.continue();
        }
    }

    public async controllerSet(buttonValue: number) : Promise<void> {
        const wasRunning = this._emulatorRunning;

        let port = 1;
        if(this._machineType == debugFile.MachineType.nes) {
            port = 0;
        }

        await this._silenced(async() => {
            await this._emulator.joyportSet(port, buttonValue);
        });
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
        const resExits = await this._emulator.multiExecBinary(exits) as bin.CheckpointInfoResponse[];

        for(const exit of resExits) {
            this._exitIndexes.push(exit.id);
        }
    }

    private async _guardCodeSeg() : Promise<void> {
        if(!this._dbgFile.codeSeg) {
            return;
        }

        const res = await this._emulator.execBinary({
            type: bin.CommandType.checkpointSet,
            operation: bin.CpuOperation.store,
            startAddress: this._dbgFile.codeSeg.start,
            endAddress: this._dbgFile.codeSeg.start + this._dbgFile.codeSeg.size - 1,
            enabled: true,
            stop: true,
            temporary: false,
        });
        this._codeSegGuardIndex = res.id;
    }

    private async _loadMapFile(filename: string | undefined) : Promise<void> {
        try {
            if(!filename) {
                throw new Error();
            }

            const text = await fs.promises.readFile(filename, 'utf8');
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

    /**
     * Note: only call this if you actually want the UI to think you've resumed.
     */
    public async continue(reverse = false) {
        await this._emulator.exit();
        !this._emulatorStarting && this.sendEvent('continued');
    }

    public async next(reverse = false, event = 'stopOnStep') : Promise<void> {
        await this._emulator.lock(async () => {
            if(this._emulatorRunning) {
                return;
            }

            console.log('Nexting...')
            console.time('next');

            await this._emulator.withAllBreaksDisabled(async () => {
                // Find the next source line and continue to it.
                const nextLine = this._getNextLine();
                if(!nextLine || (nextLine.file && nextLine.file.type == debugFile.SourceFileType.Assembly)) {
                    await this._emulator.execBinary({
                        type: bin.CommandType.advanceInstructions,
                        stepOverSubroutines: true,
                        count: 1,
                    });
                }
                else if (this._getCurrentScope() != this._getScope(nextLine)) {
                    await this._stepOut(event);
                }
                else {
                    const nextAddress = nextLine.span!.absoluteAddress;
                    let breaks : bin.CheckpointInfoResponse[] | null;
                    if(breaks = await this._setLineGuard(this._currentPosition, nextLine)) {
                        await this.continue();
                        await this._emulator.waitForStop();

                        const delBrks : bin.CheckpointDeleteCommand[] = breaks.map(x => ({
                            type: bin.CommandType.checkpointDelete,
                            id: x.id,
                        }));

                        await this._emulator.multiExecBinary(delBrks);
                    }
                    else {
                        await this._emulator.execBinary({
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
            this.sendEvent(event);
        });


        console.timeEnd('next');
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

        return await this._emulator.multiExecBinary(setBreaks);
    }

    public async stepIn() : Promise<void> {
        await this._emulator.lock(async() => {
            if(this._emulatorRunning) {
                return;
            }

            if(!this._dbgFile.codeSeg) {
                return;
            }

            if(this._currentPosition.file && this._currentPosition.file.type == debugFile.SourceFileType.Assembly) {
                await Promise.all([
                    this._emulator.waitForStop(),
                    this._emulator.execBinary({
                        type: bin.CommandType.advanceInstructions,
                        stepOverSubroutines: false,
                        count: 1,
                    }),
                ]);
            }
            else {
                await this._callStackManager.withFrameBreaksEnabled(async () => {
                    const nextLine = this._getNextLine();
                    const breaks = await this._setLineGuard(this._currentPosition, nextLine);

                    await this.continue();
                    await this._emulator.waitForStop();

                    if(breaks) {
                        const delBrks : bin.CheckpointDeleteCommand[] = breaks.map(x => ({
                            type: bin.CommandType.checkpointDelete,
                            id: x.id,
                        }));

                        await this._emulator.multiExecBinary(delBrks);
                    }
                });
            }

            await this._doRunAhead();

            const args = [ null, this._currentPosition.file!.name, this._currentPosition.num, 0];
            this.sendEvent('stopOnStep', null, ...args);
        });
    }

    private async _stepOut(event = 'stopOnStep') : Promise<void> {
        if(this._emulatorRunning) {
            return;
        }

        if(!await this._callStackManager.returnToLastStackFrame()) {
            if(this._currentPosition.file && this._currentPosition.file.type == debugFile.SourceFileType.Assembly) {
                await Promise.all([
                    this._emulator.waitForStop(),
                    this._emulator.execBinary({
                        type: bin.CommandType.executeUntilReturn,
                    }),
                ]);
            }
            else {
                this.sendMessage({
                    level: debugUtils.ExtensionMessageLevel.warning,
                    content: 'Can\'t step out here!'
                });

                const args = [ null, this._currentPosition.file!.name, this._currentPosition.num, 0];
                this.sendEvent(event, null, ...args);
            }
        }
    }

    public async stepOut(event = 'stopOnStep') : Promise<void> {
        await this._emulator.lock(async() => {
            await this._stepOut();

            await this._doRunAhead();

            const args = [ null, this._currentPosition.file!.name, this._currentPosition.num, 0];
            this.sendEvent(event, 'console', ...args);
        });
    }

    public async pause() {
        await this._emulator.ping();
        await this._doRunAhead();
        const args = [ null, this._currentPosition.file!.name, this._currentPosition.num, 0];
        this.sendEvent('stopOnStep', null, ...args);
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

        this._emulator && await this._emulator.terminate();

        this._emulator = <any>null;

        await this.disconnect(false);

        this.sendEvent('end');

        this._terminated = true;
    }

    private async _cleanup() {
        this._callStackManager.cleanup();
        for(const path of this._breakPoints.map(x => x.line.file!.name)) {
            this.clearBreakpoints(path);
        }
    }

    public async disconnect(cleanup: boolean = true) {
        this._screenUpdateTimer && clearTimeout(this._screenUpdateTimer);

        const pids = this._colorTermPids;
        debugUtils.delay(1000).then(() => {
            try {
                for(const pid of _uniq(pids)) {
                    pid > -1 && process.kill(pid, 0) && process.kill(pid, "SIGKILL");
                }
            }
            catch {}
        }).catch(() => {});
        this._colorTermPids = [-1, -1];

        if(this._emulator) {
            cleanup && this._cleanup();
            await this._emulator.disconnect();
        }

        this._emulator = <any>undefined;

        this._emulatorRunning = false;

        this._stopOnExit = false;
        this._exitQueued = false;
        this._userBreak = undefined;

        this._callStackManager = <any>undefined;
        this._variableManager = <any>undefined;
        this._graphicsManager = <any>undefined;

        this._dbgFile = <any>null;
        this._mapFile = <any>null;
        this._dbgFilePromise = new Promise((res, rej) => {
            this._dbgFileResolved = res;
            this._dbgFileRejected = rej;
        });
    }

    public async getMemory(addr: number, length: number) : Promise<Buffer> {
        return await this._emulator.getMemory(addr, length);
    }

    public async setMemory(addr: number, memory: Buffer) : Promise<void> {
        await this._emulator.setMemory(addr, memory);
    }

    // Breakpoints

    private async _verifyBreakpoints() : Promise<void> {
        if(!this._dbgFile || !this._emulator || this._emulatorStarting) {
            return;
        }

        return await this._emulator.lock(async () => {
            const wasRunning = this._emulatorRunning;

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

            await this._silenced(async () => {
                await this._emulator.ping();
                const brks : bin.CheckpointInfoResponse[] = await this._emulator.multiExecBinary(checkCmds);

                for(const brk of brks) {
                    const bp = this._breakPoints.find(x => !x.verified && x.line.span && x.line.span.absoluteAddress == brk.startAddress)
                    if(!bp) {
                        continue;
                    }

                    bp.emulatorIndex = brk.id;
                    bp.verified = true;
                    this.sendEvent('breakpointValidated', bp);
                }
            });

            if(wasRunning) {
                await this._emulator.exit();
                this._emulatorRunning = true;
            }
        });
    }

    public getBreakpointLength() : number {
        return this._breakPoints.length;
    }

    public getBreakpoints(p: string, line: number): number[] {
        return this._breakPoints.filter(x => x.line.num == line && x.line.file && !path.relative(x.line.file.name, p)).map(x => x.line.num);
    }

    public async setBreakPoint(breakPath: string, ...lines: (_lineData | number)[]) : Promise<{[key:string]:CC65ViceBreakpoint}> {
        await this._dbgFilePromise;

        let lineSyms : { [key:string]: { sym: debugFile.SourceLine, logMessage: string | undefined, condition: string | undefined } | null } = {};
        for(const l of lines) {
            let line : _lineData;
            if(typeof l === 'number') {
                line = { line: l };
            }
            else {
                line = l;
            }

            const lineSym = this._dbgFile.lines.find(x => x.num == line.line && !path.relative(breakPath, x.file!.name));
            if(!lineSym){
                lineSyms[line.line] = null;
                continue;
            }

            lineSyms[line.line] = {
                sym: lineSym,
                logMessage: line.logMessage,
                condition: line.condition,
            };
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
                    type: debugFile.SourceFileType.C
                };
                lineSym = {
                    sym: {
                        count: 0,
                        id: 0,
                        num: parseInt(line),
                        span: undefined,
                        spanId: 0,
                        file: fil,
                        fileId: 0,
                        type: 0,
                    },
                    logMessage: undefined,
                    condition: undefined,
                };
            }

            const bp = <CC65ViceBreakpoint> { verified: false, logMessage: lineSym.logMessage, condition: lineSym.condition, line: lineSym.sym, emulatorIndex: -1, id: this._breakpointId++ };
            bps[line] = bp;
        }
        this._breakPoints.push(...Object.values(bps))

        await this._verifyBreakpoints();

        return bps;
    }

    public async clearBreakpoints(p : string): Promise<void> {
        if(this._emulatorStarting) {
            return;
        }

        await this._emulator.lock(async () => {
            const wasRunning = this._emulatorRunning;
            await this._silenced(async() => {
                await this._emulator.ping();

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

                    if(bp.emulatorIndex <= 0) {
                        continue;
                    }

                    dels.push({
                        type: bin.CommandType.checkpointDelete,
                        id: bp.emulatorIndex,
                    });
                }

                dels = _uniqBy(x => x.id, dels);

                if(dels.length) {
                    await this._emulator.multiExecBinary(dels);
                }
            });
            if(wasRunning) {
                await this._emulator.exit();
                this._emulatorRunning = true;
            }
        });
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

    public async getRegisterVariables() : Promise<VariableData[]> {
        const res = await this._emulator.execBinary({
            type: bin.CommandType.registersGet,
            memspace: bin.EmulatorMemspace.main,
        });

        const regs : VariableData[] = [];
        for(const reg of res.registers) {
            let name = reg.id.toString(16);
            let size = 1;
            for(const k in this._registerMeta) {
                const meta = this._registerMeta[k];

                if(meta.id == reg.id) {
                    name = k;
                    size = meta.size / 8;
                    break;
                }
            }

            const buf = Buffer.alloc(2);
            buf.writeUInt16LE(reg.value);
            regs.push({
                name: name,
                type: '',
                addr: reg.id,
                value: typeQuery.renderValue(typeQuery.parseTypeExpression(size > 1 ? 'unsigned int' : 'unsigned char'), buf),
            });
        }

        return regs;
    }

    public async evaluateLogMessage(exp: string) : Promise<void> {
        try {
            const rex = /(\{.*?\})/g;
            const frags = exp.split(rex);
            const reses : string[] = [];
            for(const frag of frags) {
                let res : string;
                if(rex.test(frag)) {
                    const subexp = frag.substr(1, frag.length - 2);
                    res = (await this.evaluate(subexp)).value;
                }
                else {
                    res = frag;
                }

                reses.push(res);
            }

            this.sendEvent('output', 'stdout', reses.join('') + '\n');
        }
        catch {}
    }

    public async evaluate(exp: string) : Promise<VariableData> {
        const currentScope = this._getCurrentScope();
        return this._variableManager.evaluate(exp, currentScope);
    }

    public async setRegisterVariable(name: string, value: number) : Promise<VariableData> {
        const meta = this._registerMeta[name];
        if(!meta) {
            throw new Error('Invalid variable name');
        }

        const res = await this._emulator.execBinary({
            type: bin.CommandType.registersSet,
            memspace: bin.EmulatorMemspace.main,
            registers: [
                {
                    id: meta.id,
                    value,
                }
            ]
        })

        const reg = res.registers.find(x => x.id == meta.id)!;
        let size = meta.size / 8;

        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(reg.value);

        return {
            type: '',
            name: name,
            addr: reg.id,
            value: typeQuery.renderValue(typeQuery.parseTypeExpression(size > 1 ? 'unsigned int' : 'unsigned char'), buf),
        };
    }

    public async setGlobalVariable(name: string, value: number) : Promise<VariableData | undefined> {
        return await this._variableManager.setGlobalVariable(name, value);
    }

    public async getStaticVariables() : Promise<VariableData[]> {
        const currentScope = this._getCurrentScope();
        return await this._variableManager.getStaticVariables(currentScope);
    }

    public async getScopeVariables() : Promise<VariableData[]> {
        const currentScope = this._getCurrentScope()
        return await this._variableManager.getScopeVariables(currentScope);
    }

    public async getGlobalVariables() : Promise<VariableData[]> {
        return await this._variableManager.getGlobalVariables();
    }

    public async getTypeFields(addr: number, typeName: string) : Promise<VariableData[]> {
        return await this._variableManager.getTypeFields(addr, typeName);
    }

    private _getScope(line: debugFile.SourceLine) : debugFile.Scope | undefined {
        return this._dbgFile.scopes
            .find(x => x.codeSpan &&
                x.codeSpan.absoluteAddress <= line.span!.absoluteAddress
                && line.span!.absoluteAddress < x.codeSpan.absoluteAddress + x.codeSpan.size
            );
    }

    private _getCurrentScope() : debugFile.Scope | undefined {
        return this._getScope(this._currentPosition);
    }

    private static async _which(exePath: string): Promise<string> {
        // Helper resolves to 'true' if the given file path can be read from this process.
        const canAccess = (file) => new Promise((accept) => {
            fs.access(file, fs.constants.R_OK, (err) => {
                accept(!err);
            });
        });

        exePath = path.normalize(exePath);

        // When probing for an executable we need to consider three special cases:
        //
        //   1.  If the given 'exePath' contains only a file name (as opposed to a full path)
        //       then we should search for the binary at the paths specified in 'process.env.PATH'.
        //
        //   2.  On Windows, we need to include the various executable extensions (.exe, .com, etc.)
        //       as specified by 'process.env.PATHEXT'.
        //
        //   3.  On Linux, 'Mesen.exe' is a Mono application and therefore does not have executable
        //       permissions (i.e., it lacks '+x').
        //
        // The imported 'which()' module handles cases 1 & 2, but rejects 'Mesen.exe' on Linux.
        // Therefore we use a combination of 'fs.access()', 'which()', and 'hasbin()' as noted below.

        // First we uses a simple 'fs.access()' check, which does not search the $PATH or handle
        // the Windows executable extensions (.exe, .com, etc.), but does handle the case where
        // 'exePath' is a full path to 'Mesen.exe'.
        if (await canAccess(exePath)) {
            return exePath;
        }

        try {
            // If the 'fs.access()' check above did not find the binary we then invoke 'which()'.
            // This handles both executable extensions (.exe, .com, etc.) on Windows and will
            // search $PATH when given only a file name.
            return await which(exePath);
        } catch (whichErr) {
            // The last case we need to consider is when 'mesenDirectory' was not configured.
            // In this case, 'which()' may reject 'Mesen.exe' while searching the $PATH because
            // 'Mesen.exe' lacks executable permissions on Linux.
            //
            // Here we fall back on the imported 'hasbin()' module to repeat the $PATH search.
            // This works on Linux and Windows, but does not handle the case where 'exePath' is
            // the full path to the desired binary.  (Hence the prior 'fs.access()' and 'which()'
            // checks).
            return new Promise((accept, reject) => {
                hasbin.first([exePath],
                    (result) => result
                        ? accept(result)        // On success return the name found in path (e.g., 'xpet.exe')
                        : reject(whichErr));    // On failure preserve the error message from 'which()'
            });
        }
    }

    // FIXME Push down into grip?
    private async _getEmulatorPath(viceDirectory: string | undefined, mesenDirectory: string | undefined, appleWinDirectory: string | undefined, preferX64OverX64sc: boolean) : Promise<string> {
        let emulatorBaseName : string;
        let emulatorPath : string;
        const mt = this._machineType;
        if(mt == debugFile.MachineType.nes) {
            emulatorBaseName = 'Mesen.exe';

            if(mesenDirectory) {
                emulatorPath = path.join(mesenDirectory, emulatorBaseName);
            }
            else {
                emulatorPath = emulatorBaseName;
            }
        }
        else if(mt == debugFile.MachineType.apple2) {
            emulatorBaseName = 'sa2'

            if(appleWinDirectory) {
                emulatorPath = path.join(appleWinDirectory, emulatorBaseName);
            }
            else {
                emulatorPath = emulatorBaseName;
            }
        }
        else {
            if(mt == debugFile.MachineType.c128) {
                emulatorBaseName = 'x128';
            }
            else if(mt == debugFile.MachineType.cbm5x0) {
                emulatorBaseName = 'xcbm5x0';
            }
            else if(mt == debugFile.MachineType.pet) {
                emulatorBaseName = 'xpet';
            }
            else if(mt == debugFile.MachineType.plus4) {
                emulatorBaseName = 'xplus4';
            }
            else if(mt == debugFile.MachineType.vic20) {
                emulatorBaseName = 'xvic';
            }
            else {
                emulatorBaseName = preferX64OverX64sc ? 'x64' : 'x64sc';
            }

            if(viceDirectory) {
                emulatorPath = path.join(viceDirectory, emulatorBaseName);
            }
            else {
                emulatorPath = emulatorBaseName;
            }
        }

        try {
            emulatorPath = await Runtime._which(emulatorPath);
        }
        catch (e) {
            throw new Error(`Couldn't find the emulator. Make sure your \`cc65vice.viceDirectory\` or \`cc65vice.mesenDirectory\` user setting is pointing to the directory containing emulator executables. ${emulatorPath} ${e}`);
        }

        return emulatorPath;
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
            await fs.promises.stat(filename);
            return filename;
        }
        catch {
            return undefined;
        }
    }

    private async _eventHandler(e: bin.Response) : Promise<void> {
        if(this._ignoreEvents) {
            return;
        }
        else if(e.type == bin.ResponseType.checkpointInfo) {
            // Important note: For performance reasons, brk is a shared object.
            // If you add any references to it after
            // an async call you MUST duplicate it before,
            // otherwise it will be overwritten.
            if(!e.hit) {
                return;
            }

            const startAddress = e.startAddress;

            const line = () => debugUtils.getLineFromAddress(this._breakPoints, this._dbgFile, startAddress);
            this._callStackManager.addFrame(e, line);

            let index = e.id;

            // Is a breakpoint
            if(e.stop) {
                if(this._codeSegGuardIndex == index) {
                    const guard = this._codeSegGuardIndex;
                    this._codeSegGuardIndex = -1;
                    await this._emulator.execBinary({
                        type: bin.CommandType.checkpointDelete,
                        id: guard,
                    });
                    this.sendMessage({
                        level: debugUtils.ExtensionMessageLevel.error,
                        content: 'CODE segment was modified. Your program may be broken!'
                    });
                }
                else if (this._exitIndexes.includes(index)) {
                    if(!this._stopOnExit) {
                        await this.terminate();
                        return;
                    }
                    else {
                        this._exitQueued = true;
                    }
                }
                else {
                    // We save this event for later, because it happens before the stop
                    this._userBreak = this._breakPoints.find(x => x.emulatorIndex == index);
                }

                this._emulatorRunning = false;
            }
        }
        else if(e.type == bin.ResponseType.registerInfo) {
            this._updateRegisters(e.registers);
        }
        else if(e.type == bin.ResponseType.stopped) {
            this._emulatorRunning = false;

            this._updateCurrentAddress(e.programCounter);

            const args = [ null, this._currentPosition.file!.name, this._currentPosition.num, 0]
            const sendEvents = !this._emulatorStarting && !this._silenceEvents

            sendEvents && this.sendEvent('output', 'console', ...args);

            if(this._exitQueued) {
                await this._doRunAhead();
                sendEvents && this.sendEvent('stopOnExit', null, ...args);
            }
            else if(this._userBreak) {
                await this._doRunAhead();
                if(this._userBreak.logMessage) {
                    await this.evaluateLogMessage(this._userBreak.logMessage);
                }
                if(this._userBreak.condition) {
                    try {
                        const res = await this.evaluate(this._userBreak.condition);
                        if(res.value == "true") {
                            throw new Error("Hit break");
                        }
                        else {
                            await this._emulator.exit();
                        }
                    }
                    catch {
                        sendEvents && this.sendEvent('stopOnBreakpoint', null, ...args);
                    }
                }
                else {
                    sendEvents && this.sendEvent('stopOnBreakpoint', null, ...args);
                }
                this._userBreak = undefined;
            }
            else {
                sendEvents && this.sendEvent('stopOnStep', null, ...args);
            }
        }
        else if(e.type == bin.ResponseType.resumed) {
            if(this._exitQueued) {
                await this.terminate();
                return;
            }

            this._emulatorRunning = true;
            this._updateCurrentAddress(e.programCounter);

            if(!this._emulatorStarting && !this._silenceEvents) {
                this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);
            }
        }
    }

    private _updateRegisters(rr: bin.SingleRegisterInfo[]) : void {
        const meta = this._registerMeta;
        const r = this._registers;
        for(const reg of rr) {
            for(const k in meta) {
                if(meta[k].id != reg.id) {
                    continue;
                }

                const lower = k.toLowerCase();
                r[lower] = reg.value;

                if(k == 'SP') {
                    this._callStackManager.setCpuStackTop(0x100 + r.sp);
                }

                break;
            }
        }
    }

    private async _setupEmulatorEventHandler() {
        this._emulator.on(0xffffffff.toString(16), async e => this._eventHandler(e));
    }

    private async _doRunAhead() : Promise<void>{
        await this._updateUI();

        if(!this._runAhead) {
            return;
        }

        console.log('runahead start');
        console.time('runahead');

        const dumpFileName : string = await util.promisify(tmp.tmpName)({ prefix: 'cc65-vice-'});
        await this._emulator.execBinary({
            type: bin.CommandType.dump,
            saveDisks: false,
            saveRoms: false,
            filename: dumpFileName,
        });

        const oldLine = this._registers.lin;
        this._ignoreEvents = true;
        await this._emulator.withAllBreaksDisabled(async() => {
            // Try not to step through the serial line
            // to avoid a VICE bug with snapshots
            // messing up fs access
            const serialLineResumeAddresses = {
                [debugFile.MachineType.c128]: 0xEDAB,
                [debugFile.MachineType.c64]: 0xEDAB,
                [debugFile.MachineType.plus4]: 0xE1E7,
                [debugFile.MachineType.vic20]: 0xEEB2,
            };
            const serialLineResumeAddress = serialLineResumeAddresses[this._machineType];
            let serialLineCheckpoint : bin.CheckpointInfoResponse | undefined;
            if(serialLineResumeAddress) {
                serialLineCheckpoint = await this._emulator.execBinary({
                    type: bin.CommandType.checkpointSet,
                    startAddress: serialLineResumeAddress,
                    endAddress: serialLineResumeAddress,
                    stop: true,
                    enabled: true,
                    operation: bin.CpuOperation.exec,
                    temporary: false,
                });
            }

            const brkRes = await this._emulator.execBinary({
                type: bin.CommandType.checkpointSet,
                startAddress: 0x0000,
                endAddress: 0xffff,
                stop: true,
                enabled: true,
                operation: bin.CpuOperation.exec,
                temporary: false,
            });
            await this._emulator.execBinary({
                type: bin.CommandType.conditionSet,
                condition: 'RL != $' + oldLine.toString(16),
                checkpointId: brkRes.id,
            });

            await this._emulator.exit();
            let stopped = await this._emulator.waitForStop();

            if(stopped.programCounter != serialLineResumeAddress) {
                await this._emulator.execBinary({
                    type: bin.CommandType.conditionSet,
                    condition: 'RL == $' + oldLine.toString(16),
                    checkpointId: brkRes.id,
                });

                await this._emulator.exit();
                await this._emulator.waitForStop();
            }

            await this._emulator.execBinary({
                type: bin.CommandType.checkpointDelete,
                id: brkRes.id,
            });
            if(serialLineCheckpoint) {
                await this._emulator.execBinary({
                    type: bin.CommandType.checkpointDelete,
                    id: serialLineCheckpoint.id,
                });
            }
        });
        this._ignoreEvents = false;

        await this._graphicsManager.updateRunAhead(this);

        const undumpRes = await this._emulator.execBinary({
            type: bin.CommandType.undump,
            filename: dumpFileName,
        });
        this._updateCurrentAddress(undumpRes.programCounter);

        await fs.promises.unlink(dumpFileName);

        this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.num, 0);

        console.timeEnd('runahead');
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
            this.sendMessage({
                level: debugUtils.ExtensionMessageLevel.error,
                content: `
csyms are missing from your debug file. Did you add the -g switch to your linker
and compiler? (CFLAGS and LDFLAGS at the top of the standard CC65 Makefile)
`
            });
        }

        return this._dbgFile;
    }

    private _resetRegisters() {
        this._registers = {
            a: 0xff,
            x: 0xff,
            y: 0xff,
            sp: 0xff,
            lin: 0xff,
            cyc: 0xff,
            pc: 0xffff,
            fl: 0xff,
        };
    }

    // Comm
    public sendMessage(msg: debugUtils.ExtensionMessage) {
        this.sendEvent('message', msg);
    }

    public sendEvent(event: string, ... args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
