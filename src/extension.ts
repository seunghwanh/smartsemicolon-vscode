'use strict';

import { ExtensionContext, Disposable, StatusBarItem, window, StatusBarAlignment, workspace, TextEditor, commands, Position, Selection, TextLine, TextDocument } from "vscode";

export function activate(context: ExtensionContext) {
    context.subscriptions.push(new SmartSemicolonExtension());
}

export function deactivate() {
}

class SmartSemicolonExtension {

    private enable: boolean;
    private autoLineChange: boolean;
    private language: Language = undefined;

    private statusBarItem: StatusBarItem;
    private disposable: Disposable;

    constructor() {
        let registerCommand = (command: string, callback: (...args: any[]) => any, thisArg: any, subscriptions: Disposable[]) => {
            let disposable = commands.registerCommand(command, callback, thisArg);
            subscriptions.push(disposable);
        };

        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
        this.statusBarItem.command = commandNames.toggleAutoLineChange;
        this.updateConfiguration();

        let subscriptions: Disposable[] = [];
        subscriptions.push(this.statusBarItem);

        registerCommand(commandNames.insert, this.insert, this, subscriptions);
        registerCommand(commandNames.toggle, this.toggle, this, subscriptions);
        registerCommand(commandNames.toggleAutoLineChange, this.toggleAutoLineChange, this, subscriptions);

        workspace.onDidChangeConfiguration(this.updateConfiguration, this, subscriptions);
        window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, subscriptions);

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

        if (!this.enable || !this.language) {
            normalInsert(editor);
            return;
        }

        let document = editor.document;
        let line = document.lineAt(editor.selection.active.line);
        if (line.isEmptyOrWhitespace) {
            this.deleteCurrentLine(editor);
            return;
        }

        let lineInfo = this.getLineInfo(line, editor.selection.active.character);
        if (!lineInfo.isExpression) {
            normalInsert(editor);
            return;
        }

