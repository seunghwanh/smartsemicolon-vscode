# Smart Semicolon Extension

This extension places semicolons at the end of an expression.

![Basic Feature](https://raw.githubusercontent.com/seunghwanh/vscode-smartsemicolon/master/images/basic_feature.gif)

## Semantic Detection

This extension detects line comments and language brackets and configures the end of the current expression.

Line Detection

![Line Comment Detection](https://raw.githubusercontent.com/seunghwanh/vscode-smartsemicolon/master/images/line_comment_detection.gif)

Bracket Detection

![Bracket Detection](https://raw.githubusercontent.com/seunghwanh/vscode-smartsemicolon/master/images/bracket_detection.gif)

## Automatic Line Change

![Auto Line Change Basic](https://raw.githubusercontent.com/seunghwanh/vscode-smartsemicolon/master/images/auto_line_change_basic.gif)

When enabled, this extension automatically inserts a new line below the current cursor and put the cursor at the beginning of the new line on a semicolon key. The exceptions are when:

- If the current line is the only line inside a code block.
- If the below line is a code.
- If the current line has a close bracket after this expression.
- If the current line contains any of `autoLineChangeExceptionKeywords` (for example, you don't want to insert a new line after `return`, `throw` keywords in C#).

In case you don't want the newly-inserted line, simply putting another semicolon will cancel the insertion, and the cursor goes back to the previous position.

## Supported Languages
- C#
- C/C++
- Java
- Javascript, Typescript
- Go
- ShaderLab

## Extension Settings

* `smartsemicolon.enable`: toggle this extension on/off.
* `smartsemicolon.autoLineChange`: toggle the automatic line changing feature on/off.
* `smartsemicolon.acceptSuggestions`: If true, accept the current IntelliSense suggestion on a semicolon.
* `smartsemicolon.showInStatusBar`: toggle the extension information on the status bar.
* `smartsemicolon.deleteEmptyLine`: toggle deleting an empty line if the cursor is at the line and the user pressed a semicolon.

## Known Issues

- Cannot detect multi-lined comments. To insert a semicolon inside a multi-lined comment, users must manually toggle the extension off.
- Users must provide information about languages where this extension will take actions. Currently, extensions cannot retrieve language configurations from the Visual Studio Code.

### 1.0.0

Initial release 

### 1.0.3

- Supports C#, C/C++, Java, Javascript/Typescript, Go, ShaderLab languages by default.
- `smartsemicolon.languages` settings removed.
- No duplicate semicolons

### 1.0.4

- Supports multi-cursor editing.
- `smartsemicolon.acceptSuggestions` settings added.
- `smartsemicolon.showInStatusBar` settings added.
- `smartsemicolon.deleteEmptyLine` settings added.