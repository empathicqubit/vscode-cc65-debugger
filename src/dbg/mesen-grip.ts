
import { AbstractGrip } from "./abstract-grip";
import _random from 'lodash/fp/random'
import * as fs from 'fs'
import * as bin from './binary-dto'
import * as util from 'util'
import * as debugUtils from '../lib/debug-utils'
import * as debugFile from '../lib/debug-file'
import * as path from 'path'
import { __basedir } from '../basedir'
import getPort from 'get-port'
import _last from 'lodash/fp/last'
import * as pngjs from 'pngjs'

export class MesenGrip extends AbstractGrip {
    public async connect(binaryPort: number) : Promise<void> {
        this._binaryConn = await AbstractGrip._connect(binaryPort, this._binaryDataHandler.bind(this));
    }

    protected _apiVersion : number = 2;
    private _png : any;
    private _binaryPort : number = -1;
    private _mesenPath : string = '';
    private _args : string[] = [];
    private _opts : debugUtils.ExecFileOptions = {};
    public async autostart(program: string) : Promise<void> {

        try {
            const args = [this._mesenPath, ...this._args, program];
            if(process.platform == 'win32') {
                let command = __basedir + '/../dist/mintty/bin_win32_' + process.arch + '/mintty';
                command = path.normalize(command);

                this._pids = await this._execHandler(command, args, this._opts)
            }
            else {
                this._pids = await this._execHandler('mono', args, this._opts)
            }
        }
        catch {
            throw new Error(`Could not start Mesen with "${this._mesenPath} ${this._args.join(' ')}". Make sure your settings are correct.`);
        }

        await this.connect(this._binaryPort);
    }

    public async displayGetRGBA() : Promise<bin.DisplayGetResponse> {
        const res = await this.execBinary({
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.RGBA,
        });

        if(!this._png) {
            this._png = new pngjs.PNG();
        }

        try {
            const data = await util.promisify(this._png.parse.bind(this._png))(res.rawImageData)

            return {
                ...res,
                rawImageData: data.data,
            }
        }
        catch {
            // FIXME
            return res;
        }
    }

    public async start(port: number, cwd: string, machineType: debugFile.MachineType, mesenPath: string, mesenArgs?: string[], labelFile?: string) : Promise<void> {
        const mesenBaseDir = __basedir + '/../dist/mesen';

        let mesenSettingsDir =
            process.env.USERPROFILE
            // FIXME
            ? process.env.USERPROFILE + '/My Documents/Mesen'
            : process.env.HOME + '/Mesen';

        try {
            await fs.promises.mkdir(mesenSettingsDir);
        }
        catch(e) {
            console.error(e);
        }

        try {
            await fs.promises.copyFile(mesenBaseDir + '/settings.xml', mesenSettingsDir + '/settings.xml');
        }
        catch(e) {
            console.error(e);
        }

        this._opts = {
            shell: false,
            env: {
                MESEN_REMOTE_HOST: '127.0.0.1',
                MESEN_REMOTE_BASEDIR: mesenBaseDir,
                MESEN_REMOTE_WAIT: '1',
            },
            cwd: cwd,
            title: 'Mesen',
        };

        this._mesenPath = mesenPath;

        let args = [
            mesenBaseDir + '/mesen_binary_monitor.lua',
        ];

        this._binaryPort = await getPort({port: getPort.makeRange(port, port + 256)});

        this._opts.env!.MESEN_REMOTE_PORT = this._binaryPort.toString()

        if(mesenArgs) {
            args = [...args, ...mesenArgs];
        }
        else {
            args = [...args];
        }

        this._args = args;
    }
}
