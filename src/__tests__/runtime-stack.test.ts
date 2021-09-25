import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as compile from '../compile';
import * as disassembly from '../disassembly';
import * as debugUtils from '../debug-utils';
import { LaunchRequestBuildArguments } from '../launch-arguments';

describe('Stack', () => {
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

    const MAIN_C = path.join(BUILD_CWD, "src/main.c");
    const STACKFRAMES_C = path.join(BUILD_CWD, "src/test_stack_frames.c");
    test('Contains the frames plus the current position', async () => {
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
        await testShared.selectCTest(rt, 'test_stack_frames');

        await rt.setBreakPoint(STACKFRAMES_C, 4);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, STACKFRAMES_C);
                assert.strictEqual(line, 4);
            })
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

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
        await testShared.waitFor(rt, 'end');
    });

    test('Step in', async () => {
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
        await testShared.selectCTest(rt, 'test_stack_frames');

        await rt.setBreakPoint(STACKFRAMES_C, 8);
        await rt.continue();

        await testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
            assert.strictEqual(file, STACKFRAMES_C);
            assert.strictEqual(line, 8);
        })

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        await Promise.all([
            rt.stepIn(),
            testShared.waitFor(rt, 'stopOnStep', (type, __, file, line, col) => {
                assert.strictEqual(file, STACKFRAMES_C);
                assert.strictEqual(line, 3);
            })
        ]);

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
        await testShared.waitFor(rt, 'end');
    });

    test('Contains the correct local variables', async() => {
        const rt = await testShared.newRuntime();
        const LOCALVARS_C = path.join(BUILD_CWD, "src/test_local_vars.c");

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

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_local_vars');

        await rt.setBreakPoint(LOCALVARS_C, 36);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, LOCALVARS_C);
                assert.strictEqual(line, 36);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        const locals = await rt.getScopeVariables();
        const random = locals.find(x => x.name == 'random')!;
        const randomVal = await rt.getTypeFields(random.addr, random.type);
        const wow = locals.find(x => x.name == 'wow')!;
        const wowVal = await rt.getTypeFields(wow.addr, wow.type);

        await rt.continue();
        await testShared.waitFor(rt, 'end');

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