import {
    Logger, logger,
    LoggingDebugSession,
    InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent,
    Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { basename } from 'path';
import * as child_process from 'child_process';
import * as debugUtils from './debugUtils';
import { CC65ViceRuntime, CC65ViceBreakpoint } from './cc65ViceRuntime';
const { Subject } = require('await-notify');
import * as colors from 'colors/safe';

function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

enum VariablesReferenceFlag {
    HAS_TYPE    =    0x10000,
    FOLLOW_TYPE =    0x20000,
    FOLLOW_POINTER = 0x40000,
    EXPAND_DATA =    0x80000,
    EXPAND_BYTES =  0x100000,

    LOCAL =         0x200000,
    GLOBAL =        0x400000,
    PARAM =         0x800000,
    REGISTERS =    0x1000000,

    ADDR_MASK =     0x00FFFF,
}
// MAX = 0x8000000000000

/**
 * Settings for launch.json
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    /** The command of VICE emulator. */
    viceCommand?: string;
    /** The arguments to use for starting VICE. No environment variables are allowed. */
    viceArgs?: string[];
    /** The command to run before launching. This is a shell command so you can put arguments and variables in here too. */
    buildCommand?: string;
    /** The directory of your build command */
    buildCwd?: string;
    /** The d64, d81, or prg file to run, if automatic detection doesn't work */
    program?: string;
    /** Automatically stop target after launch. If not specified, target does not stop. */
    stopOnEntry?: boolean;
    /** enable logging the Debug Adapter Protocol */
    trace?: boolean;
    console?: 'integratedTerminal' | 'integratedConsole' | 'externalTerminal';
}

export class CC65ViceDebugSession extends LoggingDebugSession {

    // we don't support multiple threads, so we can use a hardcoded ID for the default thread
    private static THREAD_ID = 1;

    private _runtime: CC65ViceRuntime;

    private _configurationDone = new Subject();
    private _addressTypes: {[address:string]: string} = {};

    /**
    * Creates a new debug adapter that is used for one debug session.
    * We configure the default implementation of a debug adapter here.
    */
    public constructor() {
        super();

        // this debugger uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);

        this._runtime = new CC65ViceRuntime((args, timeout, cb) => this.runInTerminalRequest(args, timeout, cb));

        // setup event handlers
        this._runtime.on('stopOnEntry', () => {
            this.sendEvent(new StoppedEvent('entry', CC65ViceDebugSession.THREAD_ID));
        });
        this._runtime.on('stopOnStep', () => {
            this.sendEvent(new StoppedEvent('step', CC65ViceDebugSession.THREAD_ID));
        });
        this._runtime.on('stopOnBreakpoint', () => {
            this.sendEvent(new StoppedEvent('breakpoint', CC65ViceDebugSession.THREAD_ID));
        });
        this._runtime.on('stopOnDataBreakpoint', () => {
            this.sendEvent(new StoppedEvent('data breakpoint', CC65ViceDebugSession.THREAD_ID));
        });
        this._runtime.on('stopOnException', () => {
            this.sendEvent(new StoppedEvent('exception', CC65ViceDebugSession.THREAD_ID));
        });
        this._runtime.on('breakpointValidated', (bp: CC65ViceBreakpoint) => {
            this.sendEvent(new BreakpointEvent('changed', <DebugProtocol.Breakpoint>{ verified: bp.verified, id: bp.id }));
        });
        this._runtime.on('output', (category, text, filePath, line, column) => {
            const e: DebugProtocol.OutputEvent = new OutputEvent(text);

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
            this.sendEvent(e);
        });
        this._runtime.on('end', () => {
            this.sendEvent(new TerminatedEvent());
        });
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
        response.body.supportsEvaluateForHovers = false;

        response.body.supportsStepBack = false;

        // make VS Code to support data breakpoints
        response.body.supportsDataBreakpoints = false;

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

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
        try {
            logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);
            await this._configurationDone.wait(3000);

            const buildCwd = args.buildCwd || ".";

            // build the program.
            let possibles = <any>[];
            try {
                            possibles = await this._runtime.build(buildCwd, args.buildCommand || "make OPTIONS=mapfile,debugfile,labelfile");
            }
            catch {
                            throw new Error("Couldn't finish the build successfully. Check the console for details.");
            }

            const program = args.program || possibles[0];
            if(!program) {
                throw new Error('Could not find any output files that matched. Use the launch.json->program property to specify explicitly.');
            }

            // start the program in the runtime
            await this._runtime.start(program, buildCwd, !!args.stopOnEntry, args.viceCommand, args.viceArgs, args.console);
        }
        catch (e) {
            response.success = false;
            response.message = (<any>e).stack.toString();
        }

