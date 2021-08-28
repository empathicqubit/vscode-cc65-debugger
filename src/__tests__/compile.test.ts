import * as assert from 'assert';
import * as compile from '../compile';
import * as path from 'path';
import { EventEmitter } from 'events';


describe('Compile', () => {
    const BUILD_COMMAND = 'make OPTIONS=mapfile,labelfile,debugfile';
    const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/simple-project');
    const PROGRAM = BUILD_CWD + '/simple-project.c64';
    const PREPROCESS_COMMAND = 'make preprocess-only';

    test('Make works', async () => {
        await compile.make(BUILD_CWD, BUILD_COMMAND, new EventEmitter(), {
            shell: true,
        });
    });

    test('Can guess the program path', async () => {
        await compile.make(BUILD_CWD, BUILD_COMMAND, new EventEmitter(), {
            shell: true,
        });
        const possibles = await compile.guessProgramPath(BUILD_CWD);
        assert.strictEqual(possibles.includes(PROGRAM), true);
    });

    test('Preprocess works', async () => {
        assert.strictEqual(await compile.preProcess(BUILD_CWD, PREPROCESS_COMMAND, {}), true)
    });
});
