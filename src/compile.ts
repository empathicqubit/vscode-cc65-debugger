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

export async function preProcess(buildCwd: string, preprocessCmd: string, opts: {}) : Promise<boolean> {
    try {
        if(!(preprocessCmd && preprocessCmd.trim())) {
            return false;
        }

        await util.promisify(child_process.exec)(preprocessCmd, {
            ...opts,
            cwd: buildCwd,
            shell: undefined,
        }) 

        return true;
    }
    catch(e) {
        console.error(e);
        return false;
    }
}

export async function make(buildCwd: string, buildCmd: string, status: EventEmitter, opts: {}) : Promise<string[]> {
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