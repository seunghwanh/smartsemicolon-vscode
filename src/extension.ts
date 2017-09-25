'use strict';

import { ExtensionContext, StatusBarItem, window, StatusBarAlignment, workspace, commands, TextEditor, Position, Selection, Range, TextLine, TextEditorEdit, TextDocument } from "vscode";
import { LanguageParser } from "./languageParser";

export function activate(context: ExtensionContext) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
    statusBarItem.command = 'smartsemicolon.toggleAutoLineChange';
    context.subscriptions.push(statusBarItem);

    updateConfiguration();
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
    const parser = parsers.get(editor.document.languageId);

    commands.executeCommand('leaveSnippet').then(() => {
        if (acceptSuggestions) {
            commands.executeCommand('acceptSelectedSuggestion').then(() => {
                doInsert(editor, parser);
            });
        } else {
            doInsert(editor, parser);
        }
    });
}

function doInsert(editor: TextEditor, parser: LanguageParser) {
    const newSelections: Selection[] = [];
    const selectionCount = editor.selections.length;
    let isDelete = false;

    editor.edit((editBuilder) => {
        for (let i = 0; i < editor.selections.length; i++) {
            const line = editor.document.lineAt(editor.selections[i].active.line);
            if (line.isEmptyOrWhitespace) {
                newSelections.push(deleteLine(editBuilder, editor, line, editor.selections[i]));
                isDelete = true;
                continue;
            }

            let position = parser ? parser.getSemicolonPosition(line, editor.selections[i].active) :
                new Position(line.lineNumber, line.text.length);

            if (position.character == 0 || line.text.charAt(position.character - 1) != ';') {
                editBuilder.insert(position, ';');
                position = position.translate(0, 1);
            }
            newSelections.push(new Selection(position, position));
        }
    }).then(() => {
        editor.selections = newSelections;
        if (selectionCount == 1 && autoLineChange && !isDelete &&
            canInsertLineAfter(editor.document, editor.selection, parser)) {
            commands.executeCommand('editor.action.insertLineAfter');
        }
    });
}

function canInsertLineAfter(document: TextDocument, selection: Selection, parser: LanguageParser): boolean {
    if (selection.active.line == document.lineCount - 1) {
        return true;
    }

    const nextLine = document.lineAt(selection.active.line + 1);
    if (!parser) {
        return nextLine.isEmptyOrWhitespace;
    }
    return parser.isEmptyLine(nextLine);
}

function deleteLine(editBuilder: TextEditorEdit, editor: TextEditor, line: TextLine, selection: Selection): Selection {
    let newSelection: Selection = undefined;

    if (deleteEmptyLine) {
        let range: Range = undefined;
        if (selection.active.line > 0) {
            const prevLineEnd = new Position(line.lineNumber - 1, editor.document.lineAt(line.lineNumber - 1).text.length);
            range = new Range(prevLineEnd, new Position(line.lineNumber, line.text.length));
            newSelection = new Selection(prevLineEnd, prevLineEnd);
        }
        else if (editor.document.lineCount > 1) {
            const zeroPosition = new Position(0, 0);
            range = new Range(zeroPosition, new Position(1, 0));
            newSelection = new Selection(zeroPosition, zeroPosition);
        }
        if (range) {
            editBuilder.delete(range);
        }
    }

    return newSelection;
}

function toggle() {
    enable = !enable;
    workspace.getConfiguration('smartsemicolon').update('enable', enable, true);
    updateConfiguration();
}

function toggleAutoLineChange() {
    autoLineChange = !autoLineChange;
    workspace.getConfiguration('smartsemicolon').update('autoLineChange', autoLineChange, true);
    updateConfiguration();
}

function updateConfiguration() {
    const config = workspace.getConfiguration('smartsemicolon');

    enable = config.get('enable');
    autoLineChange = config.get('autoLineChange');
    acceptSuggestions = config.get('acceptSuggestions');
    showInStatusBar = config.get('showInStatusBar');
    deleteEmptyLine = config.get('deleteEmptyLine');

    updateStatusBarItem();
}

function updateStatusBarItem() {
    if (autoLineChange) {
        statusBarItem.text = statusBarItemTitle + " $(arrow-down)";
    } else {
        statusBarItem.text = statusBarItemTitle;
    }

    if (enable && showInStatusBar) {
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

let enable: boolean;
let autoLineChange: boolean;
let acceptSuggestions: boolean;
let showInStatusBar: boolean;
let deleteEmptyLine: boolean;

let statusBarItem: StatusBarItem;

const cLangFamilyParser = new LanguageParser('//', ['{', '}'], ['for'], ['throw', 'return', 'break']);

let parsers = new Map<string, LanguageParser>();
parsers.set('c', cLangFamilyParser);
parsers.set('cpp', cLangFamilyParser);
parsers.set('csharp', cLangFamilyParser);
parsers.set('java', cLangFamilyParser);
parsers.set('typescript', cLangFamilyParser);
parsers.set('javascript', cLangFamilyParser);
parsers.set('go', cLangFamilyParser);
parsers.set('shaderlab', cLangFamilyParser);

const statusBarItemTitle = 'Smart Semicolon';