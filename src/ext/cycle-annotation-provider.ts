import * as vscode from "vscode";
import * as debugFile from "../lib/debug-file";
import * as debugUtils from '../lib/debug-utils';
import * as disassembly from '../lib/disassembly';
import _minBy from 'lodash/fp/minBy';
import _debounce from 'lodash/fp/debounce';
import * as compile from '../lib/compile';

class CycleAnnotationProvider {
    private _activations : vscode.Disposable[] = [];

    private _individualCycleDecoration : vscode.TextEditorDecorationType;
    private _totalCycleDeclaration: vscode.TextEditorDecorationType;

    private _lastDecorated: { [filename: string]:number } = {};

    private _active: boolean = false;
    private _dbgFile?: debugFile.Dbgfile;
    private _buildCwd: string = '';
    private _fsWatcher: vscode.FileSystemWatcher;
    private _programData?: Buffer;
    private _loadAddress?: number;
    private _dbgTextDocument?: vscode.TextDocument;
    private _dbgLastDecorated?: number;

    private async _updateDecorations(textEditors: vscode.TextEditor[], force: boolean = false) : Promise<void> {
        console.time("update decorations");
        try {
            if(!vscode.workspace.name) {
                return;
            }

            const programPaths = await compile.guessProgramPath(this._buildCwd);
            if(!programPaths.length) {
                return;
            }

            // FIXME This is on the launch unfortunately, so we fake it for now.
            const debugPath = await debugUtils.getDebugFilePath(programPaths[0], this._buildCwd);

            if(!debugPath) {
                return;
            }

            this._dbgTextDocument = this._dbgTextDocument || await vscode.workspace.openTextDocument(debugPath);

            let dbgFileUpdated = false;
            if(!this._dbgFile) {
                dbgFileUpdated = true;
                this._dbgLastDecorated = undefined;
                this._dbgFile = debugFile.parse(this._dbgTextDocument.getText(), this._buildCwd);
                this._programData = await compile.getBinaryFromProgram(programPaths[0]);
                this._loadAddress = this._programData.readUInt16LE(0);
            }

            // FIXME Probably slow

            for(const textEditor of textEditors) {
                const textDocument = vscode.workspace.textDocuments.find(x => x.fileName == textEditor.document.fileName)
                if(!textDocument) {
                    continue;
                }

                if(!["c", "ca65"].includes(textDocument.languageId)) {
                    return;
                }

                if(!force && this._dbgLastDecorated === this._dbgTextDocument?.version && this._lastDecorated[textDocument.uri.toString()] === textDocument.version) {
                    continue;
                }

                const file = this._dbgFile.files
                    .find(x => x.name == textEditor.document.uri.fsPath.toString())
                if(!file) {
                    continue;
                }

                const lines = file.lines.filter(x => x.num + 1 < textDocument.lineCount);

                let total = 0;
                const opts : vscode.DecorationOptions[] = [];
                for(const line of lines) {
                    let instructionCount = 0;
                    let cycleCount = 0;

                    // FIXME This won't work with cruncher.
                    if(!(this._loadAddress && this._programData && line.span)) {
                        continue;
                    }

                    const mem = this._programData.slice(line.span.absoluteAddress - (this._loadAddress - 2), (line.span.absoluteAddress + line.span.size) - (this._loadAddress - 2));

                    disassembly.opCodeFind(mem, (cmd, __, ___) => {
                        instructionCount++;
                        cycleCount += disassembly.opcodeCycles[cmd];
                        return false;
                    });

                    if(textEditor.selections.length > 1 || !textEditor.selection.isSingleLine) {
                        for(const selection of textEditor.selections) {
                            if(
                                textDocument.lineAt(line.num).range.intersection(selection)
                                || textDocument.lineAt(line.num).range.intersection(selection)
                                ) {
                                total += cycleCount;
                            }
                        }
                    }

                    try {
                        const args = {
                            uri: textEditor.document.uri.toString(),
                            address: line.span.absoluteAddress,
                            instructionCount,
                        };

                        const opt : vscode.DecorationOptions = {
                            range: textDocument.lineAt(line.num).range,
                            hoverMessage: `Cycles: ${cycleCount}`,
                            renderOptions: {
                                after: {
                                    contentText: `🔄 ${cycleCount}`,
                                }
                            },
                        };

                        opts.push(opt);
                    }
                    catch {
                        continue;
                    }
                }

                textEditor.setDecorations(this._individualCycleDecoration, opts);
                if(total) {
                    const union = textEditor.selections.reduce((last : {union(input: vscode.Range)}, cur) => last.union(cur));
                    const opt : vscode.DecorationOptions = {
                        range: new vscode.Range(
                            textDocument.lineAt(union.start.line).range.start,
                            textDocument.lineAt(union.end.line).range.end
                        ),
                        hoverMessage: `✅ Selection (ALT+🖱️) cycles: ${total}`,
                        renderOptions: {
                            after: {
                                contentText: `✅ ${total}`,
                            }
                        },
                    };

                    textEditor.setDecorations(this._totalCycleDeclaration, [opt]);
                }

                this._lastDecorated[textDocument.uri.toString()] = textDocument.version;
            }

            this._dbgLastDecorated = this._dbgTextDocument?.version;
        }
        finally {
            console.timeEnd("update decorations")
        }
    }

