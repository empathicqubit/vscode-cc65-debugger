import * as testShared from './test-shared';
import * as compile from '../compile';
import * as debugUtils from '../debug-utils';
import { LaunchRequestBuildArguments } from '../launch-arguments';
import * as metrics from '../metrics';

metrics.options.disabled = true;

const all = (...args) => Promise.all(args);

// Line numbers are from zero, you moron.

describe('Runtime', () => {
    /* These tests require VICE to be installed on your PATH */
    /* All values should be explicitly defined except
        when testing the defaults */
    const BUILD_COMMAND = testShared.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const BUILD_ARGS = testShared.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }
    const PROGRAM = testShared.DEFAULT_PROGRAM
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    afterEach(testShared.cleanup);

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
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
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
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry');
        await testShared.selectCTest(rt, 'test_start_terminate');

        await rt.continue();

        await testShared.waitFor(rt, 'end');
    });
});