        commands.executeCommand("leaveSnippet").then(() => {
            editor.edit((editBuilder) => {
                let position = new Position(line.lineNumber, lineInfo.insertPosition);
                editBuilder.insert(position, ";");
            }).then(() => {
                if (this.autoLineChange && !lineInfo.hasCloseBracketAfter && this.canInsertLineBelow(document, line)) {
                    commands.executeCommand("editor.action.insertLineAfter");
                } else {
                    let cursorPosition = new Position(line.lineNumber, lineInfo.insertPosition + 1);
                    editor.selection = new Selection(cursorPosition, cursorPosition);
                }
            });
        });
    }

    private canInsertLineBelow(document: TextDocument, line: TextLine): boolean {
        if (this.containsKeywords(line, this.language.autoLineChangeExceptionKeywords)) {
            return false;
        }

        let brackets = this.language.brackets;
        if (brackets) {
            let needCheckAboveLine = line.lineNumber > 0;
            let needCheckBelowLine = line.lineNumber < document.lineCount - 1;
            let isAboveLineOpen = false;
            let isBelowLineClose = false;
            let isBelowLineCode = false;

            if (needCheckAboveLine) {
                let aboveLine = document.lineAt(line.lineNumber - 1);
                let openIndex = aboveLine.text.lastIndexOf(brackets[0]);
                let closeIndex = aboveLine.text.lastIndexOf(brackets[1]);

                if (openIndex >= 0 && (closeIndex < 0 || closeIndex < openIndex)) {
                    isAboveLineOpen = true;
                }
            }

            if (needCheckBelowLine) {
                let belowLine = document.lineAt(line.lineNumber + 1);
                let openIndex = belowLine.text.indexOf(brackets[0]);
                let closeIndex = belowLine.text.indexOf(brackets[1]);

                if (closeIndex >= 0 && (openIndex < 0 || closeIndex < openIndex)) {
                    isBelowLineClose = true;
                }

                isBelowLineCode = !isBelowLineClose && !belowLine.isEmptyOrWhitespace;
            }

            return !((isAboveLineOpen && isBelowLineClose) || isBelowLineCode);
        }

        return true;
    }

    private getLineInfo(line: TextLine, character: number): LineInfo {
        let lineInfo: LineInfo = { isExpression: false, hasCloseBracketAfter: false, insertPosition: -1 };
        let findNonWhitespaceFromEnd = (search: string, end: number): number => {
            for (let i = end; i >= 0; i--) {
                let c = search.charAt(i);
                if (c != " " && c != "\t") {
                    return i;
                }
            }

            return -1;
        };

        lineInfo.isExpression = !(this.isComment(line, character) || this.containsKeywords(line, this.language.exceptionKeywords));
        if (!lineInfo.isExpression) {
            return lineInfo;
        }

        let text = line.text;
        let endPosition = text.length - 1;
        if (this.language.lineComment) {
            let commentPosition = text.indexOf(this.language.lineComment, character);
            if (commentPosition >= 0) {
                endPosition = commentPosition - 1;
                if (endPosition < 0) {
                    endPosition = 0;
                }
            }
        }

        if (this.language.brackets) {
            let brackets = this.language.brackets;
            let openIndex = text.indexOf(brackets[0], character);
            let closeIndex = text.indexOf(brackets[1], character);

            let hasOpenBracket = openIndex >= 0 && openIndex <= endPosition;
            let hasCloseBracket = closeIndex >= 0 && closeIndex <= endPosition;

            if (hasOpenBracket && hasCloseBracket) {
                if (openIndex < closeIndex) {
                    endPosition = openIndex - 1;
                } else {
                    endPosition = closeIndex - 1;
                    lineInfo.hasCloseBracketAfter = true;
                }
            } else if (hasOpenBracket) {
                endPosition = openIndex - 1;
            } else if (hasCloseBracket) {
                endPosition = closeIndex - 1;
                lineInfo.hasCloseBracketAfter = true;
            }
        }

        lineInfo.insertPosition = findNonWhitespaceFromEnd(text, endPosition) + 1;
        return lineInfo;
    }

    private isComment(line: TextLine, character: number): boolean {
        if (this.language.lineComment && character > 0) {
            return line.text.lastIndexOf(this.language.lineComment, character - 1) >= 0;
        }

        return false;
    }

    private containsKeywords(line: TextLine, keywords: string[]): boolean {
        if (keywords) {
            for (let key in keywords) {
                if (keywords.hasOwnProperty(key)) {
                    let keyword = keywords[key];
                    let regex = new RegExp("\\s+" + keyword + "(\\s+|$)");
                    let match = line.text.match(regex);
                    if (match) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private deleteCurrentLine(editor: TextEditor) {
        commands.executeCommand("editor.action.deleteLines").then(() => {
            let lineNumber = editor.selection.active.line;
            if (lineNumber > 0) {
                let aboveLine = editor.document.lineAt(lineNumber - 1);
                let position = new Position(aboveLine.lineNumber, aboveLine.text.length);
                editor.selection = new Selection(position, position);
            }
        });
    }

    private toggle() {
        this.enable = !this.enable;
        workspace.getConfiguration(extensionPrefix).update(configNames.enable, this.enable, true);
        this.updateConfiguration();
    }

    private toggleAutoLineChange() {
        this.autoLineChange = !this.autoLineChange;
        workspace.getConfiguration(extensionPrefix).update(configNames.autoLineChange, this.autoLineChange, true);
        this.updateConfiguration();
    }

    private onDidChangeActiveTextEditor(editor: TextEditor) {
        if (!editor) {
            this.language = undefined;
            return;
        }

        let document = editor.document;
        if (!this.language || this.language.languageId != document.languageId) {
            let languages = workspace.getConfiguration(extensionPrefix).get<Language[]>(configNames.languages);
            this.language = languages.find(x => x.languageId == document.languageId);
        }

        this.updateStatusBar();
    }

    private updateConfiguration() {
        let config = workspace.getConfiguration(extensionPrefix);

        this.enable = config.get<boolean>(configNames.enable);
        this.autoLineChange = config.get<boolean>(configNames.autoLineChange);

        let editor = window.activeTextEditor;
        if (editor) {
            let languages = config.get<Language[]>(configNames.languages);
            this.language = languages.find(x => x.languageId == editor.document.languageId);
        }

        this.updateStatusBar();
    }

    private updateStatusBar() {
        if (this.autoLineChange) {
            this.statusBarItem.text = statusBarItemTitle + " $(arrow-down)";
        } else {
            this.statusBarItem.text = statusBarItemTitle;
        }

        if (this.enable && this.language) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    dispose() {
        this.disposable.dispose();
    }
}

interface LineInfo {
    isExpression: boolean;
    hasCloseBracketAfter: boolean;
    insertPosition: number;
};

interface Language {
    languageId: string;
    lineComment: string;
    brackets: string[2];
    exceptionKeywords: string[];
    autoLineChangeExceptionKeywords: string[];
};

const statusBarItemTitle = "SmartSemicolon";
const extensionPrefix = "smartsemicolon";

const configNames = {
    enable: "enable",
    autoLineChange: "autoLineChange",
    languages: "languages"
};

const commandNames = {
    insert: extensionPrefix + ".insert",
    toggle: extensionPrefix + ".toggle",
    toggleAutoLineChange: extensionPrefix + ".toggleAutoLineChange"
};