    private _onChangeVisibleEditor = async(textEditors: vscode.TextEditor[]): Promise<void> => {
        await this._updateDecorations(vscode.window.visibleTextEditors, true);
    }

    private _onChangeDebugFile = _debounce(250, async (uri: vscode.Uri): Promise<void> => {
        if(!vscode.window.activeTextEditor) {
            return;
        }

        this._dbgFile = undefined;

        await this._updateDecorations(vscode.window.visibleTextEditors);
    });

    private _onChangeTextEditorSelection = _debounce(250, async(selectionEvent : vscode.TextEditorSelectionChangeEvent) : Promise<void> => {
        const startLine = selectionEvent.selections[0].start.line;
        const endLine = selectionEvent.selections[0].end.line;

        await this._updateDecorations([selectionEvent.textEditor]);
    })

    public async activate() : Promise<void> {
        if(this._active) {
            return;
        }

        if(!vscode.workspace.workspaceFolders) {
            return;
        }

        this._buildCwd = _minBy(x => x.uri.fsPath.length, vscode.workspace.workspaceFolders)!.uri.fsPath

        this._active = true;

        this._individualCycleDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#999',
                margin: '5em',
            }
        });
        this._totalCycleDeclaration = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#999',
                margin: '5em',
            }
        });
        this._fsWatcher = vscode.workspace.createFileSystemWatcher("**/*.dbg");
        this._fsWatcher.onDidChange(this._onChangeDebugFile);
        this._fsWatcher.onDidDelete(this._onChangeDebugFile);
        this._fsWatcher.onDidCreate(this._onChangeDebugFile);

        setImmediate(async() => {
            try {
                await this._updateDecorations(vscode.window.visibleTextEditors);
            }
            catch (e) {
                console.error(e);
            }

            this._activations.push(vscode.window.onDidChangeTextEditorSelection(this._onChangeTextEditorSelection));
            this._activations.push(vscode.window.onDidChangeVisibleTextEditors(this._onChangeVisibleEditor));
        });
    }

    public deactivate() : void {
        if(!this._active) {
            return;
        }

        this._active = false;

        for(const reg of this._activations) {
            reg.dispose();
        }
        this._fsWatcher.dispose();
        this._activations = [];
        this._individualCycleDecoration.dispose();
        this._totalCycleDeclaration.dispose();
        this._lastDecorated = {};
        this._dbgTextDocument = undefined;
        this._dbgLastDecorated = undefined;
        this._dbgFile = undefined;
        this._programData = undefined;
        this._loadAddress = undefined;
    }

    public toggle() : void {
        if(this._active) {
            this.deactivate();
        }
        else {
            this.activate();
        }
    }
}

export default new CycleAnnotationProvider();