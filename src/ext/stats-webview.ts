import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as bin from '../dbg/binary-dto';

export class StatsWebview {
	private static _state: {
		runAhead?: ImageData,
		current?: ImageData,
		sprites?: ImageData[],
		screenText?: ImageData,
		memory?: number[],
		palette?: number[],
		banks?: bin.SingleBankMeta[]
		registers?: bin.SingleRegisterInfo[]
		metas?: bin.SingleRegisterMeta[]
	} = {};
	private static _emitter: EventEmitter = new EventEmitter();

	public static readonly viewType = 'statsWebview';

	private static _currentPanel: StatsWebview | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];

	public static reset() {
		StatsWebview._state.runAhead = <any>null;
		StatsWebview._state.current = <any>null;
		StatsWebview._state.screenText = <any>null;
		StatsWebview._state.sprites = [];
		StatsWebview._state.memory = [];
		StatsWebview._state.palette = [];
		StatsWebview._state.banks = [];
		StatsWebview._state.registers = [];
		StatsWebview._state.metas = [];
		if(StatsWebview._currentPanel) {
			StatsWebview._currentPanel._panel.webview.postMessage({
				reset: true,
			});
		}
	}

    public static update(update: typeof StatsWebview._state) {
		StatsWebview._state.runAhead = update.runAhead     || StatsWebview._state.runAhead;
		StatsWebview._state.current = update.current       || StatsWebview._state.current;
		StatsWebview._state.sprites = update.sprites       || StatsWebview._state.sprites;
		StatsWebview._state.screenText = update.screenText || StatsWebview._state.screenText;
		StatsWebview._state.memory = update.memory         || StatsWebview._state.memory;
		StatsWebview._state.palette = update.palette       || StatsWebview._state.palette;
		StatsWebview._state.banks = update.banks           || StatsWebview._state.banks;
		StatsWebview._state.registers = update.registers   || StatsWebview._state.registers;
		StatsWebview._state.metas = update.metas           || StatsWebview._state.metas;
        if(StatsWebview._currentPanel) {
            StatsWebview._currentPanel._panel.webview.postMessage(StatsWebview._state);
        }
	}

	public static addEventListener(event: string, cb: (...args: any[]) => void) {
		StatsWebview._emitter.addListener(event, cb);
	}

	public static async maybeCreate(extensionPath: string) : Promise<void> {
		if (StatsWebview._currentPanel) {
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			StatsWebview.viewType,
			'CC65 - Run',
			vscode.ViewColumn.Two,
			{
				retainContextWhenHidden: true,
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'dist'))]
			}
		);

		panel.webview.onDidReceiveMessage((evt) => {
			const r = evt.request;
			if(r == 'keydown' || r == 'keyup' || r == 'offset' || r == 'bank') {
				StatsWebview._emitter.emit(r, evt);
			}
		});

        StatsWebview._currentPanel = new StatsWebview(panel, extensionPath);
        await StatsWebview._currentPanel._init();

        StatsWebview.update(StatsWebview._state);
	}

	public static async revive(panel: vscode.WebviewPanel, extensionPath: string) {
        StatsWebview._currentPanel = new StatsWebview(panel, extensionPath);
        await StatsWebview._currentPanel._init();
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
		this._panel = panel;
		this._extensionPath = extensionPath;

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

	private async _init() : Promise<void> {
		const webview = this._panel.webview;

		this._panel.title = 'CC65 - Run';
        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

	private async _getHtmlForWebview(webview: vscode.Webview) : Promise<string> {
        let scriptUri : vscode.Uri;
        let connectSrc = "'none'";
        try {
            await fs.promises.stat(this._extensionPath + '/.git');
            scriptUri = vscode.Uri.parse(
                'http://localhost:8794/dist/webviews.js'
            );
            connectSrc = "http://localhost:8794 ws://localhost:8794";
        }
        catch {
            const sp = vscode.Uri.file(
                path.join(this._extensionPath, 'dist', 'webviews.js')
            );
            scriptUri = webview.asWebviewUri(sp);
        }

        const cssPathOnDisk = vscode.Uri.file(
            path.join(this._extensionPath, 'dist/styles.css')
        );
		const c64TtfPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'dist', 'c64.ttf')
		);

		const cssUri = webview.asWebviewUri(cssPathOnDisk);
		const c64TtfUri = webview.asWebviewUri(c64TtfPathOnDisk);

		const nonce = getNonce();

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${connectSrc}; font-src ${webview.cspSource}; style-src 'nonce-${nonce}' ${webview.cspSource}; img-src blob: ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style nonce="${nonce}" type="text/css">
					@font-face {
						font-family: "C64";
						src: url("${c64TtfUri}") format("truetype");
					}
				</style>
				<link rel="stylesheet" type="text/css" href="${cssUri}" nonce="${nonce}" />
                <title>Thoughts of a Dying Atheist</title>
            </head>
            <body>
                <div id="content"></div>
                <script nonce="${nonce}" type="text/javascript" src="${scriptUri}"></script>
                <script nonce="${nonce}" type="text/javascript">
                    window.statsWebviewContent();
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