import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as debugUtils from '../lib/debug-utils';
import { LaunchRequestBuildArguments } from '../lib/launch-arguments';
import { MachineType } from '../lib/debug-file';

describe('Settings', () => {
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
    const MESEN_DIRECTORY = testShared.DEFAULT_MESEN_DIRECTORY;
    const APPLEWIN_DIRECTORY = testShared.DEFAULT_APPLEWIN_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_ARGS[MachineType[debugUtils.programFiletypes.exec(PROGRAM)![3]!]];

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });


    const MAIN_S = path.join(BUILD_CWD, "src/main.s")

    test('Breaks at the entry point', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            false,
            undefined,
            VICE_DIRECTORY,
            MESEN_DIRECTORY,
            APPLEWIN_DIRECTORY,
            VICE_ARGS,
            false,
            DEBUG_FILE,
            MAP_FILE,
            LABEL_FILE
        );

        await testShared.waitFor(rt, 'stopOnEntry', () => {
            assert.strictEqual(rt.getRegisters().pc, testShared.getLabel(rt, '_main'))
        });
        await testShared.selectCTest(rt, 'test_break_entry');

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    test('Breaks at the exit point', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            true,
            false,
            undefined,
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
        await testShared.selectCTest(rt, 'test_break_exit');
        await rt.continue();

        await testShared.waitFor(rt, 'stopOnExit', (type, __, file, line, col) => {
            assert.strictEqual(file, MAIN_S);
            assert.strictEqual(line, 49);
        });

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });
});