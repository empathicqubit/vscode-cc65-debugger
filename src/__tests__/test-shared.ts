import _transform from 'lodash/transform';
import * as debugUtils from '../debug-utils';
import * as child_process from 'child_process';
export const DEFAULT_TEST_EXEC_HANDLER : debugUtils.ExecHandler = (file, args, opts) => {
    const promise = new Promise<[number, number]>((res, rej) => {
        if(args.find(x => x.includes("monitor.js"))) {
            console.log(args);
            res([-1, -1]);
            return;
        }

        const env : { [key: string]: string | undefined } =
            _transform(opts.env || {}, (a, c, k) => a[k] = c === null ? undefined : c);

        const proc = child_process.spawn(file, args, {
            cwd: opts.cwd,
            stdio: "pipe",
            shell: true,
            //shell: __dirname + "/xterm-c",
            detached: false,
            env: {
                ...process.env,
                ...env
            }
        });
        const stdout = (data: Buffer) => {
            console.log([expect.getState().currentTestName, data.toString('ascii')]);
        };
        const stderr = (data: Buffer) => {
            console.error([expect.getState().currentTestName, data.toString('ascii')]);
        };
        proc.stdout.on('data', stdout);
        proc.stderr.on('data', stderr);
        const cleanup = (e) => {
            proc.stdout.off('data', stdout);
            proc.stderr.off('data', stderr);
            e && console.error(e)
        };
        proc.on('disconnect', cleanup);
        proc.on('close', cleanup);
        proc.on('error', cleanup);
        proc.on('exit', cleanup);

        res([proc.pid, proc.pid]);
    });

    return promise;
};