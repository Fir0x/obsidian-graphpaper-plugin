import {
	Plugin,
	MarkdownRenderChild,
	SliderComponent,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	MathplotPluginSettings,
	MathplotSettingTab,
} from './settings';

import * as Plotly from 'plotly.js-dist-min';
import { LexerError, TokenType } from './mathLexer';
import { ParserError } from './mathParser';
import { MathInterpreter, InterpreterError, ConstantDef } from './mathInterpreter';
import { ConfigError, PlotConfig, parsePlotConfig } from './plotConfigParser';


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
	} else if (error instanceof ConfigError) {
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

type PlotInfo = {
	config: PlotConfig,
	plotDiv: HTMLDivElement,
	constantsDiv?: HTMLDivElement
}

type ConstantOverride = {
	name: string,
	value: number
}

export default class MathplotPlugin extends Plugin {
	plots!: PlotInfo[]
	settings!: MathplotPluginSettings

	async onload() {
		this.plots = [];

		await this.loadSettings();
		this.addSettingTab(new MathplotSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('mathplot', (source, el, ctx) => {
			try {
				let infos = parsePlotConfig(source);
				const plot = this.generatePlot(infos, el);
				this.plots.push(plot);

				const plugin = this;
				ctx.addChild(new (class extends MarkdownRenderChild {
					onunload() {
						Plotly.purge(plot.plotDiv)
						plugin.plots.remove(plot);
					}
				})(plot.plotDiv));
			} catch (error) {
				const container = el.createDiv({ cls: 'mathplot-error' });
				displayError(error, container);
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

	generatePlot(config: PlotConfig, el: HTMLElement) {
		const rootContainer = el.createDiv({ cls: 'mathplot-root' });
		const [xValues, yValuesPerFunc] = this.generateFunctionsData(config)

		let plotlyLayout: Partial<Plotly.Layout> = {
			margin: { t: 20 },
		};

		if (config.options) {
			if (config.options.view) {
				if (typeof config.options.view.xMin !== 'undefined' || typeof config.options.view.xMax !== 'undefined') {
					const xMin = typeof config.options.view.xMin === 'undefined'
						? xValues.reduce((min, value) => value < min ? value : min)
						: config.options.view.xMin;
					const xMax = typeof config.options.view.xMax === 'undefined'
						? xValues.reduce((max, value) => value > max ? value : max)
						: config.options.view.xMax;

					plotlyLayout.xaxis = {
						range: [xMin, xMax]
					};
				}

				if (typeof config.options.view.yMin !== 'undefined' || typeof config.options.view.yMax !== 'undefined') {
					const reduceFn = (globalMin: number, yValues: number[]) => {
						const localMin = yValues.reduce((min, y) => y < min ? y : min)
						return localMin < globalMin ? localMin : globalMin;
					}
					const yMin = typeof config.options.view.yMin === 'undefined'
						? yValuesPerFunc.reduce(reduceFn, Infinity)
						: config.options.view.yMin;
					const yMax = typeof config.options.view.yMax === 'undefined'
						? yValuesPerFunc.reduce(reduceFn, Infinity)
						: config.options.view.yMax;

					plotlyLayout.yaxis = {
						range: [yMin, yMax]
					};
				}
			}
		}

		let plotlyConfig: Partial<Plotly.Config> = {
			responsive: true,
		};


		let plotlyData: Plotly.Data[] = [];
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i];
			const functionConfig = config.functions[i]!;
			plotlyData.push({
				x: xValues,
				y: yValues,
				type: 'scatter',
				mode: 'lines',
				name: functionConfig.name,
				line: {
					dash: this.settings.curveLineType,
				}
			});
		}

		const plotlyContainer = rootContainer.createDiv({ cls: 'mathplot-plot' });
		Plotly.newPlot(plotlyContainer, plotlyData, plotlyLayout, plotlyConfig);

		let plot: PlotInfo = {
			plotDiv: plotlyContainer,
			config
		}

		if (config.constants) {
			const constantsContainer = rootContainer.createDiv({ cls: 'mathplot-constants' });
			for (const constantConfig of config.constants) {
				// No need for sliders if no range is defined
				if (typeof constantConfig.range === 'undefined') {
					continue;
				}

				const uniqueConstantContainer = constantsContainer.createDiv();
				uniqueConstantContainer.createSpan({ cls: 'mathplot-constant-label', text: `${constantConfig.name} = ` });
				new SliderComponent(uniqueConstantContainer)
					.setLimits(constantConfig.range.min, constantConfig.range.max, constantConfig.range.step)
					.setValue(constantConfig.value)
					.setInstant(true)
					.onChange((newValue) => this.updatePlotConstant(plot, constantConfig.name, newValue));
			}
			plot.constantsDiv = constantsContainer;
		}

		return plot
	}

	updatePlotsRender() {
		for (const plot of this.plots) {
			Plotly.update(plot.plotDiv, {
				line: {
					dash: this.settings.curveLineType
				}
			}, {});
		}
	}

	private generateFunctionsData(config: PlotConfig, constantOverrides?: ConstantOverride[]): [number[], number[][]] {
		const sampleOffset = Math.max(1e-10, (config.xMax - config.xMin) / config.sampleCount);
		const xValues = Array.from({ length: config.sampleCount + 1 }, (_, i) => config.xMin + i * sampleOffset);

		let constants: ConstantDef[] = []
		if (config.constants) {
			for (const constantConfig of config.constants) {
				const constantOverride = constantOverrides?.find((value) => value.name === constantConfig.name);
				if (constantOverride) {
					constants.push({ name: constantConfig.name, value: constantOverride.value });
				} else {
					constants.push({ name: constantConfig.name, value: constantConfig.value });
				}
			}
		}

		let interpreter = new MathInterpreter(constants);
		let yValuesPerFunc = []
		for (const expr of config.functions) {
			yValuesPerFunc.push(interpreter.interpret(expr, xValues));
		}

		return [xValues, yValuesPerFunc];
	}

	private updatePlotConstant(plot: PlotInfo, name: string, value: number) {
		const [xValues, yValuesPerFunc] = this.generateFunctionsData(plot.config, [{ name, value }]);
		this.updatePlotValues(plot.plotDiv, xValues, yValuesPerFunc);
	}

	private updatePlotValues(plotDiv: HTMLDivElement, xValues: number[], yValuesPerFunc: number[][]) {
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i]!;
			Plotly.update(plotDiv, {
				x: [xValues],
				y: [yValues],
			}, {}, i);
		}

	}
}