        this.sendResponse(response);
    }

    protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {

        const path = <string>args.source.path;
        const clientLines = args.lines || [];

        await this._runtime.clearBreakpoints(path);

        // set and verify breakpoint locations
        const actualBreakpoints = <any>(await Promise.all(clientLines.map(async l => {
            const brk = await this._runtime.setBreakPoint(path, this.convertClientLineToDebugger(l));
            if(!brk) {
                return null;
            }

            let { verified, line, id } = brk;
            const bp = <DebugProtocol.Breakpoint> new Breakpoint(verified, this.convertDebuggerLineToClient(line.num));
            bp.id= id;
            return bp;
        }))).filter(x => x);

        // send back the actual breakpoint positions
        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }

    protected async terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): Promise<void> {
        await this._runtime.terminate();
        this._addressTypes = {};
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
                new Scope("Global", VariablesReferenceFlag.GLOBAL, true),
                // FIXME new Scope("Parameter Stack", VariablesReferenceFlag.PARAM, false),
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

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
        const variables: DebugProtocol.Variable[] = [];

        try {
            const ref = args.variablesReference;

            if (ref & VariablesReferenceFlag.REGISTERS) {
                const regs = this._runtime.getRegisters();
                for(const k in regs) {
                    variables.push({
                        name: k.toUpperCase(),
                        value: '0x' + regs[k].toString(16).padStart(2, '0'),
                        variablesReference: 0,
                    });
                }
            }
            else if (ref & VariablesReferenceFlag.LOCAL) {
                const vars = await this._runtime.getScopeVariables();
                for(const v of vars) {
                    this._addressTypes[v.addr.toString(16)] = v.type || '';

                    variables.push({
                        name: v.name,
                        value: v.value,
                        type: v.type,
                        memoryReference: v.addr.toString(16),
                        variablesReference: v.addr | (v.type ? VariablesReferenceFlag.HAS_TYPE : 0),
                    });
                }
            }
            else if(ref & VariablesReferenceFlag.PARAM) {
                const buf = await this._runtime.getParamStack(); // FIXME Make this number configurable.
                for(let i = 0 ; i < buf.length ; i+=8) {
                    const val = buf.slice(i, i + 8);
                    variables.push({
                        name: i.toString(16),
                        value: debugUtils.rawBufferHex(val),
                        variablesReference: 0,
                        presentationHint: {
                            kind: "data",
                        }
                    })
                }
            }
            else if(ref & VariablesReferenceFlag.GLOBAL) {
                const vars = await this._runtime.getGlobalVariables();
                for(const v of vars) {
                    this._addressTypes[v.addr.toString(16)] = v.type || '';

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
                        this._addressTypes[field.addr.toString(16)] = field.type || '';
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

                    if(ref & VariablesReferenceFlag.HAS_TYPE) {
                        variables.push({
                            name: `Type at this address`,
                            value: "",
                            variablesReference: VariablesReferenceFlag.FOLLOW_TYPE | ref,
                            presentationHint: {
                                kind: 'virtual'
                            }
                        })
                    }

                    variables.push(this._pointerMenu(pointerVal))

                    variables.push({
                        name: `Mem @ 0x${(<any>ref.toString(16)).padStart(4, '0')} (Direct)`,
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

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        this._runtime.continue();
        this.sendResponse(response);
    }

    protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments) : void {
        this._runtime.continue(true);
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this._runtime.step();
        this.sendResponse(response);
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request) {
        this._runtime.stepIn();
        this.sendResponse(response);
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): void {
        this._runtime.stepOut();
        this.sendResponse(response);
    }

    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
        throw new Error('Not supported');
    }

    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): void {
        this._runtime.pause();
        this.sendResponse(response);
    }

    protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {

        let reply: string | undefined = undefined;
        if (args.context == "hover") {
            const vars = [...await this._runtime.getScopeVariables(), ...await this._runtime.getGlobalVariables()];
            const v = vars.find(x => x.name == args.expression);
            if(v) {
                reply = v.value;
            }
        }

        if (args.context === 'repl') {
            reply = `Please use the monitor from the terminal tab. It can do colors and stuff.`;
        }

        reply = reply || "No command entered."

        reply = reply.replace(/(\s+LDA\s+)/g, colors.green("$1"));

        response.body = {
            result: reply,
            variablesReference: 0
        };
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
                {
                    label: "item 10",
                    sortText: "10"
                },
                {
                    label: "item 1",
                    sortText: "01"
                },
                {
                    label: "item 2",
                    sortText: "02"
                }
            ]
        };
        this.sendResponse(response);
    }

    protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments) {
    }

    protected async disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request) : Promise<void> {
        await this._runtime.terminate();
        this._addressTypes = {};
        this.sendResponse(response)
    }

    //---- helpers

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'mock-adapter-data');
    }
}
