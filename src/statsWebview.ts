import * as vscode from 'vscode';
import * as path from 'path';
import * as dbgFile from './debugFile';
import * as fs from 'fs';
import * as util from 'util';

export class StatsWebview {
	private static _currentPanel: StatsWebview | undefined;
    private static _debugFile: dbgFile.Dbgfile | undefined;

	public static readonly viewType = 'statsWebview';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
    private _disposables: vscode.Disposable[] = [];

    public static update(debugFile: dbgFile.Dbgfile | undefined) {
        StatsWebview._debugFile = debugFile;
        if(StatsWebview._currentPanel && StatsWebview._debugFile) {
            StatsWebview._currentPanel._panel.webview.postMessage(StatsWebview._debugFile.segs);
        }
    }

	public static createOrShow(extensionPath: string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (StatsWebview._currentPanel) {
			StatsWebview._currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			StatsWebview.viewType,
			'CC65 Stats',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'dist'))]
			}
		);

        StatsWebview._currentPanel = new StatsWebview(panel, extensionPath);

        StatsWebview.update(StatsWebview._debugFile)
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
		StatsWebview._currentPanel = new StatsWebview(panel, extensionPath);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
		this._panel = panel;
		this._extensionPath = extensionPath;

        this._init();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public dispose() {
		StatsWebview._currentPanel = undefined;

		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
    }

	private _init() {
		const webview = this._panel.webview;

		this._panel.title = 'Project Stats';
        this._panel.webview.html = this._getHtmlForWebview(webview);

    }

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'dist', 'webviews.js')
		);

		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		const nonce = getNonce();

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Jimmy Eat World</title>
            </head>
            <body>
                <div id="content"></div>
                <script nonce="${nonce}" type="text/javascript" src="${scriptUri}"></script>
                <script nonce="${nonce}" type="text/javascript">
                    webviews.statsWebviewContent();
                </script>
            </body>
            </html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}