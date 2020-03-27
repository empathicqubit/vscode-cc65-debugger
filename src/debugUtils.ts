import * as util from 'util';
import * as fs from 'fs';
import * as dbgfile from './debugFile';
import * as child_process from 'child_process';

export const programFiletypes = /\.(d[0-9]{2}|prg|c64)$/i

export interface ExecHandler {
    (file: string, args: string[], opts: child_process.ExecFileOptions): Promise<[number, number]>;
}

export function rawBufferHex(buf: Buffer) {
    return buf.toString('hex').replace(/([0-9a-f]{8})/gi, '$1 ').replace(/([0-9a-f]{2})/gi, '$1 ');
}

export async function loadDebugFile(programName: string, buildDir: string) {
    const match = programFiletypes.exec(programName)!;
    let filename : string;
    if(match[1] == 'c64') {
        filename = programName + '.dbg';
    }
    else {
        filename = programName.replace(programFiletypes, '.dbg');
    }

    const dbgFileData = await util.promisify(fs.readFile)(filename, 'ascii');
    return dbgfile.parse(dbgFileData, buildDir);
}
