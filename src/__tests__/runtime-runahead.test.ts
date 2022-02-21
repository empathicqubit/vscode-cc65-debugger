import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as disassembly from '../lib/disassembly';
import * as debugUtils from '../lib/debug-utils';
import { MachineType } from '../lib/debug-file';

describe('Runahead', () => {
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


    const RUNAHEAD_C = path.join(BUILD_CWD, "src/test_runahead.c");
    test('Restores the original location', async() => {
        const rt = await testShared.newRuntime();
        await Promise.all([
            rt.start(
            await testShared.portGetter(),
                PROGRAM,
                BUILD_CWD,
                true,
                false,
                true,
                VICE_DIRECTORY,
                MESEN_DIRECTORY,
                VICE_ARGS,
                false,
                DEBUG_FILE,
                MAP_FILE,
                MachineType.unknown,
                LABEL_FILE
            ),
            testShared.waitFor(rt, 'runahead', () => assert.strictEqual(rt.getRegisters().pc, testShared.getLabel(rt, '_main'))),
        ])

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_runahead');

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    test('Does not break file access', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            true,
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
        await testShared.selectCTest(rt, 'test_runahead');

        await rt.setBreakPoint(RUNAHEAD_C, 38);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, RUNAHEAD_C);
                assert.strictEqual(line, 38);
            })
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    test('Triggered by step', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            true,
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
        await testShared.selectCTest(rt, 'test_runahead');

        await Promise.all([
            rt.next(),
            testShared.waitFor(rt, 'runahead', (args) => assert.strictEqual(rt.getRegisters().pc > testShared.getLabel(rt, '_main') && rt.getRegisters().pc < testShared.getLabel(rt, '_main') + disassembly.maxOpCodeSize * 10, true))
        ]);
        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });

    test('Triggered by step in', async() => {
        const rt = await testShared.newRuntime();
        await rt.start(
            await testShared.portGetter(),
            PROGRAM,
            BUILD_CWD,
            true,
            false,
            true,
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
        await testShared.selectCTest(rt, 'test_runahead');

        await rt.setBreakPoint(RUNAHEAD_C, 34);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, RUNAHEAD_C);
                assert.strictEqual(line, 34);
            })
        ])

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'runahead', (args) => assert.strictEqual(
                rt.getRegisters().pc >= testShared.getLabel(rt, '_step_runahead')
                && rt.getRegisters().pc < testShared.getLabel(rt, '_step_runahead') * disassembly.maxOpCodeSize * 10, true
            )),
        ]);

        await rt.continue();
        await testShared.waitFor(rt, 'end');
    });
});