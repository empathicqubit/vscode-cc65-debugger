import * as testShared from './test-shared';
import * as path from 'path';
import * as debugUtils from '../lib/debug-utils';
import * as assert from 'assert';
import _random from 'lodash/fp/random';
import getPort from 'get-port';
import { MachineType } from '../lib/debug-file';

describe('Attach', () => {

    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const PROGRAM = testShared.DEFAULT_PROGRAM;
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;
    const VICE_ARGS = testShared.DEFAULT_ARGS[MachineType[debugUtils.programFiletypes.exec(PROGRAM)![3]!]];

    afterEach(testShared.cleanup);

    beforeEach(async () => {
        await debugUtils.delay(Math.random() * 1000);
    });


    let binaryPort = -1;
    beforeEach(async () => {
        binaryPort = _random(0x8700, 0x8700 + 256);

        binaryPort = await getPort({ port: getPort.makeRange(binaryPort, binaryPort + 256) });

        const pids = await testShared.cleanupExecHandler(path.join(VICE_DIRECTORY, 'x64sc'), ['+remotemonitor', '-binarymonitor', '-binarymonitoraddress', `127.0.0.1:${binaryPort}`, '-iecdevice8', ...VICE_ARGS], {
            cwd: '/tmp',
            shell: false,
        })

        await debugUtils.delay(1000);
    });

    test('Can attach to a running process', async() => {
        const rt = await testShared.newRuntime();
        await Promise.all([
            rt.attach(binaryPort, BUILD_CWD, false, false, false, PROGRAM, DEBUG_FILE, MAP_FILE),
            (async () => {
                await testShared.waitFor(rt, 'message', (msg: debugUtils.ExtensionMessage) => {
                    assert.strictEqual(msg.items && msg.items.includes('Autostart'), true);
                })
                await rt.action('Autostart');
            })(),
        ]);
    });
});
