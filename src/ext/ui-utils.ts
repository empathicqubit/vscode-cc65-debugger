import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as customRequests from '../lib/custom-requests';

export const extId = 'cc65-vice';

export const activationLanguages = ['c', 'cpp', 'ca65'];

export interface MyDebugSession extends vscode.DebugSession {
    customRequest(command: 'enableStats') : Thenable<any>;
    customRequest(command: 'disassemble', args: DebugProtocol.DisassembleRequest['arguments']) : Thenable<DebugProtocol.DisassembleResponse['body']>;
    customRequest(command: 'disassembleLine', args: customRequests.DisassembleLineRequest['arguments']) : Thenable<DebugProtocol.DisassembleResponse['body']>;
    customRequest(command: 'messageActioned', args: customRequests.MessageActionedRequest['arguments']) : Thenable<void>
    customRequest<T extends string>(command: T & (T extends ('enableStats' | 'disassemble' | 'messageActioned' | 'disassembleLine') ? never : {}), args?: any) : Thenable<any>;
}

export function getActiveSession() : MyDebugSession | undefined {
    const sesh = vscode.debug.activeDebugSession;
    if(sesh?.type != extId) {
        return undefined;
    }

    return sesh;
};