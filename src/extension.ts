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
import { DebugSession } from 'vscode-debugadapter';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'external';

export function activate(context: vscode.ExtensionContext) {
    vscode.debug.onDidReceiveDebugSessionCustomEvent(e => {
        if(e.event == 'runahead') {
            StatsWebview.maybeCreate(context.extensionPath);
            StatsWebview.update(e.body.runAhead, e.body.current);
        }
        else if(e.event == 'current') {
            StatsWebview.maybeCreate(context.extensionPath);
            StatsWebview.update(undefined, e.body.current);
        }
    });

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

const newSession = () : DebugSession => {
    const sesh = new CC65ViceDebugSession();

    return sesh;
}

class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
           return executable;
    }
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

        config.viceDirectory = vscode.workspace.getConfiguration('cc65vice').get('viceDirectory');
        config.preferX64OverX64sc = vscode.workspace.getConfiguration('cc65vice').get('preferX64OverX64sc');
        config.runAhead = vscode.workspace.getConfiguration('cc65vice').get('runAhead');

        return config;
    }
}

class CC65ViceDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

    private server?: Net.Server;

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        if (!this.server) {
            // start listening on a random port
            this.server = Net.createServer(socket => {
                const session = newSession();
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
        const sesh = newSession();
        return new (<any>vscode).DebugAdapterInlineImplementation();
    }
}
