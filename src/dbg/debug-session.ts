import * as child_process from 'child_process';
import * as colors from 'colors/safe';
import * as compile from '../lib/compile';
import _debounce from 'lodash/fp/debounce';
import _flatten from 'lodash/fp/flatten';
import { basename } from 'path';
import {
    Breakpoint, BreakpointEvent, ContinuedEvent, Event, InitializedEvent, Logger, logger,
    LoggingDebugSession, OutputEvent, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as debugUtils from '../lib/debug-utils';
import * as keyMappings from '../lib/key-mappings';
import { LaunchRequestArguments, LaunchRequestBuildArguments } from '../lib/launch-arguments';
import * as metrics from '../lib/metrics';
import { CC65ViceBreakpoint, Runtime } from './runtime';
import * as path from 'path';
import { __basedir } from '../basedir';
import { MachineType } from '../lib/debug-file';
const { Subject } = require('await-notify');

enum VariablesReferenceFlag {
    HAS_TYPE =       0x10000,
    FOLLOW_TYPE =    0x20000,
    FOLLOW_POINTER = 0x40000,
    EXPAND_DATA =    0x80000,
    EXPAND_BYTES =  0x100000,

    LOCAL =          0x0200000,
    GLOBAL =         0x0400000,
    //PARAM =        0x0800000,
    REGISTERS =      0x1000000,
    STATICS =        0x2000000,

    ADDR_MASK = 0x00FFFF,
}
// MAX = 0x8000000000000

/**
 * This class is designed to interface the debugger Runtime with Visual Studio's request model.
 */
export class CC65ViceDebugSession extends LoggingDebugSession {

    // we don't support multiple threads, so we can use a hardcoded ID for the default thread
    private static THREAD_ID = 1;

    private _runtime: Runtime;

    private _configurationDone = new Subject();
    private _addressTypes: {[address:string]: string} = {};
    private _tabby: boolean;
    private _keybuf: string[] = [];
    private _controllerBuf: keyMappings.joyportBits = 0;
    private _consoleType?: string;

    private _bounceBuf: () => void;
    private _bounceControllerBuf: () => void;

    private _execHandler : debugUtils.ExecHandler = (async (file, args, opts) => {
        if(!path.isAbsolute(file) && path.dirname(file) != '.') {
            file = path.join(__basedir, file);
        }

        file = path.normalize(file);

        if(process.platform == 'win32') {
            args.unshift('/S', '/C', file);
            file = 'cmd.exe';
            args = args.map(x => ['echo', '&&', '||', '>', '>>'].includes(x.trim()) ? x : `"${x}"`);
        }
        else if (![file, ...args].includes(process.execPath)) {
            args.unshift(__basedir + '/../exec-handler.js', '--ms-enable-electron-run-as-node', file);
            file = process.execPath;
        }

        return await new Promise<[number, number]>((res, rej) => {
            this.runInTerminalRequest({
                args: [file, ...args],
                cwd: opts.cwd || __basedir,
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
    });

    /**
    * Creates a new debug adapter that is used for one debug session.
    * We configure the default implementation of a debug adapter here.
    */
    public constructor() {
        super();

        // this debugger uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);

        this._runtime = new Runtime(
            <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts))
        );

        this._bounceBuf = _debounce(250, async () => {
            const keybuf = this._keybuf;
            this._keybuf = [];
            try {
                await this._runtime.keypress(keybuf.join(''));
            }
            catch(e) {
                console.error(e);
            }
        });

        this._bounceControllerBuf = _debounce(100, async () => {
            try {
                await this._runtime.controllerSet(this._controllerBuf);
            }
            catch(e) {
                console.error(e);
            }
        });

        // setup event handlers
        this._runtime.on('stopOnEntry', () => {
            const e = new StoppedEvent('entry', CC65ViceDebugSession.THREAD_ID);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('stopOnExit', () => {
            const e = new StoppedEvent('exit', CC65ViceDebugSession.THREAD_ID);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('stopOnStep', () => {
            const e = new StoppedEvent('step', CC65ViceDebugSession.THREAD_ID)
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('continued', () => {
            const e = new ContinuedEvent(CC65ViceDebugSession.THREAD_ID);
            //console.log(e)
            this.sendEvent(e);
        });
        this._runtime.on('stopOnBreakpoint', () => {
            const e = new StoppedEvent('breakpoint', CC65ViceDebugSession.THREAD_ID);
            //console.log(e)
            this.sendEvent(e);
        });
        this._runtime.on('stopOnDataBreakpoint', () => {
            const e = new StoppedEvent('data breakpoint', CC65ViceDebugSession.THREAD_ID)
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('stopOnException', () => {
            const e = new StoppedEvent('exception', CC65ViceDebugSession.THREAD_ID);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('breakpointValidated', (bp: CC65ViceBreakpoint) => {
            const e = new BreakpointEvent('changed', <DebugProtocol.Breakpoint>{ verified: bp.verified, id: bp.id });
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('palette', data => {
            const e = new Event('palette', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('banks', data => {
            const e = new Event('banks', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('registers', data => {
            const e = new Event('registers', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('runahead', data => {
            const e = new Event('runahead', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('screenText', data => {
            const e = new Event('screenText', data);
            //console.log(e);
            this.sendEvent(e);
        })
        this._runtime.on('sprites', data => {
            const e = new Event('sprites', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('memory', data => {
            const e = new Event('memory', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('current', data => {
            const e = new Event('current', data);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('started', () => {
            const e = new Event('started');
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('message', (msg: debugUtils.ExtensionMessage) => {
            const e = new Event('message', msg);
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('output', (category, text, filePath, line, column) => {
            const e: DebugProtocol.OutputEvent = new OutputEvent(text || '');

            e.body.category = category;

            if(filePath) {
                e.body.source = this.createSource(filePath);
            }
            if(line) {
                e.body.line = this.convertDebuggerLineToClient(line);
            }
            if(column) {
                e.body.column = this.convertDebuggerColumnToClient(column);
            }
            else {
                e.body.column = 0;
            }
            //console.log(e);
            this.sendEvent(e);
        });
        this._runtime.on('end', () => {
            this._runtime = <any>undefined;
            this.sendEvent(new TerminatedEvent());
        });
    }

    protected async customRequest(command: string, response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments, request: DebugProtocol.Request): Promise<void> {
        response.success = true;

        try {
            if(command == 'keyup') {
                const evt : KeyboardEvent = request.arguments;
                if(evt.location == 3) {
                    const controllerMapped = keyMappings.controllerMappings[evt.key];
                    if(!controllerMapped) {
                        return;
                    }
                    this._controllerBuf &= (~controllerMapped) & keyMappings.joyportBits.ALL;
                    this._bounceControllerBuf();
                    return;
                }

                if(evt.key == "Tab") {
                    this._tabby = false;
                }
            }
            else if(command == 'keydown') {
                const evt : KeyboardEvent = request.arguments;
                if(evt.location == 3) {
                    const controllerMapped = keyMappings.controllerMappings[evt.key];
                    if(!controllerMapped) {
                        return;
                    }

                    this._controllerBuf |= controllerMapped;
                    this._bounceControllerBuf();
                    return;
                }

                if(evt.location !== 0) {
                    return;
                }

                if(evt.key == "Tab") {
                    this._tabby = true;
                    return;
                }

                const mapped = keyMappings.keyMappings[
                    [
                        evt.ctrlKey ? 'Control' : '',
                        evt.shiftKey ? 'Shift' : '',
                        this._tabby ? 'Tab' : '',
                        evt.key
                    ].filter(x => x).join('+')
                ];

                const key = mapped
                    ? `\\x${mapped.toString(16).padStart(2, '0')}`
                    : (evt.shiftKey
                        ? evt.key.toUpperCase()
                        : evt.key
                    );

                this._keybuf.push(key);

                this._bounceBuf();
            }
            else if(command == 'offset') {
                await this._runtime.updateMemoryOffset(request.arguments.offset);
            }
            else if(command == 'bank') {
                await this._runtime.updateMemoryBank(request.arguments.bank);
            }
            else if(command == 'messageActioned') {
                await this._runtime.action(request.arguments.name);
            }
            else if(command == 'enableStats') {
                await this._runtime.enableStats();
            }
            else {
                response.success = false;
                response.message = 'Unknown command';
            }
        }
        catch(e) {
            response.success = false
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    /**
    * The 'initialize' request is the first request called by the frontend
    * to interrogate the features the debug adapter provides.
    */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};

        // the adapter implements the configurationDoneRequest.
        response.body.supportsConfigurationDoneRequest = true;

        // make VS Code to use 'evaluate' when hovering over source
        response.body.supportsEvaluateForHovers = true;

        response.body.supportsDisassembleRequest = false;

        response.body.supportsStepBack = false;

        response.body.supportsSetVariable = true;

        // make VS Code to support data breakpoints
        response.body.supportsDataBreakpoints = false;

        response.body.supportTerminateDebuggee = true;
        response.body.supportsTerminateRequest = true;

        // make VS Code to support completion in REPL
        response.body.supportsCompletionsRequest = false;
        response.body.completionTriggerCharacters = [ ".", "[" ];

        // make VS Code to send cancelRequests
        response.body.supportsCancelRequest = true;

        // make VS Code send the breakpointLocations request
        response.body.supportsBreakpointLocationsRequest = true;

        this.sendResponse(response);

        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
        // we request them early by sending an 'initializeRequest' to the frontend.
        // The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new InitializedEvent());
    }

    /**
    * Called at the end of the configuration sequence.
    * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
    */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        this._configurationDone.notify();
    }

    private _procs: child_process.ChildProcessWithoutNullStreams[] = [];

    public runInTerminalRequest(args: DebugProtocol.RunInTerminalRequestArguments, timeout: number, cb: (response: DebugProtocol.RunInTerminalResponse) => void): void {
        if(process.env.NODE_ENV == 'test') {
            const proc = child_process.spawn(args.args[0], args.args.slice(1), <any>{
                stdio: 'pipe',
                shell: true,
                cwd: args.cwd,
                env: {
                    ...process.env,
                    ...args.env,
                }
            },);

            proc.stdout.on('data', data => {
                this._runtime.sendEvent('output', 'stdout', data.toString());
            });

            proc.stderr.on('data', data => {
                this._runtime.sendEvent('output', 'stderr', data.toString());
            });

            this._procs.push(proc);

            cb({
                request_seq: Math.random() * 10000000000,
                success: true,
                command: 'runInTerminal',
                seq: Math.random() * 10000000000,
                type: 'runInTerminal',
                body: {
                    processId: proc.pid,
                    shellProcessId: proc.pid,
                }
            });
        }
        else {
            super.runInTerminalRequest(args, timeout, cb);
        }
    }

    protected async attachRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
        try {
            if(!args.port) {
                throw new Error('Attach requires a port in launch.json');
            }
            await this._runtime.attach(args.port, args.build.cwd, !!args.stopOnEntry, !!args.stopOnExit, !!args.runAhead, args.program, args.machineType ? MachineType[args.machineType] : undefined, args.debugFile, args.mapFile);
        }
        catch (e) {
            metrics.event('session', 'attach-error');

            console.error(e);
            response.success = false;
            response.message = (<any>e).stack.toString();
        }

        this.sendResponse(response);
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
        try {
            logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);
            await this._configurationDone.wait(3000);

            this._consoleType = args.console

            // build the program.
            try {
                const success = await compile.build(
                    args.build,
                    <debugUtils.ExecHandler>((file, args, opts) => this._execHandler(file, args, opts)),
                    args.cc65Home
                );
                if(!success) {
                    throw new Error();
                }
            }
            catch {
                metrics.event('session', 'build-error');
                throw new Error("Couldn't finish the build successfully. Check the console for details.");
            }

            if(!args.program) {
                throw new Error('Could not find any output files that matched. Use the launch.json->program property to specify explicitly.');
            }

            // start the program in the runtime
            await this._runtime.start(
                args.port!,
                args.program,
                args.build.cwd,
                !!args.stopOnEntry,
                !!args.stopOnExit,
                !!args.runAhead,
                args.machineType
                ? MachineType[args.machineType]
                : undefined,
                args.viceDirectory,
                args.mesenDirectory,
                args.appleWinDirectory,
                args.emulatorArgs,
                args.preferX64OverX64sc,
                args.debugFile,
                args.mapFile
            );
        }
        catch (e) {
            metrics.event('session', 'launch-error');

            console.error(e);
            response.success = false;
            response.message = (<any>e).stack.toString();
        }

        this.sendResponse(response);
    }

    protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
        try {
            if(!args.breakpoints) {
                // send back the actual breakpoint positions
                response.body = {
                    breakpoints: [],
                };
                this.sendResponse(response);
                return;
            }

            const path = args.source.path!;

            await this._runtime.clearBreakpoints(path);

            // set and verify breakpoint locations
            const brks = await this._runtime.setBreakPoint(path, ...args.breakpoints.map(x => ({
                line: this.convertClientLineToDebugger(x.line),
                logMessage: x.logMessage,
                condition: x.condition,
            })));

            const actualBreakpoints : DebugProtocol.Breakpoint[] = [];
            for(const b in brks) {
                const brk = brks[b];
                let { verified, line, id } = brk;
                const bp = <DebugProtocol.Breakpoint> new Breakpoint(verified, this.convertDebuggerLineToClient(line.num));
                bp.id = id;
                actualBreakpoints.push(bp);
            }

            // send back the actual breakpoint positions
            response.body = {
                breakpoints: actualBreakpoints
            };
            this.sendResponse(response);
        }
        catch(e) {
            console.error(e);
            response.success = false
            response.message = e
            this.sendResponse(response);
        }
    }

    protected async terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            await this._runtime.terminate();
            this._addressTypes = {};
            this._keybuf = [];
        }
        catch(e) {
            console.error(e);
            response.success = false;
            response.message = (<any>e).stack.toString();
        }

        this.sendResponse(response);
    }

    protected breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): void {

        if (args.source.path) {
            const bps = this._runtime.getBreakpoints(args.source.path, this.convertClientLineToDebugger(args.line));
            response.body = {
                breakpoints: bps.map(col => {
                    return {
                        line: args.line,
                        column: this.convertDebuggerColumnToClient(col)
                    }
                })
            };
        } else {
            response.body = {
                breakpoints: []
            };
        }
        this.sendResponse(response);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [
                new Thread(CC65ViceDebugSession.THREAD_ID, "thread 1")
            ]
        };
        this.sendResponse(response);
    }

    protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void> {

        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;

        const stk = await this._runtime.stack(startFrame, endFrame);

        response.body = {
            stackFrames: stk.frames.map(f => new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line))),
            totalFrames: stk.count
        };
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

        response.body = {
            scopes: [
                new Scope("Registers", VariablesReferenceFlag.REGISTERS, false),
                new Scope("Local", VariablesReferenceFlag.LOCAL, false),
                new Scope("Statics", VariablesReferenceFlag.STATICS, false),
                new Scope("Global", VariablesReferenceFlag.GLOBAL, true),
            ]
        };
        this.sendResponse(response);
    }

    private _pointerMenu(pointerVal: number, idx?: number) : DebugProtocol.Variable {
        let name : string;
        let val : string;
        const helpText = `Mem @ 0x${(<any>pointerVal.toString(16)).padStart(4, '0')} (Pointer Dest)`;
        if(typeof idx === 'undefined') {
            name = helpText;
            val = "";
        }
        else {
            name = idx.toString();
            val = helpText;
        }

        return {
            name: name,
            value: val,
            variablesReference: VariablesReferenceFlag.FOLLOW_POINTER | pointerVal,
            presentationHint: {
                kind: 'virtual'
            },
        };
    }

    private _addAddressType(addr: number, type: string) {
        this._addressTypes[addr.toString(16)] = type || this._addressTypes[addr.toString(16)] || '';
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
        const variables: DebugProtocol.Variable[] = [];

        try {
            const ref = args.variablesReference;

            if (ref & VariablesReferenceFlag.REGISTERS) {
                const regs = await this._runtime.getRegisterVariables();
                for(const reg of regs) {
                    variables.push({
                        name: reg.name,
                        value: reg.value,
                        variablesReference: 0,
                    });
                }
            }
            else if (ref & VariablesReferenceFlag.STATICS) {
                const vars = await this._runtime.getStaticVariables();
                for(const v of vars) {
                    this._addAddressType(v.addr, v.type)

                    variables.push({
                        name: v.name,
                        value: v.value,
                        type: v.type,
                        memoryReference: v.addr.toString(16),
                        variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                    });
                }
            }
            else if (ref & VariablesReferenceFlag.LOCAL) {
                const vars = await this._runtime.getScopeVariables();
                for(const v of vars) {
                    this._addAddressType(v.addr, v.type)

                    variables.push({
                        name: v.name,
                        value: v.value,
                        type: v.type,
                        memoryReference: v.addr.toString(16),
                        variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                    });
                }
            }
            else if(ref & VariablesReferenceFlag.GLOBAL) {
                const vars = await this._runtime.getGlobalVariables();
                for(const v of vars) {
                    this._addAddressType(v.addr, v.type)

                    variables.push({
                        name: v.name,
                        value: v.value,
                        type: v.type,
                        memoryReference: v.addr.toString(16),
                        variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                    });
                }
            }
            else if(ref > 0) {
                if(ref & (VariablesReferenceFlag.EXPAND_BYTES)) {
                    // 9B are retrieved in case there is a pointer straddling the boundary
                    // There is probably a better way to do this since we technically
                    // have this data already from the parent.
                    const val = await this._runtime.getMemory(args.variablesReference & VariablesReferenceFlag.ADDR_MASK, 9);
                    for(let i = 0; i < val.length - 1; i++) {
                        const pointerVal = val.readUInt16LE(i);
                        variables.push(this._pointerMenu(pointerVal, i))
                    }
                }
                else if(ref & (VariablesReferenceFlag.EXPAND_DATA | VariablesReferenceFlag.FOLLOW_POINTER)) {
                    const addr = ref & VariablesReferenceFlag.ADDR_MASK
                    const buf = await this._runtime.getMemory(addr, 128); // FIXME Make this number configurable.
                    for(let i = 0 ; i < buf.length ; i+=8) {
                        const val = buf.slice(i, i + 8);
                        variables.push({
                            name: (addr + i).toString(16),
                            value: debugUtils.rawBufferHex(val),
                            variablesReference: VariablesReferenceFlag.EXPAND_BYTES | (addr + i),
                            presentationHint: {
                                kind: "data",
                            }
                        })
                    }
                }
                else if(ref & VariablesReferenceFlag.FOLLOW_TYPE) {
                    const fields = await this._runtime.getTypeFields(ref & VariablesReferenceFlag.ADDR_MASK, this._addressTypes[(ref & VariablesReferenceFlag.ADDR_MASK).toString(16)]);
                    for(const field of fields) {
                        this._addAddressType(field.addr, field.type)
                        variables.push({
                            type: field.type,
                            name: field.name,
                            value: field.value,
                            memoryReference: field.addr.toString(16),
                            variablesReference: field.addr | (field.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                        })
                    }
                }
                else {
                    const val = await this._runtime.getMemory(ref & VariablesReferenceFlag.ADDR_MASK, 2);
                    const pointerVal = val.readUInt16LE(0);

                    const addr = ref & VariablesReferenceFlag.ADDR_MASK;

                    if(ref & VariablesReferenceFlag.HAS_TYPE) {
                        if(pointerVal || !(this._addressTypes[addr.toString(16)] || '').endsWith('*')) {
                            variables.push({
                                name: `Type at this address`,
                                value: "",
                                variablesReference: VariablesReferenceFlag.FOLLOW_TYPE | ref,
                                presentationHint: {
                                    kind: 'virtual'
                                }
                            })
                        }
                        else {
                            variables.push({
                                name: `NULL`,
                                value: "",
                                variablesReference: 0,
                                presentationHint: {
                                    kind: 'virtual'
                                }
                            })
                        }
                    }

                    variables.push(this._pointerMenu(pointerVal))

                    variables.push({
                        name: `Mem @ 0x${(<any>addr.toString(16)).padStart(4, '0')} (Direct)`,
                        value: "",
                        variablesReference: VariablesReferenceFlag.EXPAND_DATA | ref,
                        presentationHint: {
                            kind: 'virtual'
                        }
                    })
                }
            }
        }
        catch (e) {
            console.error(e);
            variables.push({
                name: `Error`,
                value: e.toString(),
                variablesReference: 0,
            });
        }

        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }

    protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): Promise<void> {
        response.success = true;
        try {
            await this._runtime.continue();
        }
        catch(e) {
            response.success = false;
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void> {
        response.success = true;
        try {
            await this._runtime.next();
        }
        catch(e) {
            response.success = false;
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request) : Promise<void> {
        response.success = true;
        try {
            await this._runtime.stepIn();
        }
        catch(e) {
            response.success = false;
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): Promise<void> {
        response.success = true;
        try {
            await this._runtime.stepOut();
        }
        catch(e) {
            response.success = false;
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
        throw new Error('Not supported');
    }

    protected async pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): Promise<void> {
        response.success = true;
        try {
            await this._runtime.pause();
        }
        catch(e) {
            response.success = false;
            response.message = e.message;
        }

        this.sendResponse(response);
    }

    protected async setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            const ref = args.variablesReference;
            const addr = ref & VariablesReferenceFlag.ADDR_MASK
            if(ref & VariablesReferenceFlag.REGISTERS) {
                const res = await this._runtime.setRegisterVariable(args.name, parseInt(args.value));
                response.body = {
                    value: res.value,
                    variablesReference: 0,
                };
            }
            else if(ref & VariablesReferenceFlag.GLOBAL) {
                const v = await this._runtime.setGlobalVariable(args.name, parseInt(args.value));
                if(!v) {
                    throw new Error('This type of variable cannot be set yet');
                }

                response.body = {
                    value: v.value,
                    type: v.type,
                    variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                };
            }
            else {
                throw new Error('You can only modify registers and globals');
            }

            response.success = true;
        }
        catch(e) {
            response.success = false;
            response.message = e.toString();
        }

        this.sendResponse(response);
    }

    protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {
        try {
            const lastVal = await this._runtime.evaluate(args.expression);
            if(!lastVal) {
                response.body = {
                    result: 'Not found',
                    variablesReference: 0,
                };
                this.sendResponse(response);
                return;
            }

            this._addAddressType(lastVal.addr, lastVal.type);
            response.body = {
                type: lastVal.type,
                result: lastVal.value,
                variablesReference: lastVal.addr | (lastVal.type ? VariablesReferenceFlag.HAS_TYPE : 0),
            };
        }
        catch(e) {
            response.success = false;
            response.message = e.toString();
        }
        this.sendResponse(response);
    }

    protected setDataBreakpointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetDataBreakpointsArguments): void {

        // clear all data breakpoints
        this._runtime.clearAllDataBreakpoints();

        response.body = {
            breakpoints: []
        };

        for (let dbp of args.breakpoints) {
            // assume that id is the "address" to break on
            const ok = this._runtime.setDataBreakpoint(dbp.dataId);
            response.body.breakpoints.push({
                verified: ok
            });
        }

        this.sendResponse(response);
    }

    protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {

        response.body = {
            targets: [
            ]
        };
        this.sendResponse(response);
    }

    protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments) {
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request) : Promise<void> {
        try {
            if(args.terminateDebuggee) {
                await this._runtime.terminate();
            }
            else {
                await this._runtime.disconnect();
            }
        }
        catch(e) {
            console.error(e);
            response.success = false;
            response.message = (<any>e).stack.toString();
        }

        this._addressTypes = {};
        this._keybuf = [];
        this.sendResponse(response);
    }

    //---- helpers

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'mock-adapter-data');
    }
}
