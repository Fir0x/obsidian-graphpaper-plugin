import { App, PluginSettingTab, Setting } from 'obsidian';
import GraphpaperPlugin from './main';

import { Dash } from 'plotly.js-dist-min';

export interface GraphpaperPluginSettings {
	curveLineType: Dash;
}

export const DEFAULT_SETTINGS: GraphpaperPluginSettings = {
	curveLineType: 'solid',
};

export class GraphpaperSettingTab extends PluginSettingTab {
	plugin: GraphpaperPlugin;

	constructor(app: App, plugin: GraphpaperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						solid: 'Solid',
						dot: 'Dot'
					})
					.setValue(this.plugin.settings.curveLineType)
					.onChange(async (value) => {
						this.plugin.settings.curveLineType = value as Dash;
						await this.plugin.saveSettings();
						this.plugin.updatePlotsRender();
					});
			}
			);
	}
}
