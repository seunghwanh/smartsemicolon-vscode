'use strict';

import { ExtensionContext, Disposable, StatusBarItem, window, StatusBarAlignment, workspace, TextEditor, commands, Position, Selection, TextLine, TextDocument } from "vscode";
import * as configurations from "./configurations";
import * as language from "./language";
import { LineExpression } from "./language";

export function activate(context: ExtensionContext) {
    context.subscriptions.push(new SmartSemicolonExtension());
}

export function deactivate() {
}

class SmartSemicolonExtension {

    private enable: boolean;
    private autoLineChange: boolean;
    private statusBarItem: StatusBarItem;
    private disposable: Disposable;

    constructor() {
        let registerCommand = (command: string, callback: (...args: any[]) => any, thisArg: any, subscriptions: Disposable[]) => {
            let disposable = commands.registerCommand(command, callback, thisArg);
            subscriptions.push(disposable);
        };

        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this.statusBarItem.command = configurations.commands.toggleAutoLineChange;
        this.updateConfiguration();

        let subscriptions: Disposable[] = [];
        subscriptions.push(this.statusBarItem);

        registerCommand(configurations.commands.insert, this.insert, this, subscriptions);
        registerCommand(configurations.commands.toggle, this.toggle, this, subscriptions);
        registerCommand(configurations.commands.toggleAutoLineChange, this.toggleAutoLineChange, this, subscriptions);
        workspace.onDidChangeConfiguration(this.updateConfiguration, this, subscriptions);

        this.disposable = Disposable.from(...subscriptions);
    }

    private insert() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        let normalInsert = (editor: TextEditor) => {
            editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, ";");
            });
        };

        let document = editor.document;
        let languageId = document.languageId;
        if (!this.enable || !language.exists(languageId)) {
            normalInsert(editor);
            return;
        }

        let line = document.lineAt(editor.selection.active.line);
        if (line.isEmptyOrWhitespace) {
            this.deleteCurrentLine(editor);
            return;
        }

        let lineExpression = language.getLineExpression(languageId, line, editor.selection.active.character);
        if (lineExpression.skip) {
            normalInsert(editor);
            return;
        }

        if (lineExpression.end > 0 && line.text.charAt(lineExpression.end - 1) == ";") {
            this.insertLineBelow(editor, line, lineExpression);
        }
        else {
            commands.executeCommand("leaveSnippet").then(() => {
                editor.edit((editBuilder) => {
                    let position = new Position(line.lineNumber, lineExpression.end);
                    editBuilder.insert(position, ";");
                }).then(() => {
                    this.insertLineBelow(editor, line, lineExpression);
                });
            });
        }
    }

    private insertLineBelow(editor: TextEditor, line: TextLine, lineExpression: LineExpression) {
        let document = editor.document;
        if (this.autoLineChange && !lineExpression.hasCloseBracketAfter && language.canInsertLineBelow(document, line)) {
            commands.executeCommand("editor.action.insertLineAfter");
        } else {
            let cursorPosition = new Position(line.lineNumber, lineExpression.end + 1);
            editor.selection = new Selection(cursorPosition, cursorPosition);
        }
    }

    private deleteCurrentLine(editor: TextEditor) {
        let lineNumber = editor.selection.active.line;
        let document = editor.document;
        let isLastLine = lineNumber == document.lineCount - 1;

        commands.executeCommand("editor.action.deleteLines").then(() => {
            lineNumber = editor.selection.active.line;
            let position: Position;

            if (isLastLine) {
                position = new Position(lineNumber, document.lineAt(lineNumber).text.length);
            } else if (lineNumber > 0) {
                let aboveLine = editor.document.lineAt(lineNumber - 1);
                position = new Position(aboveLine.lineNumber, aboveLine.text.length);
            }

            editor.selection = new Selection(position, position);
        });
    }

    private toggle() {
        this.enable = !this.enable;
        configurations.get().update(configurations.names.enable, this.enable, true);
        this.updateConfiguration();
    }

    private toggleAutoLineChange() {
        this.autoLineChange = !this.autoLineChange;
        configurations.get().update(configurations.names.autoLineChange, this.autoLineChange, true);
        this.updateConfiguration();
    }

    private updateConfiguration() {
        let config = configurations.get();
        this.enable = config.get<boolean>(configurations.names.enable);
        this.autoLineChange = config.get<boolean>(configurations.names.autoLineChange);
        this.updateStatusBar();
    }

    private updateStatusBar() {
        const statusBarItemTitle = "SmartSemicolon";

        if (this.autoLineChange) {
            this.statusBarItem.text = statusBarItemTitle + " $(arrow-down)";
        } else {
            this.statusBarItem.text = statusBarItemTitle;
        }

        if (this.enable) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    dispose() {
        this.disposable.dispose();
    }
}