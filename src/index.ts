import * as vscode from 'vscode';
import * as default_config from '../config/settings.json';
import * as manifest from '../package.json';
import * as path from 'path';

function isObject(value: any) {
  return value !== null && typeof value === 'object';
}

function logging(...args: any[]) {
  console.log(`[${manifest.publisher}.${manifest.name}-${manifest.version}]`,
    ...args);
}

const cmdDiffSettings = manifest.contributes.commands[0].command;

function checkContains(object1: any, object2: any): boolean {
  if (Array.isArray(object1) && Array.isArray(object2)) {
    return (object2 as any[]).every(
      item2 => (object1 as any[]).some(
        item1 => checkContains(item1, item2)
      )
    );
  }
  if (isObject(object1) && isObject(object2)) {
    return Object.entries(object2).every(
      ([key2, value2]) => checkContains(object1[key2], value2)
    );
  }
  return object1 == object2;
}

async function tryUpdateSettings() {
  const current_config = vscode.workspace.getConfiguration();
  const config_diff = Object.entries(default_config).filter(
    ([key, value]) => !checkContains(current_config.get(key), value)
  );
  if (!config_diff.length) {
    logging('Skip: nothing to update.');
    return;
  }

  const ans = await vscode.window.showWarningMessage(
    'Wanna update: ' + config_diff.map(([key]) => key).join(', ') + ' ?',
    'Yes', 'No', 'Diff');
  if (ans === 'Diff') {
    logging('Skip: inspect diff.');
    vscode.commands.executeCommand(cmdDiffSettings);
    return;
  }
  if (ans === 'No') {
    logging('Skip: user canceled.');
    return;
  }
  if (ans === 'Yes') {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Updating settings...',
      cancellable: false
    }, (progress) => {
      const finish_keys: Array<String> = [];
      return Promise.all(config_diff.map(async ([key, value]) => {
        logging('Updating', key, ':', value);
        try {
          await current_config.update(key, value, vscode.ConfigurationTarget.Global);
        } catch (error) { }

        finish_keys.unshift(key);
        progress.report({
          increment: 100 * finish_keys.length / config_diff.length,
          message: `(${finish_keys.length}/${config_diff.length})` +
            ` ${finish_keys.join(', ')}`,
        });
      }));
    });
    logging('Updated all settings.');
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(cmdDiffSettings, async () => {
      logging(`Cmd: ${cmdDiffSettings}`);
      await vscode.commands.executeCommand('workbench.action.openSettingsJson');

      const base_path = path.resolve(__dirname, '../config/settings.json');
      const target_uri = vscode.window.activeTextEditor?.document.uri;
      await vscode.commands.executeCommand('vscode.diff',
        vscode.Uri.file(base_path), target_uri, 'DiffSettings');
    }));
  logging(`Registered ${cmdDiffSettings}`);

  tryUpdateSettings();
}
