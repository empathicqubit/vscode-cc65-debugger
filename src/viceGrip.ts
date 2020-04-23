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

const waitPort = require('wait-port');
const queue = require('queue');

const MAX_CHUNK = 10;

async function * fakeStream() {
    while(true) {
        yield new Promise((res, rej) => setTimeout(() => res('\n(C:$0000) '), 1));
    }
}

export class ViceGrip extends EventEmitter {
    private _port : number = -1;
    private _conn: Readable & Writable;
    private _program: string;
    private _initBreak: number = -1;
    private _cwd: string;
    private _vicePath: string | undefined;
    private _viceArgs: string[] | undefined;

    private _bufferFile: Writable;
    private _bufferFileName: string;
    private _fakeStream: Readable;
    private _consoleHandler: EventEmitter;

    private _cmdQueue = queue({
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

    /**
    * This isn't currently used but it is meant to allow commands to be written
    * to a playback file which will be executed when VICE is started for real
    * with start. I was originally doing this because TCP performance was lacking.
    * my new workaround is to jam a bunch of commands together with ; separators.
    */
    public async openBuffer() {
        this._bufferFileName = await util.promisify(tmp.tmpName)();
        const write =  fs.createWriteStream(this._bufferFileName);
        this._bufferFile = write;
        this._fakeStream = (<any>Readable).from(fakeStream());
    }

    public async start() {
        if(this._fakeStream || this._bufferFile) {
            const fake = this._fakeStream;
            const buf = this._bufferFile;

            this._fakeStream = <any>null;
            this._bufferFile = <any>null;

            fake.destroy();
            buf.end();
        }

        this._port = await getPort({port: getPort.makeRange(29170, 29970)});

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
            "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${this._port}`,

            // Hardware
            "-iecdevice8", "-autostart-delay", "1", "-autostart-warp", "-autostart-handle-tde",

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
            args = [...args, ...this._viceArgs, "-autostart", this._program];
        }
        else {
            args = [...args, "-autostart", this._program];
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

        const connection = new net.Socket();

        while(this._port == await getPort({port: getPort.makeRange(this._port, this._port + 256)}));

        let tries = 0;
        do {
            tries++;
            try {
                await waitPort({
                    host: '127.0.0.1',
                    port: this._port,
                    timeout: 10000,
                    interval: 100,
                });

                connection.connect({
                    host: '127.0.0.1',
                    port: this._port,
                });

            } catch(e) {
                if(tries > 3) {
                    throw e;
                }
                continue;
            }

            this._conn = connection;
            break;
        } while(true);

        if(this._bufferFileName) {
            await this.exec(`pb "${this._bufferFileName}"`);
            await util.promisify(fs.unlink)(this._bufferFileName);
            this._bufferFileName = <any>null;
        }

        this._conn.read();
        const writer = async () => {
            try {
                await util.promisify((d, cb) => this._conn.write(d, cb))('\n');
            }
            catch {
            }

            wid = setTimeout(writer, 100)
        }
        let wid = setTimeout(writer, 100);
        await this.wait();

        clearTimeout(wid);
        await new Promise(resolve => setTimeout(resolve, 100));
        this._conn.read();
    }

    public async wait(binary: boolean = false) : Promise<string | Buffer> {
        let conn: Readable;
        if(this._fakeStream) {
            conn = this._fakeStream;
        }
        else {
            conn = this._conn;
        }

        return await new Promise<string | Buffer>((res, rej) => {
            let gather : string[] = [];

            let binaryLength = -1;
            let binaryCount = 0;
            let binaryGather : Buffer[] = [];
            const waitForViceData = (d : Buffer) => {
                if(binary) {
                    if(binaryLength == -1) {
                        binaryLength = d.readUInt32LE(1) + 6; // STX + address + error byte
                    }
                    binaryGather.push(d);
                    binaryCount += d.length;
                    if(binaryCount >= binaryLength) {
                        conn.removeListener('data', waitForViceData);
                        conn.removeListener('error', rej);
                        res(Buffer.concat(binaryGather));
                        return;
                    }
                }

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

    public async multiExec(cmds: string[]) : Promise<string> {
        return (await Promise.all(_(cmds).chunk(MAX_CHUNK).map(async chunk => <string>await this.exec(
            chunk.join(' ; ')
        )).value())).join('\n');
    }

    public async exec(command: string | Uint8Array) : Promise<string | Buffer> {
        let conn : Writable;
        if(!command) {
            return '';
        }

        if(this._bufferFile) {
            conn = this._bufferFile;
        }
        else {
            conn = this._conn;
        }

        if(command instanceof Uint8Array) {
            return await new Promise<string | Buffer>((res, rej) => {
                this._cmdQueue.push(async () => {
                    try {
                        conn.write(Buffer.from(command));
                        const finish = this.wait(true);
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
        else {
            return await new Promise<string | Buffer>((res, rej) => {
                this._cmdQueue.push(async () => {
                    try {
                        conn.write(command + "\n");
                        const finish = this.wait();
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
    }

    public async end() {
        this._pids[1] > -1 && process.kill(this._pids[1], "SIGKILL");
        this._pids[0] > -1 && process.kill(this._pids[0], "SIGKILL");
        this.exec(`quit`);
        this._conn && await util.promisify((cb) => this._conn.end(cb))();
        this._pids = [-1, -1];
        this._conn = <any>null;
        this._cmdQueue.end();
    }

    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T {
        return this._conn.pipe(destination, options);
    }

    on(event: "data", listener: (data: Buffer) => void): this
    on(event: "end", listener: () => void): this
    on(event: string, listener: (...args: any[]) => void): this {
        if(event == 'data') {
            this._conn.on(event, listener);
        }
        else if(event == 'end') {
            this._conn.on('close', listener);
            this._conn.on('finish', listener);
            this._conn.on('end', listener);
        }
        else {
            this._conn.on(event, listener);
        }

        return this;
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void) : this {
        this._conn.removeListener(event, listener);

        return this;
    }
}
