import { App, PluginSettingTab, Setting } from 'obsidian';
import GraphpaperPlugin from './main';

import { Dash } from 'plotly.js-dist-min';

export interface GraphpaperPluginSettings {
	curveLineType: Dash;
	splitPlotAutoMaxColumns: number,
}

export const DEFAULT_SETTINGS: GraphpaperPluginSettings = {
	curveLineType: 'solid',
	splitPlotAutoMaxColumns: 4,
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
			.setName('Curve line type')
			.setDesc('Line type for 2D plots.')
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
			});

		new Setting(containerEl)
			.setName('Max plot per row')
			.setDesc('Maxium number of plots in the same row when using "auto" in split mode.')
			.addText((component) => {
				component.inputEl.type = 'number';
				component
					.setValue(this.plugin.settings.splitPlotAutoMaxColumns.toString())
					.onChange(async (value) => {
						this.plugin.settings.splitPlotAutoMaxColumns = Math.max(Number(value), 1);
						component.setValue(this.plugin.settings.splitPlotAutoMaxColumns.toString());
						await this.plugin.saveSettings();
						this.plugin.updatePlotsRender();
					});
			});
	}
}
