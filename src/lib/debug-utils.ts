import _transform from 'lodash/transform';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import readdir from 'recursive-readdir';
import * as dbgfile from './debug-file';
import * as debugFile from './debug-file';
import * as runtime from '../dbg/runtime';

export interface ExtensionMessage {
    level: ExtensionMessageLevel,
    content: string,
    items?: string[],
}

export enum ExtensionMessageLevel {
    information,
    warning,
    error,
}

export async function delay(ms: number) : Promise<void> {
    return new Promise(function(res, rej) {
        setTimeout(function() { res() }, ms)
    });
}

export const programFiletypes = /\.((d[0-9]{2}|prg|dsk)|(apple2|nes|vic20|c16|c64|c128|plus4|cbm510|cbm610|pet))$/i

export interface ExecFileOptions extends child_process.ExecFileOptions {
    title?: string;
}

export interface ExecHandler {
    (file: string, args: string[], opts: ExecFileOptions): Promise<[number, number]>;
}

export function rawBufferHex(buf: Buffer) {
    return buf.toString('hex').replace(/([0-9a-f]{8})/gi, '$1 ').replace(/([0-9a-f]{2})/gi, '$1 ');
}

export async function getDebugFilePath(programName?: string, buildCwd?: string) : Promise<string | undefined> {
    if(!programName || !buildCwd) {
        return;
    }

    const progFile = path.basename(programName, path.extname(programName));

    const possibles : string[] = await util.promisify(readdir)(buildCwd);
    const filename : string | undefined = possibles
        .find(x => /\.dbg$/gi.test(x) && path.basename(x).startsWith(progFile));

    if(!filename) {
        return;
    }

    return filename;
}

export async function loadDebugFile(filename: string, buildDir: string) {
    const dbgFileData = await fs.promises.readFile(filename, 'ascii');
    return dbgfile.parse(dbgFileData, buildDir);
}

export function getLineFromAddress(breakPoints: runtime.CC65ViceBreakpoint[], dbgFile: debugFile.Dbgfile, addr: number) : debugFile.SourceLine {
    let maybeBreakpoint = breakPoints.find(x => x.line.span && x.line.span.absoluteAddress == addr);
    let curSpan : debugFile.DebugSpan;
    if(maybeBreakpoint) {
        curSpan = maybeBreakpoint.line.span!;
    }
    else {
        curSpan = dbgFile.spans
            .find(x =>
                x.absoluteAddress <= addr
                && x.lines.length
                && x.lines.find(l => l.file)
            )
            || dbgFile.spans[0];
    }

    return curSpan.lines.find(x => x.file)
        || curSpan.lines[0];
}

export function DEFAULT_HEADLESS_EXEC_HANDLER(stdout: (data: Buffer) => void, stderr: (data: Buffer) => void) : ExecHandler {
    return async (file, args, opts) => {
        const promise = new Promise<[number, number]>((res, rej) => {

            if(args.find(x => x.includes("monitor.js"))) {
                console.log(args);
                res([-1, -1]);
                return;
            }

            const env : { [key: string]: string | undefined } =
                _transform(opts.env || {}, (a, c, k) => a[k] = c === null ? undefined : c);

            const proc = child_process.spawn(file, args, {
                cwd: opts.cwd,
                stdio: "pipe",
                shell: true,
                //shell: __dirname + "/xterm-c",
                detached: false,
                env: {
                    ...process.env,
                    ...env
                }
            });
            proc.stdout.on('data', stdout);
            proc.stderr.on('data', stderr);
            const cleanup = (e) => {
                proc.stdout.off('data', stdout);
                proc.stderr.off('data', stderr);
                e && console.error(e);
            };
            proc.on('disconnect', cleanup);
            proc.on('close', cleanup);
            proc.on('error', cleanup);
            proc.on('exit', cleanup);

            res([proc.pid, proc.pid]);
        });

        return await promise;
    };
}