import * as net from 'net'
import _last from 'lodash/fp/last'
import * as debugFile from './debug-file'
import semver from 'semver'
import _intersectionBy from 'lodash/fp/intersectionBy'
import _random from 'lodash/fp/random'
import _uniq from 'lodash/fp/uniq'
import * as path from 'path'
import getPort from 'get-port';
import * as tmp from 'tmp';
import { EventEmitter } from 'events'
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as util from 'util';
import * as debugUtils from './debug-utils';
import * as bin from './binary-dto';

const waitPort = require('wait-port');

export class ViceGrip extends EventEmitter {
    public textPort : number | undefined;
    public versionInfo : { 
        viceVersion: string, 
        svnRevision: number,
        compoundDirectory: boolean,
    } | undefined;

    private _binaryConn: Readable & Writable;

    private _commandBytes : Buffer = Buffer.alloc(1024);
    private _responseBytes : Buffer = Buffer.alloc(0);
    private _responseByteCount : number = 0;
    private _nextResponseLength : number = -1;
    private _responseEmitter : EventEmitter = new EventEmitter();

    private _binaryDataHandler(d : Buffer) {
        try {
            // FIXME: API version
            const header_size = 12;
            if(this._nextResponseLength == -1) {
                this._responseByteCount = 0;
                this._nextResponseLength = d.readUInt32LE(2) + header_size;
                if(this._responseBytes.length < this._nextResponseLength) {
                    this._responseBytes = Buffer.alloc(this._nextResponseLength);
                }
            }

            if(d.length + this._responseByteCount > this._responseBytes.length) {
                this._responseBytes = Buffer.concat([this._responseBytes.slice(0, this._responseByteCount), d]);
            }
            else {
                d.copy(this._responseBytes, this._responseByteCount);
            }

            this._responseByteCount += d.length;

            if(this._responseBytes.length &&
                this._responseBytes.readUInt8(0) != 0x02) {
                const res : bin.Response = {
                    type: 0,
                    apiVersion: 0,
                    related: [],
                    error: 0xff,
                    requestId: 0xffffffff,
                };

                this._responseEmitter.emit('error', res);
            }

            if(this._responseByteCount >= this._nextResponseLength) {
                const res = bin.responseBufferToObject(this._responseBytes, this._nextResponseLength);

                if(res.type == bin.ResponseType.stopped) {
                    this._responseEmitter.emit('stopped', res);
                }

                this._responseEmitter.emit(res.requestId.toString(16), res);

                const oldResponseByteCount = this._responseByteCount;
                this._responseByteCount = 0;

                const oldResponseLength = this._nextResponseLength;
                this._nextResponseLength = -1;

                const sliced = this._responseBytes.slice(oldResponseLength, oldResponseByteCount);
                if(sliced.length >= header_size) {
                    this._binaryDataHandler(sliced);
                }
                else {
                    sliced.copy(this._responseBytes, this._responseByteCount);
                    this._responseByteCount += sliced.length;
                }
            }

        }
        catch(e) {
            console.error(e);
        }
    };

    private _handler: debugUtils.ExecHandler;
    private _pids: [number, number] = [-1, -1];

    constructor(
        handler: debugUtils.ExecHandler,
    ) {
        super();

        this._handler = handler;
    }

    public async autostart(program: string) : Promise<bin.AutostartResponse> {
        return await this.execBinary({
            type: bin.CommandType.autostart,
            filename: program,
            index: 0,
            run: true,
        });
    }

    public async exit() : Promise<bin.ExitResponse> {
        return await this.execBinary({
            type: bin.CommandType.exit,
        });
    }

    public async checkpointList() : Promise<bin.CheckpointListResponse> {
        return await this.execBinary({
            type: bin.CommandType.checkpointList,
            responseType: bin.ResponseType.checkpointList,
        });
    }

    public async getMemory(addr: number, length: number, bankId: number = 0) : Promise<Buffer> {
        if(length <= 0) {
            return Buffer.alloc(0);
        }

        const res = await this.execBinary({
            type: bin.CommandType.memoryGet,
            sidefx: false,
            startAddress: addr,
            endAddress: addr + length - 1,
            memspace: bin.ViceMemspace.main,
            bankId: bankId,
        });

        return Buffer.from(res.memory);
    }

    public async setMemory(addr: number, memory: Buffer) : Promise<void> {
        if(memory.length <= 0) {
            return;
        }

        await this.execBinary({
            type: bin.CommandType.memorySet,
            sidefx: false,
            startAddress: addr,
            endAddress: addr + memory.length - 1,
            memspace: bin.ViceMemspace.main,
            bankId: 0,
            memory: memory,
        });
    }

