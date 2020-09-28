import {setup, teardown, suite, test} from 'mocha'
import * as assert from 'assert';
import * as bin from '../binary-dto'
import * as mocha from 'mocha'
import { CC65ViceRuntime } from '../cc65ViceRuntime'
import * as child_process from 'child_process'
import * as path from 'path'
import * as _ from 'lodash';
import * as tmp from 'tmp';
import * as util from 'util';
import * as TGA from 'tga';
import * as fs from 'fs';

const all = (...args) => Promise.all(args);

suite('Runtime', () => {
    /* These tests require VICE to be installed on your PATH */
    /* All values should be explicitly defined except
        when testing the defaults */
    const BUILD_COMMAND = 'make OPTIONS=mapfile,labelfile,debugfile';
    const PREPROCESS_COMMAND = 'make preprocess-only';
    const BUILD_CWD = __dirname + '/../../src/tests/simple-project';
    const MAP_FILE = BUILD_CWD + '/simple-project.c64.map';
    const DEBUG_FILE = BUILD_CWD + '/simple-project.c64.dbg';
    const LABEL_FILE = BUILD_CWD + '/simple-project.c64.lbl';
    const PROGRAM = BUILD_CWD + '/simple-project.c64'
    const VICE_DIRECTORY = BUILD_CWD + '/../vicedir';

    let seq = 0;
    let request_seq = 0;
    let rt : CC65ViceRuntime;
    let viceArgs : string[] = [];
    let pids : number[] = [];

    const waitFor = async(rt: CC65ViceRuntime, event: string, assertion?: ((...x: any[]) => void)) : Promise<void> => {
        await new Promise((res, rej) => {
            const listener = (...args) => {
                try {
                    assertion && assertion(...args);

                    rt.off(event, listener);
                    res();
                }
                catch(e) {
                    console.log(e);
                }
            };

            rt.on(event, listener);
        });
    }

    setup(async() => {
        rt = new CC65ViceRuntime((args, timeout, cb) => {
            const env : { [key: string]: string | undefined } = _.transform(args.env || {}, (a, c, k) => a[k] = c === null ? undefined : c);
            const proc = child_process.spawn(args.args[0], args.args.slice(1), {
                cwd: args.cwd,
                stdio: "pipe",
                shell: false,
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
            proc.on('close', cleanup);
            proc.on('error', cleanup);
            proc.on('exit', cleanup);
            cb({
                command: 'runInTerminal',
                seq: seq++,
                success: true,
                type: 'response',
                request_seq: request_seq++,
                body: {
                    processId: proc.pid,
                    shellProcessId: proc.pid,
                }
            });
        });

        const emit = rt.emit.bind(rt);
        rt.emit = (...args) => (console.log(args), emit(...args));

        rt.on('output', (...args) => {
            if(args[0] == 'stderr') {
                console.log(args[1]);
            }
        });
    });

    teardown(async () => {
        for(const pid of pids) {
            try {
                process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
            }
            catch {}
        }
        pids = [];
    });

    suite('Build', () => {
        test('Builds successfully', async() => {
            await rt.build(BUILD_CWD, BUILD_COMMAND, PREPROCESS_COMMAND);
        })
    });

    suite('Launch', () => {
        setup(async () => {
            await rt.build(BUILD_CWD, BUILD_COMMAND, PREPROCESS_COMMAND);
        });

        test('Starts and terminates successfully without intervention', async() => {
            await rt.start(
                PROGRAM, 
                BUILD_CWD, 
                false,
                false,
                false, 
                VICE_DIRECTORY,
                viceArgs,
                undefined, 
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await new Promise((res, rej) => {
                rt.once('end', () => {
                    res();
                });
            });
        });

        test('Breaks at the entry point', async() => {
            await rt.start(
                PROGRAM, 
                BUILD_CWD, 
                true,
                false,
                false, 
                VICE_DIRECTORY,
                viceArgs, 
                undefined, 
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnEntry', () => assert.strictEqual(rt.getRegisters().pc, 2147));
            await rt.continue();
            await waitFor(rt, 'end');
        });

        test('Breaks at the exit point', async() => {
            await rt.start(
                PROGRAM, 
                BUILD_CWD, 
                false,
                true,
                false, 
                VICE_DIRECTORY,
                viceArgs, 
                undefined, 
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnStep', () => assert.strictEqual(rt.getRegisters().pc, 2160));
            await rt.continue();
            await waitFor(rt, 'end');
        });

        suite('Headless', () => {
            test('Image grab works', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD,
                    true,
                    false,
                    false, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                const req : bin.DisplayGetCommand = {
                    type: bin.CommandType.displayGet,
                    useVicII: true,
                    format: bin.DisplayGetFormat.BGRA,
                };
                const res : bin.DisplayGetResponse = await rt._vice.execBinary(req);
                const tga = new TGA(res.imageData);
            });
        });

        suite('Runahead', () => {
            test('Restores the original location', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD, 
                    false,
                    true,
                    true, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, 2160));
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by breakpoint', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD, 
                    true,
                    false,
                    true, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), 7);
                await rt.continue();

                await waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc, 2154));
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by step', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD, 
                    true,
                    false,
                    true, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');

                await rt.step();

                await waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, 2154));
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by pause', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD, 
                    true,
                    false,
                    true, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');

                await rt.pause();

                await waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, 2147));
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by step in', async() => {
                await rt.start(
                    PROGRAM, 
                    BUILD_CWD, 
                    true,
                    false,
                    true, 
                    VICE_DIRECTORY,
                    viceArgs, 
                    undefined, 
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), 7);
                await rt.continue();

                await waitFor(rt, 'runahead', () => assert.strictEqual(rt._currentAddress, 2154));

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'runahead', () => assert.strictEqual(rt._currentAddress, 2112)),
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });
    });
});