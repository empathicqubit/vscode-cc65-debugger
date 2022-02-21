import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as debugUtils from '../lib/debug-utils';
import { __basedir } from '../basedir';
import { MachineType } from '../lib/debug-file';
describe('Assembly', () => {
    const BUILD_CWD = path.normalize(__basedir + '/../src/__tests__/asm-project');
    const MAP_FILE = BUILD_CWD + '/program.c64.map';
    const DEBUG_FILE = BUILD_CWD + '/program.c64.dbg';
    const LABEL_FILE = BUILD_CWD + '/program.c64.lbl';
    const PROGRAM = BUILD_CWD + '/program.c64'

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const MESEN_DIRECTORY = testShared.DEFAULT_MESEN_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    const MAIN_S = path.join(BUILD_CWD, "src/main.s")

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
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

        await rt.continue();

        await testShared.waitFor(rt, 'end');
    });

    test('Can set a breakpoint', async() => {
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

        await rt.setBreakPoint(MAIN_S, 12);
        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S)
                assert.strictEqual(line, 12)
            }),
        ]);

        await rt.terminate();
    });

    test('Can step in', async() => {
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

        await testShared.waitFor(rt, 'started');

        await rt.setBreakPoint(MAIN_S, 7);
        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S)
                assert.strictEqual(line, 7)
            }),
        ]);

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S)
                assert.strictEqual(line, 18)
            }),
        ]);

        await rt.terminate();
    });

    test('Can step out', async() => {
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

        await rt.setBreakPoint(MAIN_S, 7);
        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'stopOnBreakpoint', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S);
                assert.strictEqual(line, 7);
            }),
        ]);


        await Promise.all([
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S);
                assert.strictEqual(line, 18);
            }),
            rt.stepIn(),
        ]);

        await Promise.all([
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, MAIN_S);
                assert.strictEqual(line, 9);
            }),
            rt.stepOut(),
        ]);

        await rt.terminate();
    });
});
