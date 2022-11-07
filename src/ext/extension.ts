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

import * as vscode from 'vscode';
import * as debugUtils from '../lib/debug-utils';
import * as metrics from '../lib/metrics';
import * as descriptor from './descriptor';
import { StatsWebview } from './stats-webview';
import cycleAnnotationProvider from './cycle-annotation-provider';
import { DebugProtocol } from 'vscode-debugprotocol';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'external';

let commands : vscode.Disposable[] = [];

const extId = 'cc65-vice';

interface MyDebugSession extends vscode.DebugSession {
    customRequest(command: 'enableStats') : Thenable<any>;
    customRequest(command: 'disassemble', args: DebugProtocol.DisassembleRequest['arguments']) : Thenable<DebugProtocol.DisassembleResponse['body']>;
    customRequest(command: 'messageActioned', args: { name: string })
    customRequest<T extends string>(command: T & (T extends ('enableStats' | 'disassemble' | 'messageActioned') ? never : {}), args?: any) : Thenable<any>;
}

const getActiveSession = () : MyDebugSession | undefined => {
    const sesh = vscode.debug.activeDebugSession;
    if(sesh?.type != extId) {
        return undefined;
    }

    return sesh;
};

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
            const sesh = getActiveSession();
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
        const session : MyDebugSession = e.session;
        if(eventName === e.event) {
            return;
        }

        await StatsWebview.maybeCreate(context.extensionPath);
        if(statsEvents.includes(eventName)) {
            StatsWebview.update(e.body);
        }
        else if(eventName == 'started') {
            await session.customRequest('enableStats');

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
                session.customRequest('messageActioned', {
                    name: action,
                });
            }
        }
    });

    let command : vscode.Disposable;
    command = vscode.commands.registerCommand(extId + '.toggleCycleCounters', () => {
        cycleAnnotationProvider.toggle();
    });
    commands.push(command);

    command = vscode.commands.registerCommand(extId + '.debugCaptureCommand', () => {
        vscode.env.clipboard.writeText("Hello world! This is me... life could be... fun for everyone");
    });
    commands.push(command);

    command = vscode.commands.registerCommand(extId + '.disassembleLine', async (args: { uri: string, address: number, instructionCount: number }) => {
        const sesh = getActiveSession();
        if(!sesh) {
            vscode.window.showErrorMessage('Debug session must be running');
            return;
        }

        args = args || { uri: '', address: -1, instructionCount: -1 };

        const res = await sesh.customRequest('disassemble', {
            memoryReference: 'ram',
            offset: args.address,
            instructionOffset: 0,
            instructionCount: args.instructionCount,
            resolveSymbols: false,
        });

        StatsWebview.update({
            disassembly: res?.instructions,
        });
    });
    commands.push(command);

    const provider = new descriptor.CC65ViceConfigurationProvider(
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
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(extId, provider));

    console.log('Running as ', runMode);
    let factory: descriptor.CC65ViceDebugAdapterDescriptorFactory | descriptor.InlineDebugAdapterFactory | descriptor.DebugAdapterExecutableFactory;
    // Do I need this or will it be broken?
    switch (runMode) {
        // This indentation tho...
        case 'server':
            factory = new descriptor.CC65ViceDebugAdapterDescriptorFactory();
            break;

        case 'inline':
            factory = new descriptor.InlineDebugAdapterFactory();
            break;

        case 'external': default:
            factory = new descriptor.DebugAdapterExecutableFactory();
            break;
    }

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory(extId, factory));
    if ('dispose' in factory) {
        context.subscriptions.push(factory);
    }
}

export function deactivate() {
    commands.forEach(x => x.dispose());
    cycleAnnotationProvider.deactivate();
}