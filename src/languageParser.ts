'use strict';

import { Position, CharacterPair, TextLine, TextDocument } from "vscode";

export class LanguageParser {

    private lineComment: string;
    private brackets: CharacterPair;
    private exceptionKeywords: string[];
    private autoLineChangeExceptionKeywords: string[];

    constructor(lineComment: string,
        brackets: CharacterPair,
        exceptionKeywords: string[],
        autoLineChangeExceptionKeywords: string[]) {

        this.lineComment = lineComment;
        this.brackets = brackets;
        this.exceptionKeywords = exceptionKeywords;
        this.autoLineChangeExceptionKeywords = autoLineChangeExceptionKeywords;
    }

    public getSemicolonPosition(line: TextLine, position: Position): Position {
        const info: LineInfo = {
            skip: false,
            end: line.text.length - 1
        };

        info.skip = this.isLineComment(line, position.character) || this.containsKeyword(line, this.exceptionKeywords);
        if (info.skip) {
            return position;
        }

        if (this.lineComment) {
            const commentIndex = line.text.indexOf(this.lineComment, position.character);
            if (commentIndex >= 0) {
                info.end = commentIndex - 1;
            }
        }

        this.inspectBrackets(line, position, info);
        info.end = this.findNonWhitespaceBackward(line, info.end) + 1;
        return new Position(line.lineNumber, info.end);
    }

    private findNonWhitespaceBackward(line: TextLine, index: number): number {
        for (let i = index; i >= 0; i--) {
            const c = line.text.charAt(i);
            if (c != ' ' && c != '\t') {
                return i;
            }
        }
        return -1;
    }

    private inspectBrackets(line: TextLine, position: Position, info: LineInfo): void {
        if (!this.brackets) {
            return;
        }

        const openIndex = line.text.indexOf(this.brackets[0], position.character);
        const endIndex = line.text.indexOf(this.brackets[1], position.character);
        if (openIndex < 0 && endIndex < 0) {
            return;
        }

        let newIndex: number;
        if (openIndex < 0) {
            newIndex = endIndex - 1;
        } else if (endIndex < 0) {
            newIndex = openIndex - 1;
        } else {
            newIndex = Math.min(openIndex, endIndex) - 1;
        }

        if (newIndex < info.end) {
            info.end = newIndex;
        }
    }

    private containsKeyword(line: TextLine, keywords: string[]): boolean {
        if (!keywords) {
            return false;
        }

        return keywords.find((keyword) => {
            const regex = new RegExp('\\s' + keyword + '(?:\\s|;|$)');
            return line.text.match(regex) != null;
        }) !== undefined;
    }

    private isLineComment(line: TextLine, index: number): boolean {
        if (!this.lineComment) {
            return false;
        }

        const commentIndex = line.text.indexOf(this.lineComment);
        return commentIndex >= 0 && commentIndex < index;
    }

    public canInsertLineAfter(document: TextDocument, currentLine: number): boolean {
        if (this.containsKeyword(document.lineAt(currentLine), this.autoLineChangeExceptionKeywords)) {
            return false;
        }
        if (currentLine == document.lineCount - 1) {
            return true;
        }

        const nextLine = document.lineAt(currentLine + 1);
        if (!this.brackets) {
            return nextLine.isEmptyOrWhitespace;
        }

        return nextLine.isEmptyOrWhitespace || nextLine.text.startsWith(this.brackets[1], nextLine.firstNonWhitespaceCharacterIndex);
    }
}

interface LineInfo {
    skip: boolean;
    end: number;
}