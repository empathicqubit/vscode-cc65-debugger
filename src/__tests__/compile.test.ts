import * as assert from 'assert';
import * as compile from '../compile';
import * as path from 'path';
import { EventEmitter } from 'events';


describe('Compile', () => {
    const BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/simple-project');
    const PROGRAM = BUILD_CWD + '/simple-project.c64';

    test('Make works', async () => {
        await compile.make(BUILD_CWD, BUILD_COMMAND, new EventEmitter(), {
            shell: <any>true,
        });
    });

    test('Can guess the program path', async () => {
        await compile.make(BUILD_CWD, BUILD_COMMAND, new EventEmitter(), {
            shell: <any>true,
        });
        const possibles = await compile.guessProgramPath(BUILD_CWD);
        assert.strictEqual(possibles.includes(PROGRAM), true);
    });
});
