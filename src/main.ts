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