    private static async _connect(binaryPort: number, listener: (data: Buffer) => void) : Promise<net.Socket> {
        let binaryConn : net.Socket | undefined;

        while(binaryPort == await getPort({port: getPort.makeRange(binaryPort, binaryPort + 256)})) {};

        let binaryTries = 0;
        do {
            binaryTries++;
            try {
                binaryConn = new net.Socket({
                });

                await waitPort({
                    host: '127.0.0.1',
                    port: binaryPort,
                    timeout: 10000,
                    interval: 100,
                });

                await new Promise<void>((res, rej) => {
                    binaryConn!.connect({
                        host: '127.0.0.1',
                        port: binaryPort,
                    }, () => {
                        binaryConn!.off('error', rej);
                        res();
                    });

                    binaryConn!.once('error', rej);
                });
            } catch(e) {
                if(binaryConn) {
                    try {
                        binaryConn.end();
                    }
                    catch {
                    }
                }
                if(binaryTries > 3) {
                    throw e;
                }
                continue;
            }

            break;
        } while(true);

        binaryConn.on('data', listener);

        binaryConn.read();
        binaryConn.resume();

        return binaryConn;
    }

    public async connect(binaryPort: number) {
        await this._versionProbeConnect(binaryPort, false);

        this._binaryConn = await ViceGrip._connect(binaryPort, this._binaryDataHandler.bind(this));

        const resources : bin.ResourceGetCommand[] = [
            {
                type: bin.CommandType.resourceGet,
                resourceName: 'MonitorServer',
            },
            {
                type: bin.CommandType.resourceGet,
                resourceName: 'MonitorServerAddress',
            }
        ];

        const [enabledRes, textRes] : bin.ResourceGetResponse[] = await this.multiExecBinary(resources);

        if(!enabledRes.intValue) {
            return;
        }

        this.textPort = parseInt(_last(textRes.stringValue!.split(':'))!);
    }

    private async _versionProbeConnect(binaryPort: number, terminate: boolean) : Promise<void> {
        if(this.versionInfo) {
            return;
        }

        const grip = new ViceGrip(this._handler);
        grip._binaryConn = await ViceGrip._connect(binaryPort, grip._binaryDataHandler.bind(grip));

        try {
            const res = await grip.execBinary({
                type: bin.CommandType.viceInfo,
            })

            console.log('VICE Info', res);

            const ver = res.viceVersion.join('.')
            const rev = res.svnRevision;
            this.versionInfo = {
                viceVersion: ver,
                svnRevision: rev,
                compoundDirectory: semver.satisfies(ver, `>=3.6`) || rev >= 39825,
            }
        }
        catch {
            this.versionInfo = {
                viceVersion: '3.5.0.0',
                svnRevision: 0,
                compoundDirectory: false,
            }
        }

        terminate ? await grip.terminate() : await grip.disconnect();
    }

