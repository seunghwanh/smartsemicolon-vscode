'use strict';

import { ExtensionContext, Disposable, StatusBarItem, window, StatusBarAlignment, workspace, TextEditor, commands, Position, Selection, TextLine, TextDocument, Range, TextEditorEdit } from "vscode";
import { LineParser } from "./lineParser";

export function activate(context: ExtensionContext) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
    statusBarItem.command = 'smartsemicolon.toggleAutoLineChange';

    updateConfiguration();

    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(workspace.onDidChangeConfiguration(updateConfiguration));

    context.subscriptions.push(commands.registerCommand('smartsemicolon.insert', insert));
    context.subscriptions.push(commands.registerCommand('smartsemicolon.toggle', toggle));
    context.subscriptions.push(commands.registerCommand('smartsemicolon.toggleAutoLineChange', toggleAutoLineChange));
}

function insert() {
    const editor = window.activeTextEditor;
    if (!editor) {
        return;
    }

    const languageId = editor.document.languageId;
    if (languageId == 'plaintext') {
        editor.edit((editBuilder) => {
            for (let i = 0; i < editor.selections.length; i++) {
                editBuilder.insert(editor.selections[i].active, ';');
            }
        });
        return;
    }

    commands.executeCommand('leaveSnippet').then(() => {
        if (acceptSuggestions) {
            commands.executeCommand('acceptSelectedSuggestion').then(() => {
                doInsert(editor);
            });
        } else {
            doInsert(editor);
        }
    });
}

function doInsert(editor: TextEditor) {
    const parser = lineParsers.get(editor.document.languageId);
    if (!parser) {
        insertAtTheEnd(editor);
    } else {
        const selections: Selection[] = [];
        let isDelete = false;

        editor.edit((editBuilder) => {
            for (let i = 0; i < editor.selections.length; i++) {
                const line = editor.document.lineAt(editor.selections[i].active);
                if (line.isEmptyOrWhitespace) {
                    isDelete = true;
                    deleteLine(line, editor.document, editBuilder, selections, editor.selections[i]);
                    continue;
                }

                let position = parser.getSemicolonPosition(editor.document, editor.selections[i].active);
                if (position.character == 0 || line.text.charAt(position.character - 1) != ';') {
                    editBuilder.insert(position, ';');
                }
                position = position.translate(0, 1);
                selections.push(new Selection(position, position));
            }
        }).then(() => {
            editor.selections = selections;

            if (autoLineChange && selections.length == 1 && !isDelete) {
                editor.edit((editBuilder) => {
                    const line = editor.document.lineAt(editor.selection.active);
                    if (parser.canInsertLineBelow(editor.document, line)) {
                        const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
                        editBuilder.insert(getLineEndPosition(line), '\n' + indent);
                    }
                });
            }
        });
    }
}

function getLineEndPosition(line: TextLine): Position {
    return new Position(line.lineNumber, line.text.length);
}

function deleteLine(line: TextLine, document: TextDocument, editBuilder: TextEditorEdit, selections: Selection[], selection: Selection) {
    const range = getLineDeletionRange(document, line);
    if (range) {
        editBuilder.delete(range);
        selections.push(new Selection(range.start, range.start));
    } else {
        selections.push(selection);
    }
}

function insertAtTheEnd(editor: TextEditor) {
    commands.executeCommand('cursorEnd').then(() => {
        editor.edit((editBuilder) => {
            for (let i = 0; i < editor.selections.length; i++) {
                editBuilder.insert(editor.selections[i].active, ';');
            }
        }).then(() => {
            if (autoLineChange) {
                commands.executeCommand('editor.action.insertLineAfter');
            }
        });
    });
}

function getLineDeletionRange(document: TextDocument, line: TextLine): Range {
    if (line.lineNumber == 0) {
        return undefined;
    }
    return new Range(new Position(line.lineNumber - 1, document.lineAt(line.lineNumber - 1).text.length), new Position(line.lineNumber, line.text.length));
}

function toggle() {
    enable = !enable;
    workspace.getConfiguration('smartsemicolon').update('enable', enable, true);
    updateStatusBarItem();
}

function toggleAutoLineChange() {
    autoLineChange = !autoLineChange;
    workspace.getConfiguration('smartsemicolon').update('autoLineChange', autoLineChange, true);
    updateStatusBarItem();
}

function updateConfiguration() {
    const config = workspace.getConfiguration('smartsemicolon');
    enable = config.get('enable');
    autoLineChange = config.get('autoLineChange');
    acceptSuggestions = config.get('acceptSuggestions');
    showInStatusBar = config.get('showInStatusBar');

    updateStatusBarItem();
}

function updateStatusBarItem() {
    if (autoLineChange) {
        statusBarItem.text = statusBarItemTitle + ' $(arrow-down)';
    } else {
        statusBarItem.text = statusBarItemTitle;
    }

    if (!enable || !showInStatusBar) {
        statusBarItem.hide();
    }
    else {
        statusBarItem.show();
    }
}

let enable: boolean;
let autoLineChange: boolean;
let acceptSuggestions: boolean;
let showInStatusBar: boolean;

let statusBarItem: StatusBarItem;

let lineParsers = new Map<string, LineParser>();
lineParsers.set('csharp', new LineParser('//', ['{', '}'], ['for'], ['return', 'break', 'throw']));

const statusBarItemTitle = 'SmartSemicolon';