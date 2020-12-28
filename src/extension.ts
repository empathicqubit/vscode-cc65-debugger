'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol'
import { CC65ViceDebugSession } from './debug-session';
import * as Net from 'net';
import * as util from 'util';
import * as debugUtils from './debug-utils';
import { StatsWebview } from './stats-webview';
import { DebugSession } from 'vscode-debugadapter';
import * as metrics from './metrics';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'external';

export function activate(context: vscode.ExtensionContext) {
    const disableMetrics : boolean = !!vscode.workspace.getConfiguration('cc65vice').get('disableMetrics');
    metrics.options.disabled = disableMetrics;

    vscode.workspace.onDidChangeConfiguration(e => {
        if(!e.affectsConfiguration('cc65vice')) {
            return;
        }

        const disableMetrics : boolean = !!vscode.workspace.getConfiguration('cc65vice').get('disableMetrics');
        metrics.options.disabled = disableMetrics;
    }) ;

    metrics.event('extension', 'activated');

    StatsWebview.addEventListener('keydown', evt => {
        const sesh = vscode.debug.activeDebugSession;
        if(!sesh) {
            return;
        }
        sesh.customRequest('keydown', evt);
    });

    StatsWebview.addEventListener('keyup', evt => {
        const sesh = vscode.debug.activeDebugSession;
        if(!sesh) {
            return;
        }
        sesh.customRequest('keyup', evt);
    });

    vscode.debug.onDidReceiveDebugSessionCustomEvent(async e => {
        if(e.event == 'runahead') {
            StatsWebview.maybeCreate(context.extensionPath);
            StatsWebview.update(e.body.runAhead);
        }
        else if(e.event == 'current') {
            StatsWebview.maybeCreate(context.extensionPath);
            StatsWebview.update(undefined, e.body.current);
        }
        else if(e.event == 'sprites') {
            StatsWebview.maybeCreate(context.extensionPath);
            StatsWebview.update(undefined, undefined, e.body.sprites);
        }
        else if(e.event == 'started') {
            const terminal =
                vscode.window.terminals.find(x => x.name.includes('VICE Monitor'))
                || vscode.window.terminals.find(x => x.name.includes('VICE'))
                || vscode.window.terminals[0];
            terminal && terminal.show();
        }
        else if(e.event == 'message') {
            const l = e.body.level;
            const items : string[] = e.body.items || [];
            const content : string = e.body.content;
            let promise : Thenable<string | undefined>;
            if(l == 'information') {
                promise = vscode.window.showInformationMessage(content, ...items);
            }
            else if(l == 'warning') {
                promise = vscode.window.showWarningMessage(content, ...items);
            }
            else if(l == 'error') {
                promise = vscode.window.showErrorMessage(content, ...items);
            }
            else {
                console.error('invalid user message');
                console.error(e);
                return;
            }

            const action = await promise;
            if(action) {
                e.session.customRequest('messageActioned', {
                    name: action
                });
            }
        }
    });

    const provider = new CC65ViceConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('cc65-vice', provider));

    console.log('Running as ', runMode);
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
