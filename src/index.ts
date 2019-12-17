import * as vscode from 'vscode';
import * as default_config from '../config/settings.json';
import * as manifest from '../package.json';

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object';
}

function logging(...args: any[]): void {
  console.log(`[${manifest.publisher}.${manifest.name}-${manifest.version}]`,
    ...args);
}

export function activate() {
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
      config_diff.forEach(([key, value]) => {
        config.update(key, value, vscode.ConfigurationTarget.Global);
        logging('Update: ', key);
      });
    });
}

export function deactivate() { }
