import * as vscode from 'vscode';
import * as default_config from '../config/settings.json';
import * as manifest from '../package.json';
import * as path from 'path';

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object';
}

function logging(...args: any[]): void {
  console.log(`[${manifest.publisher}.${manifest.name}-${manifest.version}]`,
    ...args);
}

function tryUpdateSettings() {
  const config = vscode.workspace.getConfiguration();
  const config_diff = Object.entries(default_config).filter(([key, value]) => {
    const c_value = config.get(key);
    if (Array.isArray(c_value) && Array.isArray(value)) {
      const strs = (c_value as Array<any>).map(v => JSON.stringify(v));
      return (value as Array<any>).some(v => !strs.includes(JSON.stringify(v)));
    }
    if (isObject(c_value) && isObject(value)) {
      value = Object.assign({}, c_value, value);
    }
    return JSON.stringify(value) !== JSON.stringify(c_value);
  });

  if (!config_diff.length) {
    logging('Skip: nothing to update.');
    return;
  }

  vscode.window.showWarningMessage(
    'Wanna update: ' + config_diff.map(([key, _]) => key).join(', ') + ' ?',
    'Yes', 'No')
    .then((ans) => {
      if (ans !== 'Yes') {
        logging('Skip: user canceled.');
        return;
      }
      return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Updating settings...',
        cancellable: false
      }, (progress, _) => {
        const finish_keys: Array<String> = [];
        return Promise.all(config_diff.map(async ([key, value]) => {
          logging('Updating', key, ':', value);
          await config.update(key, value, vscode.ConfigurationTarget.Global);

          finish_keys.unshift(key);
          progress.report({
            increment: 100 * finish_keys.length / config_diff.length,
            message: `(${finish_keys.length}/${config_diff.length})` +
              ` ${finish_keys.join(', ')}`,
          });
        }));
      });
    })
    .then(() => {
      logging('Updated all settings.');
    });
}

export function activate(context: vscode.ExtensionContext) {
  tryUpdateSettings();

  const cmd0 = manifest.contributes.commands[0].command;
  context.subscriptions.push(vscode.commands.registerCommand(cmd0, async () => {
    logging(`Cmd: ${cmd0}`);
    await Promise.all([
      'workbench.action.joinAllGroups',
      'workbench.action.closePanel',
      'workbench.action.maximizeEditor',
    ].map(id => vscode.commands.executeCommand(id)));
  }));
  logging(`Registered ${cmd0}`);

  const cmd1 = manifest.contributes.commands[1].command;
  context.subscriptions.push(vscode.commands.registerCommand(cmd1, async () => {
    logging(`Cmd: ${cmd1}`);
    await vscode.commands.executeCommand('workbench.action.openSettingsJson');

    const base_path = path.resolve(__dirname, '../config/settings.json');
    const target_uri = vscode.window.activeTextEditor?.document.uri;
    await vscode.commands.executeCommand('vscode.diff',
      vscode.Uri.file(base_path), target_uri, 'DiffSettings');
  }));
  logging(`Registered ${cmd1}`);
}
