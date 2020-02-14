/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as fs from 'fs';
import * as _ from 'lodash';
import * as readdir from 'recursive-readdir';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as getPort from 'get-port';
import * as net from 'net';
import * as dbgfile from './debugFile'
import watch from 'node-watch';
import { stringify } from 'querystring';

const queue = require('queue');

export interface CC65ViceBreakpoint {
	id: number;
	line: dbgfile.SourceLine;
	viceIndex: number;
	verified: boolean;
}

/**
 * A CC65Vice runtime with minimal debugger functionality.
 */
export class CC65ViceRuntime extends EventEmitter {

	private _dbgFileName: string;

	private _dbgFile: dbgfile.Dbgfile;

	private _currentAddress: number;

	private _paramStackBottom: number = -1;
	private _paramStackTop: number = -1;
	private _paramStackPointer: number = -1;

	private _cpuStackBottom: number = 0x1ff;
	private _cpuStackTop: number = 0x1ff;

	private _memoryData : Buffer = Buffer.alloc(0xffff);

	private _codeSegAddress: number = -1;
	private _codeSegLength: number = -1;

	private _entryAddress: number = -1;

	private _breakPoints : CC65ViceBreakpoint[] = [];

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private _breakpointId = 1;

	private _viceProc : child_process.ChildProcess;

	private _vicePort : number;

	private _viceRunning : boolean = false;

	private _currentPosition: dbgfile.SourceLine;
	private _viceConnection: net.Socket;

	private _viceQueue = queue({
		concurrency: 1,
		timeout: 5000,
		autostart: true,
	});

	constructor() {
		super();
	}

	public async startVice(program: string, initBreak: number, vicePath?: string) {
		this._vicePort = await getPort({port: getPort.makeRange(29170, 29970)})

		const args = [
			"-iecdevice8",
			"+VICIIdsize",
			"-rsuser",
			"-rsuserdev",
			"2",
			"-rsdev3baud",
			"2400",
			"-rsuserbaud",
			"2400",
			"-rsdev3ip232",
			...(initBreak > -1
			? ['-initbreak', initBreak.toString()]
			: []),
			"-nativemonitor",
			"-remotemonitor",
			"-remotemonitoraddress",
			"127.0.0.1:" + this._vicePort,
			"-VICIIfilter",
			"0",
			"-model",
			"ntsc",
			"-iecdevice8",
			"-autostart-warp",
			"-sidenginemodel",
			"256",
			"-sound",
			"-autostart-handle-tde",
			"-residsamp",
			"0",
			program,
		];

		const opts = {
			shell: false,
			cwd: path.dirname(this._dbgFileName),
		};

		if(vicePath) {
			try {
				this._viceProc = child_process.spawn(vicePath, args, opts);
			}
			catch {
				throw new Error('Could not start VICE using your custom path in launch.json->viceCommand property');
			}
		}
		else {
			try {
				this._viceProc = child_process.spawn('x64', args, opts);
			}
			catch {
				try {
					this._viceProc = child_process.spawn('x64sc', args, opts);
				}
				catch {
					throw new Error('Could not start either x64 or x64sc. Define your VICE path in your launch.json \"viceCommand\" property');
				}
			}
		}

		const connection = new net.Socket();

		while(this._vicePort == await getPort({port: getPort.makeRange(this._vicePort, this._vicePort + 1)}));

		let tries = 0;
		do {
			tries++;
			await new Promise(resolve => setTimeout(resolve, 1000));
			try {
				connection.connect({
					host: '127.0.0.1',
					port: this._vicePort,
				})
				await new Promise((res, rej) => (connection.on('connect', res), connection.on('error', rej)))
			} catch(e) {
				if(tries > 5) {
					throw e;
				}

				continue;
			}

			this._viceConnection = connection;
			this._setupViceDataHandler();
			break;
		} while(true);

		await this.continue();
		await this.waitForVice();
		await this._setParamStackBottom();

		this.sendEvent('output', 'console', 'Console is VICE monitor enabled!\n\n')
	}

