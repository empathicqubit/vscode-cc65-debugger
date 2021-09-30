import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as debugUtils from '../lib/debug-utils';

describe('Stack', () => {
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const PROGRAM = testShared.DEFAULT_PROGRAM
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_VICE_ARGS;

    const LOCALVARS_C = path.join(BUILD_CWD, "src/test_local_vars.c");

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });

    const MAIN_C = path.join(BUILD_CWD, "src/main.c");
    const STACKFRAMES_C = path.join(BUILD_CWD, "src/test_stack_frames.c");

    describe('Variable expressions evaluate correctly', () => {
        const data : Array<[string, {}]> = [
            ['25 * 25', 625],
            ['25 * weehah', 2225],
            ['2 * j', 9838],
        ];
        test.each(data)('%s', async (expression, expected) => {
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

            await testShared.waitFor(rt, 'started');
            await testShared.selectCTest(rt, 'test_local_vars');

            await rt.setBreakPoint(LOCALVARS_C, 51);

            await Promise.all([
                rt.continue(),
                testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, LOCALVARS_C);
                    assert.strictEqual(line, 51);
                }),
            ]);

            await testShared.waitFor(rt, 'stopOnBreakpoint');

            const actual = await rt.evaluate(expression);

            assert.equal(actual!.value, expected);

            await rt.continue();
            await testShared.waitFor(rt, 'end');
        });
    })

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

        await rt.setBreakPoint(LOCALVARS_C, 51);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, LOCALVARS_C);
                assert.strictEqual(line, 51);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        const locals = await rt.getScopeVariables();
        const random = locals.find(x => x.name == 'random')!;
        const randomVal = await rt.getTypeFields(random.addr, random.type);
        const wow = locals.find(x => x.name == 'wow')!;
        const wowVal = await rt.getTypeFields(wow.addr, wow.type);

        const xy = locals.find(x => x.name == 'xy')!;
        const xyVal = await rt.getTypeFields(xy.addr, xy.type);

        const statics = await rt.getStaticVariables();

        await rt.continue();
        await testShared.waitFor(rt, 'end');

        console.log(locals);
        assert.deepStrictEqual(locals.map(x => x.name).sort(), ['cool', 'i', 'j', 'lol', 'random', 'whoa', 'wow', 'xy']);

        console.log(randomVal);
        assert.strictEqual(random.value, "0x03fc");
        assert.strictEqual(randomVal[0].type, "unsigned int");
        assert.strictEqual(randomVal[0].value, "0x3003");

        console.log(wowVal);
        assert.strictEqual(wowVal.find(x => x.name == 'j')!.value, "0x03");
        assert.strictEqual(wowVal.find(x => x.name == 'k')!.value, "0x04");

        console.log(xyVal);
        assert.deepStrictEqual(xyVal[0].type, 'struct sub');
        assert.deepStrictEqual(xyVal[0].name, 'xy');

        assert.deepStrictEqual(xyVal[1].type, '')
        assert.deepStrictEqual(xyVal[1].name, 'mem');
        assert.deepStrictEqual(xyVal[1].value, '0x0201');

        assert.deepStrictEqual(locals.find(x => x.name == 'whoa')!.value, "-0x01");

        console.log(statics)
        assert.deepStrictEqual(statics.map(x => x.name).sort(), ['weehah']);
        assert.deepStrictEqual(statics[0].value, "0x59");
    });
});