import * as net from 'net';
import { Readable, Writable, EventEmitter } from 'stream';
import * as child_process from 'child_process'
import * as colors from 'colors';
import * as getPort from 'get-port';
import * as util from 'util';

export class VicesWonderfulWorldOfColor {
    private _outputServer: net.Server;
    private _outputTerminalPid: number | undefined;
    // Connection to VICE. Obtained however
    private _conn : Readable & Writable;

    _output: EventEmitter;
    private _handler: (file: string, args: string[], opts: child_process.ExecFileOptions) => Promise<number | undefined>;

    constructor(conn: Readable & Writable, output: EventEmitter, handler: (file: string, args: string[], opts: child_process.ExecFileOptions) => Promise<number | undefined>) {
        this._conn = conn;
        this._output = output;
        this._handler = handler;
    }

    public async main() {
        const server = new net.Server((sock) => {
            sock.pipe(this._conn);

            sock.write(colors.green("I'm the VICE monitor!\n"));

            let gather : string[] = [];
            const onData = (data : string) => {
                gather.push(data);
            };

            const concat = () => {
                handler(gather.join(''))
                gather = [];
                setTimeout(concat, 100);
            }

            setTimeout(concat, 100);

            const handler = (data : string) => {
                data = data.replace(/[^ -~\s]+/g, '');

                const asmrex = /^\.([C])(:)([0-9a-f]){4}\s{2}(([0-9a-f]+\s){1,4})\s*(\w{3})\s.*$/gim
                let replacements : any = {};
                let asmmatch : RegExpExecArray | null;
                while(asmmatch = asmrex.exec(data)) {
                    const cmd = asmmatch[6];
                    if(cmd.startsWith('LD')) {
                        replacements[asmmatch[0]] = colors.green(asmmatch[0]);
                    }
                    else if(cmd.startsWith('ST')) {
                        replacements[asmmatch[0]] = colors.red(asmmatch[0]);
                    }
                    else if(cmd.startsWith('J') || cmd.startsWith('B')) {
                        replacements[asmmatch[0]] = colors.yellow(asmmatch[0]);
                    }
                }

                // FIXME DRY error. Should push all regexes into common location.
                const memrex = /^(\s*>)([C])(:)([0-9a-f]{4})(\s{2}(([0-9a-f]{2}\s){4}\s){4}\s)(.{16})/gim;
                let memmatch : RegExpExecArray | null;
                while(memmatch = memrex.exec(data)) {
                    const newString : string[] = [];
                    newString.push(memmatch[1], memmatch[2], memmatch[3], memmatch[4]);
                    const byteColors : string[] = [];
                    let i = 0;
                    const hex = memmatch[5].replace(/[0-9a-f]+\s/g, match => {
                        const val = parseInt(match, 16);
                        let col;
                        if(!val) {
                            col = colors.gray;
                        }
                        else {
                            col = colors.reset;
                        }

                        byteColors.push(col(memmatch![8][i]))
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

            this._output.on('data', onData);
        });

        const port = await getPort({ port: getPort.makeRange(29170, 30000) });
        server.listen(port, '127.0.0.1');

        this._outputServer = server;

        this._outputTerminalPid = await this._handler(process.execPath, [__dirname + '/../dist/nc.js', '127.0.0.1', port.toString()], {});
    }

    public async end() {
        this._outputTerminalPid && process.kill(this._outputTerminalPid, "SIGKILL");
        this._outputServer && await util.promisify(cb => this._outputServer.close(cb))();
        this._outputServer = <any>null;
        this._outputTerminalPid = <any>null;
    }
}