	private _setupViceDataHandler() {
		let breakpointHit = false;

		this._viceConnection.on('data', async (d) => {
			const data = d.toString();

			// Address changes always produce this line.
			// The command line prefix may not match as it
			// changes for others that get executed.
			const addrexe = /^\.C:([0-9a-f]+)([^\r\n]+\s+SP:([0-9a-f]+)\s+)?/im.exec(data);
			if(addrexe) {
				this._viceRunning = false;

				const addr = parseInt(addrexe[1], 16);
				this._currentAddress = addr
				this._currentPosition = this._getLineFromAddress(addr);

				this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.line, 0);

				if(addrexe[3]) {
					this._cpuStackTop = 0x100 + parseInt(addrexe[3], 16)
				}
			}

			// Also handle the register data format
			const regs = /\s*ADDR\s+A\s+X\s+Y\s+SP\s+00\s+01\s+NV-BDIZC\s+LIN\s+CYC\s+STOPWATCH\s+\.;([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)/im.exec(data);
			if(regs) {
				const addr = parseInt(regs[1], 16);
				this._currentAddress = addr
				this._currentPosition = this._getLineFromAddress(addr);

				this.sendEvent('output', 'console', null, this._currentPosition.file!.name, this._currentPosition.line, 0);
			}

			const memrex =/^\>C:([0-9a-f]+)((\s+[0-9a-f]{2}){1,9})/gim;
			let memmatch = memrex.exec(data);
			if(memmatch) {
				do {
					const addr = parseInt(memmatch[1]|| "0", 16);
					let i = 0;
					const md = this._memoryData;
					for(const byt of memmatch[2].split(/\s+/g)) {
						if(!byt) {
							continue;
						}

						md.writeUInt8(parseInt(byt, 16), addr + i);
						i++;
					}
				} while(memmatch = memrex.exec(data))
			}

			const breakrex = /^#([0-9]+)\s+\(Stop\s+on\s+exec\s+([0-9a-f]+)\)\s+/gim;
			let breakmatch = breakrex.exec(data)

			if(breakmatch) {
				// Set the current position only once
				const addr = parseInt(breakmatch[2], 16);
				this._currentAddress = addr
				this._currentPosition = this._getLineFromAddress(addr);

				let idx = parseInt(breakmatch[1]);

				const userBreak = this._breakPoints.find(x => x.line.span && x.line.span.absoluteAddress == this._currentPosition.span!.absoluteAddress);
				if(userBreak) {
					this.sendEvent('stopOnBreakpoint', 'console', null, this._currentPosition.file!.name, this._currentPosition.line, 0);
				}

			}
		})
	}

	public async getScopeVariables() : Promise<any[]> {
		const stack = await this.getParamStack();
		const scope = this._dbgFile.scopes
			.find(x => x.span
				&& x.span.absoluteAddress <= this._currentPosition.span!.absoluteAddress
				&& this._currentPosition.span!.absoluteAddress <= x.span.absoluteAddress + x.span.size);

		if(!scope) {
			return [];
		}

		const vars : {name : string, value: string, addr: number}[] = [];
		const mostOffset = scope.csyms[0].offs;
		for(let i = 0; i < scope.csyms.length; i++) {
			const csym = scope.csyms[i];
			const nextCsym = scope.csyms[i+1];
			if(csym.sc == dbgfile.sc.auto) {
				const seek = -mostOffset+csym.offs;
				let seekNext = mostOffset;
				if(nextCsym) {
					seekNext = -mostOffset+nextCsym.offs
				}

				let val;
				if(seekNext - seek == 2) {
					val = stack.readUInt16LE(seek);
				}
				else {
					val = stack.readUInt8(seek);
				}

				vars.push({
					name: csym.name,
					value: "0x" + val.toString(16),
					addr: this._paramStackTop + seek,
				});
			}
		}
		for(const csym of scope.csyms) {
		}

		return vars;
	}

	public async getParamStack() : Promise<Buffer> {
		await this.setParamStackTop();

		return await this.getMemory(this._paramStackTop, this._paramStackBottom - this._paramStackTop)
	}

	public async getGlobalVariables() : Promise<any[]> {
		const vars: {name: string, value: string, addr: number}[] = [];
		for(const sym of this._dbgFile.syms) {
			if(sym.type != "lab" || !sym.name.startsWith("_")) {
				continue;
			}

			const mem = await this.getMemory(sym.val, 2);

			vars.push({ name: sym.name.replace(/^_/g, ''), value: mem.toString('hex'), addr: sym.val })
		}

		return vars;
	}

	private _setParamStackPointer() {
		const zp = this._dbgFile.segs.find(x => x.name == 'ZEROPAGE');
		if(!zp) {
			return -1;
		}

		this._paramStackPointer = zp.start;
	}

	public async getParamStackPos() : Promise<number> {
		const res = await this.getMemory(this._paramStackPointer, 2);
		return res.readUInt16LE(0);
	}

	private async _setParamStackBottom() {
		this._paramStackBottom = await this.getParamStackPos();
	}

