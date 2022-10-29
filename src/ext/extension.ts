/*!
Copyright (c) 2021, EmpathicQubit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

import * as Net from 'net';
import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';
import { DebugSession } from 'vscode-debugadapter';
import * as compile from '../lib/compile';
import { CC65ViceDebugSession } from '../dbg/debug-session';
import * as debugUtils from '../lib/debug-utils';
import * as metrics from '../lib/metrics';
import { StatsWebview } from './stats-webview';
import { LaunchRequestArguments } from '../lib/launch-arguments';
import cycleAnnotationProvider from './cycle-annotation-provider';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'external';

let cycleCommand : vscode.Disposable;
let debugCaptureCommand : vscode.Disposable;

const updateConfiguration = () => {
    // THIS MUST BE FIRST
    const disableMetrics : boolean = !!vscode.workspace.getConfiguration('cc65vice').get('disableMetrics');
    metrics.options.disabled = disableMetrics;
    // THIS MUST BE FIRST

    const enableCycleCounters : boolean = !!vscode.workspace.getConfiguration('cc65vice').get('enableCycleCounters');
    if(enableCycleCounters) {
        setImmediate(() => cycleAnnotationProvider.activate());
    }
    else {
        setImmediate(() => cycleAnnotationProvider.deactivate())
    }
}

export function activate(context: vscode.ExtensionContext) {
    // THIS MUST BE FIRST
    updateConfiguration();
    // THIS MUST BE FIRST

    vscode.workspace.onDidChangeConfiguration(async e => {
        if(!e.affectsConfiguration('cc65vice')) {
            return;
        }

        updateConfiguration();
    }) ;

    metrics.event('extension', 'activated');

    [
        'offset',
        'keydown',
        'keyup',
        'bank',
    ].forEach(t => {
        StatsWebview.addEventListener(t, evt => {
            const sesh = vscode.debug.activeDebugSession;
            if(!sesh) {
                return;
            }
            sesh.customRequest(t, evt);
        });
    });

    const statsEvents = [
        'memory',
        'palette',
        'banks',
        'registers',
        'screenText',
        'runahead',
        'current',
        'sprites',
    ];

    vscode.debug.onDidReceiveDebugSessionCustomEvent(async e => {
        const eventName = e.event.replace(/^cc65-vice:/, '');
        if(eventName === e.event) {
            return;
        }

        await StatsWebview.maybeCreate(context.extensionPath);
        if(statsEvents.includes(eventName)) {
            StatsWebview.update(e.body);
        }
        else if(eventName == 'started') {
            await e.session.customRequest('enableStats');

            const terminal =
                vscode.window.terminals.find(x => x.name.includes('VICE Monitor'))
                || vscode.window.terminals.find(x => x.name.includes('VICE'))
                || vscode.window.terminals[0];
            terminal && terminal.show();
        }
        else if(eventName == 'message') {
            const body : debugUtils.ExtensionMessage = e.body;
            const l = body.level;
            const items : string[] = body.items || [];
            let promise : Thenable<string | undefined>;
            if(l == debugUtils.ExtensionMessageLevel.information) {
                promise = vscode.window.showInformationMessage(body.content, ...items);
            }
            else if(l == debugUtils.ExtensionMessageLevel.warning) {
                promise = vscode.window.showWarningMessage(body.content, ...items);
            }
            else if(l == debugUtils.ExtensionMessageLevel.error) {
                promise = vscode.window.showErrorMessage(body.content, ...items);
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

    cycleCommand = vscode.commands.registerCommand('cc65-vice.toggleCycleCounters', () => {
        cycleAnnotationProvider.toggle();
    });

    debugCaptureCommand = vscode.commands.registerCommand('cc65-vice.debugCaptureCommand', () => {
        vscode.env.clipboard.writeText("Hello world! This is me... life could be... fun for everyone");
    });

    const provider = new CC65ViceConfigurationProvider(
        () => {
            console.log('GETTING PORT...');
            let port = context.globalState.get<number>('current-port') || 29700;
            port++;
            if(port > 30000) {
                port = 29700;
            }

            context.globalState.update('current-port', port);

            return port;
        }
    );
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('cc65-vice', provider));

    console.log('Running as ', runMode);
    let factory: CC65ViceDebugAdapterDescriptorFactory | InlineDebugAdapterFactory | DebugAdapterExecutableFactory;
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
    cycleCommand.dispose();
    cycleAnnotationProvider.deactivate();
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
    private _portGetter: () => number;
    constructor(portGetter: () => number) {
        this._portGetter = portGetter;
    }

    /**
    * Massage a debug configuration just before a debug session is being launched,
    * e.g. add all missing attributes to the debug configuration.
    */
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, c: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        const config = <LaunchRequestArguments><any>c;
        // if launch.json is missing or empty
        if (!c.type && !config.request && !c.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'makefile') {
                c.type = 'cc65-vice';
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
        return new (<any>vscode).DebugAdapterInlineImplementation();
    }
}
