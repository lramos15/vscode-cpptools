/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { getSshConfigHostInfos } from '../sshHosts';
import * as vscode from 'vscode';
import { BaseNode, LabelLeafNode, refreshCppSshTargetsView } from './common';
import { TargetLeafNode, filesWritable, setActiveSshTarget, _activeTarget, workspaceState_activeSshTarget } from './targetNodes';
import { extensionContext, ISshConfigHostInfo } from '../../common';
import * as nls from 'vscode-nls';

nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

let _targets: Map<string, ISshConfigHostInfo> = new Map<string, ISshConfigHostInfo>();

export class SshTargetsProvider implements vscode.TreeDataProvider<BaseNode> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<BaseNode | undefined> = new vscode.EventEmitter<BaseNode | undefined>();

    public get onDidChangeTreeData(): vscode.Event<BaseNode | undefined> {
        return this._onDidChangeTreeData.event;
    }

    async getChildren(node?: BaseNode): Promise<BaseNode[]> {
        if (node) {
            return node.getChildren();
        }

        const children: BaseNode[] = await this.getTargets();
        if (children.length === 0) {
            return [new LabelLeafNode(localize('no.ssh.targets', 'No SSH targets'))];
        }

        return children;
    }

    getTreeItem(node: BaseNode): Promise<vscode.TreeItem> {
        return node.getTreeItem();
    }

    refresh(node?: BaseNode): void {
        this._onDidChangeTreeData.fire(node);
    }

    private async getTargets(): Promise<BaseNode[]> {
        filesWritable.clear();
        _targets = await getSshConfigHostInfos();
        const targetNodes: BaseNode[] = [];
        for (const host of Array.from(_targets.keys())) {
            const sshConfigHostInfo: ISshConfigHostInfo | undefined = _targets.get(host);
            if (sshConfigHostInfo) {
                targetNodes.push(new TargetLeafNode(host, sshConfigHostInfo));
            }
        }
        return targetNodes;
    }
}

export async function initializeSshTargets(): Promise<void> {
    _targets = await getSshConfigHostInfos();
    await setActiveSshTarget(extensionContext?.workspaceState.get(workspaceState_activeSshTarget));
}

export async function getActiveSshTarget(selectWhenNotSet: boolean = true): Promise<string | undefined> {
    if (_targets.size === 0) {
        throw Error(localize('no.ssh.targets', 'No SSH targets.'));
    }
    if (!_activeTarget && selectWhenNotSet) {
        const name: string | undefined = await selectSshTarget();
        if (!name) {
            throw Error(localize('no.active.ssh.target', 'No active SSH target.'));
        }
        await setActiveSshTarget(name);
        await vscode.commands.executeCommand(refreshCppSshTargetsView);
    }
    return _activeTarget;
}

export function selectSshTarget(): Thenable<string | undefined> {
    return vscode.window.showQuickPick(Array.from(_targets.keys()), { title: localize('select.ssh.target', 'Select an SSH target') });
}
