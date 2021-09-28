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

export const programFiletypes = /\.((d[0-9]{2}|prg)|(vic20|c16|c64|c128|plus4|cbm510|cbm610|pet))$/i

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
    const dbgFileData = await util.promisify(fs.readFile)(filename, 'ascii');
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
