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
import { LexerError, TokenType } from './lexer';
import { ParserError } from './parser';
import { MathInterpreter, InterpreterError } from './interpreter';
import { z } from 'zod';

const plotInfoSchema = z.strictObject({
	xMin: z.number(),
	xMax: z.number(),
	sampleCount: z.number(),
	function: z.coerce.string(),
	view: z.strictObject({
		xMin: z.number().optional(),
		xMax: z.number().optional(),
		yMin: z.number().optional(),
		yMax: z.number().optional(),
	}).optional(),
});

type PlotInfo = {
	xMin: number,
	xMax: number,
	sampleCount: number,
	mathFunc: string,
	view?: {
		xMin?: number,
		xMax?: number,
		yMin?: number,
		yMax?: number,
	},
}

function parse(source: string) {
	const yaml = parseYaml(source);

	const zodResult = plotInfoSchema.safeParse(yaml);
	if (!zodResult.success) {
		const msg = zodResult.error.issues
			.map(issue => `'${issue.path.join('.')}': ${issue.message}`)
			.join('\n');
		throw new SyntaxError(msg);
	}

	const { function: mathFunc, ...rest } = zodResult.data;
	return {
		...rest,
		mathFunc
	} as PlotInfo;
}

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

	generatePlot(infos: PlotInfo, el: HTMLElement) {
		const container = el.createDiv({ cls: 'mathplot-plot' });
		const sampleOffset = Math.max(1e-10, (infos.xMax - infos.xMin) / infos.sampleCount);
		const xValues = Array.from({ length: infos.sampleCount + 1 }, (_, i) => infos.xMin + i * sampleOffset);
		const yValues = new MathInterpreter().interpret(infos.mathFunc, xValues);

		let layout: Partial<Plotly.Layout> = {
			margin: { t: 20 },
		};

		if (infos.view) {
			if (typeof infos.view.xMin !== 'undefined' || typeof infos.view.xMax !== 'undefined') {
				const xMin = typeof infos.view.xMin === 'undefined' ? xValues.reduce((min, value) => value < min ? value : min) : infos.view.xMin;
				const xMax = typeof infos.view.xMax === 'undefined' ? xValues.reduce((max, value) => value > max ? value : max) : infos.view.xMax;
				layout.xaxis = {
					range: [xMin, xMax]
				};
			}

			if (typeof infos.view.yMin !== 'undefined' || typeof infos.view.yMax !== 'undefined') {
				const yMin = typeof infos.view.yMin === 'undefined' ? yValues.reduce((min, value) => value < min ? value : min) : infos.view.yMin;
				const yMax = typeof infos.view.yMax === 'undefined' ? yValues.reduce((max, value) => value > max ? value : max) : infos.view.yMax;
				layout.yaxis = {
					range: [yMin, yMax]
				};
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

