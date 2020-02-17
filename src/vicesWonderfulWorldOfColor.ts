import * as net from 'net';
import { Readable, Writable, EventEmitter } from 'stream';
import * as child_process from 'child_process'
import * as colors from 'colors';
import * as eventStream from 'event-stream'
import * as util from 'util';
import * as fs from 'fs';
import charcodes from './charcodes';


export class VicesWonderfulWorldOfColor {
	private _outputServer: net.Server;
	private _outputTerminalPid: number | undefined;
	// Connection to VICE. Obtained however
	private _conn : Readable & Writable;

	private _handler: (file: string, args: string[], opts: child_process.ExecFileOptions) => Promise<number | undefined>;

	constructor(conn: Readable & Writable, handler: (file: string, args: string[], opts: child_process.ExecFileOptions) => Promise<number | undefined>) {
		this._conn = conn;
		this._handler = handler;
	}

	public async main() {
		const server = new net.Server((sock) => {
			sock.pipe(this._conn);

			const onData = (d : Buffer) => {
				if(d[0] == 0x02) {
					return;
				}

				let data = d.toString();
				// FIXME DRY error. Should push all regexes into common location.
				const memrex = /^(\s*>)([C])(:)([0-9a-f]{4})(\s{2}(([0-9a-f]{2}\s){4}\s){4}\s)(.{16})/gim;
				let memmatch : RegExpExecArray | null;
				let replacements : any = {};
				while(memmatch = memrex.exec(data)) {
					const newString : string[] = [];
					newString.push(memmatch[1], memmatch[2], memmatch[3], memmatch[4]);
					const byteColors : string[] = [];
					let i = 0;
					const hex = memmatch[5].replace(/[0-9a-f]+\s/g, match => {
						const val = parseInt(match, 16);
						let col;
						// "standard characters"
						if(!val) {
							col = colors.gray;
						}
						else if(val >= 0x01 && val <= 0x3f) {
							col = colors.cyan;
						}
						// "graphics characters"
						else if(val >= 0x40 && val <= 0x7f) {
							col = colors.yellow;
						}
						// "inverted standard"
						else if(val >= 0x80 && val <= 0xbf) {
							col = c => colors.bgCyan(colors.black(c));
						}
						// "inverted graphics"
						else {
							col = c => colors.bgYellow(colors.black(c));
						}

						byteColors.push(col(charcodes[val] || memmatch![8][i]))
						i++;
						return col(match);
					});

					newString.push(hex, byteColors.join(''));

					replacements[memmatch[0]] = newString.join('');
				}

				for(const orig in replacements) {
					const replacement = replacements[orig];
					data = data.replace(orig, replacement);
				}

				sock.write(data);
			};

			this._conn.pipe(eventStream.split(/(\r?\n)/)).on('data', onData);

			const bail = () => {
				sock.unpipe(this._conn);
				this._conn.off('data', onData);

				sock.off('close', bail);
				sock.off('end', bail);
				sock.off('destroy', bail);
				sock.off('error', bail);
			};

			sock.on('close', bail);
			sock.on('end', bail);
			sock.on('destroy', bail);
			sock.on('error', bail);
		});

		server.listen(5995, '127.0.0.1');

		this._outputServer = server;

		this._outputTerminalPid = await this._handler('ncat', ['127.0.0.1', '5995'], {});
	}
}