import * as assert from 'assert';
import * as compile from '../compile';
import * as path from 'path';
import * as debugUtils from '../debug-utils';
import _transform from 'lodash/transform';
import * as child_process from 'child_process';

describe('Compile', () => {
    const BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/simple-project');
    const PROGRAM = BUILD_CWD + '/simple-project.c64';

    let pids : number[] = [];
    let execHandler : debugUtils.ExecHandler;
    beforeEach(() => {
        execHandler = (file, args, opts) => {
            const promise = new Promise<[number, number]>((res, rej) => {
                if(args.find(x => x.includes("monitor.js"))) {
                    console.log(args);
                    return [-1, -1];
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
                proc.stdout.pipe(process.stdout);
                proc.stderr.pipe(process.stderr);
                pids.push(proc.pid);
                const cleanup = (e) => {
                    proc.stdout.unpipe(process.stdout);
                    proc.stdout.unpipe(process.stderr);
                    pids.splice(pids.indexOf(proc.pid), 1);
                    e && console.error(e)
                };
                proc.on('disconnect', cleanup);
                proc.on('close', cleanup);
                proc.on('error', cleanup);
                proc.on('exit', cleanup);

                res([proc.pid, proc.pid]);
            });

            return promise;
        };
    })

    afterEach(async () => {
        for(const pid of pids) {
            try {
                process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
            }
            catch {}
        }
        pids = [];
    });

    test('Build works', async () => {
        await compile.clean(BUILD_CWD, execHandler);
        await compile.build(BUILD_CWD, BUILD_COMMAND, execHandler);
    });

    test('Build works with 32-bit compiler', async () => {
        const oldExecHandler = execHandler;
        execHandler = (file, args, opts) => {
            let sep = ':';
            if(process.platform == 'win32') {
                sep = ';';
            }

            if(opts && opts.env && opts.env.PATH) {
                opts.env.PATH = opts.env.PATH.replace(/\/cc65\/bin_(\w+)_\w+/g, '/cc65/bin_$1_x32');
                console.log(opts.env.PATH);
            }
            return oldExecHandler(file, args, opts);
        }
        await compile.clean(BUILD_CWD, execHandler);
        await compile.build(BUILD_CWD, BUILD_COMMAND, execHandler);
    });

    test('Can guess the program path', async () => {
        await compile.make(BUILD_CWD, BUILD_COMMAND, execHandler, {
            shell: <any>true,
        });
        const possibles = await compile.guessProgramPath(BUILD_CWD);
        assert.strictEqual(possibles.includes(PROGRAM), true);
    });
});
