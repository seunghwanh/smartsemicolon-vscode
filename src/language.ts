'use strict';

import { CharacterPair, TextLine, TextDocument } from "vscode";

export function exists(languageId: string): boolean {
    return Languages.hasOwnProperty(languageId);
}

export function getLineExpression(languageId: string, line: TextLine, character: number): LineExpression {
    let language = Languages[languageId];
    if (!language) {
        return undefined;
    }

    let lineInfo: LineExpression = { skip: false, hasCloseBracketAfter: false, end: -1 };
    lineInfo.skip = (isComment(language.lineComment, line, character) || containsKeywords(line, language.exceptionKeywords));
    if (lineInfo.skip) {
        return lineInfo;
    }

    let text = line.text;
    let endPosition = text.length - 1;
    if (language.lineComment) {
        let commentPosition = text.indexOf(language.lineComment, character);
        if (commentPosition >= 0) {
            endPosition = commentPosition - 1;
            if (endPosition < 0) {
                endPosition = 0;
            }
        }
    }

    if (language.brackets) {
        let brackets = language.brackets;
        let bracketPositions = getPosition(brackets, line, character, endPosition);

        if (bracketPositions[0] >= 0 && bracketPositions[1] >= 0) {
            if (bracketPositions[0] < bracketPositions[1]) {
                endPosition = bracketPositions[0] - 1;
            } else {
                endPosition = bracketPositions[1] - 1;
                lineInfo.hasCloseBracketAfter = true;
            }
        } else if (bracketPositions[0] >= 0) {
            endPosition = bracketPositions[0] - 1;
        } else if (bracketPositions[1] >= 0) {
            endPosition = bracketPositions[1] - 1;
            lineInfo.hasCloseBracketAfter = true;
        }
    }

    lineInfo.end = findNonWhitespaceFromEnd(text, endPosition) + 1;
    return lineInfo;
};

export function canInsertLineBelow(document: TextDocument, line: TextLine): boolean {
    let languageId = document.languageId;
    let language = Languages[languageId];
    if (!language) {
        return undefined;
    }

    if (containsKeywords(line, language.autoLineChangeExceptionKeywords)) {
        return false;
    }

    let brackets = language.brackets;
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

            isBelowLineCode = !isBelowLineClose &&
                !belowLine.isEmptyOrWhitespace &&
                !isComment(language.lineComment, belowLine);
        }

        return !((isAboveLineOpen && isBelowLineClose) || isBelowLineCode);
    }

    return true;
}

function findNonWhitespaceFromEnd(search: string, end: number): number {
    for (let i = end; i >= 0; i--) {
        let c = search.charAt(i);
        if (c != " " && c != "\t") {
            return i;
        }
    }

    return -1;
}

function isComment(lineComment: string, line: TextLine, character?: number): boolean {
    if (lineComment) {
        if (character === undefined) {
            return line.text.startsWith(lineComment, line.firstNonWhitespaceCharacterIndex);
        } else if (character > 0) {
            return line.text.lastIndexOf(lineComment, character - 1) >= 0;
        }
    }
    return false;
}

function containsKeywords(line: TextLine, keywords: string[]): boolean {
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

function getPosition(delimiter: CharacterPair, line: TextLine, character: number, end?: number): CharacterPairPosition {
    let text = line.text;
    let position: CharacterPairPosition = [-1, -1];

    for (let i = 0; i < delimiter.length; i++) {
        let index = text.indexOf(delimiter[i], character);
        if (end !== undefined && index <= end) {
            position[i] = index;
        }
    }

    return position;
}

export interface LineExpression {
    skip: boolean;
    end: number;
    hasCloseBracketAfter: boolean;
};

type CharacterPairPosition = [number, number];

interface Language {
    lineComment: string;
    brackets: CharacterPair;
    exceptionKeywords: string[];
    autoLineChangeExceptionKeywords: string[];
};

const Languages: { [languageId: string]: Language; } = {};

// C++ family
Languages["csharp"] = { lineComment: "//", brackets: ["{", "}"], exceptionKeywords: ["for"], autoLineChangeExceptionKeywords: ["return", "break", "throw"] };
Languages["cpp"] = Languages["csharp"];
Languages["java"] = Languages["csharp"];

// Javascript family
Languages["javascript"] = { lineComment: "//", brackets: ["{", "}"], exceptionKeywords: ["for"], autoLineChangeExceptionKeywords: ["return", "break", "throw"] };
Languages["typescript"] = Languages["javascript"];

// C family
Languages["c"] = { lineComment: "//", brackets: ["{", "}"], exceptionKeywords: ["for"], autoLineChangeExceptionKeywords: ["return", "break"] };
Languages["shaderlab"] = Languages["c"];
Languages["go"] = Languages["c"];