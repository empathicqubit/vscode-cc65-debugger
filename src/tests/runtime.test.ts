import * as assert from 'assert';
import * as child_process from 'child_process';
import * as fs from 'fs';
import _difference from 'lodash/fp/difference';
import _random from 'lodash/fp/random';
import _transform from 'lodash/transform';
import { setup, suite, teardown, test } from 'mocha';
import * as net from 'net';
import * as path from 'path';
import * as util from 'util';
import * as bin from '../binary-dto';
import * as debugUtils from '../debug-utils';
import * as disassembly from '../disassembly';
import { Runtime } from '../runtime';

const all = (...args) => Promise.all(args);

suite('Runtime', () => {
    /* These tests require VICE to be installed on your PATH */
    /* All values should be explicitly defined except
        when testing the defaults */
    const BUILD_COMMAND = 'make OPTIONS=mapfile,labelfile,debugfile';
    const PREPROCESS_COMMAND = 'make preprocess-only';
    const BUILD_CWD = path.normalize(__dirname + '/../../src/tests/simple-project');
    const PROGRAM = BUILD_CWD + '/simple-project.c64'
    const MAP_FILE = PROGRAM + '.map';
    const DEBUG_FILE = PROGRAM + '.dbg';
    const LABEL_FILE = PROGRAM + '.lbl';
    const VICE_DIRECTORY = typeof process.env.VICE_DIRECTORY != 'undefined' ? process.env.VICE_DIRECTORY : path.normalize(BUILD_CWD + '/../vicedir/src');

    console.log('VICE DIRECTORY ENV', process.env.VICE_DIRECTORY);
    console.log('VICE DIRECTORY', VICE_DIRECTORY);

    let seq = 0;
    let request_seq = 0;
    let rt : Runtime;
    let viceArgs : string[] = [
        '-VICIIborders', '3',
        '+VICIIhwscale',
        '-VICIIcrtblur', '0',
        '-VICIIfilter', '0',
        '+VICIIdscan',
        '+VICIIdsize',
        '+sidfilters',
        '-residsamp', '0',
        '+sound',
        '-sounddev', 'dummy'
    ];
    let pids : number[] = [];

    const waitFor = async(rt: Runtime, event: string, assertion?: ((...x: any[]) => void)) : Promise<void> => {
        await new Promise<void>((res, rej) => {
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
        rt = new Runtime((args, timeout, cb) => {
            if(args.args.find(x => x.includes("monitor.js"))) {
                console.log(args);
                cb({
                    command: 'runInTerminal',
                    seq: seq++,
                    success: true,
                    type: 'response',
                    request_seq: request_seq++,
                    body: {
                        processId: -1,
                        shellProcessId: -1,
                    }
                });
                return;
            }

            const env : { [key: string]: string | undefined } =
                _transform(args.env || {}, (a, c, k) => a[k] = c === null ? undefined : c);
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
            proc.on('disconnect', cleanup);
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

        rt.on('message', (...args) => {
            console.log(args);
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

    suite('Attach', () => {
        const binaryPort = 1024 + Math.floor(Math.random() * 10000);
        let proc : child_process.ChildProcessWithoutNullStreams;

        setup(async () => {
            await rt.build(BUILD_CWD, BUILD_COMMAND, PREPROCESS_COMMAND);

            proc = child_process.spawn(VICE_DIRECTORY + '/x64sc', ['-binarymonitor', '-binarymonitoraddress', `127.0.0.1:${binaryPort}`, '-iecdevice8'], {
                cwd: '/tmp',
                shell: false,
            });

            proc.stdout.pipe(process.stdout);
            proc.stderr.pipe(process.stdout);

            await debugUtils.delay(1000);

            const conn = net.connect(binaryPort, '127.0.0.1');
            const buf = Buffer.from([
                0x02, 0x01,
                0xff, 0xff, 0xff, 0xff,
                0xaf, 0xe9, 0x23, 0x3d,

                0xdd,

                0x01,
                0x00, 0x00,

                0xd2,
                ...new Array<number>(0xd2).fill(0x00)
            ]);
            buf.writeUInt32LE(buf.length - 11, 2);
            buf.write(PROGRAM, buf.indexOf(0xd2) + 1, 'ascii');
            await util.promisify((buf, cb) => conn.write(buf, cb))(buf);
            await new Promise((res, rej) => (conn.once('data', res), conn.once('error', rej)));
            await util.promisify(conn.end.bind(conn))();
        });

        test('Can attach to a running process', async() => {
            await rt.attach(binaryPort, BUILD_CWD, false, false, false, undefined, PROGRAM, DEBUG_FILE, MAP_FILE);
        });

        teardown(async () => {
            const conn = net.connect(binaryPort, '127.0.0.1');
            const buf = Buffer.from([
                0x02, 0x01,
                0x00, 0x00, 0x00, 0x00,
                0xaf, 0xe9, 0x23, 0x3d,

                0xbb
            ]);
            buf.writeUInt32LE(buf.length - 11, 2);
            await util.promisify((buf, cb) => conn.write(buf, cb))(buf);
            try {
                await new Promise((res, rej) => (conn.once('data', res), conn.once('error', rej)));
                await util.promisify(conn.end.bind(conn))();
            }
            catch {}
        });
    });

    suite('Assembly', () => {
        const BUILD_CWD = path.normalize(__dirname + '/../../src/tests/asm-project');
        const MAP_FILE = BUILD_CWD + '/asm-project.c64.map';
        const DEBUG_FILE = BUILD_CWD + '/asm-project.c64.dbg';
        const LABEL_FILE = BUILD_CWD + '/asm-project.c64.lbl';
        const PROGRAM = BUILD_CWD + '/asm-project.c64'

        const MAIN_S = path.join(BUILD_CWD, "src/main.s")

        setup(async () => {
            await rt.build(BUILD_CWD, BUILD_COMMAND, PREPROCESS_COMMAND);
        });

        suite('Essential', () => {
            test('Starts and terminates successfully with intervention', async() => {
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

                await waitFor(rt, 'stopOnEntry');
                await rt.continue();
                await debugUtils.delay(2000);
                await rt.terminate();
            });

            test('Can set a breakpoint', async() => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(MAIN_S, 12);
                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 12)
                    }),
                );

                await waitFor(rt, 'stopOnBreakpoint');

                await rt.terminate();
            });

            test('Can step in', async() => {
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

                await waitFor(rt, 'started');

                await rt.setBreakPoint(MAIN_S, 7);
                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 7)
                    }),
                );

                await waitFor(rt, 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 18)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.terminate();
            });

            test('Can step out', async() => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(MAIN_S, 7);
                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 7)
                    }),
                );

                await waitFor(rt, 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 18)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await all(
                    rt.stepOut(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 9)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.terminate();
            });
        });
    });

    suite('Launch', () => {
        const MAIN_C = path.join(BUILD_CWD, "src/main.c")

        /** This is the zero-based line index to the function signature */
        let mainOffset = -1;
        let thingOffset = -1;
        let stepsOffset = -1;
        let mainContents = '';
        let stepsEntry = -1;
        const labels : { [key:string]:number } = {};
        setup(async () => {
            await rt.build(BUILD_CWD, BUILD_COMMAND, PREPROCESS_COMMAND);

            mainContents = await util.promisify(fs.readFile)(MAIN_C, 'utf8');

            {
                const mainMatch = mainContents.split(/(\s+main\s*\(\s*void\s*\)\s*\{)/gm);

                mainOffset = mainMatch[0].match(/[\r\n]/g)!.length
            }

            {
                const stepsMatch = mainContents.split(/(\s+steps\s*\(\s*void\s*\)\s*\{)/gm);

                stepsOffset = stepsMatch[0].match(/[\r\n]/g)!.length
            }

            {
                const thingMatch = mainContents.split(/(\s+steps\s*\(\s*void\s*\)\s*\{)/gm);

                thingOffset = thingMatch[0].match(/[\r\n]/g)!.length
            }

            const labelFile = await util.promisify(fs.readFile)(LABEL_FILE, "ascii");
            labelFile.split(/[\r\n]+/gim).forEach(x => {
                const spl = x.split(/\s+/gim);
                labels[spl[2]] = parseInt(spl[1], 16);
            });

            stepsEntry = mainOffset + 3;
        });

        suite('Essential', () => {
            test('Non-C64 platform works correctly', async () => {
                const PROGRAM = BUILD_CWD + '/simple-project.pet';
                const MAP_FILE = PROGRAM + '.map';
                const DEBUG_FILE = PROGRAM + '.dbg';
                const LABEL_FILE = PROGRAM + '.lbl';
                const viceArgs = [
                    '+sound',
                    '-sounddev', 'dummy',
                ];

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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(MAIN_C, stepsEntry);
                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint')
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsOffset + 1)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                console.log('STEP OUT')

                await all(
                    rt.stepOut(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, mainOffset + 4)
                    }),
                    waitFor(rt, 'stopOnStep'),
                );

                console.log('CONTINUE')

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Pauses correctly', async () => {
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

                await waitFor(rt, 'stopOnEntry');
                await rt.step();
                await waitFor(rt, 'stopOnStep');
                await rt.setMemory(0x03fc, Buffer.from([0x01]));
                const testCycle = async () => {
                    await rt.continue();
                    await debugUtils.delay(_random(100, 200));
                    await rt.pause();
                    const previousPC = rt.getRegisters().pc;
                    await debugUtils.delay(_random(100, 200));
                    assert.strictEqual(rt.getRegisters().pc, previousPC);
                }
                for(let i = 0; i < 10; i++) {
                    await testCycle();
                }
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

                await new Promise<void>((res, rej) => {
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

                await waitFor(rt, 'stopOnEntry', () => assert.strictEqual(rt.getRegisters().pc, labels['._main']));
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

                await waitFor(rt, 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_C)
                    assert.strictEqual(line, mainOffset + 8)
                });
                await waitFor(rt, 'stopOnExit');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Can set a shitton of breakpoints without them clearing', async() => {
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

                await all(

                    waitFor(rt, 'started'),

                    rt.setBreakPoint(MAIN_C, mainOffset + 1),
                    rt.setBreakPoint(MAIN_C, mainOffset + 2),
                    rt.setBreakPoint(MAIN_C, mainOffset + 3),

                    rt.setBreakPoint(MAIN_C, stepsOffset + 3),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 4),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 5),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 6),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 7),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 8),
                    rt.setBreakPoint(MAIN_C, stepsOffset + 9),

                    rt.setBreakPoint(MAIN_C, thingOffset + 3),
                    rt.setBreakPoint(MAIN_C, thingOffset + 4),
                    rt.setBreakPoint(MAIN_C, thingOffset + 5),
                    rt.setBreakPoint(MAIN_C, thingOffset + 6),

                    rt.setBreakPoint(MAIN_C, thingOffset + 15),
                    rt.setBreakPoint(MAIN_C, thingOffset + 16),
                    rt.setBreakPoint(MAIN_C, thingOffset + 17),
                    rt.setBreakPoint(MAIN_C, thingOffset + 18)
                )

                assert.strictEqual(rt.getBreakpointLength(), 18);
            });

            test('Can step out', async() => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(MAIN_C, stepsEntry);
                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint')
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsOffset + 1)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await all(
                    rt.stepOut(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, mainOffset + 4)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Can step in', async() => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), stepsEntry);

                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint'),
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsOffset + 1)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Contains the correct local variables', async() => {
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

                await waitFor(rt, 'started');

                await rt.setBreakPoint(MAIN_C, stepsOffset + 9);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsOffset + 9)
                    }),
                );

                await waitFor(rt, 'stopOnBreakpoint');

                const locals = await rt.getScopeVariables();

                assert.strictEqual(locals.length, 2);
                assert.strictEqual(_difference(locals.map(x => x.name), ['i', 'j']).length, 0);
                assert.strictEqual(_difference(locals.map(x => x.value), ['0xff', '0xef']).length, 0);

                await rt.continue();
                await waitFor(rt, 'end');
            });
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

                const res = await rt._vice.execBinary({
                    type: bin.CommandType.displayGet,
                    useVicII: true,
                    format: bin.DisplayGetFormat.BGRA,
                });
                assert.strictEqual(res.targaImageData.readUInt8(2), 2);
            });
        });

        suite('Stack', () => {
            test('Contains the frames plus the current position', async () => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), mainOffset + 2);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, mainOffset + 2)
                    })
                );

                await waitFor(rt, 'stopOnStep');

                const frames = await rt.stack(0, 1000);

                assert.deepStrictEqual(
                    frames,
                    {
                        frames: [
                        {
                            index: 0,
                            name: '0x0897',
                            file: BUILD_CWD + '/src/main.c',
                            line: mainOffset + 2
                        },
                        {
                            index: 1,
                            name: 'main',
                            file: BUILD_CWD + '/src/main.c',
                            line: mainOffset + 2
                        }
                        ],
                        count: 2
                    }
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Step in', async () => {
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

                await waitFor(rt, 'stopOnEntry');

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), mainOffset + 2);
                await rt.continue();

                await waitFor(rt, 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_C)
                    assert.strictEqual(line, mainOffset + 2)
                })

                await waitFor(rt, 'stopOnStep');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsOffset + 1)
                    })
                );

                await waitFor(rt, 'stopOnStep');

                const frames = await rt.stack(0, 1000);

                assert.deepStrictEqual(
                    frames,
                    {
                        frames: [
                        {
                            index: 0,
                            name: '0x0840',
                            file: MAIN_C,
                            line: stepsOffset + 1,
                        },
                        {
                            index: 1,
                            name: 'steps',
                            file: MAIN_C,
                            line: stepsOffset + 1
                        },
                        {
                            index: 2,
                            name: 'main',
                            file: MAIN_C,
                            line: mainOffset + 2
                        }
                        ],
                        count: 3
                    }
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });

        suite('Runahead', () => {
            setup(async () => {
            });

            test('Restores the original location', async() => {
                await all([
                    rt.start(
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
                    ),
                    waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, labels['._main'])),
                ])

                await waitFor(rt, 'started');

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

                await rt.setBreakPoint(path.join(BUILD_CWD, "src/main.c"), mainOffset + 2);
                await rt.continue();

                await waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > labels['._main'] && rt.getRegisters().pc < labels['._main'] + disassembly.maxOpCodeSize * 10, true));
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

                await waitFor(rt, 'started');

                await all(
                    rt.step(),
                    waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > labels['._main'] && rt.getRegisters().pc < labels['._main'] + disassembly.maxOpCodeSize * 10, true))
                );
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

                await waitFor(rt, 'started');

                await all([
                    waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc, labels['._main'])),
                    rt.pause()
                ])

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

                await rt.setBreakPoint(MAIN_C, stepsEntry);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_C)
                        assert.strictEqual(line, stepsEntry)
                    })
                )

                await waitFor(rt, 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'runahead', (args) => assert.strictEqual(
                        rt.getRegisters().pc >= labels['._steps']
                        && rt.getRegisters().pc < labels['._steps'] * disassembly.maxOpCodeSize * 10, true
                    )),
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });
    });
});
