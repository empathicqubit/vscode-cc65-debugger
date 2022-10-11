import { DebugProtocol } from 'vscode-debugprotocol';

export interface LaunchRequestBuildArguments {
    /** Should we skip the build completely? */
    skip?: boolean;
    /** The executable to run */
    command?: string;
    /** The arguments to use */
    args?: string[];
    /** The full absolute path to run your build command in */
    cwd: string;
    /** Environment variables to add */
    environment?: {[key:string]:string}; // FIXME unused
}

/**
 * Settings for launch.json
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    /** launch or attach */
    request?: 'launch' | 'attach';
    /** Port of the binary monitor to connect to */
    port?: number;
    /** When hitting a breakpoint, step ahead by one frame so that any screen updates that may have been made become visible immediately. */
    runAhead?: boolean;
    /** Use X64 instead of X64SC when appropriate. */
    preferX64OverX64sc?: boolean;
    /** The directory of VICE emulator. */
    viceDirectory?: string;
    /** The directory of Mesen emulator. */
    mesenDirectory?: string;
    /** The directory of AppleWin emulator. */
    appleWinDirectory?: string;
    /** The directory of CC65, if custom. */
    cc65Home?: string;
    /** The arguments to use for starting the emulator. No environment variables are allowed. */
    emulatorArgs?: string[];
    /** The command to run before launching. This is a shell command so you can put arguments and variables in here too. */
    build: LaunchRequestBuildArguments;
    /** The d64, d81, or prg file to run, if automatic detection doesn't work */
    program: string;
    /** The machine type to use, instead of the autodetected one. */
    machineType?: string;
    /** The debug file path, if automatic detection doesn't work */
    debugFile: string;
    /** The map file path, if automatic detection doesn't work */
    mapFile: string;
    /** Automatically stop target after hitting the beginning of main(). If not specified, target does not stop. */
    stopOnEntry?: boolean;
    /** Automatically stop target after hitting the end of main(). */
    stopOnExit?: boolean;
    /** enable logging the Debug Adapter Protocol */
    trace?: boolean;
    console?: 'integratedTerminal' | 'integratedConsole' | 'externalTerminal';
}
