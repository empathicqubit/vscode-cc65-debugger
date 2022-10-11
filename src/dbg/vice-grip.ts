import { AbstractGrip } from "./abstract-grip";
import _random from 'lodash/fp/random'
import * as bin from './binary-dto'
import semver from 'semver'
import * as fs from 'fs'
import * as debugUtils from '../lib/debug-utils'
import * as path from 'path'
import * as debugFile from '../lib/debug-file'
import { __basedir } from '../basedir'
import getPort from 'get-port'
import _last from 'lodash/fp/last'

export class ViceGrip extends AbstractGrip {
    private _versionInfo : {
        version: string,
        svnRevision: number,
        compoundDirectory: boolean,
        displayBuffer8BitOnly: boolean,
        keyboardBufferPetsciiOnly: boolean,
        canSetJoyport: boolean,
    } | undefined;

    // We do this so we can use a custom kernal which starts a tiny bit faster:
    // https://codebase64.org/doku.php?id=base:using_a_running_vice_session_for_development
    private static _getDirectoryOptions(machineType: debugFile.MachineType, compoundDirectory: boolean) : string[] {
        let q = "";
        let sep = ":";
        if(process.platform == "win32") {
            sep = ';';
        }

        let dirs = [""];
        if(compoundDirectory) {
            dirs = [
                path.normalize(__basedir + "/../dist/system"),
            ];
        }
        else {
            if(machineType == debugFile.MachineType.c64) {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/C64"),
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.c128) {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/C128"),
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.pet) {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/PET"),
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.vic20) {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/VIC20"),
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
            else if(machineType == debugFile.MachineType.plus4) {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/PLUS4"),
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
            else {
                dirs = [
                    path.normalize(__basedir + "/../dist/system/DRIVES"),
                    path.normalize(__basedir + "/../dist/system/PRINTER"),
                ];
            }
        }

        return ["-directory", q + dirs.join(sep) + q];
    }

    /**
     * Get the version info from a VICE with default settings so it's less likely
     * to break at startup
     * @param emulatorPath The absolute path to VICE
     * @param machineType C64, C128, VIC20, etc.
     */
    private async _versionProbeStart(emulatorPath: string, machineType: debugFile.MachineType, port: number) : Promise<void> {
        let directoryOpts : string[] = [];
        try {
            await fs.promises.access(path.dirname(emulatorPath) + '/../data/GLSL');
            directoryOpts = ViceGrip._getDirectoryOptions(machineType, true);
        }
        catch {}

        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: '.',
            title: 'VICE',
        };

        const binaryPort = await getPort({port: getPort.makeRange(port, port + 256)});

        let args = [
            "-default",

            ...directoryOpts,

            '+sound',

            // Monitor
            "+remotemonitor",
            "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${binaryPort}`,
        ];

        console.log('Probing VICE', emulatorPath, JSON.stringify(args), opts);

        let pids : number[];
        try {
            pids = await this._execHandler(emulatorPath, args, opts);
        }
        catch {
            throw new Error(`Could not start VICE with "${emulatorPath} ${args.join(' ')}". Make sure your settings are correct.`);
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

        const grip = new ViceGrip(this._execHandler);
        grip._binaryConn = await ViceGrip._connect(binaryPort, grip._binaryDataHandler.bind(grip));

        try {
            const res = await grip.execBinary({
                type: bin.CommandType.emulatorInfo,
            })

            console.log('VICE Info', res);

            const ver = res.version.slice(0, -1).join('.')
            const rev = res.svnRevision;
            this._apiVersion = res.apiVersion;
            this._versionInfo = {
                version: ver,
                svnRevision: rev,
                canSetJoyport: semver.satisfies(ver, `>=3.6`) || rev >= 41221,
                compoundDirectory: semver.satisfies(ver, `>=3.6`) || rev >= 39825,
                displayBuffer8BitOnly: this._apiVersion >= 2,
                keyboardBufferPetsciiOnly: this._apiVersion >=2,
            }
        }
        catch {
            this._apiVersion = 1
            this._versionInfo = {
                version: '3.5.0.0',
                svnRevision: 0,
                canSetJoyport: false,
                compoundDirectory: false,
                displayBuffer8BitOnly: false,
                keyboardBufferPetsciiOnly: false,
            }
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
            const res = await this.execBinary({
                type: bin.CommandType.displayGet,
                useVicII: false,
                format: bin.DisplayGetFormat.RGBA,
            });

            return res;
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

        const opts : debugUtils.ExecFileOptions = {
            shell: false,
            cwd: cwd,
            title: 'VICE',
        };

        let args = [
            ...ViceGrip._getDirectoryOptions(machineType, this._versionInfo!.compoundDirectory),

            '-sound',

            // C64-specific
            ...(
                machineType == debugFile.MachineType.c64
                ? [
                    "-iecdevice8",
                ]
                : []
            ),

            // Hardware
            "-autostart-warp", "-autostartprgmode", "1", "+autostart-handle-tde",

            ...(
                labelFile
                ? ['-moncommands', labelFile]
                : []
            )
        ];

        const startText = _random(29170, 29400);
        const binaryPort = await getPort({port: getPort.makeRange(port, port + 256)});
        const textPort = await getPort({port: getPort.makeRange(startText, startText + 256)});

        args = [...args,
            // Add these as late as possible so we can try to capture the unused port quickly
            "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${textPort}`,
            "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${binaryPort}`,
        ];

        if(emulatorArgs) {
            args = [...args, ...emulatorArgs];
        }
        else {
            args = [...args];
        }

        console.log('Starting VICE', emulatorPath, JSON.stringify(args), opts);

        if(process.platform == 'win32') {
            if(/chocolatey[\\/]+bin[\\/]+/i.test(emulatorPath)) {
                args.unshift('--shimgen-waitforexit');
            }
            args.unshift('-h', 'error', emulatorPath);

            emulatorPath = __basedir + '/../dist/mintty/bin_win32_' + process.arch + '/mintty';
        }

        try {
            this._pids = await this._execHandler(emulatorPath, args, opts)
        }
        catch {
            throw new Error(`Could not start VICE with "${emulatorPath} ${args.join(' ')}". Make sure your settings are correct.`);
        }

        await this.connect(binaryPort);
    }
}
