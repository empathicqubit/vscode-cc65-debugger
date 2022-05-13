import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as debugUtils from '../lib/debug-utils';
import _random from 'lodash/fp/random';
import _chunk from 'lodash/fp/chunk';
describe('Execution control', () => {
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const PROGRAM = testShared.DEFAULT_PROGRAM;
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;
    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const MESEN_DIRECTORY = testShared.DEFAULT_MESEN_DIRECTORY;
    const APPLEWIN_DIRECTORY = testShared.DEFAULT_APPLEWIN_DIRECTORY;

    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });

    const STEPOUT_C = path.join(BUILD_CWD, "src/test_step_out.c");
    test('Steps to the next line', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_step_out');

        await rt.setBreakPoint(STEPOUT_C, 8);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 8);
            }),
        ]);

        await Promise.all([
            rt.next(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 9);
            }),
        ]) ;

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    if(false) {
        test('Steps out at the end of the function', async() => {
            const rt = await testShared.newRuntime();
            await rt.start(
                await testShared.portGetter(),
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                MESEN_DIRECTORY,
                APPLEWIN_DIRECTORY,
                VICE_ARGS,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            );

            await testShared.waitFor(rt, 'stopOnEntry');
            await testShared.selectCTest(rt, 'test_step_out');

            await rt.setBreakPoint(STEPOUT_C, 5);

            await Promise.all([
                rt.continue(),
                testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                    assert.strictEqual(file, STEPOUT_C);
                    assert.strictEqual(line, 5);
                }),
            ]);

            await Promise.all([
                rt.next(),
                testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                    assert.strictEqual(file, STEPOUT_C);
                    assert.strictEqual(line, 9);
                }),
            ]) ;

            await rt.continue();
            await testShared.waitFor(rt, 'end');
        });
    }

    test('Pauses correctly', async () => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_pause');
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

    const SHITTON_C = path.join(BUILD_CWD, "src/test_shitton_of_breakpoints.c");
    test('Conditional breakpoints work', async() => {
        const rt = await testShared.newRuntime();

        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_shitton_of_breakpoints');

        // This breakpoint shouldn't get hit
        await rt.setBreakPoint(SHITTON_C,
            {
                line: 12,
                condition: 'i == 2',
            }
        );

        await rt.setBreakPoint(SHITTON_C,
            {
                line: 17,
                condition: 'i == 2',
            }
        );

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, SHITTON_C);
                assert.strictEqual(line, 17);
            }),
        ]);
    });

    test('Breakpoints can be set very early', async() => {
        const rt = await testShared.newRuntime();

        await Promise.all([
            rt.start(
                await testShared.portGetter(),
                PROGRAM,
                BUILD_CWD,
                false,
                true,
                false,
                VICE_DIRECTORY,
                MESEN_DIRECTORY,
                APPLEWIN_DIRECTORY,
                VICE_ARGS,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            ),
            (async() => {
                for(let i = 0 ; i < 6 ; i++) {
                    await Promise.all([
                        rt.setBreakPoint(SHITTON_C, 7 + i * 5),
                        rt.setBreakPoint(SHITTON_C, 9 + i * 5),
                        rt.setBreakPoint(SHITTON_C, 10 + i * 5),
                    ]);
                }

            })()
        ]);
    });

    test('Can set a shitton of breakpoints without them clearing', async() => {
        const rt = await testShared.newRuntime();

        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            false,
            true,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_shitton_of_breakpoints');

        const lines : number[] = [];
        for(let i = 0 ; i < 6 ; i++) {
            lines.push(
                7 + i * 5,
                9 + i * 5,
                10 + i * 5
            );
        }

        assert.strictEqual(lines.length, 18);

            await Promise.all(
                lines.map(async (x, i) => {
                    await rt.clearBreakpoints(SHITTON_C);
                    await rt.setBreakPoint(SHITTON_C, ...lines.slice(0, i + 1));
                })
            );

        assert.strictEqual(rt.getBreakpointLength(), 18);
    });

    test('Can step out', async() => {
        const rt = await testShared.newRuntime();

        await Promise.all([
            rt.start(
                await testShared.portGetter(),
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                false,
                VICE_DIRECTORY,
                MESEN_DIRECTORY,
                APPLEWIN_DIRECTORY,
                VICE_ARGS,
                false,
                DEBUG_FILE,
                MAP_FILE,
                LABEL_FILE
            ),
            testShared.waitFor(rt, 'stopOnEntry')
        ]);

        await testShared.selectCTest(rt, 'test_step_out');

        await rt.setBreakPoint(STEPOUT_C, 8);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 8);
            }),
        ]);

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 3);
            }),
        ]);

        await Promise.all([
            rt.stepOut(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 9);
            }),
        ]);

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    test('Can step in', async() => {
        const rt = await testShared.newRuntime();
        const STEPIN_C = path.join(BUILD_CWD, "src/test_step_in.c");

        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_step_in');

        await rt.setBreakPoint(STEPIN_C, 8);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint'),
        ]);

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPIN_C)
                assert.strictEqual(line, 3)
            }),
        ]);

        await rt.continue()
        await testShared.waitFor(rt, 'end');
    });
});