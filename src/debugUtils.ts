import * as util from 'util';
import * as fs from 'fs';
import * as dbgfile from './debugFile';
import * as child_process from 'child_process';
import * as path from 'path';

export const programFiletypes = /\.(d[0-9]{2}|prg|c64)$/i

export interface ExecHandler {
    (file: string, args: string[], opts: child_process.ExecFileOptions): Promise<[number, number]>;
}

export function rawBufferHex(buf: Buffer) {
    return buf.toString('hex').replace(/([0-9a-f]{8})/gi, '$1 ').replace(/([0-9a-f]{2})/gi, '$1 ');
}

export async function loadDebugFile(programName: string, buildDir: string) {
    const progDir = path.dirname(programName);
    const progFile = path.basename(programName, path.extname(programName));

    const possibles = await util.promisify(fs.readdir)(progDir);
    const filename : string | undefined = possibles
        .find(x => path.extname(x) == '.dbg' && path.basename(x).startsWith(progFile));

    if(!filename) {
        throw new Error("Could not find debug file");
    }

    const dbgFileData = await util.promisify(fs.readFile)(path.join(progDir, filename), 'ascii');
    return dbgfile.parse(dbgFileData, buildDir);
}
