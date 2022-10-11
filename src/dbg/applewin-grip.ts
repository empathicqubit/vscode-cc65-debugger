import { AbstractGrip } from "./abstract-grip";
import * as tmp from 'tmp'
import * as bin from './binary-dto'
import * as util from 'util'
import * as fs from 'fs'
import * as debugUtils from '../lib/debug-utils'
import * as path from 'path'
import * as debugFile from '../lib/debug-file'
import getPort from 'get-port'
import _last from 'lodash/fp/last'

export class AppleWinGrip extends AbstractGrip {
    private _versionInfo : {
        version: string,
        svnRevision: number,
        displayBuffer8BitOnly: boolean,
        canSetJoyport: boolean,
    } | undefined;

    /**
     * Get the version info from an AppleWin with default settings so it's less likely
     * to break at startup
     * @param emulatorPath The absolute path to AppleWin
     * @param machineType Only apple2 currently
     */
    private async _versionProbeStart(emulatorPath: string, machineType: debugFile.MachineType, port: number) : Promise<void> {
        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: '.',
            title: 'AppleWin',
        };

        const binaryPort = await getPort({port: getPort.makeRange(port, port + 256)});

        let args = [
            "--default",

            // Monitor
            "--binary-monitor", "--binary-monitor-address", `127.0.0.1:${binaryPort}`,
        ];

        console.log('Probing AppleWin', emulatorPath, JSON.stringify(args), opts);

        let pids : number[];
        try {
            pids = await this._execHandler(emulatorPath, args, opts);
        }
        catch {
            throw new Error(`Could not start AppleWin with "${emulatorPath} ${args.join(' ')}". Make sure your settings are correct.`);
        }

        await this._versionProbeConnect(binaryPort, true);
    }

    public async connect(binaryPort: number) : Promise<void> {
        await this._versionProbeConnect(binaryPort, false);

        this._binaryConn = await AbstractGrip._connect(binaryPort, this._binaryDataHandler.bind(this));

        const resources : bin.ResourceGetCommand[] = [
            {
                type: bin.CommandType.resourceGet,
                resourceName: 'MonitorServer',
            },
            {
                type: bin.CommandType.resourceGet,
                resourceName: 'MonitorServerAddress',
            }
        ];

        const [enabledRes, textRes] : bin.ResourceGetResponse[] = await this.multiExecBinary(resources);

        if(!enabledRes.intValue) {
            return;
        }

        this.textPort = parseInt(_last(textRes.stringValue!.split(':'))!);
    }

    private async _versionProbeConnect(binaryPort: number, terminate: boolean) : Promise<void> {
        if(this._versionInfo) {
            return;
        }

        const grip = new AppleWinGrip(this._execHandler);
        grip._binaryConn = await AppleWinGrip._connect(binaryPort, grip._binaryDataHandler.bind(grip));

        const res = await grip.execBinary({
            type: bin.CommandType.emulatorInfo,
        })

        console.log('Emulator Info', res);

        const ver = res.version.slice(0, -1).join('.')
        const rev = res.svnRevision;
        this._apiVersion = res.apiVersion;
        this._versionInfo = {
            version: ver,
            svnRevision: rev,
            canSetJoyport: true,
            displayBuffer8BitOnly: true,
        }

        terminate ? await grip.terminate() : await grip.disconnect();
    }

    public async joyportSet(port: number, value: number) : Promise<void> {
        if(!this._versionInfo!.canSetJoyport) {
            return;
        }

        super.joyportSet(port, value);
    }

    public async autostart(program: string) : Promise<void> {
        await this.execBinary({
            type: bin.CommandType.autostart,
            filename: program,
            index: 0,
            run: true,
        });
    }

    public async displayGetRGBA() : Promise<bin.DisplayGetResponse> {
        if(!this._versionInfo!.displayBuffer8BitOnly) {
            throw new Error("Shouldn't get here.");
        }

        const res = await this.execBinary({
            type: bin.CommandType.displayGet,
            useVicII: false,
            format: bin.DisplayGetFormat.Indexed8,
        });

        const paletteRes = await this.execBinary({
            type: bin.CommandType.paletteGet,
            useVicII: false,
        });
        const entries = paletteRes.entries;

        const buf = Buffer.alloc(res.rawImageData.length * 4);

        for(let i = 0; i < res.rawImageData.length; i++) {
            const index = res.rawImageData[i];
            const entry = entries[index];
            buf.writeUInt8(entry.red, i * 4 + 0);
            buf.writeUInt8(entry.green, i * 4 + 1);
            buf.writeUInt8(entry.blue, i * 4 + 2);
            buf.writeUInt8(255, i * 4 + 3);
        }

        return {
            ...res,
            rawImageData: buf,
        };
    }

    public async start(port: number, cwd: string, machineType: debugFile.MachineType, emulatorPath: string, emulatorArgs?: string[], labelFile?: string) : Promise<void> {
        await this._versionProbeStart(emulatorPath, machineType, port);

        let logfile : string | undefined;
        // FIXME VICE needs this on Windows to display any output in the console.
        if(false && process.platform == "win32") {
            logfile = await util.promisify(tmp.tmpName)({ prefix: 'cc65-vice-'});

            const tempdir = path.dirname(logfile!);
            const temps = await fs.promises.readdir(tempdir);
            temps
                .filter(x => /^cc65-vice-/.test(x))
                .map(x => fs.promises.unlink(path.join(tempdir, x)).catch(() => {}));
        }

        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: cwd,
            title: 'AppleWin',
        };

        let args = [
            ...(
                logfile
                ? ['--log-file', logfile]
                : []
            ),

            // FIXME This is a label file generated by cc65 for VICE, which contains
            // a bunch of 'al' (add label commands), to put labels in the assembly.
            // This might be useful if AppleWin also has a debugger which does label
            // files like this.
            ...(
                false && labelFile
                ? ['--mon-commands', labelFile!]
                : []
            )
        ];

        // const startText = _random(29170, 29400);
        const binaryPort = await getPort({port: getPort.makeRange(port, port + 256)});
        // const textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});

        args = [...args,
            // Add these as late as possible so we can try to capture the unused port quickly
            // FIXME If you want to include a CLI monitor "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${textPort}`,
            "--binary-monitor", "--binary-monitor-address", `127.0.0.1:${binaryPort}`,
        ];

        if(emulatorArgs) {
            args = [...args, ...emulatorArgs];
        }
        else {
            args = [...args];
        }

        console.log('Starting AppleWin', emulatorPath, JSON.stringify(args), opts);

        try {
            this._pids = await this._execHandler(emulatorPath, args, opts)
        }
        catch {
            throw new Error(`Could not start AppleWin with "${emulatorPath} ${args.join(' ')}". Make sure your settings are correct.`);
        }

        // Windows only, for debugging
        if(false && logfile) {
            await this._execHandler('powershell', ['-Command', 'Get-Content', logfile!, '-Wait'], {
                title: 'Log Output'
            })
        }

        await this.connect(binaryPort);
    }
}
