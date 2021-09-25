import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as compile from '../compile';
import { LaunchRequestBuildArguments } from '../launch-arguments';
import * as debugUtils from '../debug-utils';
import _random from 'lodash/fp/random';
describe('Execution control', () => {
    const BUILD_COMMAND = testShared.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const BUILD_ARGS = testShared.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }
    const PROGRAM = testShared.DEFAULT_PROGRAM;
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;
    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;

    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    afterEach(testShared.cleanup);

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

    test('Can set a shitton of breakpoints without them clearing', async() => {
        const rt = await testShared.newRuntime();
        const SHITTON_C = path.join(BUILD_CWD, "src/test_shitton_of_breakpoints.c");

        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            false,
            true,
            false,
            VICE_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_shitton_of_breakpoints');

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
        const rt = await testShared.newRuntime();
        const STEPOUT_C = path.join(BUILD_CWD, "src/test_step_out.c");

        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            VICE_DIRECTORY,
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
            testShared.waitFor(rt, 'stopOnBreakpoint'),
        ]);

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 3);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnStep');

        await Promise.all([
            rt.stepOut(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPOUT_C);
                assert.strictEqual(line, 9);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnStep');

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
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, STEPIN_C)
                assert.strictEqual(line, 3)
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnStep');

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });
});