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

    const selectCTest = async (testName: string) => {
        const lab = rt._dbgFile.labs.find(x => x.name == `_${testName}_main`)!;
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(lab.val);
        console.log(lab);
        await rt.setMemory(0x03fc, buf);
    }

    const getLabel = (name: string) : number => {
        return (rt._dbgFile.labs.find(x => x.name == name) || { val: 0x00 }).val;
    }

    const waitFor = async(event: string, assertion?: ((...x: any[]) => void)) : Promise<void> => {
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

    beforeEach(async() => {
        rt = new Runtime(execHandler);

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

    afterEach(async () => {
        for(const pid of pids) {
            try {
                pid != -1 && process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
            }
            catch {}
        }
        pids = [];
    });

    describe('Attach', () => {
        const binaryPort = 1024 + Math.floor(Math.random() * 10000);
        let proc : child_process.ChildProcessWithoutNullStreams;

        beforeEach(async () => {
            await compile.build(BUILD, execHandler);

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
            await rt.attach(binaryPort, BUILD_CWD, false, false, false, PROGRAM, DEBUG_FILE, MAP_FILE);
        });

        afterEach(async () => {
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

        beforeEach(async () => {
            await compile.build(BUILD, execHandler);
        });

        describe('Essential', () => {
            test('Starts and terminates successfully without intervention', async() => {
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

                await waitFor('stopOnEntry');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor('stopOnEntry');

                await rt.setBreakPoint(MAIN_S, 12);
                await all(
                    rt.continue(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 12)
                    }),
                );

                await waitFor('stopOnBreakpoint');

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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor('started');

                await rt.setBreakPoint(MAIN_S, 7);
                await all(
                    rt.continue(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 7)
                    }),
                );

                await waitFor('stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 18)
                    }),
                );

                await waitFor('stopOnStep');

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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor('stopOnEntry');

                await rt.setBreakPoint(MAIN_S, 7);
                await all(
                    rt.continue(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 7)
                    }),
                );

                await waitFor('stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 18)
                    }),
                );

                await waitFor('stopOnStep');

                await all(
                    rt.stepOut(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, MAIN_S)
                        assert.strictEqual(line, 9)
                    }),
                );

                await waitFor('stopOnStep');

                await rt.terminate();
            });
        });
    });

    describe('Launch', () => {
        const MAIN_C = path.join(BUILD_CWD, "src/main.c")
        const MAIN_S = path.join(BUILD_CWD, "src/main.s")

        beforeEach(async () => {
            await compile.build(BUILD, execHandler);
        });

        describe('Essential', () => {
            test('Non-C64 platform works correctly', async () => {
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

                await waitFor('stopOnEntry');
                await selectCTest('test_non_c64');

                await rt.setBreakPoint(NONC64_C, 8);
                await all(
                    rt.continue(),
                    waitFor('stopOnBreakpoint')
                );

                await all(
                    rt.stepIn(),
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, NONC64_C);
                        assert.strictEqual(line, 3);
                    }),
                    waitFor('stopOnStep')
                );


                const wastedOnMyself = [
                    waitFor('output', (type, __, file, line, col) => {
                        assert.strictEqual(file, NONC64_C);
                        assert.strictEqual(line, 9);
                    }),
                    waitFor('stopOnStep')
                ];

                await all(
                    rt.stepOut(),
                    ...wastedOnMyself,
                );

                await rt.continue();
                await waitFor('end');
            });

            test('Can modify memory correctly', async() => {
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

                await waitFor('stopOnEntry');
                await selectCTest('test_template');
                await rt.continue();
                await waitFor('stopOnExit');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor('stopOnEntry');
                await selectCTest('test_pause');
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

                await waitFor( 'stopOnEntry');
                await selectCTest('test_start_terminate');

                await rt.continue();

                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'stopOnEntry', () => assert.strictEqual(rt.getRegisters().pc, getLabel('_main')));
                await selectCTest('test_break_entry');
                await rt.continue();
                await waitFor( 'end');
            });

            test('Breaks at the exit point', async() => {
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

                await waitFor( 'stopOnEntry');
                await selectCTest('test_break_exit');
                await rt.continue();

                await waitFor( 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, MAIN_S);
                    assert.strictEqual(line, 43);
                });
                await waitFor( 'stopOnExit');

                await rt.continue();
                await waitFor( 'end');
            });

            test('Can set a shitton of breakpoints without them clearing', async() => {
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

                await waitFor( 'started');
                await selectCTest('test_shitton_of_breakpoints');

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

                await waitFor( 'stopOnEntry');
                await selectCTest('test_step_out');

                await rt.setBreakPoint(STEPOUT_C, 8);

                await all(
                    rt.continue(),
                    waitFor( 'stopOnBreakpoint'),
                );

                await all(
                    rt.stepIn(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPOUT_C);
                        assert.strictEqual(line, 3);
                    }),
                );

                await waitFor( 'stopOnStep');

                await all(
                    rt.stepOut(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPOUT_C);
                        assert.strictEqual(line, 9);
                    }),
                );

                await waitFor( 'stopOnStep');

                await rt.continue();
                await waitFor( 'end');
            });

            test('Can step in', async() => {
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

                await waitFor( 'stopOnEntry');
                await selectCTest('test_step_in');

                await rt.setBreakPoint(STEPIN_C, 8);

                await all(
                    rt.continue(),
                    waitFor( 'stopOnBreakpoint'),
                );

                await all(
                    rt.stepIn(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STEPIN_C)
                        assert.strictEqual(line, 3)
                    }),
                );

                await waitFor( 'stopOnStep');

                await rt.continue();
                await waitFor( 'end');
            });

            test('Contains the correct local variables', async() => {
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

                await waitFor( 'started');
                await selectCTest('test_local_vars');

                await rt.setBreakPoint(LOCALVARS_C, 31);

                await all(
                    rt.continue(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, LOCALVARS_C);
                        assert.strictEqual(line, 31);
                    }),
                );

                await waitFor( 'stopOnBreakpoint');

                const locals = await rt.getScopeVariables();

                await rt.continue();
                await waitFor( 'end');

                assert.deepStrictEqual(locals.map(x => x.name).sort(), ['cool', 'i', 'j', 'lol', 'wow']);
            });
        });

        describe('Stack', () => {
            const STACKFRAMES_C = path.join(BUILD_CWD, "src/test_stack_frames.c");
            test('Contains the frames plus the current position', async () => {
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

                await waitFor( 'stopOnEntry');
                await selectCTest('test_stack_frames');

                await rt.setBreakPoint(STACKFRAMES_C, 4);

                await all(
                    rt.continue(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STACKFRAMES_C);
                        assert.strictEqual(line, 4);
                    })
                );

                await waitFor( 'stopOnBreakpoint');

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
                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'stopOnEntry');
                await selectCTest('test_stack_frames');

                await rt.setBreakPoint(STACKFRAMES_C, 8);
                await rt.continue();

                await waitFor( 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, STACKFRAMES_C);
                    assert.strictEqual(line, 8);
                })

                await waitFor( 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, STACKFRAMES_C);
                        assert.strictEqual(line, 3);
                    })
                );

                await waitFor( 'stopOnStep');

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
                await waitFor( 'end');
            });
        });

        describe('Runahead', () => {
            const RUNAHEAD_C = path.join(BUILD_CWD, "src/test_runahead.c");
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
                        false,
                        DEBUG_FILE,
                        MAP_FILE,
                        LABEL_FILE
                    ),
                    waitFor( 'runahead', () => assert.strictEqual(rt.getRegisters().pc, getLabel('_main'))),
                ])

                await waitFor( 'started');
                await selectCTest('test_runahead');

                await rt.continue();
                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'stopOnEntry');
                await selectCTest('test_runahead');

                await rt.setBreakPoint(RUNAHEAD_C, 3);
                await all(
                    rt.continue(),
                    waitFor( 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > getLabel('_step_runahead') && rt.getRegisters().pc < getLabel('_step_runahead') + disassembly.maxOpCodeSize * 10, true))
                );
                await rt.continue();
                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'started');
                await selectCTest('test_runahead');

                await all(
                    rt.next(),
                    waitFor( 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > getLabel('_main') && rt.getRegisters().pc < getLabel('_main') + disassembly.maxOpCodeSize * 10, true))
                );
                await rt.continue();
                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'started');
                await selectCTest('test_runahead');

                await all([
                    waitFor( 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc, getLabel('_main'))),
                    rt.pause()
                ])

                await rt.continue();
                await waitFor( 'end');
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
                    false,
                    DEBUG_FILE,
                    MAP_FILE,
                    LABEL_FILE
                );

                await waitFor( 'stopOnEntry');
                await selectCTest('test_runahead');

                await rt.setBreakPoint(RUNAHEAD_C, 8);

                await all(
                    rt.continue(),
                    waitFor( 'output', (type, __, file, line, col) => {
                        assert.strictEqual(file, RUNAHEAD_C);
                        assert.strictEqual(line, 8);
                    })
                )

                await waitFor( 'stopOnBreakpoint');

                await all(
                    rt.stepIn(),
                    waitFor( 'runahead', (args) => assert.strictEqual(
                        rt.getRegisters().pc >= getLabel('_step_runahead')
                        && rt.getRegisters().pc < getLabel('_step_runahead') * disassembly.maxOpCodeSize * 10, true
                    )),
                );

                await rt.continue();
                await waitFor( 'end');
            });
        });
    });
});
