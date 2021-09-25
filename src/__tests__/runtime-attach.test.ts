import * as child_process from 'child_process';
import { LaunchRequestBuildArguments } from '../launch-arguments';
import * as testShared from './test-shared';
import * as path from 'path';
import * as debugUtils from '../debug-utils';
import * as net from 'net';
import * as util from 'util';

describe('Attach', () => {

    const BUILD_COMMAND = testShared.DEFAULT_BUILD_COMMAND;
    const BUILD_CWD = testShared.DEFAULT_BUILD_CWD;
    const BUILD_ARGS = testShared.DEFAULT_BUILD_ARGS;
    const BUILD : LaunchRequestBuildArguments = {
        cwd: BUILD_CWD,
        args: BUILD_ARGS,
        command: BUILD_COMMAND,
    }
    const PROGRAM = testShared.DEFAULT_PROGRAM;
    const MAP_FILE = testShared.DEFAULT_MAP_FILE;
    const DEBUG_FILE = testShared.DEFAULT_DEBUG_FILE;
    const VICE_DIRECTORY = testShared.DEFAULT_VICE_DIRECTORY;

    afterEach(testShared.cleanup);

    let binaryPort = -1;
    beforeEach(async () => {
        binaryPort = await testShared.portGetter();

        const pids = await testShared.cleanupExecHandler(path.join(VICE_DIRECTORY, 'x64sc'), ['-binarymonitor', '-binarymonitoraddress', `127.0.0.1:${binaryPort}`, '-iecdevice8'], {
            cwd: '/tmp',
            shell: false,
        })

        await debugUtils.delay(1000);

        const conn = net.connect(binaryPort, '127.0.0.1');
        const buf = Buffer.from([
            0x02, 0x01,
            0xff, 0xff, 0xff, 0xff,
            0xaf, 0xe9, 0x23, 0x3d,

            0xdd,

            0x01,
            0x00, 0x00,

            0xd2,
            ...new Array<number>(0xd2).fill(0x00)
        ]);
        buf.writeUInt32LE(buf.length - 11, 2);
        buf.write(PROGRAM, buf.indexOf(0xd2) + 1, 'ascii');
        await util.promisify((buf, cb) => conn.write(buf, cb))(buf);
        await new Promise((res, rej) => (conn.once('data', res), conn.once('error', rej)));
        await util.promisify(conn.end.bind(conn))();
    });

    test('Can attach to a running process', async() => {
        await (await testShared.newRuntime()).attach(binaryPort, BUILD_CWD, false, false, false, PROGRAM, DEBUG_FILE, MAP_FILE);
    });
});
