'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol'
import { CC65ViceDebugSession } from './cc65ViceDebug';
import * as languageClient from 'vscode-languageclient';
import * as Net from 'net';
import * as util from 'util';
import * as debugUtils from './debugUtils';
import { StatsWebview } from './statsWebview';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'external';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
		vscode.commands.registerCommand('cc65-vice.stats', async () => {
            StatsWebview.createOrShow(context.extensionPath);
            const dbgfile = await debugUtils.loadDebugFile("boop", "boop");
            StatsWebview.update(dbgfile);
		})
	);

    const provider = new CC65ViceConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('cc65-vice', provider));

    let factory: vscode.DebugAdapterDescriptorFactory;
    // Do I need this or will it be broken?
    switch (runMode) {
        // This indentation tho...
        case 'server':
            factory = new CC65ViceDebugAdapterDescriptorFactory();
            break;

        case 'inline':
            factory = new InlineDebugAdapterFactory();
            break;

        case 'external': default:
            factory = new DebugAdapterExecutableFactory();
            break;
        }

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('cc65-vice', factory));
    if ('dispose' in factory) {
        context.subscriptions.push(factory);
    }
}

export function deactivate() {
    // nothing to do
}


class CC65ViceConfigurationProvider implements vscode.DebugConfigurationProvider {

    /**
    * Massage a debug configuration just before a debug session is being launched,
    * e.g. add all missing attributes to the debug configuration.
    */
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'makefile') {
                config.type = 'cc65-vice';
                config.name = 'Build and launch VICE';
                config.request = 'launch';
                config.buildCommand = 'make OPTIONS=debugfile,mapfile,labelfile';
                config.buildCwd = '${worspaceFolder}';
                config.stopOnEntry = true;
            }
        }

        return config;
    }
}

class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {

    // The following use of a DebugAdapter factory shows how to control what debug adapter executable is used.
    // Since the code implements the default behavior, it is absolutely not neccessary and we show it here only for educational purpose.

    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
        // param "executable" contains the executable optionally specified in the package.json (if any)

        // use the executable specified in the package.json if it exists or determine it based on some other information (e.g. the session)
        if (!executable) {
            const command = "absolute path to my DA executable";
            const args = [
                "some args",
                "another arg"
            ];
            const options = {
                cwd: "working directory for executable",
                env: { "VAR": "some value" }
            };
            executable = new vscode.DebugAdapterExecutable(command, args, options);
        }

        // make VS Code launch the DA executable
        return executable;
    }
}

class CC65ViceDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

    private server?: Net.Server;

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        if (!this.server) {
            // start listening on a random port
            this.server = Net.createServer(socket => {
                const session = new CC65ViceDebugSession();
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        // make VS Code connect to debug server
        return new vscode.DebugAdapterServer((<Net.AddressInfo>this.server.address()).port);
    }

    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

    createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
        const sesh = new CC65ViceDebugSession();
        return new (<any>vscode).DebugAdapterInlineImplementation();
    }
}
