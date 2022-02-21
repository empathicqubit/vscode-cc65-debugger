import * as testShared from './test-shared';
import * as compile from '../lib/compile';
import * as debugUtils from '../lib/debug-utils';
import { LaunchRequestBuildArguments } from '../lib/launch-arguments';
import * as metrics from '../lib/metrics';
import { MachineType } from '../lib/debug-file';

metrics.options.disabled = true;

// Line numbers are from zero, you moron.

describe('Runtime', () => {
    /* These tests require VICE to be installed on your PATH */
    /* All values should be explicitly defined except
        when testing the defaults */
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const PROGRAM = testShared.DEFAULT_PROGRAM
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const MESEN_DIRECTORY = testShared.DEFAULT_MESEN_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });


    test('Can modify memory correctly', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            true,
            false,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            MachineType.unknown,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_template');
        await rt.continue();
        await testShared.waitFor(rt, 'stopOnExit');
    });

    test('Starts and terminates successfully without intervention', async() => {
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
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            MachineType.unknown,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_start_terminate');

        await rt.continue();

        await testShared.waitFor(rt, 'end');
    });
});