	public async setParamStackTop() {
		this._paramStackTop = await this.getParamStackPos();
	}

	public async getMemory(addr: number, length: number) : Promise<Buffer> {
		if(length <= 0) {
			return Buffer.alloc(0);
		}

		const end = addr + (length - 1);
		const cmd = new Uint8Array(9);
		cmd[0] = 0x02; // Binary marker
		cmd[1] = cmd.length - 3; // Length
		cmd[2] = 0x01; // memdump, the only binary command
		cmd[3] = addr & 0x00FF // Low byte
		cmd[4] = addr>>8; // High byte
		cmd[5] = end & 0x00FF // Low byte
		cmd[6] = end>>8; // High byte
		cmd[7] = 0x00; // Memory context (Computer)
		cmd[8] = '\n'.charCodeAt(0); // Memory context (Computer)

		const buf : Buffer = <Buffer>(await this.viceExec(cmd));

		const resLength = buf.readUInt32LE(1);

		let i = 0;
		const res = buf.slice(6, 6 + resLength);
		for(const byt of res) {
			this._memoryData.writeUInt8(byt, addr + i);
			i++;
		}

		return res;
	}

	public async setCpuStack() {
		let i = 0;
		for(const byt of await this.getMemory(this._cpuStackTop, this._cpuStackBottom - this._cpuStackTop)){
			this._memoryData.writeUInt8(byt, this._cpuStackTop + i)
		}
	}

	private _getLineFromAddress(addr: number) : dbgfile.SourceLine {
		const curSpan = this._dbgFile.spans
			.find(x =>
				x.absoluteAddress <= addr
				&& x.lines.length
				&& x.lines.find(l => l.file && /\.c$/gi.test(l.file.name))
			)
			|| this._dbgFile.spans[0];

		return curSpan.lines
			.find(x => x.file && /\.c$/gi.test(x.file.name))
			|| this._dbgFile.lines[0];
	}