    /**
     * Get the version info from a VICE with default settings so it's less likely
     * to break at startup
     * @param vicePath The absolute path to VICE
     */
    private async _versionProbeStart(vicePath: string) : Promise<void> {
        const startText = _random(29170, 29400);
        const startBinary = _random(29700, 30000);
        const binaryPort = await getPort({port: getPort.makeRange(startBinary, startBinary + 256)});
        const textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});

        let args = [
            "-default",

            // Monitor
            "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${textPort}`,
            "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${binaryPort}`,
        ];

        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: '.',
            title: 'VICE',
        };

        console.log('Probing VICE', vicePath, args, opts);

        let pids : number[];
        try {
            pids = await this._handler(vicePath, args, opts);
        }
        catch {
            throw new Error(`Could not start VICE with "${vicePath} ${args.join(' ')}". Make sure your settings are correct.`);
        }

        await this._versionProbeConnect(binaryPort, true);
    }

    public async start(initBreak: number, cwd: string, machineType: debugFile.MachineType, vicePath: string, viceArgs?: string[], labelFile?: string) {
        await this._versionProbeStart(vicePath);

        const startText = _random(29170, 29400);
        const startBinary = _random(29700, 30000);
        const binaryPort = await getPort({port: getPort.makeRange(startBinary, startBinary + 256)});
        const textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});

        let q = "";
        let sep = ":";
        let logfile : string | undefined;
        if(process.platform == "win32") {
            q = '"';
            sep = ';';
            logfile = await util.promisify(tmp.tmpName)({ prefix: 'cc65-vice-'});

            const tempdir = path.dirname(logfile!);
            const temps = await util.promisify(fs.readdir)(tempdir);
            temps
                .filter(x => /^cc65-vice-/.test(x))
                .map(x => util.promisify(fs.unlink)(path.join(tempdir, x)).catch(() => {}));
        }

        let dirs = [""];
        if(this.versionInfo!.compoundDirectory) {
            dirs = [
                path.normalize(__dirname + "/../dist/system"),
            ];
        }
        else {
            if(machineType == debugFile.MachineType.c64) {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/C64"),
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.c128) {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/C128"),
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.pet) {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/PET"),
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.vic20) {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/VIC20"),
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.plus4) {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/PLUS4"),
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
            else {
                dirs = [
                    path.normalize(__dirname + "/../dist/system/DRIVES"),
                    path.normalize(__dirname + "/../dist/system/PRINTER"),
                ];
            }
        }

        let args = [
            "-directory", q + dirs.join(sep) + q,

            // C64-specific
            ...(
                machineType == debugFile.MachineType.c64
                ? [
                    "-iecdevice8",
                ]
                : []
            ),

            // FIXME Double-check to see if there are caveats to omitting
            // the -nativemonitor flag. Sometimes the GUI monitor would steal focus.
            // Monitor
            "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${textPort}`,
            "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${binaryPort}`,

            // Hardware
             "-autostart-warp", "-autostartprgmode", "1", "-autostart-handle-tde",

            ...(
                initBreak > -1
                ? ['-initbreak', initBreak.toString()]
                : []
            ),

            ...(
                logfile
                ? ['-logfile', logfile]
                : []
            ),

            ...(
                labelFile
                ? ['-moncommands', labelFile]
                : []
            )
        ];

        if(viceArgs) {
            args = [...args, ...viceArgs];
        }
        else {
            args = [...args];
        }

        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: cwd,
            title: 'VICE',
        };

        console.log('Starting VICE', vicePath, args, opts);

        try {
            this._pids = await this._handler(vicePath, args, opts)
        }
        catch {
            throw new Error(`Could not start VICE with "${vicePath} ${args.join(' ')}". Make sure your settings are correct.`);
        }

        // Windows only, for debugging
        if(logfile) {
            await this._handler('powershell', ['-Command', 'Get-Content', logfile, '-Wait'], {
                title: 'Log Output'
            })
        }

        await this.connect(binaryPort);
    }

    public async ping() : Promise<bin.PingResponse> {
        return await this.execBinary({
            type: bin.CommandType.ping,
        });
    }

    public async waitForStop(startAddress?: number, endAddress?: number, continueIfUnmatched?: boolean) : Promise<bin.StoppedResponse> {
        return await new Promise<bin.StoppedResponse>((res) => {
            const handle = async (r: bin.StoppedResponse) => {
                if(!endAddress
                    ? (!startAddress || r.programCounter == startAddress)
                    : (startAddress! <= r.programCounter && r.programCounter <= endAddress)) {
                    res(r);
                    this._responseEmitter.off('stopped', handle);
                }
                else if(continueIfUnmatched) {
                    await this.exit();
                }
            }
            this._responseEmitter.on('stopped', handle);
        });
    }

    public async execBinary(command: bin.MemoryGetCommand): Promise<bin.MemoryGetResponse>
    public async execBinary(command: bin.MemorySetCommand): Promise<bin.MemorySetResponse>

    public async execBinary(command: bin.CheckpointGetCommand): Promise<bin.CheckpointInfoResponse>
    public async execBinary(command: bin.CheckpointSetCommand): Promise<bin.CheckpointInfoResponse>
    public async execBinary(command: bin.CheckpointDeleteCommand): Promise<bin.CheckpointDeleteResponse>
    public async execBinary(command: bin.CheckpointListCommand): Promise<bin.CheckpointListResponse>
    public async execBinary(command: bin.CheckpointToggleCommand): Promise<bin.CheckpointToggleResponse>

    public async execBinary(command: bin.ConditionSetCommand): Promise<bin.ConditionSetResponse>

    public async execBinary(command: bin.RegistersGetCommand): Promise<bin.RegisterInfoResponse>
    public async execBinary(command: bin.RegistersSetCommand): Promise<bin.RegisterInfoResponse>

    public async execBinary(command: bin.DumpCommand): Promise<bin.DumpResponse>
    public async execBinary(command: bin.UndumpCommand): Promise<bin.UndumpResponse>

    public async execBinary(command: bin.ResourceGetCommand): Promise<bin.ResourceGetResponse>
    public async execBinary(command: bin.ResourceSetCommand): Promise<bin.ResourceSetResponse>

    public async execBinary(command: bin.AdvanceInstructionsCommand): Promise<bin.AdvanceInstructionsResponse>
    public async execBinary(command: bin.KeyboardFeedCommand): Promise<bin.KeyboardFeedResponse>
    public async execBinary(command: bin.ExecuteUntilReturnCommand): Promise<bin.ExecuteUntilReturnResponse>

    public async execBinary(command: bin.PingCommand): Promise<bin.PingResponse>
    public async execBinary(command: bin.BanksAvailableCommand): Promise<bin.BanksAvailableResponse>
    public async execBinary(command: bin.RegistersAvailableCommand): Promise<bin.RegistersAvailableResponse>
    public async execBinary(command: bin.DisplayGetCommand): Promise<bin.DisplayGetResponse>
    public async execBinary(command: bin.ViceInfoCommand): Promise<bin.ViceInfoResponse>

    public async execBinary(command: bin.ExitCommand): Promise<bin.ExitResponse>
    public async execBinary(command: bin.QuitCommand): Promise<bin.QuitResponse>
    public async execBinary(command: bin.ResetCommand): Promise<bin.ResetResponse>
    public async execBinary(command: bin.AutostartCommand): Promise<bin.AutostartResponse>
    public async execBinary(command: bin.Command) : Promise<bin.Response>
    public async execBinary(command: bin.Command) : Promise<bin.Response> {
        const results = await this.multiExecBinary([command]);
        return results[0];
    }

    public async multiExecBinary(commands: bin.MemoryGetCommand[]): Promise<bin.MemoryGetResponse[]>
    public async multiExecBinary(commands: bin.MemorySetCommand[]): Promise<bin.MemorySetResponse[]>

    public async multiExecBinary(commands: bin.CheckpointGetCommand[]): Promise<bin.CheckpointInfoResponse[]>
    public async multiExecBinary(commands: bin.CheckpointSetCommand[]): Promise<bin.CheckpointInfoResponse[]>
    public async multiExecBinary(commands: bin.CheckpointDeleteCommand[]): Promise<bin.CheckpointDeleteResponse[]>
    public async multiExecBinary(commands: bin.CheckpointListCommand[]): Promise<bin.CheckpointListResponse[]>
    public async multiExecBinary(commands: bin.CheckpointToggleCommand[]): Promise<bin.CheckpointToggleResponse[]>

    public async multiExecBinary(commands: bin.ConditionSetCommand[]): Promise<bin.ConditionSetResponse[]>

    public async multiExecBinary(commands: bin.RegistersGetCommand[]): Promise<bin.RegisterInfoResponse[]>
    public async multiExecBinary(commands: bin.RegistersSetCommand[]): Promise<bin.RegisterInfoResponse[]>

    public async multiExecBinary(commands: bin.DumpCommand[]): Promise<bin.DumpResponse[]>
    public async multiExecBinary(commands: bin.UndumpCommand[]): Promise<bin.UndumpResponse[]>

    public async multiExecBinary(commands: bin.ResourceGetCommand[]): Promise<bin.ResourceGetResponse[]>
    public async multiExecBinary(commands: bin.ResourceSetCommand[]): Promise<bin.ResourceSetResponse[]>

    public async multiExecBinary(commands: bin.AdvanceInstructionsCommand[]): Promise<bin.AdvanceInstructionsResponse[]>
    public async multiExecBinary(commands: bin.KeyboardFeedCommand[]): Promise<bin.KeyboardFeedResponse[]>
    public async multiExecBinary(commands: bin.ExecuteUntilReturnCommand[]): Promise<bin.ExecuteUntilReturnResponse[]>

    public async multiExecBinary(commands: bin.PingCommand[]): Promise<bin.PingResponse[]>
    public async multiExecBinary(commands: bin.BanksAvailableCommand[]): Promise<bin.BanksAvailableResponse[]>
    public async multiExecBinary(commands: bin.RegistersAvailableCommand[]): Promise<bin.RegistersAvailableResponse[]>
    public async multiExecBinary(commands: bin.DisplayGetCommand[]): Promise<bin.DisplayGetResponse[]>
    public async multiExecBinary(commands: bin.ViceInfoCommand[]): Promise<bin.ViceInfoResponse[]>

    public async multiExecBinary(commands: bin.ExitCommand[]): Promise<bin.ExitResponse[]>
    public async multiExecBinary(commands: bin.QuitCommand[]): Promise<bin.QuitResponse[]>
    public async multiExecBinary(commands: bin.ResetCommand[]): Promise<bin.ResetResponse[]>
    public async multiExecBinary(commands: bin.AutostartCommand[]): Promise<bin.AutostartResponse[]>
    public async multiExecBinary(commands: bin.Command[]) : Promise<bin.Response[]>
    public async multiExecBinary(commands: bin.Command[]) : Promise<bin.Response[]> {
        let conn : Writable;
        if(!commands || !commands.length) {
            return [];
        }

        conn = this._binaryConn;

        const frags : Uint8Array[] = [];
        const results = Promise.all(commands.map(command => {
            const body = bin.commandObjectToBytes(command, this._commandBytes);
            const requestId = _random(0, 0xffffffff);
            const buf = Buffer.alloc(11 + body.length);
            buf.writeUInt8(0x02, 0); // start
            buf.writeUInt8(0x01, 1); // version
            buf.writeUInt32LE(body.length, 2);
            buf.writeUInt32LE(requestId, 6);
            buf.writeUInt8(command.type, 10);
            body.copy(buf, 11);
            frags.push(buf);

            if(body.length > this._commandBytes.length) {
                this._commandBytes = body;
            }

            return new Promise<bin.Response>((res, rej) => {
                try {
                    const rid = requestId.toString(16);
                    const related : bin.Response[] = [];
                    const afterResponse = (b : bin.Response) => {
                        if(b.error) {
                            const error : any = new Error(`Response error: error 0x${b.error.toString(16)}: req_type 0x${command.type.toString(16)}: req_id 0x${requestId.toString(16)}`);
                            error.response = b;
                            error.command = command;
                            rej(error);
                        }
                        else if(!command.responseType || b.type == command.responseType) {
                            b.related = related;
                            this._responseEmitter.off(rid, afterResponse)
                            res(b);
                        }
                        else {
                            related.push(b);
                        }
                    }
                    this._responseEmitter.on(rid, afterResponse);
                }
                catch(e) {
                    rej(e);
                    throw e;
                }
            });
        }));
        if(this._binaryConn.writableEnded) {
            throw new Error('VICE is not running.');
        }
        await util.promisify((d, cb) => conn.write(d, cb))(Buffer.concat(frags));
        return await results;
    }

    public async withAllBreaksDisabled<T>(func: () => Promise<T>) : Promise<T> {
        const preBrk = await this.checkpointList();
        const tog : bin.CheckpointToggleCommand[] = preBrk.related.filter(x => x.stop && x.enabled).map(x => ({
            type: bin.CommandType.checkpointToggle,
            id: x.id,
            enabled: false,
        }));
        await this.multiExecBinary(tog);

        const res = await func();

        for(const t of tog) {
            t.enabled = true;
        }

        const postBrk = await this.checkpointList();
        const remaining = _intersectionBy(x => x.id, tog, postBrk.related);
        await this.multiExecBinary(remaining);

        return res;
    }

    public async disconnect() : Promise<void> {
        try {
            this._binaryConn && await util.promisify((cb) => this._binaryConn.end(cb))();
        }
        catch(e) {
            console.error(e);
        }
        this._pids = [-1, -1];
        this._binaryConn = <any>null;
    }

    public async terminate() : Promise<void> {
        try {
            this._binaryConn && await this.execBinary({
                type: bin.CommandType.quit,
            });
        }
        catch(e) {
            console.error(e);
        }

        // Give VICE a second to shut down properly
        // FIXME Something about this delay causes a race condition when
        // awaited.
        const pids = this._pids;
        debugUtils.delay(1000).then(() => {
            for(const pid of _uniq(pids)) {
                try {
                    pid > -1 && process.kill(pid, 0) && process.kill(pid, "SIGKILL");
                }
                catch {}
            }
        }).catch(() => {});
        this._pids = [-1, -1];

        await this.disconnect();
    }

    once(event: string, listener: ((r: bin.Response) => void) | (() => void)): this {
        if(event == 'end') {
            this._binaryConn.once('error', listener);
            this._binaryConn.once('close', listener);
            this._binaryConn.once('finish', listener);
            this._binaryConn.once('end', listener);
        }
        else {
            this._responseEmitter.on(event, listener);
        }

        return this;
    }

    on(event: string, listener: ((r: bin.Response) => void) | (() => void)): this {
        if(event == 'end') {
            this._binaryConn.on('error', listener);
            this._binaryConn.on('close', listener);
            this._binaryConn.on('finish', listener);
            this._binaryConn.on('end', listener);
        }
        else {
            this._responseEmitter.on(event, listener);
        }

        return this;
    }
}
