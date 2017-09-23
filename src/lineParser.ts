'use strict';

import { CharacterPair, TextDocument, Position, TextLine } from "vscode";

export class LineParser {

    private lineComment: string;
    private brackets: CharacterPair;
    private strings: string[];
    private exceptionKeywords: string[];
    private autoLineChangeExceptionKeywords: string[];

    constructor(lineComment: string, brackets: CharacterPair, exceptionKeywords: string[], autoLineChangeExceptionKeywords: string[]) {
        this.lineComment = lineComment;
        this.brackets = brackets;
        this.exceptionKeywords = exceptionKeywords;
        this.autoLineChangeExceptionKeywords = autoLineChangeExceptionKeywords;
    }

    public getSemicolonPosition(document: TextDocument, position: Position): Position {
        const line = document.lineAt(position.line);
        const lineInfo: LineInfo = {
            skip: false,
            end: line.text.length,
            hasCloseBracketAfter: false
        };

        this.inspectLineComment(line, lineInfo, position.character);
        this.containsExceptionKeywords(line, lineInfo, position.character);
        if (lineInfo.skip) {
            return position;
        }

        this.inspectBrackets(line, lineInfo, position.character);
        lineInfo.end = this.findNonWhitespace(line, lineInfo.end) + 1;

        if (line.text.charAt(lineInfo.end) == ';') {
            return undefined;
        }

        return new Position(position.line, lineInfo.end);
    }

    private inspectLineComment(line: TextLine, lineInfo: LineInfo, character: number): void {
        if (!this.lineComment) {
            return;
        }

        const index = line.text.indexOf(this.lineComment);
        if (index >= 0) {
            if (character > index) {
                lineInfo.skip = true;
            } else {
                lineInfo.end = index;
            }
        }
    }

    private containsExceptionKeywords(line: TextLine, lineInfo: LineInfo, character: number): void {
        if (lineInfo.skip || !this.exceptionKeywords) {
            return;
        }

        for (let keyword of this.exceptionKeywords) {
            const regex = new RegExp('\\s+' + keyword + '(\\s+|$)');
            if (line.text.match(regex)) {
                lineInfo.skip = true;
                break;
            }
        }
    }

    private inspectBrackets(line: TextLine, lineInfo: LineInfo, character: number): void {
        if (!this.brackets) {
            return;
        }

        const positions = this.getPositions(this.brackets, line, character, lineInfo.end);
        if (positions[0] >= 0 && positions[1] >= 0) {
            if (positions[0] < positions[1]) {
                lineInfo.end = positions[0];
            } else {
                lineInfo.end = positions[1];
                lineInfo.hasCloseBracketAfter = true;
            }
        } else if (positions[0] >= 0) {
            lineInfo.end = positions[0];
        } else if (positions[1] >= 0) {
            lineInfo.end = positions[1];
            lineInfo.hasCloseBracketAfter = true;
        }

        lineInfo.end--;
    }

    private findNonWhitespace(line: TextLine, end: number): number {
        for (let i = end; i >= 0; i--) {
            const c = line.text.charAt(i);
            if (c != ' ' && c != '\t') {
                return i;
            }
        }
        return -1;
    }

    private getPositions(delimiter: CharacterPair, line: TextLine, character: number, end: number): CharacterPairPositions {
        let text = line.text;
        let position: CharacterPairPositions = [-1, -1];

        for (let i = 0; i < delimiter.length; i++) {
            let index = text.indexOf(delimiter[i], character);
            if (index <= end) {
                position[i] = index;
            }
        }

        return position;
    }
}

interface LineInfo {
    skip: boolean;
    end: number;
    hasCloseBracketAfter: boolean;
}

type CharacterPairPositions = [number, number];