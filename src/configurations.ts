'use strict';

import { WorkspaceConfiguration, workspace } from "vscode";

const extensionPrefix = "smartsemicolon";

export function get(): WorkspaceConfiguration {
    return workspace.getConfiguration(extensionPrefix);
}

export const names = {
    enable: "enable",
    autoLineChange: "autoLineChange"
};

export const commands = {
    insert: extensionPrefix + ".insert",
    toggle: extensionPrefix + ".toggle",
    toggleAutoLineChange: extensionPrefix + ".toggleAutoLineChange"
};