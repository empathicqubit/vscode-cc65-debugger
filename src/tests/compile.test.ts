import {setup, teardown, suite, test} from 'mocha';
import * as assert from 'assert';
import * as _ from 'lodash';
import * as compile from '../compile';
import * as path from 'path';
import { EventEmitter } from 'events';


suite('Compile', () => {
    const BUILD_COMMAND = 'make OPTIONS=mapfile,labelfile,debugfile';
    const BUILD_CWD = path.normalize(__dirname + '/../../src/tests/simple-project');
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