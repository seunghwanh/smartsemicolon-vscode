'use strict';

import { TextDocument, Position, TextLine, CharacterPair } from "vscode";

export class LanguageParser {

    private lineComment: string;
    private brackets: CharacterPair;
    private exceptionKeywords: string[];
    private autoLineChangeExceptionKeywords: string[];

    constructor(lineComment: string, brackets: CharacterPair, exceptionKeywords: string[], autoLineChangeExceptionKeywords: string[]) {
        this.lineComment = lineComment;
        this.brackets = brackets;
        this.exceptionKeywords = exceptionKeywords;
        this.autoLineChangeExceptionKeywords = autoLineChangeExceptionKeywords;
    }

    public getSemicolonPosition(line: TextLine, position: Position): Position {
        const lineInfo: LineInfo = <LineInfo>{};

        lineInfo.skip = this.isLineComment(line, position) || this.containsKeywords(line, this.exceptionKeywords);
        if (lineInfo.skip) {
            return position;
        }

        lineInfo.end = line.text.length - 1;
        if (this.lineComment) {
            const lineCommentIndex = line.text.indexOf(this.lineComment, position.character);
            if (lineCommentIndex >= 0) {
                lineInfo.end = lineCommentIndex - 1;
            }
        }

        this.inspectBrackets(line, position, lineInfo);
        lineInfo.end = this.findNonWhitespaceCharacterBackward(line, lineInfo.end) + 1;
        return new Position(position.line, lineInfo.end);
    }

    private isLineComment(line: TextLine, position: Position): boolean {
        if (!this.lineComment) {
            return false;
        }

        const index = line.text.indexOf(this.lineComment);
        return index >= 0 && index < position.character;
    }

    private containsKeywords(line: TextLine, keywords: string[]): boolean {
        if (!keywords) {
            return false;
        }
        return keywords.find(x => line.text.indexOf(x) >= 0) !== undefined;
    }

    private findNonWhitespaceCharacterBackward(line: TextLine, index: number): number {
        for (let i = index; i >= 0; i--) {
            const c = line.text.charAt(i);
            if (c != ' ' && c != '\t') {
                return i;
            }
        }
        return -1;
    }

    private inspectBrackets(line: TextLine, position: Position, lineInfo: LineInfo) {
        if (this.brackets) {
            const openIndex = line.text.indexOf(this.brackets[0], position.character);
            const endIndex = line.text.indexOf(this.brackets[1], position.character);
            let index: number;
            if (openIndex >= 0 || endIndex >= 0) {
                if (openIndex < 0) {
                    index = endIndex - 1;
                }
                else if (endIndex < 0) {
                    index = openIndex - 1;
                }
                else {
                    index = Math.min(openIndex, endIndex) - 1;
                }

                if (index < lineInfo.end) {
                    lineInfo.end = index;
                }
            }
        }
    }

    public isEmptyLine(line: TextLine): boolean {
        if (!this.brackets) {
            return line.isEmptyOrWhitespace;
        }

        return line.text.startsWith(this.brackets[0], line.firstNonWhitespaceCharacterIndex) ||
            line.text.startsWith(this.brackets[1], line.firstNonWhitespaceCharacterIndex);
    }
}

interface LineInfo {
    skip: boolean;
    end: number;
    hasClosingBracket: boolean;
}