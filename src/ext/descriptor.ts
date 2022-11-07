import { DebugSession } from "vscode-debugadapter";
import { CC65ViceDebugSession } from "../dbg/debug-session";
import * as vscode from 'vscode';
import { LaunchRequestArguments } from "../lib/launch-arguments";
import * as compile from '../lib/compile';
import * as net from 'net';
import { extId } from "./ui-utils";

const newSession = () : DebugSession => {
    const sesh = new CC65ViceDebugSession();

    return sesh;
}

export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return executable;
    }
}

export class CC65ViceConfigurationProvider implements vscode.DebugConfigurationProvider {
    private _portGetter: () => number;
    constructor(portGetter: () => number) {
        this._portGetter = portGetter;
    }

    /**
    * Massage a debug configuration just before a debug session is being launched,
    * e.g. add all missing attributes to the debug configuration.
    */
    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, c: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        const config = <LaunchRequestArguments><any>c;
        // if launch.json is missing or empty
        if (!c.type && !config.request && !c.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'makefile') {
                c.type = extId;
                c.name = 'Build and launch VICE';
                config.request = 'launch';
                config.build = {
                    command: compile.DEFAULT_BUILD_COMMAND,
                    cwd: '${workspaceFolder}',
                    args: compile.DEFAULT_BUILD_ARGS,
                }
                config.stopOnEntry = true;
            }
        }

        if(c.request != 'attach' && !(config.port && config.port > 0)) {
            config.port = this._portGetter();
        }
        config.cc65Home = vscode.workspace.getConfiguration('cc65vice').get('cc65Home');
        config.viceDirectory = vscode.workspace.getConfiguration('cc65vice').get('viceDirectory');
        config.appleWinDirectory = vscode.workspace.getConfiguration('cc65vice').get('appleWinDirectory');
        config.mesenDirectory = vscode.workspace.getConfiguration('cc65vice').get('mesenDirectory');
        config.preferX64OverX64sc = vscode.workspace.getConfiguration('cc65vice').get('preferX64OverX64sc');
        config.runAhead = vscode.workspace.getConfiguration('cc65vice').get('runAhead');

        return c;
    }
}

export class CC65ViceDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

    private server?: net.Server;

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        if (!this.server) {
            // start listening on a random port
            this.server = net.createServer(socket => {
                const session = newSession();
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        // make VS Code connect to debug server
        return new vscode.DebugAdapterServer((<net.AddressInfo>this.server.address()).port);
    }

    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}

export class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

    createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new (<any>vscode).DebugAdapterInlineImplementation();
    }
}