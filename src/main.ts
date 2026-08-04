import {
	Plugin,
	MarkdownRenderChild,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	MathplotPluginSettings,
	MathplotSettingTab,
} from './settings';

import * as Plotly from 'plotly.js-dist-min';
import { LexerError, TokenType } from './mathLexer';
import { ParserError } from './mathParser';
import { MathInterpreter, InterpreterError } from './mathInterpreter';
import { PlotConfig, parsePlotConfig } from './plotConfigParser';


function displayError(error: any, container: HTMLDivElement) {
	let message: [string, boolean][] = [['MathPlot error:\n', true]];
	if (error instanceof LexerError) {
		message.push([error.message + '\nHint: ' + error.source.slice(0, error.index), false]);
		message.push([error.source[error.index]!, true]);
		message.push([error.source.slice(error.index + 1), false]);
	} else if (error instanceof ParserError) {
		let messagePart = error.message + '\nHint: [';

		for (let i = 0; i < error.tokens.length; i++) {
			const token = error.tokens[i]!;
			let tokenStr = '';
			switch (token.type) {
				case TokenType.Identifier: tokenStr += token.value; break;
				case TokenType.Literal: tokenStr += token.value; break;
				case TokenType.Plus: tokenStr += '+'; break;
				case TokenType.Minus: tokenStr += '-'; break;
				case TokenType.Star: tokenStr += '*'; break;
				case TokenType.Slash: tokenStr += '/'; break;
				case TokenType.Caret: tokenStr += '^'; break;
				case TokenType.LeftParen: tokenStr += '('; break;
				case TokenType.RightParen: tokenStr += ')'; break;
			}

			if (i == error.index) {
				message.push([messagePart, false]);
				message.push([`'${tokenStr}'`, true]);
				messagePart = '';
			} else {
				messagePart += `'${tokenStr}'`;
			}

			if (i < error.tokens.length - 1) {
				messagePart += ' | ';
			}
		}

		message.push([messagePart + ']', false]);
	} else if (error instanceof InterpreterError) {
		message.push([error.message, false]);
	} else {
		message.push(['[Dev error] ' + (error instanceof Error ? error.message : String(error)), false]);
	}

	for (const messagePart of message) {
		if (messagePart[1]) {
			container.createSpan({ text: messagePart[0]!, cls: 'mathplot-error', attr: { id: 'notice' } });
		} else {
			container.createSpan({ text: messagePart[0], cls: 'mathplot-error' });
		}
	}
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
				let infos = parsePlotConfig(source);
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
				const container = el.createDiv({ cls: 'mathplot-error' });
				displayError(error, container)
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

	generatePlot(infos: PlotConfig, el: HTMLElement) {
		const container = el.createDiv({ cls: 'mathplot-plot' });
		const sampleOffset = Math.max(1e-10, (infos.xMax - infos.xMin) / infos.sampleCount);
		const xValues = Array.from({ length: infos.sampleCount + 1 }, (_, i) => infos.xMin + i * sampleOffset);
		const yValues = new MathInterpreter().interpret(infos.mathFunc, xValues);

		let layout: Partial<Plotly.Layout> = {
			margin: { t: 20 },
		};

		if (infos.options) {
			if (infos.options.view) {
				if (typeof infos.options.view.xMin !== 'undefined' || typeof infos.options.view.xMax !== 'undefined') {
					const xMin = typeof infos.options.view.xMin === 'undefined'
						? xValues.reduce((min, value) => value < min ? value : min)
						: infos.options.view.xMin;
					const xMax = typeof infos.options.view.xMax === 'undefined'
						? xValues.reduce((max, value) => value > max ? value : max)
						: infos.options.view.xMax;

					layout.xaxis = {
						range: [xMin, xMax]
					};
				}

				if (typeof infos.options.view.yMin !== 'undefined' || typeof infos.options.view.yMax !== 'undefined') {
					const yMin = typeof infos.options.view.yMin === 'undefined'
						? yValues.reduce((min, value) => value < min ? value : min)
						: infos.options.view.yMin;
					const yMax = typeof infos.options.view.yMax === 'undefined'
						? yValues.reduce((max, value) => value > max ? value : max)
						: infos.options.view.yMax;

					layout.yaxis = {
						range: [yMin, yMax]
					};
				}
			}
		}

		let config: Partial<Plotly.Config> = {
			responsive: true,
		};

		Plotly.newPlot(container, [{
			x: xValues,
			y: yValues,
			type: 'scatter',
			mode: 'lines',
			line: {
				dash: this.settings.curveLineType,
			}
		}], layout, config);

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

