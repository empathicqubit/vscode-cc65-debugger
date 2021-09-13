
import * as path from 'path';
import * as vscode from 'vscode';
import * as compile from '../../compile';
describe('Integration', () => {
    test('Verify that the session finishes successfully without intervention', async () => {
        const root = vscode.Uri.file(path.normalize(__dirname + '/../../../src/tests/simple-project'));
        await vscode.commands.executeCommand('vscode.openFolder', root);
        const ws = vscode.workspace.getWorkspaceFolder(root);
        await vscode.debug.startDebugging(ws, {
            "type": "cc65-vice",
            "request": "launch",
            "name": "debug-" + Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER / 2)).toString(16),
            "program": "${workspaceFolder}/simple-project.c64",
            "build": {
                "cwd": "${workspaceFolder}",
                "command": compile.DEFAULT_BUILD_COMMAND,
                "args": compile.DEFAULT_BUILD_ARGS,
            },
            "stopOnEntry": false,
            "stopOnExit": false,
            "viceArgs": [],
        });

        await new Promise<void>((res, rej) => {
            vscode.debug.onDidTerminateDebugSession(e => {
                res();
            });
        });
    });
});