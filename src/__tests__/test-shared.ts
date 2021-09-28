import _transform from 'lodash/transform';
import _random from 'lodash/fp/random';
import _last from 'lodash/fp/last';
import * as debugUtils from '../lib/debug-utils';
import * as child_process from 'child_process';
import * as compile from '../lib/compile';
import * as path from 'path';
import { Runtime } from '../dbg/runtime';
import * as metrics from '../lib/metrics';
import getPort from 'get-port';
import { __basedir } from '../basedir';

console.log('PROCESS', process.pid);

metrics.options.disabled = true;

export const DEFAULT_TEST_EXEC_HANDLER : debugUtils.ExecHandler = async (file, args, opts) => {
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
            console.log([expect.getState().currentTestName, _last(data.toString('ascii').split(/[\r\n]+/gim).filter(x => x))]);
        };
        const stderr = (data: Buffer) => {
            console.error([expect.getState().currentTestName, _last(data.toString('ascii').split(/[\r\n]+/gim).filter(x => x))]);
        };
        proc.stdout.on('data', stdout);
        proc.stderr.on('data', stderr);
        const cleanup = (e) => {
            proc.stdout.off('data', stdout);
            proc.stderr.off('data', stderr);
            e && console.error(e);
        };
        proc.on('disconnect', cleanup);
        proc.on('close', cleanup);
        proc.on('error', cleanup);
        proc.on('exit', cleanup);

        res([proc.pid, proc.pid]);
    });

    return await promise;
};

const ports = {
    "runtime.test.ts": 0x8000,
    "runtime-assembly.test.ts": 0x8100,
    "runtime-execution.test.ts": 0x8200,
    "runtime-other-platforms.test.ts": 0x8300,
    "runtime-runahead.test.ts": 0x8400,
    "runtime-settings.test.ts": 0x8500,
    "runtime-stack.test.ts": 0x8600,
    "runtime-attach.test.ts": 0x8700,
}

export async function portGetter() : Promise<number> {
    const testName = path.basename(expect.getState().testPath);
    const val = ports[testName];
    if(!val) {
        throw new Error(`You need to add a port for the test file: "${testName}"`);
    }
    const port = await getPort({port: getPort.makeRange(val, val + 0xff)});
    ports[testName] = port + 1;

    return port;
}

export const DEFAULT_COMMON_VICE_ARGS : string[] = [
    '+sound',
    '-sounddev', 'dummy',
    '-autostart-warp',
    '-warp',
];

export const DEFAULT_VICE_ARGS : string[] = [
    '-VICIIborders', '3',
    '+VICIIhwscale',
    '-VICIIcrtblur', '0',
    '-VICIIfilter', '0',
    '+VICIIdscan',
    '+VICIIdsize',
    '+sidfilters',
    '-residsamp', '0',
    ...DEFAULT_COMMON_VICE_ARGS,
];

export const DEFAULT_BUILD_COMMAND = compile.DEFAULT_BUILD_COMMAND;
export const DEFAULT_BUILD_CWD = path.normalize(__basedir + '/../src/__tests__/simple-project');
export const DEFAULT_BUILD_ARGS = compile.DEFAULT_BUILD_ARGS;
export const DEFAULT_PROGRAM = DEFAULT_BUILD_CWD + '/simple-project.c64'
export const DEFAULT_MAP_FILE = DEFAULT_PROGRAM + '.map';
export const DEFAULT_DEBUG_FILE = DEFAULT_PROGRAM + '.dbg';
export const DEFAULT_LABEL_FILE = DEFAULT_PROGRAM + '.lbl';
export const DEFAULT_VICE_DIRECTORY =
    typeof process.env.VICE_DIRECTORY != 'undefined'
    ? process.env.VICE_DIRECTORY
    : path.normalize(DEFAULT_BUILD_CWD + '/../vicedir/src');

console.log('VICE DIRECTORY ENV', process.env.VICE_DIRECTORY);
console.log('VICE DIRECTORY', DEFAULT_VICE_DIRECTORY);

let pids : number[] = [];
export const cleanupExecHandler : debugUtils.ExecHandler = async (f, a, o) => {
    const ret = await DEFAULT_TEST_EXEC_HANDLER(f, a, o)
    pids.push(...ret);

    return ret;
};

const defaultExcludedEvents = ['banks', 'palette', 'memory', 'screenText'];

const rts : Runtime[] = [];
export async function newRuntime(excludedEvents?: string[]) : Promise<Runtime> {
    const rt = new Runtime(cleanupExecHandler);

    if(!excludedEvents) {
        excludedEvents = defaultExcludedEvents;
    }

    const emit = rt.emit.bind(rt);
    rt.emit = (name : string, ...args) => {
        if(false && !excludedEvents!.includes(name)) {
            console.log([
                expect.getState().currentTestName,
                name,
                ...args
            ])
        }
        return emit(name, ...args);
    };

    rts.push(rt);

    return rt;
};

export async function cleanup() : Promise<void> {
    const killPids = [...pids];
    const killRts = [...rts];

    for(const rt of killRts) {
        rt.terminate();
        rts.splice(rts.indexOf(rt), 1);
    }

    await debugUtils.delay(500);

    for(const pid of killPids) {
        try {
            pid != -1 && process.kill(pid, 0) && process.kill(pid, 'SIGKILL');
        }
        catch {}

        pids.splice(pids.indexOf(pid), 1);
    }
}

export async function selectCTest(rt: Runtime, testName: string): Promise<void> {
    const lab = rt._dbgFile.labs.find(x => x.name == `_${testName}_main`)!;
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(lab.val);
    console.log(lab);
    await rt.setMemory(0x03fc, buf);
}

export function getLabel(rt: Runtime, name: string) : number {
    return (rt._dbgFile.labs.find(x => x.name == name) || { val: 0x00 }).val;
}

export async function waitFor(rt: Runtime, event: string, assertion?: ((...x: any[]) => void)) : Promise<void> {
    const err = new Error('Timed out waiting for assertion');
    await new Promise<void>((res, rej) => {
        let finished = false;
        setTimeout(() => {
            if(!finished) {
                rej(err);
            }
        }, 10000);

        const listener = (...args) => {
            try {
                assertion && assertion(...args);

                finished = true;
                rt.off(event, listener);
                res();
            }
            catch(e) {
                console.log(e);
            }
        };

        rt.on(event, listener);
    });
}