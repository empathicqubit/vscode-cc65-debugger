import * as child_process from 'child_process'
import * as net from 'net'
import * as getPort from 'get-port';
import * as path from 'path';
import * as eventStream from 'event-stream';

const queue = require('queue');

export class ViceGrip {
	private _proc : child_process.ChildProcess;
	private _port : number = -1;
	private _conn: net.Socket;
	private _program: string;
	private _initBreak: number = -1;
	private _cwd: string;
	private _vicePath: string | undefined;

	private _cmdQueue = queue({
		concurrency: 1,
		timeout: 5000,
		autostart: true,
	});

	constructor(program: string, initBreak: number, cwd: string, vicePath?: string) {
		this._program = program;
		this._initBreak = initBreak;
		this._cwd = cwd;
		this._vicePath = vicePath;
	}

	public async start() {
		this._port = await getPort({port: getPort.makeRange(29170, 29970)})

		// FIXME Configurable? Many of these settings are for me
		// due to performance constraints of my Chromebook, but
		// most people probably won't need them. VICE can save
		// its own settings so most probably don't matter, except
		// for NTSC/PAL/etc. That should probably be tied to the
		// debug configuration, and *required*, with no default.

		// If you allowed the entire command to be configurable,
		// then you can stick the model arg and stuff on the end
		// of the array...
		const args = [
			// Monitor
			"-nativemonitor",
			"-remotemonitor", "-remotemonitoraddress", "127.0.0.1:" + this._port,

			// Hardware
			"-model", "ntsc", // FIXME This is bad.
			"-iecdevice8", "-autostart-warp", "-autostart-handle-tde",

			// Serial
			"-rsuser", "-rsuserdev", "2", "-rsuserbaud", "2400",
			"-rsdev3baud", "2400", "-rsdev3ip232",
			...(
				this._initBreak > -1
				? ['-initbreak', this._initBreak.toString()]
				: []
			),

			// Multimedia
			"-sound", "-sidenginemodel", "256", "-residsamp", "0",
			"-VICIIfilter", "0", "+VICIIdsize",
			this._program,
		];

		const opts = {
			shell: false,
			cwd: this._cwd,
		};

		if(this._vicePath) {
			try {
				this._proc = child_process.spawn(this._vicePath, args, opts);
			}
			catch {
				throw new Error('Could not start VICE using your custom path in launch.json->viceCommand property');
			}
		}
		else {
			try {
				this._proc = child_process.spawn('x64', args, opts);
			}
			catch {
				try {
					this._proc = child_process.spawn('x64sc', args, opts);
				}
				catch {
					throw new Error('Could not start either x64 or x64sc. Define your VICE path in your launch.json \"viceCommand\" property');
				}
			}
		}

		const connection = new net.Socket();

		while(this._port == await getPort({port: getPort.makeRange(this._port, this._port + 1)}));

		let tries = 0;
		do {
			tries++;
			await new Promise(resolve => setTimeout(resolve, 1000));
			try {
				connection.connect({
					host: '127.0.0.1',
					port: this._port,
				})
				await new Promise((res, rej) => (connection.on('connect', res), connection.on('error', rej)))
			} catch(e) {
				if(tries > 5) {
					throw e;
				}

				continue;
			}

			this._conn = connection;
			break;
		} while(true);
	}

	public async wait(binary: boolean = false) : Promise<string | Buffer> {
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
						res(Buffer.concat(binaryGather));
						this._conn.removeListener('data', waitForViceData);
						this._conn.removeListener('error', rej);
						return;
					}
				}

				const data = d.toString();
				gather.push(data);
				const match = /^\(C:\$([0-9a-f]+)\)/m.test(data);
				if(match) {
					res(gather.join(''));
					this._conn.removeListener('data', waitForViceData);
					this._conn.removeListener('error', rej);
				}
			};

			this._conn.on('data', waitForViceData);
			this._conn.on('error', rej);
		});
	}

	public async exec(command: string | Uint8Array) : Promise<string | Buffer> {
		if(command instanceof Uint8Array) {
			return await new Promise<string | Buffer>((res, rej) => {
				this._cmdQueue.push(async () => {
					this._conn.write(Buffer.from(command));
					const finish = this.wait(true);
					finish.then(res, rej);
					return await finish;
				});
			});
		}
		else {
			return await new Promise<string | Buffer>((res, rej) => {
				this._cmdQueue.push(async () => {
					this._conn.write(command + "\n");
					const finish = this.wait();
					finish.then(res, rej);
					return await finish;
				});
			});
		}
	}

	public end() {
		this._conn && this._conn.end();
		this._conn = <any>null;
		this._cmdQueue.end();
		this._proc && this._proc.kill();
		this._proc = <any>null;
	}

	on(event: "data", listener: (data: Buffer) => void): this
	on(event: string, listener: (...args: any[]) => void): this {
		if(event == 'data') {
			this._conn.on(event, listener);
		}
		else {
			this._conn.on(event, listener);
		}

		return this;
	}

	public removeListener(event: string, handler: () => void) {
		this._conn.removeListener(event, handler);
	}
}