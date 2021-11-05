import * as assert from 'assert';
import * as compile from '../lib/compile';
import * as path from 'path';
import * as debugUtils from '../lib/debug-utils';
import _transform from 'lodash/transform';
import * as child_process from 'child_process';
import * as testShared from './test-shared';
import { LaunchRequestBuildArguments } from '../lib/launch-arguments';
import { __basedir } from '../basedir';

describe('Compile', () => {
    const BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = path.normalize(__basedir + '/../src/__tests__/simple-project');
    const PROGRAM = path.normalize(BUILD_CWD + '/simple-project.c64');
    const BUILD_ARGS = compile.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }

    let pids : number[] = [];
    let execHandler : debugUtils.ExecHandler;
    beforeEach(() => {
        const defaultHandler = debugUtils.DEFAULT_HEADLESS_EXEC_HANDLER(buf => console.log(buf.toString("utf8")), buf => console.error(buf.toString("utf8")));
        execHandler = async (f, a, o) => {
            const ret = await defaultHandler(f, a, o)
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

    test('Build works with assembly project', async () => {
        const BUILD_CWD = path.normalize(__basedir + '/../src/__tests__/asm-project');

        await compile.clean(BUILD_CWD, execHandler);
        await compile.build({
            ...BUILD,
            cwd: BUILD_CWD,
        }, execHandler);
    });

    test('Can guess the program path', async () => {
        await compile.clean(BUILD_CWD, execHandler);
        await compile.build({
            ...BUILD,
            cwd: BUILD_CWD,
        }, execHandler);
        const possibles = await compile.guessProgramPath(BUILD_CWD);
        expect(possibles).toContain(PROGRAM);
    });
});
