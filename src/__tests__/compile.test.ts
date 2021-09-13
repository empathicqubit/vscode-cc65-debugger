import * as assert from 'assert';
import * as compile from '../compile';
import * as path from 'path';
import * as debugUtils from '../debug-utils';
import _transform from 'lodash/transform';
import * as child_process from 'child_process';
import * as testShared from './test-shared';
import { LaunchRequestBuildArguments } from '../launch-arguments';

describe('Compile', () => {
    const BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = path.normalize(__dirname + '/../../src/__tests__/simple-project');
    const PROGRAM = BUILD_CWD + '/simple-project.c64';
    const BUILD_ARGS = compile.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }

    let pids : number[] = [];
    let execHandler : debugUtils.ExecHandler;
    beforeEach(() => {
        execHandler = async (f, a, o) => {
            const ret = await testShared.DEFAULT_TEST_EXEC_HANDLER(f, a, o)
            pids.push(...ret);

            return ret;
        };
    })

    afterEach(async () => {
        for(const pid of pids) {
            try {
                pid != -1 && process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
            }
            catch {}
        }
        pids = [];
    });

    test('Build works', async () => {
        await compile.clean(BUILD_CWD, execHandler);
        await compile.build(BUILD, execHandler);
    });

    test('Build works with 32-bit compiler', async () => {
        const oldExecHandler = execHandler;
        execHandler = (file, args, opts) => {
            let sep = ':';
            if(process.platform == 'win32') {
                sep = ';';
            }

            if(opts && opts.env && opts.env.PATH) {
                opts.env.PATH = opts.env.PATH.replace(/\/cc65\/bin_(\w+)_\w+/g, '/cc65/bin_$1_x32');
                console.log(opts.env.PATH);
            }
            return oldExecHandler(file, args, opts);
        }
        await compile.clean(BUILD_CWD, execHandler);
        await compile.build(BUILD, execHandler);
    });

    test('Can guess the program path', async () => {
        await compile.make(BUILD, execHandler, {
            shell: <any>true,
        });
        const possibles = await compile.guessProgramPath(BUILD_CWD);
        assert.strictEqual(possibles.includes(PROGRAM), true);
    });
});
