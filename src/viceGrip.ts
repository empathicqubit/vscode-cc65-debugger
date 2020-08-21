import * as child_process from 'child_process'
import * as net from 'net'
import * as _ from 'lodash'
import * as path from 'path'
import * as getPort from 'get-port';
import * as tmp from 'tmp';
import { Readable, Writable, EventEmitter } from 'stream';
import * as fs from 'fs';
import * as util from 'util';
import * as hasbin from 'hasbin';
import { DebugProtocol } from 'vscode-debugprotocol'
import * as debugUtils from './debugUtils';
import * as bin from './binary-dto';

const waitPort = require('wait-port');
const queue = require('queue');

const MAX_CHUNK = 10;

async function * fakeStream() {
    while(true) {
        yield new Promise((res, rej) => setTimeout(() => res('\n(C:$0000) '), 1));
    }
}

export class ViceGrip extends EventEmitter {
    private _textPort : number = -1;
    private _binaryPort : number = -1;

    private _textConn: Readable & Writable;
    private _binaryConn: Readable & Writable;

    private _responseBytes : Buffer[] = [];
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
            }

            this._responseBytes.push(d);
            this._responseByteCount += d.length;

            if(this._responseByteCount >= this._nextResponseLength) {
                const buf = Buffer.concat(this._responseBytes);

                const res = bin.responseBufferToObject(buf, this._nextResponseLength);

                if(res.type == bin.ResponseType.stopped) {
                    this._responseEmitter.emit('stopped', res);
                }

                this._responseEmitter.emit(res.requestId.toString(16), res);

                this._responseBytes = [];
                this._responseByteCount = 0;

                const oldResponseLength = this._nextResponseLength;
                this._nextResponseLength = -1;

                const sliced = buf.slice(oldResponseLength, buf.length);
                if(buf.length - oldResponseLength >= header_size) {
                    this._binaryDataHandler(sliced);
                }
                else {
                    this._responseBytes = [sliced];
                }
            }

        }
        catch(e) {
            console.error(e);
        }
    };

    private _program: string;
    private _initBreak: number = -1;
    private _cwd: string;
    private _vicePath: string | undefined;
    private _viceArgs: string[] | undefined;

    private _consoleHandler: EventEmitter;

    private _textCmdQueue = queue({
        concurrency: 1,
        timeout: 5000,
        autostart: true,
    });

    private _handler: debugUtils.ExecHandler;
    private _pids: [number, number] = [-1, -1];

    constructor(
        program: string,
        initBreak: number,
        cwd: string,
        handler: debugUtils.ExecHandler,
        vicePath: string | undefined,
        viceArgs: string[] | undefined,
        consoleHandler: EventEmitter
    ) {
        super();

        this._handler = handler;
        this._consoleHandler = consoleHandler;
        this._program = program;
        this._initBreak = initBreak;
        this._cwd = cwd;
        this._vicePath = vicePath;
        this._viceArgs = viceArgs;
    }

    public async autostart() : Promise<bin.AutostartResponse> {
        const cmd : bin.AutostartCommand = {
            type: bin.CommandType.autostart,
            filename: this._program,
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

    public async start() {
        const startText = _.random(29170, 29400);
        const startBinary = _.random(29700, 30000);
        this._textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});
        this._binaryPort = await getPort({port: getPort.makeRange(startBinary, startBinary + 256)});

        let q = "'";
        let sep = ':';
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

        let args = [
            "-directory", `${q}${path.normalize(__dirname + "/../system")}${sep}\$\$${q}`,

            // Monitor
            "-nativemonitor",
            "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${this._textPort}`,
            "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${this._binaryPort}`,

            // Hardware
            "-iecdevice8", "-autostart-warp", "-autostartprgmode", "1", "-autostart-handle-tde",

            ...(
                this._initBreak > -1
                ? ['-initbreak', this._initBreak.toString()]
                : []
            ),

            ...(
                logfile
                ? ['-logfile', logfile]
                : []
            )
        ];

        if(this._viceArgs) {
            args = [...args, ...this._viceArgs];
        }
        else {
            args = [...args];
        }

        const opts = {
            shell: false,
            cwd: this._cwd,
        };

        if(this._vicePath) {
            try {
                await util.promisify(fs.stat)(this._vicePath)
                this._pids = await this._handler(this._vicePath, args, opts)
            }
            catch {
                throw new Error(`Could not start VICE using launch.json->viceCommand = "${this._vicePath}". Make sure it's an absolute path.`);
            }
        }
        else {
            try {
                const x64Exec : string = <any>await util.promisify((i, cb) => hasbin.first(i, (result) => result ? cb(null, result) : cb(new Error('Missing'), null)))(['x64sc', 'x64'])
                this._pids = await this._handler(x64Exec, args, opts);
            }
            catch(e) {
                throw new Error('Could not start either x64 or x64sc. Define your VICE path in your launch.json->viceCommand property');
            }
        }

        // Windows only, for debugging
        if(logfile) {
            await this._handler('powershell', ['-Command', 'Get-Content', logfile, '-Wait'], {})
        }

        let textConn : net.Socket | undefined;

        while(this._textPort == await getPort({port: getPort.makeRange(this._textPort, this._textPort + 256)}));

        let textTries = 0;
        do {
            textTries++;
            try {
                textConn = new net.Socket();

                await waitPort({
                    host: '127.0.0.1',
                    port: this._textPort,
                    timeout: 10000,
                    interval: 100,
                });

                textConn.connect({
                    host: '127.0.0.1',
                    port: this._textPort,
                });

            } catch(e) {
                if(textConn) {
                    try {
                        textConn.end();
                    }
                    catch {}
                }
                if(textTries > 3) {
                    throw e;
                }
                continue;
            }

            this._textConn = textConn;
            break;
        } while(true);

        this._textConn.read();
        const writer = async () => {
            try {
                await util.promisify((d, cb) => this._textConn.write(d, cb))('\n');
            }
            catch {
            }

            wid = setTimeout(writer, 100)
        }
        let wid = setTimeout(writer, 100);
        await this.waitText();

        clearTimeout(wid);

        let binaryConn : net.Socket | undefined;

        while(this._binaryPort == await getPort({port: getPort.makeRange(this._binaryPort, this._binaryPort + 256)}));

        let binaryTries = 0;
        do {
            binaryTries++;
            try {
                binaryConn = new net.Socket({
                });

                await waitPort({
                    host: '127.0.0.1',
                    port: this._binaryPort,
                    timeout: 10000,
                    interval: 100,
                });

                binaryConn.connect({
                    host: '127.0.0.1',
                    port: this._binaryPort,
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

        await new Promise(resolve => setTimeout(resolve, 100));
        this._textConn.read();

        this._binaryConn.on('data', this._binaryDataHandler.bind(this));

        this._binaryConn.resume();
    }

    public async waitText() : Promise<string> {
        let conn: Readable;
        conn = this._textConn;

        return await new Promise<string>((res, rej) => {
            let gather : string[] = [];

            const waitForViceData = (d : Buffer) => {
                const data = d.toString();

                gather.push(data);
                const match = /^\(C:\$([0-9a-f]+)\)/m.test(data);
                if(match) {
                    conn.off('data', waitForViceData);
                    conn.off('error', rej);
                    res(gather.join(''));
                }
            };

            conn.on('data', waitForViceData);
            conn.on('error', rej);
        });
    }

    public async multiExecText(cmds: string[]) : Promise<string> {
        return (await Promise.all(_(cmds).chunk(MAX_CHUNK).map(async chunk => <string>await this.execText(
            chunk.join(' ; ')
        )).value())).join('\n');
    }

    public async waitForStop<T extends bin.AbstractResponse>() : Promise<T> {
        return await new Promise<T>((res, rej) => {
            const handle = (r) => {
                res(r);
            }
            this._responseEmitter.once('stopped', handle);
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
            const body = bin.commandObjectToBytes(command);
            const requestId = _.random(0, 0xffffffff);
            const buf = Buffer.alloc(11);
            buf.writeUInt8(0x02, 0); // start
            buf.writeUInt8(0x01, 1); // version
            buf.writeUInt32LE(body.length, 2);
            buf.writeUInt32LE(requestId, 6);
            buf.writeUInt8(command.type, 10);
            frags.push(buf);
            frags.push(body);
            return new Promise<U>((res, rej) => {
                try {
                    const rid = requestId.toString(16);
                    const related : bin.AbstractResponse[] = [];
                    const afterResponse = (b : U) => {
                        if(!command.responseType || b.type == command.responseType) {
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
        conn.write(Buffer.concat(frags));
        return await results;
    }

    public async execText(command: string) : Promise<string> {
        let conn : Writable;
        if(!command) {
            return '';
        }

        conn = this._textConn;

        return await new Promise<string>((res, rej) => {
            this._textCmdQueue.push(async () => {
                try {
                    conn.write(command + "\n");
                    const finish = this.waitText();
                    const done = await finish;
                    res(done);
                }
                catch(e) {
                    rej(e);
                    throw e;
                }
            });
        });
    }

    public async end() {
        this._pids[1] > -1 && process.kill(this._pids[1], "SIGKILL");
        this._pids[0] > -1 && process.kill(this._pids[0], "SIGKILL");
        const cmd : bin.QuitCommand = {
            type: bin.CommandType.quit,
        }
        const res : bin.QuitResponse = await this.execBinary(cmd);
        this._textConn && await util.promisify((cb) => this._textConn.end(cb))();
        this._binaryConn && await util.promisify((cb) => this._binaryConn.end(cb))();
        this._pids = [-1, -1];
        this._textConn = <any>null;
        this._binaryConn = <any>null;
        this._textCmdQueue.end();
    }

    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T {
        return this._textConn.pipe(destination, options);
    }

    on(event: string, listener: ((r: bin.AbstractResponse) => void) | (() => void)): this {
        if(event == 'end') {
            this._binaryConn.on('close', listener);
            this._binaryConn.on('finish', listener);
            this._binaryConn.on('end', listener);
        }
        else {
            this._responseEmitter.on(event, listener);
        }

        return this;
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void) : this {
        this._textConn.removeListener(event, listener);

        return this;
    }
}
