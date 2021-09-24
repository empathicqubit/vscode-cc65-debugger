import * as assert from 'assert';
import * as child_process from 'child_process';
import _random from 'lodash/fp/random';
import * as testShared from './test-shared';
import * as net from 'net';
import * as path from 'path';
import * as util from 'util';
import * as compile from '../compile';
import * as debugUtils from '../debug-utils';
import * as disassembly from '../disassembly';
import { LaunchRequestBuildArguments } from '../launch-arguments';
import * as metrics from '../metrics';
import { Runtime } from '../runtime';

metrics.options.disabled = true;

const all = (...args) => Promise.all(args);

// Line numbers are from zero, you moron.

describe('Runtime', () => {
    /* These tests require VICE to be installed on your PATH */
    /* All values should be explicitly defined except
        when testing the defaults */
    const BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/simple-project');
    const BUILD_ARGS = compile.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }
    const PROGRAM = BUILD_CWD + '/simple-project.c64'
    const MAP_FILE = PROGRAM + '.map';
    const DEBUG_FILE = PROGRAM + '.dbg';
    const LABEL_FILE = PROGRAM + '.lbl';
    const VICE_DIRECTORY = typeof process.env.VICE_DIRECTORY != 'undefined' ? process.env.VICE_DIRECTORY : path.normalize(BUILD_CWD + '/../vicedir/src');

    console.log('VICE DIRECTORY ENV', process.env.VICE_DIRECTORY);
    console.log('VICE DIRECTORY', VICE_DIRECTORY);

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

    const selectCTest = async (rt: Runtime, testName: string) => {
        const lab = rt._dbgFile.labs.find(x => x.name == `_${testName}_main`)!;
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(lab.val);
        console.log(lab);
        await rt.setMemory(0x03fc, buf);
    }

    const getLabel = (rt: Runtime, name: string) : number => {
        return (rt._dbgFile.labs.find(x => x.name == name) || { val: 0x00 }).val;
    }

    const waitFor = async(rt: Runtime, event: string, assertion?: ((...x: any[]) => void)) : Promise<void> => {
        const err = new Error('Timed out waiting for assertion');
        await new Promise<void>((res, rej) => {
            let finished = false;
            setTimeout(() => {
                if(!finished) {
                    rej(err);
                }
            }, 10000);

            const listener = (...args) => {
                try {
                    assertion && assertion(...args);

                    finished = true;
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

    let pids : number[] = [];
    const execHandler : debugUtils.ExecHandler = async (f, a, o) => {
        const ret = await testShared.DEFAULT_TEST_EXEC_HANDLER(f, a, o)
        pids.push(...ret);

        return ret;
    };

    const rts : Runtime[] = [];
    const newRuntime = async() : Promise<Runtime> => {
        const rt = new Runtime(execHandler);

        const emit = rt.emit.bind(rt);
        rt.emit = (...args) => (console.log([expect.getState().currentTestName, ...args]), emit(...args));

        rt.on('output', (...args) => {
            if(args[0] == 'stderr') {
                console.log([expect.getState().currentTestName, args[1]]);
            }
        });

        rt.on('message', (...args) => {
            console.log([expect.getState().currentTestName, ...args]);
        });

        rts.push(rt);

        return rt;
    };

    afterEach(async () => {
        const killPids = [...pids];
        const killRts = [...rts];

        for(const rt of killRts) {
            rt.terminate();
            rts.splice(rts.indexOf(rt), 1);
        }

        await debugUtils.delay(500);

        for(const pid of killPids) {
            try {
                pid != -1 && process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
            }
            catch {}

            pids.splice(pids.indexOf(pid), 1);
        }
    });

    describe('Attach', () => {
        const binaryPort = 1024 + Math.floor(Math.random() * 10000);
        let proc : child_process.ChildProcessWithoutNullStreams;

        beforeAll(async () => {
            await compile.build(BUILD, execHandler);
        });

        beforeEach(async () => {
            const pids = await execHandler(path.join(VICE_DIRECTORY, 'x64sc'), ['-binarymonitor', '-binarymonitoraddress', `127.0.0.1:${binaryPort}`, '-iecdevice8'], {
                cwd: '/tmp',
                shell: false,
            })

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
            await (await newRuntime()).attach(binaryPort, BUILD_CWD, false, false, false, PROGRAM, DEBUG_FILE, MAP_FILE);
        });
    });

    describe('Assembly', () => {
        const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/asm-project');
        const BUILD : LaunchRequestBuildArguments = {
            args: BUILD_ARGS,
            command: BUILD_COMMAND,
            cwd: BUILD_CWD,
        }
        const MAP_FILE = BUILD_CWD + '/asm-project.c64.map';
        const DEBUG_FILE = BUILD_CWD + '/asm-project.c64.dbg';
        const LABEL_FILE = BUILD_CWD + '/asm-project.c64.lbl';
        const PROGRAM = BUILD_CWD + '/asm-project.c64'

        const MAIN_S = path.join(BUILD_CWD, "src/main.s")

        beforeAll(async () => {
            await compile.build(BUILD, execHandler);
        });

        test('Starts and terminates successfully without intervention', async() => {
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                viceArgs,
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
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                viceArgs,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnEntry');

            await rt.setBreakPoint(MAIN_S, 12);
            await all(
                rt.continue(),
                waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S)
                    assert.strictEqual(line, 12)
                }),
            );

            await rt.terminate();
        });

        test('Can step in', async() => {
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                viceArgs,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'started');

            await rt.setBreakPoint(MAIN_S, 7);
            await all(
                rt.continue(),
                waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S)
                    assert.strictEqual(line, 7)
                }),
            );

            await all(
                rt.stepIn(),
                waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S)
                    assert.strictEqual(line, 18)
                }),
            );

            await rt.terminate();
        });

        test('Can step out', async() => {
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                viceArgs,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnEntry');

            await rt.setBreakPoint(MAIN_S, 7);
            await all(
                rt.continue(),
                waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S);
                    assert.strictEqual(line, 7);
                }),
            );


            await all(
                rt.stepIn(),
                waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S);
                    assert.strictEqual(line, 18);
                }),
            );

            await all(
                rt.stepOut(),
                waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S);
                    assert.strictEqual(line, 9);
                }),
            );

            await rt.terminate();
        });
    });

    describe('Launch', () => {
        const MAIN_C = path.join(BUILD_CWD, "src/main.c")
        const MAIN_S = path.join(BUILD_CWD, "src/main.s")

        beforeAll(async () => {
            await compile.build(BUILD, execHandler);
        });

        describe('xpet and others', () => {
            test('xpet works correctly', async () => {
                const rt = await newRuntime();
                const PROGRAM = BUILD_CWD + '/simple-project.pet';
                const MAP_FILE = PROGRAM + '.map';
                const DEBUG_FILE = PROGRAM + '.dbg';
                const LABEL_FILE = PROGRAM + '.lbl';
                const viceArgs = [
                    '+sound',
                    '-sounddev', 'dummy',
                ];

                const NONC64_C = path.join(BUILD_CWD, "src/test_non_c64.c")

                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_non_c64');

                await rt.setBreakPoint(NONC64_C, 8);
                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint')
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                        assert.strictEqual(file, NONC64_C);
                        assert.strictEqual(line, 3);
                    }),
                );


                const wastedOnMyself = [
                    waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                        assert.strictEqual(file, NONC64_C);
                        assert.strictEqual(line, 9);
                    }),
                ];

                await all(
                    rt.stepOut(),
                    ...wastedOnMyself,
                );

                await all(
                    rt.continue(),
                    waitFor(rt, 'end')
                );
            });
        })

        test('Can modify memory correctly', async() => {
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                true,
                false,
                VICE_DIRECTORY,
                viceArgs,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnEntry');
            await selectCTest(rt, 'test_template');
            await rt.continue();
            await waitFor(rt, 'stopOnExit');
        });

        test('Starts and terminates successfully without intervention', async() => {
            const rt = await newRuntime();
            await rt.start(
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                viceArgs,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await waitFor(rt, 'stopOnEntry');
            await selectCTest(rt, 'test_start_terminate');

            await rt.continue();

            await waitFor(rt, 'end');
        });


        describe('Settings', () => {
            test('Breaks at the entry point', async() => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry', () => assert.strictEqual(rt.getRegisters().pc, getLabel(rt, '_main')));
                await selectCTest(rt, 'test_break_entry');
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Breaks at the exit point', async() => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    true,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_break_exit');
                await rt.continue();

                await waitFor(rt, 'stopOnExit', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S);
                    assert.strictEqual(line, 43);
                });

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });

        describe('Execution control', () => {
            test('Pauses correctly', async () => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_pause');
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

            test('Can set a shitton of breakpoints without them clearing', async() => {
                const rt = await newRuntime();
                const SHITTON_C = path.join(BUILD_CWD, "src/test_shitton_of_breakpoints.c");

                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    false,
                    true,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'started');
                await selectCTest(rt, 'test_shitton_of_breakpoints');

                for(let i = 0 ; i < 6 ; i++) {
                    await Promise.all([
                        rt.setBreakPoint(SHITTON_C, 7 + i * 5),
                        rt.setBreakPoint(SHITTON_C, 9 + i * 5),
                        rt.setBreakPoint(SHITTON_C, 10 + i * 5),
                    ]);
                }

                assert.strictEqual(rt.getBreakpointLength(), 18);
            });

            test('Can step out', async() => {
                const rt = await newRuntime();
                const STEPOUT_C = path.join(BUILD_CWD, "src/test_step_out.c");

                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_step_out');

                await rt.setBreakPoint(STEPOUT_C, 8);

                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint'),
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPOUT_C);
                        assert.strictEqual(line, 3);
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await all(
                    rt.stepOut(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPOUT_C);
                        assert.strictEqual(line, 9);
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Can step in', async() => {
                const rt = await newRuntime();
                const STEPIN_C = path.join(BUILD_CWD, "src/test_step_in.c");

                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_step_in');

                await rt.setBreakPoint(STEPIN_C, 8);

                await all(
                    rt.continue(),
                    waitFor(rt, 'stopOnBreakpoint'),
                );

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPIN_C)
                        assert.strictEqual(line, 3)
                    }),
                );

                await waitFor(rt, 'stopOnStep');

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });

        describe('Stack', () => {
            const STACKFRAMES_C = path.join(BUILD_CWD, "src/test_stack_frames.c");
            test('Contains the frames plus the current position', async () => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_stack_frames');

                await rt.setBreakPoint(STACKFRAMES_C, 4);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STACKFRAMES_C);
                        assert.strictEqual(line, 4);
                    })
                );

                await waitFor(rt, 'stopOnBreakpoint');

                const frames = await rt.stack(0, 1000);

                assert.deepStrictEqual(
                    frames,
                    {
                        frames: [
                            {
                                index: 0,
                                name: '0x08a0',
                                file: STACKFRAMES_C,
                                line: 4
                            },
                            {
                                index: 1,
                                name: 'step_frames',
                                file: STACKFRAMES_C,
                                line: 3
                            },
                            {
                                index: 2,
                                name: 'test_stack_frames_main',
                                file: STACKFRAMES_C,
                                line: 8
                            },
                            {
                                index: 3,
                                name: 'main',
                                file: MAIN_C,
                                line: 5
                            }
                        ],
                        count: 4
                    }
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Step in', async () => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_stack_frames');

                await rt.setBreakPoint(STACKFRAMES_C, 8);
                await rt.continue();

                await waitFor(rt, 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, STACKFRAMES_C);
                    assert.strictEqual(line, 8);
                })

                await waitFor(rt, 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STACKFRAMES_C);
                        assert.strictEqual(line, 3);
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
                                name: '0x0894',
                                file: STACKFRAMES_C,
                                line: 3
                            },
                            {
                                index: 1,
                                name: 'step_frames',
                                file: STACKFRAMES_C,
                                line: 3
                            },
                            {
                                index: 2,
                                name: 'test_stack_frames_main',
                                file: STACKFRAMES_C,
                                line: 8
                            },
                            {
                                index: 3,
                                name: 'main',
                                file: MAIN_C,
                                line: 5
                            }
                        ],
                        count: 4
                    }
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Contains the correct local variables', async() => {
                const rt = await newRuntime();
                const LOCALVARS_C = path.join(BUILD_CWD, "src/test_local_vars.c");

                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    false,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'started');
                await selectCTest(rt, 'test_local_vars');

                await rt.setBreakPoint(LOCALVARS_C, 36);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, LOCALVARS_C);
                        assert.strictEqual(line, 36);
                    }),
                );

                await waitFor(rt, 'stopOnBreakpoint');

                const locals = await rt.getScopeVariables();
                const random = locals.find(x => x.name == 'random')!;
                const randomVal = await rt.getTypeFields(random.addr, random.type);
                const wow = locals.find(x => x.name == 'wow')!;
                const wowVal = await rt.getTypeFields(wow.addr, wow.type);

                await rt.continue();
                await waitFor(rt, 'end');

                console.log(locals);
                assert.deepStrictEqual(locals.map(x => x.name).sort(), ['cool', 'i', 'j', 'lol', 'random', 'whoa', 'wow']);

                console.log(randomVal);
                assert.strictEqual(random.value, "0x03fc");
                assert.strictEqual(randomVal[0].type, "unsigned int");
                assert.strictEqual(randomVal[0].value, "0x3003");

                console.log(wowVal);
                assert.strictEqual(wowVal.find(x => x.name == 'j')!.value, "0x03");
                assert.strictEqual(wowVal.find(x => x.name == 'k')!.value, "0x04");

                assert.deepStrictEqual(locals.find(x => x.name == 'whoa')!.value, "-0x01");
            });
        });

        describe('Runahead', () => {
            const RUNAHEAD_C = path.join(BUILD_CWD, "src/test_runahead.c");
            test('Restores the original location', async() => {
                const rt = await newRuntime();
                await all([
                    rt.start(
                        PROGRAM,
                        BUILD_CWD,
                        true,
                        false,
                        true,
                        VICE_DIRECTORY,
                        viceArgs,
                        false,
                        DEBUG_FILE,
                        MAP_FILE,
                        LABEL_FILE
                    ),
                    waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, getLabel(rt, '_main'))),
                ])

                await waitFor(rt, 'started');
                await selectCTest(rt, 'test_runahead');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Does not break file access', async() => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    true,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_runahead');

                await rt.setBreakPoint(RUNAHEAD_C, 38);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, RUNAHEAD_C);
                        assert.strictEqual(line, 38);
                    })
                )

                await waitFor(rt, 'stopOnBreakpoint');

                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by step', async() => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    true,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'started');
                await selectCTest(rt, 'test_runahead');

                await all(
                    rt.next(),
                    waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > getLabel(rt, '_main') && rt.getRegisters().pc < getLabel(rt, '_main') + disassembly.maxOpCodeSize * 10, true))
                );
                await rt.continue();
                await waitFor(rt, 'end');
            });

            test('Triggered by step in', async() => {
                const rt = await newRuntime();
                await rt.start(
                    PROGRAM,
                    BUILD_CWD,
                    true,
                    false,
                    true,
                    VICE_DIRECTORY,
                    viceArgs,
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor(rt, 'stopOnEntry');
                await selectCTest(rt, 'test_runahead');

                await rt.setBreakPoint(RUNAHEAD_C, 34);

                await all(
                    rt.continue(),
                    waitFor(rt, 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, RUNAHEAD_C);
                        assert.strictEqual(line, 34);
                    })
                )

                await waitFor(rt, 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor(rt, 'runahead', (args) => assert.strictEqual(
                        rt.getRegisters().pc >= getLabel(rt, '_step_runahead')
                        && rt.getRegisters().pc < getLabel(rt, '_step_runahead') * disassembly.maxOpCodeSize * 10, true
                    )),
                );

                await rt.continue();
                await waitFor(rt, 'end');
            });
        });
    });
});