	public async waitForVice(binary: boolean = false) : Promise<string | Buffer> {
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
						this._viceConnection.removeListener('data', waitForViceData);
						this._viceConnection.removeListener('error', rej);
						return;
					}
				}

				const data = d.toString();
				gather.push(data);
				const match = /^\(C:\$([0-9a-f]+)\)/m.test(data);
				if(match) {
					res(gather.join(''));
					this._viceConnection.removeListener('data', waitForViceData);
					this._viceConnection.removeListener('error', rej);
				}
			};

			this._viceConnection.on('data', waitForViceData);
			this._viceConnection.on('error', rej);
		});
	}

	private _getBreakpointMatches(breakpointText: string) : number[][] {
		const rex = /^(BREAK|TRACE):\s+([0-9]+)\s+C:\$([0-9a-f]+)/gim;

		const matches : number[][] = [];
		let match;
		while (match = rex.exec(breakpointText)) {
			matches.push([parseInt(match[2]), parseInt(match[3], 16)]);
		}

		return matches;
	}

	private _getBreakpointNum(breakpointText: string) : number {
		return this._getBreakpointMatches(breakpointText)[0][0];
	}

	public async viceExec(command: string | Uint8Array) : Promise<string | Buffer> {
		if(command instanceof Uint8Array) {
			return await new Promise<string | Buffer>((res, rej) => {
				this._viceQueue.push(async () => {
					this._viceConnection.write(Buffer.from(command));
					const finish = this.waitForVice(true);
					finish.then(res, rej);
					return await finish;
				});
			});
		}
		else {
			return await new Promise<string | Buffer>((res, rej) => {
				this._viceQueue.push(async () => {
					this._viceConnection.write(command + "\n");
					const finish = this.waitForVice();
					finish.then(res, rej);
					return await finish;
				});
			});
		}
	}

	// Clean up all the things
	public async terminate() : Promise<void> {
		this._viceConnection && this._viceConnection.end();
		this._viceConnection = <any>null;
		this._viceQueue.end();
		this._viceRunning = false;
		this._viceProc && this._viceProc.kill();
		this._viceProc = <any>null;
		this._dbgFile = <any>null;
	}

	/**
	 * Build the program using the command specified and try to find the output file with monitoring.
	 * @returns The possible output files of types d81, prg, and d64.
	 */
	public async build(workspaceDir: string, cmd: string) : Promise<string[]> {
		const builder = new Promise((res, rej) => {
			const process = child_process.spawn(cmd, {
				shell: true,
				cwd: workspaceDir,
			})

			process.stdout.on('data', (d) => {
				this.sendEvent('output', 'stdout', d.toString());
			});

			process.stderr.on('data', (d) => {
				this.sendEvent('output', 'stderr', d.toString());
			});

			process.on('close', (code) => {
				if(code) {
					rej(code);
				}

				res(code);
			})
		});

		const filetypes = /\.(d[0-9]{2}|prg)$/i
		let filenames : string[] = [];
		const watcher = watch(workspaceDir, {
			recursive: true,
			filter: f => filetypes.test(f),
		}, (evt, filename) => {
			filenames.push(filename);
		});

		await builder;

		watcher.close();
		if(filenames.length) {
			return filenames;
		}

		filenames = await readdir(workspaceDir)

		filenames = filenames.filter(x => filetypes.test(x))

		const files = await Promise.all(filenames.map(async filename => {
			const fileStats = await util.promisify(fs.stat)(filename);
			let listingLength : number = 0;
			const ext = path.extname(filename).toLowerCase();
			if (/^\.d[0-9]{2}$/.test(ext)) {
				try {
					const res = await util.promisify(child_process.execFile)('c1541', ['-attach', filename, '-list'])
					listingLength = (res.stdout.match(/[\r\n]+/g) || '').length
				}
				catch {}
			}

			return {
				fileStats,
				filename,
				listingLength,
			};
		}));

		filenames = _(files)
			.orderBy([x => x.fileStats.mTime, x => x.listingLength], ['desc', 'desc'])
			.map(x => x.filename)
			.value();

		return filenames;
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, vicePath?: string) {
		const filetypes = /\.(d[0-9]{2}|prg)$/gi
		if(!filetypes.test(program)) {
			throw new Error("File must be a Commodore Disk image or PRoGram.");
		}

		this.loadSource(program.replace(filetypes, ".dbg"));

		const codeSeg = this._dbgFile.segs.find(x => x.name == "CODE");

		if(codeSeg) {
			this._codeSegAddress = codeSeg.start;
			this._codeSegLength = codeSeg.size;
		}

		const startSym = this._dbgFile.syms.find(x => x.name == "_main" && x.type == "lab");

		if(startSym != null) {
			this._entryAddress = startSym.val
		}

		this._setParamStackPointer();

		await this.startVice(program, this._entryAddress, vicePath);

		await this.verifyBreakpoints();

		if (stopOnEntry) {
			// we step once
			await this.step(false, 'stopOnEntry');
		} else {
			// we just start to run until we hit a breakpoint or an exception
			await this.continue();
		}
	}

	public async continue(reverse = false) {
		this._viceRunning = true;
		await this.viceExec('x');
	}

	public async step(reverse = false, event = 'stopOnStep') {
		// Find the next source line and continue to it.
		const currentFile = this._currentPosition.file;
		const currentIdx = currentFile!.lines.indexOf(this._currentPosition);
		let nextLine = currentFile!.lines[currentIdx + 1];
		if(!nextLine) {
			await this.viceExec('z');
		}
		else {
			const nextAddress = nextLine.span!.absoluteAddress;
			this._viceRunning = true;
			await this.viceExec(`un ${nextAddress.toString(16)}`);
		}
		this.sendEvent(event, 'console')
	}

	public async stepIn() {
		const thisSpan = this._currentPosition.span!;
		const thisSegAddress = thisSpan.absoluteAddress - 1;
		const endCodeSeg = (this._codeSegAddress + this._codeSegLength).toString(16);

		const brk = <string>await this.viceExec(`watch exec \$${this._codeSegAddress.toString(16)} \$${thisSegAddress.toString(16)}`);
		const brk2 = <string>await this.viceExec(`watch exec \$${(thisSegAddress + thisSpan.size).toString(16)} \$${endCodeSeg}`);

		const brknum = this._getBreakpointNum(brk);
		const brknum2 = this._getBreakpointNum(brk2);

		await this.viceExec(`x`);

		await this.viceExec(`del ${brknum}`);
		await this.viceExec(`del ${brknum2}`);
		this.sendEvent('stopOnStep', 'console')
	}

	public async stepOut(event = 'stopOnStep') {
		await this.viceExec('ret');
		this.sendEvent(event, 'console')
	}

	public async pause() {
		await this.viceExec('r');
		this.sendEvent('stopOnStep', 'console')
	}

	public async stack(startFrame: number, endFrame: number): Promise<any> {
		await this.setCpuStack();

		const frames = new Array<any>();
		let i = startFrame;
		frames.push({
			index: i,
			name: this._currentAddress.toString(16),
			file: this._currentPosition.file!.name,
			line: this._currentPosition.line
		});
		i++;

		for(const byt of this._memoryData.slice(this._cpuStackTop, this._cpuStackBottom + 1)) {
			frames.push({
				index: i,
				name: byt.toString(16),
				file: this._currentPosition.file!.name,
				line: this._currentPosition.line
			});
			i++;
		}

		return {
			frames: frames,
			count: frames.length,
		};
	}

	public getBreakpoints(path: string, line: number): number[] {
		return [];
	}

	/*
	 * Set breakpoint in file with given line.
	 */
	public async setBreakPoint(path: string, line: number) : Promise<CC65ViceBreakpoint | null> {
		let lineSym : dbgfile.SourceLine | undefined;
		if(this._dbgFile) {
			lineSym = this._dbgFile.lines.find(x => x.line == line && path.includes(x.file!.name))
			if(!lineSym){
				return null;
			}
		}

		if(!lineSym) {
			const fil : dbgfile.SourceFile = {
				mtime: new Date(),
				name: path,
				mod: "",
				lines: [],
				id: 0,
				size: 0,
			};
			lineSym = {
				count: 0,
				id: 0,
				line: line,
				span: null,
				spanId: 0,
				file: fil,
				fileId: 0,
				type: 0,
			};
		}

		const bp = <CC65ViceBreakpoint> { verified: false, line: lineSym, viceIndex: -1, id: this._breakpointId++ };
		this._breakPoints.push(bp);

		await this.verifyBreakpoints();

		return bp;
	}

	private async _clearBreakPoint(bp: CC65ViceBreakpoint) : Promise<CC65ViceBreakpoint | undefined> {
		const index = this._breakPoints.indexOf(bp);
		this._breakPoints.splice(index, 1);

		await this.viceExec(`del ${bp.viceIndex}`);

		// Also clean up breakpoints with the same address.
		const bks = this._getBreakpointMatches(<string>await this.viceExec(`bk`));
		for(const bk of bks) {
			const addr = bk[1];
			const idx = bk[0];
			if(addr == bp.line.span!.absoluteAddress) {
				await this.viceExec(`del ${idx.toString()}`)
			}
		}

		return bp;
	}

	/*
	 * Clear all breakpoints.
	 */
	public async clearBreakpoints(p : string): Promise<void> {
		for(const bp of [...this._breakPoints]) {
			if(!bp.line.file!.name.includes(p)) {
				continue;
			}

			await this._clearBreakPoint(bp);
		}
	}

	/*
	 * Set data breakpoint.
	 */
	public setDataBreakpoint(address: string): boolean {
		return false;
	}

	/*
	 * Clear all data breakpoints.
	 */
	public clearAllDataBreakpoints(): void {
	}

	private loadSource(file: string) {
		this._dbgFileName = file;
		let dbgFileData : string;
		try {
			dbgFileData = fs.readFileSync(this._dbgFileName).toString();
		}
		catch {
			throw new Error(
	`Could not load debug symbols file from cc65. It must nave
	the same name as your d84/d64/prg file with an .dbg extension.`
			);
		}

		this._dbgFile = dbgfile.parse(dbgFileData, file);
	}

	private async verifyBreakpoints() : Promise<void> {
		if(!this._dbgFile || !this._viceConnection) {
			return;
		}

		const wasRunning = this._viceRunning;

		for(const bp of this._breakPoints) {
			const sourceFile = this._dbgFile.files.find(x => x.lines.find(x => x.line == bp.line.line) && x.name == bp.line.file!.name);
			if (sourceFile && !bp.verified && bp.line.line <= sourceFile.lines[sourceFile.lines.length - 1].line) {
				const srcLine = sourceFile.lines.find(x => x.line >= bp.line.line) || sourceFile.lines[sourceFile.lines.length / 2];

				bp.line = srcLine;

				const res = <string>await this.viceExec(`bk ${srcLine.span!.absoluteAddress.toString(16)}`);
				const idx = this._getBreakpointNum(res);

				bp.viceIndex = idx;
				bp.verified = true;
				this.sendEvent('breakpointValidated', bp);
			}
		}

		if(wasRunning) {
			await this.continue();
		}
	}

	/**
	 * Fire events if line has a breakpoint or the word 'exception' is found.
	 * Returns true is execution needs to stop.
	 */
	private fireEventsForLine(ln: number, stepEvent?: string): boolean {
		return false;
	}

	private sendEvent(event: string, ... args: any[]) {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}
}
