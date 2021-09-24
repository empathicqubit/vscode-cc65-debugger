import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import { LaunchRequestBuildArguments } from '../launch-arguments';
describe('xpet and others', () => {
    const BUILD_COMMAND = testShared.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const BUILD_ARGS = testShared.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }
    const PROGRAM = BUILD_CWD + '/simple-project.pet';
    const MAP_FILE = PROGRAM + '.map';
    const DEBUG_FILE = PROGRAM + '.dbg';
    const LABEL_FILE = PROGRAM + '.lbl';

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const VICE_ARGS = [
        '+sound',
        '-sounddev', 'dummy',
    ];

    afterEach(testShared.cleanup);

    test('xpet works correctly', async () => {
        const rt = await testShared.newRuntime();

        const NONC64_C = path.join(BUILD_CWD, "src/test_non_c64.c")

        await rt.start(
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
        await testShared.selectCTest(rt, 'test_non_c64');

        await rt.setBreakPoint(NONC64_C, 8);
        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint')
        ]);

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, NONC64_C);
                assert.strictEqual(line, 3);
            }),
        ]);


        const wastedOnMyself = [
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, NONC64_C);
                assert.strictEqual(line, 9);
            }),
        ];

        await Promise.all([
            rt.stepOut(),
            ...wastedOnMyself,
        ]);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'end')
        ]);
    });
});