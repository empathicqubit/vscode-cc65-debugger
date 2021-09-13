import { EventEmitter } from "events";
import * as fs from 'fs';
import * as child_process from 'child_process';
import watch from 'node-watch';
import _flow from 'lodash/fp/flow';
import _orderBy from 'lodash/fp/orderBy';
import _map from 'lodash/fp/map';
import * as debugUtils from './debug-utils';
import * as util from 'util';
import readdir from 'recursive-readdir';
import * as path from 'path';
import * as os from 'os';

export const DEFAULT_BUILD_COMMAND = 'make OPTIONS=mapfile,labelfile,debugfile';

export async function guessProgramPath(workspaceDir: string) {
    const filenames : string[] = await readdir(workspaceDir);

    const programs = filenames.filter(x => debugUtils.programFiletypes.test(x))

    const fileMeta = await Promise.all(programs.map(async filename => {
        const [fileStats, listingLength] = await Promise.all([
            util.promisify(fs.stat)(filename),
            (async() => {
                const ext = path.extname(filename).toLowerCase();
                if (/^\.d[0-9]{2}$/.test(ext)) {
                    try {
                        const res = await util.promisify(child_process.execFile)('c1541', ['-attach', filename, '-list'])
                        return (res.stdout.match(/[\r\n]+/g) || '').length
                    }
                    catch {}
                }

                return 0;
            })(),
        ]);

        return {
            fileStats,
            filename,
            listingLength,
        };
    }));
    const orderedPrograms = _flow(
        _orderBy<typeof fileMeta[0]>([x => x.fileStats.mtime, x => x.listingLength], ['desc', 'desc']),
        _map((x: typeof fileMeta[0]) => x.filename)
    )(fileMeta);

    return orderedPrograms;
}

/**
* Build the program using the command specified and try to find the output file with monitoring.
* @returns The possible output files of types d81, prg, and d64.
*/
export async function build(buildCwd: string, buildCmd: string, eventEmitter: EventEmitter, cc65Home?: string) : Promise<string[]> {
    let sep = ':';
    if(process.platform == 'win32') {
        sep = ';';
    }
    let binDir : string | undefined;
    if(!cc65Home) {
        if(['linux', 'win32'].includes(process.platform) && ['arm', 'arm64', 'x32', 'x64'].includes(os.arch())) {
            cc65Home = path.normalize(__dirname + '/../dist/cc65');
            binDir = cc65Home + '/bin_' + process.platform + '_' + os.arch();
        }
    }
    else {
        binDir = cc65Home + '/bin';
    }

    console.log('CC65_HOME', cc65Home);
    console.log('CC65 bin folder', binDir);

    const opts : child_process.ExecOptions = {
        shell: <any>true,
        env: {
            PATH: [binDir, process.env.PATH].filter(x => x).join(sep),
            CC65_HOME: [process.env.CC65_HOME, cc65Home].filter(x => x).join(sep),
        }
    };

    const [changedFilenames] = await Promise.all([
        make(buildCwd, buildCmd, eventEmitter, opts),
    ]);

    if(changedFilenames.length) {
        return changedFilenames;
    }

    return await guessProgramPath(buildCwd);
}

export async function make(buildCwd: string, buildCmd: string, status: EventEmitter, opts: child_process.ExecOptions) : Promise<string[]> {
    const builder = new Promise((res, rej) => {
        const process = child_process.spawn(buildCmd, {
            ...opts,
            cwd: buildCwd,
        });

        // FIXME This is a little smelly
        process.stdout.on('data', (d) => {
            setImmediate(() => status.emit('output', 'stdout', d.toString()));
        });

        process.stderr.on('data', (d) => {
            setImmediate(() => status.emit('output', 'stderr', d.toString()));
        });

        process.on('close', (code) => {
            if(code) {
                const err = new Error('Problem making the project');
                rej(err);
            }

            res(code);
        })
    });

    let filenames : string[] = [];
    const watcher = watch(buildCwd, {
        recursive: true,
        filter: f => debugUtils.programFiletypes.test(f),
    }, (evt, filename) => {
        filenames.push(filename || "");
    });

    await builder;

    watcher.close();

    return filenames;
}