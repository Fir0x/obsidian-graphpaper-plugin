import {
	Plugin,
	MarkdownRenderChild,
	parseYaml
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	MathplotPluginSettings,
	MathplotSettingTab,
} from './settings';

import * as Plotly from 'plotly.js-dist-min';
import MathInterpreter from './interpreter';

type PlotInfo = {
	xMin: number,
	xMax: number,
	sampleCount: number,
	mathFunc: string
}

function parse(source: string) {
	const yaml = parseYaml(source);
	const checkMandatoryField = (field: string, types: string | string[]) => {
		if (!yaml.hasOwnProperty(field)) {
			throw new SyntaxError(`Missing field '${field}' in code block.`);
		}

		if (typeof types === 'string') {
			types = [types];
		}

		const fieldType = typeof yaml[field];
		if (!types.includes(fieldType)) {
			throw new SyntaxError(`Field '${field}' type is '${fieldType}', but must be one of the following types: ${types.join(', ')}.`);
		}
	};

	checkMandatoryField('xMin', 'number');
	checkMandatoryField('xMax', 'number');
	checkMandatoryField('sampleCount', 'number');
	checkMandatoryField('function', ['string', 'number']);

	const infos = {
		xMin: yaml.xMin,
		xMax: yaml.xMax,
		sampleCount: yaml.sampleCount,
		mathFunc: typeof (yaml.function) === 'number' ? (yaml.function as number).toString() : yaml.function
	};

	return infos as PlotInfo;
}

export default class MathplotPlugin extends Plugin {
	plotDivs!: HTMLDivElement[];
	settings!: MathplotPluginSettings;

	async onload() {
		this.plotDivs = [];

		await this.loadSettings();
		this.addSettingTab(new MathplotSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('mathplot', (source, el, ctx) => {
			try {
				let infos = parse(source);
				const plotDiv = this.generatePlot(infos, el);
				this.plotDivs.push(plotDiv);

				const plugin = this;
				ctx.addChild(new (class extends MarkdownRenderChild {
					onunload() {
						Plotly.purge(plotDiv)
						plugin.plotDivs.remove(plotDiv);
					}
				})(plotDiv));
			} catch (error) {
				const message = (error instanceof Error) ? error.message : String(error);
				const container = el.createDiv({ cls: 'mathplot-error' });
				container.createEl('strong', { text: 'MathPlot error: ' });
				container.createEl('span', { text: message });
			}
		});
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MathplotPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	generatePlot(infos: PlotInfo, el: HTMLElement) {
		const container = el.createDiv({ cls: 'mathplot-plot' });
		const sampleOffset = Math.max(1e-10, (infos.xMax - infos.xMin) / infos.sampleCount);
		const xValues = Array.from({ length: infos.sampleCount + 1 }, (_, i) => infos.xMin + i * sampleOffset);
		const yValues = new MathInterpreter().interpret(infos.mathFunc, xValues);

		Plotly.newPlot(container, [{
			x: xValues,
			y: yValues,
			type: 'scatter',
			mode: 'lines',
			line: {
				dash: this.settings.curveLineType,
			}
		}], {
			margin: { t: 20 }
		}, {
			responsive: true
		});

		return container;
	}

	updatePlotsRender() {
		for (const plotDiv of this.plotDivs) {
			Plotly.update(plotDiv, {
				line: {
					dash: this.settings.curveLineType
				}
			}, {});
		}
	}
}

