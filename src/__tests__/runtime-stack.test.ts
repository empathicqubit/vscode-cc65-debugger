import * as path from 'path';
import * as assert from 'assert';
import * as testShared from './test-shared';
import * as debugUtils from '../lib/debug-utils';
import * as bin from '../dbg/binary-dto';
import { MachineType } from '../lib/debug-file';

describe('Stack', () => {
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const PROGRAM = testShared.DEFAULT_PROGRAM
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const LABEL_FILE = testShared.DEFAULT_LABEL_FILE;

    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const MESEN_DIRECTORY = testShared.DEFAULT_MESEN_DIRECTORY;
    const APPLEWIN_DIRECTORY = testShared.DEFAULT_APPLEWIN_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_ARGS[MachineType[debugUtils.programFiletypes.exec(PROGRAM)![3]!]];
    console.log(VICE_ARGS);

    const LOCALVARS_C = path.join(BUILD_CWD, "src/test_local_vars.c");
    const LOCALVARS_LASTLINE = 54;

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });

    const MAIN_C = path.join(BUILD_CWD, "src/main.c");
    const STACKFRAMES_C = path.join(BUILD_CWD, "src/test_stack_frames.c");

    describe('Variable expressions evaluate correctly', () => {
        const data : Array<[string, {}]> = [
            ['25 * 25', '625'],
            ['25 * weehah', '2225'],
            ['j', '4919'],
            ['2 * j', '9838'],
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

            await testShared.waitFor(rt, 'started');
            await testShared.selectCTest(rt, 'test_local_vars');

            await rt.setBreakPoint(LOCALVARS_C, LOCALVARS_LASTLINE);

            await Promise.all([
                rt.continue(),
                testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                    assert.strictEqual(file, LOCALVARS_C);
                    assert.strictEqual(line, LOCALVARS_LASTLINE);
                }),
            ]);

            await testShared.waitFor(rt, 'stopOnBreakpoint');

            const actual = await rt.evaluate(expression);

            assert.strictEqual(actual!.value, expected);

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

        const expected = {
            frames: [
                {
                    index: 0,
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
                    line: 14
                }
            ],
            count: 4
        };

        assert.strictEqual(frames.count, expected.count);

        for(const f in expected.frames) {
            const frame = expected.frames[f];
            for(const p in frame) {
                const prop = frame[p];
                assert.strictEqual(frames.frames[f][p], prop);
            }
        }

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

        const expected =
            {
                frames: [
                    {
                        index: 0,
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
                        line: 14
                    }
                ],
                count: 4
            };

        assert.strictEqual(frames.count, expected.count);

        for(const f in expected.frames) {
            const frame = expected.frames[f];
            for(const p in frame) {
                const prop = frame[p];
                assert.strictEqual(frames.frames[f][p], prop);
            }
        }

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

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_local_vars');

        await rt.setBreakPoint(LOCALVARS_C, LOCALVARS_LASTLINE);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, LOCALVARS_C);
                assert.strictEqual(line, LOCALVARS_LASTLINE);
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
        assert.deepStrictEqual(locals.map(x => x.name).sort(), ['blarg', 'blerg', 'cool', 'i', 'j', 'k', 'lol', 'random', 'whoa', 'wow', 'xy']);

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
        assert.deepStrictEqual(statics.map(x => x.name).sort(), ['bonza', 'weehah']);
        assert.deepStrictEqual(statics.map(x => x.value), ["0x42", "0x59"]);
    });

    test('Can set globals', async() => {
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

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_local_vars');

        await rt.setBreakPoint(LOCALVARS_C, LOCALVARS_LASTLINE);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, LOCALVARS_C);
                assert.strictEqual(line, LOCALVARS_LASTLINE);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        const globalsBefore = await rt.getGlobalVariables();
        assert.strictEqual(globalsBefore.find(x => x.name == 'globby')!.value, '0x34');

        await rt.setGlobalVariable('globby', 0xff);

        const globalsAfter = await rt.getGlobalVariables();
        assert.strictEqual(globalsAfter.find(x => x.name == 'globby')!.value, '0xff');
    });

    test('Can set registers', async() => {
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

        await testShared.waitFor(rt, 'started');
        await testShared.selectCTest(rt, 'test_local_vars');

        await rt.setBreakPoint(LOCALVARS_C, LOCALVARS_LASTLINE);

        await Promise.all([
            rt.continue(),
            testShared.waitFor(rt, 'output', (type, __, file, line, col) => {
                assert.strictEqual(file, LOCALVARS_C);
                assert.strictEqual(line, LOCALVARS_LASTLINE);
            }),
        ]);

        await testShared.waitFor(rt, 'stopOnBreakpoint');

        const registersBefore = await rt.getRegisters();
        const a = registersBefore.a + 1;

        await rt.setRegisterVariable('A', a);

        const registersAfter = await rt._emulator.execBinary({
            type: bin.CommandType.registersGet,
            memspace: bin.EmulatorMemspace.main,
        });

        assert.strictEqual(registersAfter.registers.find(x => x.id == 0)!.value, a);
    });
});