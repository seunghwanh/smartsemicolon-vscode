'use strict';

import { ExtensionContext, Disposable, StatusBarItem, window, StatusBarAlignment, workspace, TextEditor, commands, Position, Selection, TextLine, TextDocument, Range, TextEditorEdit } from "vscode";
import * as configurations from "./configurations";
import * as language from "./language";
import { LineExpression } from "./language";
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
                position.translate(0, 1);
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

// class SmartSemicolonExtension {

//     private enable: boolean;
//     private autoLineChange: boolean;
//     private statusBarItem: StatusBarItem;
//     private disposable: Disposable;

//     constructor() {
//         let registerCommand = (command: string, callback: (...args: any[]) => any, thisArg: any, subscriptions: Disposable[]) => {
//             let disposable = commands.registerCommand(command, callback, thisArg);
//             subscriptions.push(disposable);
//         };

//         this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
//         this.statusBarItem.command = configurations.commands.toggleAutoLineChange;
//         this.updateConfiguration();

//         let subscriptions: Disposable[] = [];
//         subscriptions.push(this.statusBarItem);

//         registerCommand(configurations.commands.insert, this.insert, this, subscriptions);
//         registerCommand(configurations.commands.toggle, this.toggle, this, subscriptions);
//         registerCommand(configurations.commands.toggleAutoLineChange, this.toggleAutoLineChange, this, subscriptions);
//         workspace.onDidChangeConfiguration(this.updateConfiguration, this, subscriptions);

//         this.disposable = Disposable.from(...subscriptions);
//     }

//     private insert() {
//         let editor = window.activeTextEditor;
//         if (!editor) {
//             return;
//         }

//         let normalInsert = (editor: TextEditor) => {
//             editor.edit((editBuilder) => {
//                 editBuilder.insert(editor.selection.active, ";");
//             });
//         };

//         let document = editor.document;
//         let languageId = document.languageId;
//         if (!this.enable || !language.exists(languageId)) {
//             normalInsert(editor);
//             return;
//         }

//         let line = document.lineAt(editor.selection.active.line);
//         if (line.isEmptyOrWhitespace) {
//             this.deleteCurrentLine(editor);
//             return;
//         }

//         let lineExpression = language.getLineExpression(languageId, line, editor.selection.active.character);
//         if (lineExpression.skip) {
//             normalInsert(editor);
//             return;
//         }

//         if (lineExpression.end > 0 && line.text.charAt(lineExpression.end - 1) == ";") {
//             this.insertLineBelow(editor, line, lineExpression);
//         }
//         else {
//             commands.executeCommand("leaveSnippet").then(() => {
//                 editor.edit((editBuilder) => {
//                     let position = new Position(line.lineNumber, lineExpression.end);
//                     editBuilder.insert(position, ";");
//                 }).then(() => {
//                     this.insertLineBelow(editor, line, lineExpression);
//                 });
//             });
//         }
//     }

//     private insertLineBelow(editor: TextEditor, line: TextLine, lineExpression: LineExpression) {
//         let document = editor.document;
//         if (this.autoLineChange && !lineExpression.hasCloseBracketAfter && language.canInsertLineBelow(document, line)) {
//             commands.executeCommand("editor.action.insertLineAfter");
//         } else {
//             let cursorPosition = new Position(line.lineNumber, lineExpression.end + 1);
//             editor.selection = new Selection(cursorPosition, cursorPosition);
//         }
//     }

//     private deleteCurrentLine(editor: TextEditor) {
//         let lineNumber = editor.selection.active.line;
//         let document = editor.document;
//         let isLastLine = lineNumber == document.lineCount - 1;

//         commands.executeCommand("editor.action.deleteLines").then(() => {
//             lineNumber = editor.selection.active.line;
//             let position: Position;

//             if (isLastLine) {
//                 position = new Position(lineNumber, document.lineAt(lineNumber).text.length);
//             } else if (lineNumber > 0) {
//                 let aboveLine = editor.document.lineAt(lineNumber - 1);
//                 position = new Position(aboveLine.lineNumber, aboveLine.text.length);
//             }

//             editor.selection = new Selection(position, position);
//         });
//     }

//     private toggle() {
//         this.enable = !this.enable;
//         configurations.get().update(configurations.names.enable, this.enable, true);
//         this.updateConfiguration();
//     }

//     private toggleAutoLineChange() {
//         this.autoLineChange = !this.autoLineChange;
//         configurations.get().update(configurations.names.autoLineChange, this.autoLineChange, true);
//         this.updateConfiguration();
//     }

//     private updateConfiguration() {
//         let config = configurations.get();
//         this.enable = config.get<boolean>(configurations.names.enable);
//         this.autoLineChange = config.get<boolean>(configurations.names.autoLineChange);
//         this.updateStatusBar();
//     }

//     private updateStatusBar() {
//         const statusBarItemTitle = "SmartSemicolon";

//         if (this.autoLineChange) {
//             this.statusBarItem.text = statusBarItemTitle + " $(arrow-down)";
//         } else {
//             this.statusBarItem.text = statusBarItemTitle;
//         }

//         if (this.enable) {
//             this.statusBarItem.show();
//         } else {
//             this.statusBarItem.hide();
//         }
//     }

//     dispose() {
//         this.disposable.dispose();
//     }
// }
