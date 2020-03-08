import * as util from 'util';
import * as fs from 'fs';
import * as dbgfile from './debugFile';
import * as child_process from 'child_process';

export const programFiletypes = /\.(d[0-9]{2}|prg)$/i

export interface ExecHandler {
    (file: string, args: string[], opts: child_process.ExecFileOptions): Promise<[number, number]>;
}

export async function loadDebugFile(programName: string, buildDir: string) {
    const filename = programName.replace(programFiletypes, '.dbg');
    const dbgFileData = await util.promisify(fs.readFile)(filename, 'ascii');
    return dbgfile.parse(dbgFileData, buildDir);
}
