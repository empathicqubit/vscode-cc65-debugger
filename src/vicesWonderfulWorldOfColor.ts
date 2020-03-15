import * as net from 'net';
import { Readable, Writable, EventEmitter } from 'stream';
import * as child_process from 'child_process'
import * as colors from 'colors';
import * as getPort from 'get-port';
import * as util from 'util';
import * as debugUtils from './debugUtils';
import { ViceGrip } from './viceGrip';

const contentMangler = (data : string) : string => {
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

    return data;
};

export class VicesWonderfulWorldOfColor {
    private _outputServer: net.Server;
    private _outputTerminalPids: [number, number];

    _output: EventEmitter;
    private _handler: debugUtils.ExecHandler;
    private _vice: ViceGrip;

    constructor(
        vice: ViceGrip,
        output: EventEmitter,
        handler: debugUtils.ExecHandler,
    ) {
        this._output = output;
        this._handler = handler;
        this._vice = vice;
    }

    public async enableFlood(sock: net.Socket) {
        let gather : string[] = [];
        const onData = (data : string) => {
            gather.push(data);
        };

        const concat = () => {
            sock.write(contentMangler(gather.join('')));
            gather = [];
            setTimeout(concat, 100);
        }

        setTimeout(concat, 100);

        this._output.on('data', onData);


    }

    public async main() {
        const server = new net.Server((sock) => {
            sock.write(colors.green(
`I'm the VICE monitor! I only display responses to your commands, but if you want
to see everything going on behind the scenes, type the command "!iwantitall"
`));
            const onData = async data => {
                const cmd = data.toString().split(/[\r\n]+/g)[0];
                if(/^\s*!\s*iwantitall/gi.test(cmd)) {
                    sock.write("And I want it now!\n");

                    this.enableFlood(sock);
                }
                else {
                    const res = <string>await this._vice.exec(cmd);
                    sock.write(contentMangler(res));
                }
            };

            sock.on('data', onData);
        });

        const port = await getPort({ port: getPort.makeRange(29170, 30000) });
        server.listen(port, '127.0.0.1');

        this._outputServer = server;

        this._outputTerminalPids = await this._handler(process.execPath, [__dirname + '/../dist/nc.js', '127.0.0.1', port.toString()], {});
    }

    public async end() {
        this._outputTerminalPids[1] > -1 && process.kill(this._outputTerminalPids[1], "SIGKILL");
        this._outputTerminalPids[0] > -1 && process.kill(this._outputTerminalPids[0], "SIGKILL");
        this._outputServer && await util.promisify((cb: (err?: Error | undefined) => void) => this._outputServer.close(cb))();
        this._outputServer = <any>null;
        this._outputTerminalPids = [-1, -1];
    }
}
