import * as child_process from 'child_process'
import * as net from 'net'
import _last from 'lodash/fp/last'
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
import * as hasbin from 'hasbin';
import { DebugProtocol } from 'vscode-debugprotocol'
import * as debugUtils from './debug-utils';
import * as bin from './binary-dto';
import { enable } from 'colors/safe';

const waitPort = require('wait-port');

export class ViceGrip extends EventEmitter {
    public textPort : number | undefined;
    private _binaryPort : number = -1;
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
                const res : bin.AbstractResponse = {
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
        const cmd : bin.AutostartCommand = {
            type: bin.CommandType.autostart,
            filename: program,
            index: 0,
            run: true,
        };

        return await this.execBinary(cmd);
    }

    public async exit() : Promise<bin.ExitResponse> {
        const cmd : bin.ExitCommand = {
            type: bin.CommandType.exit,
        };

        return await this.execBinary(cmd);
    }

    public async checkpointDelete(cmd : bin.CheckpointDeleteCommand) : Promise<bin.CheckpointDeleteResponse> {
        return await this.execBinary(cmd);
    }

    public async checkpointList() : Promise<bin.CheckpointListResponse> {
        const cmd: bin.CheckpointListCommand = {
            type: bin.CommandType.checkpointList,
            responseType: bin.ResponseType.checkpointList,
        };

        return await this.execBinary(cmd);
    }

    public async getMemory(addr: number, length: number) : Promise<Buffer> {
        if(length <= 0) {
            return Buffer.alloc(0);
        }

        const res = await this.execBinary<bin.MemoryGetCommand, bin.MemoryGetResponse>({
            type: bin.CommandType.memoryGet,
            sidefx: false,
            startAddress: addr,
            endAddress: addr + length - 1,
            memspace: bin.ViceMemspace.main,
            bankId: 0,
        });

        return Buffer.from(res.memory);
    }


    public async connect(binaryPort: number) {
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

            this._binaryConn = binaryConn;
            break;
        } while(true);

        this._binaryConn.on('data', this._binaryDataHandler.bind(this));

        this._binaryConn.read();
        this._binaryConn.resume();

        this._binaryPort = binaryPort;

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

    public async start(initBreak: number, cwd: string, vicePath: string, viceArgs?: string[], labelFile?: string) {
        const startText = _random(29170, 29400);
        const startBinary = _random(29700, 30000);
        const binaryPort = await getPort({port: getPort.makeRange(startBinary, startBinary + 256)});
        const textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});

        let q = "";
        let logfile : string | undefined;
        if(process.platform == "win32") {
            q = '"';
            logfile = await util.promisify(tmp.tmpName)({ prefix: 'cc65-vice-'});

            const tempdir = path.dirname(logfile!);
            const temps = await util.promisify(fs.readdir)(tempdir);
            temps
                .filter(x => /^cc65-vice-/.test(x))
                .map(x => util.promisify(fs.unlink)(path.join(tempdir, x)).catch(() => {}));
        }

        let args = [
            // C64-specific
            ...(
                path.basename(vicePath).startsWith('x64')
                ? [
                    "-directory", `${q}${path.normalize(__dirname + "/../dist/system")}${q}`,
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
        const cmd : bin.PingCommand = {
            type: bin.CommandType.ping,
        };

        return await this.execBinary(cmd);
    }

    public async waitForStop(startAddress?: number, endAddress?: number, continueIfUnmatched?: boolean) : Promise<bin.StoppedResponse> {
        return await new Promise<bin.StoppedResponse>((res, rej) => {
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

    public async execBinary<T extends bin.Command, U extends bin.Response<T>>(command: T) : Promise<U> {
        const results = await this.multiExecBinary<T, U>([command]);
        return results[0];
    }

    public async multiExecBinary<T extends bin.Command, U extends bin.Response<T>>(commands: T[]) : Promise<U[]> {
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

            return new Promise<U>((res, rej) => {
                try {
                    const rid = requestId.toString(16);
                    const related : bin.AbstractResponse[] = [];
                    const afterResponse = (b : U) => {
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
            const cmd : bin.QuitCommand = {
                type: bin.CommandType.quit,
            };
            this._binaryConn && await this.execBinary(cmd);
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

    once(event: string, listener: ((r: bin.AbstractResponse) => void) | (() => void)): this {
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

    on(event: string, listener: ((r: bin.AbstractResponse) => void) | (() => void)): this {
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
