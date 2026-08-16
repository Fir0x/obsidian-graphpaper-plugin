import {
	Plugin,
	MarkdownRenderChild,
	SliderComponent,
	TextComponent,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	GraphpaperPluginSettings,
	GraphpaperSettingTab,
} from './settings';

import * as Plotly from 'plotly.js-dist-min';
import { LexerError, TokenType } from './mathLexer';
import { ParserError } from './mathParser';
import { MathInterpreter, InterpreterError, ConstantDef } from './mathInterpreter';
import { ConfigError, PlotConfig, parsePlotConfig, ViewOptions, ConstantConfig } from './plotConfigParser';


function displayError(error: any, container: HTMLDivElement) {
	let message: [string, boolean][] = [['Graphpaper error:\n', true]];
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
			container.createSpan({ text: messagePart[0]!, cls: 'graphpaper-error', attr: { id: 'notice' } });
		} else {
			container.createSpan({ text: messagePart[0], cls: 'graphpaper-error' });
		}
	}
}

type PlotInfo = {
	config: PlotConfig,
	plotDiv: HTMLDivElement,
	constantsDiv?: HTMLDivElement
	// Needed because of a Plotly bug in their autorange system on update/react (see isssue #7024)
	plotlyLayout: Partial<Plotly.Layout>
}

type ConstantOverride = {
	name: string,
	value: number
}

export default class GraphpaperPlugin extends Plugin {
	plots!: PlotInfo[]
	settings!: GraphpaperPluginSettings

	async onload() {
		this.plots = [];

		await this.loadSettings();
		this.addSettingTab(new GraphpaperSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('graphpaper', (source, el, ctx) => {
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
				const container = el.createDiv({ cls: 'graphpaper-error' });
				displayError(error, container);
			}
		});
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<GraphpaperPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

	private generatePlot(config: PlotConfig, el: HTMLElement) {
		const rootContainer = el.createDiv({ cls: 'graphpaper-root' });
		const [xValues, yValuesPerFunc] = this.generateFunctionsData(config)

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

		const [plotlyLayout, plotlyConfig] = plotlySettingsFromConfig(config, xValues, yValuesPerFunc);

		const plotlyContainer = rootContainer.createDiv({ cls: 'graphpaper-plot' });
		Plotly.newPlot(plotlyContainer, plotlyData, structuredClone(plotlyLayout), plotlyConfig);

		let plot: PlotInfo = {
			plotDiv: plotlyContainer,
			config,
			plotlyLayout,
		}

		if (config.constants) {
			const constantsContainer = this.createConstantsContainer(rootContainer, config.constants, plot);
			plot.constantsDiv = constantsContainer;
		}

		return plot
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

	private createConstantsContainer(rootContainer: HTMLElement, constantConfigs: ConstantConfig[], plot: PlotInfo) {
		const constantsContainer = rootContainer.createDiv({ cls: 'graphpaper-constants' });
		for (const constantConfig of constantConfigs) {
			// No need for sliders if no range is defined
			if (constantConfig.range === undefined) {
				continue;
			}

			const uniqueConstantContainer = constantsContainer.createDiv();
			uniqueConstantContainer.createSpan({ cls: 'graphpaper-constant-label', text: `${constantConfig.name} = ` });
			const slider = new SliderComponent(uniqueConstantContainer)
				.setLimits(constantConfig.range.min, constantConfig.range.max, constantConfig.range.step)
				.setValue(constantConfig.value)
				.setInstant(true)
				.onChange((newValue) => this.updatePlotConstant(plot, constantConfig.name, newValue));

			let sliderEl = slider.sliderEl;
			sliderEl.addEventListener('dblclick', () => {
				const input = new TextComponent(uniqueConstantContainer)
					.setValue(slider.getValue().toString());

				let inputEl = input.inputEl;
				let slideSpanEl = sliderEl.previousElementSibling as HTMLElement | null;
				inputEl.type = 'number';
				const inputWidth = sliderEl.offsetWidth + (slideSpanEl?.offsetWidth ?? 0);
				inputEl.style.width = `${inputWidth}px`;

				inputEl.focus();
				inputEl.select();
				if (slideSpanEl) {
					slideSpanEl.style.display = 'none';
				}
				sliderEl.style.display = 'none';

				const restoreSliderMode = () => {
					inputEl.remove();
					sliderEl.style.display = '';
					if (slideSpanEl) {
						slideSpanEl.style.display = '';
					}
				};

				let preventCommit = false;
				const commit = () => {
					if (preventCommit) return;

					let value = parseFloat(inputEl.value);
					if (!Number.isNaN(value)) {
						slider.setValue(Math.clamp(value, constantConfig.range!.min, constantConfig.range!.max));
					}

					// Need to be done here because inputEl.remove() will trigger a blur event
					preventCommit = true;
					restoreSliderMode();
				};

				inputEl.addEventListener('blur', commit);
				inputEl.addEventListener('keydown', (e) => {
					if (e.key == 'Enter') {
						commit();
					} else if (e.key == 'Escape') {
						preventCommit = true;
						restoreSliderMode();
					}
				})
			});
		}

		return constantsContainer;
	}

	private updatePlotConstant(plot: PlotInfo, name: string, value: number) {
		const [xValues, yValuesPerFunc] = this.generateFunctionsData(plot.config, [{ name, value }]);
		this.updatePlotValues(plot, xValues, yValuesPerFunc);
	}

	private updatePlotValues(plot: PlotInfo, xValues: number[], yValuesPerFunc: number[][]) {
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i]!;
			Plotly.update(plot.plotDiv, {
				x: [xValues],
				y: [yValues],
			}, structuredClone(plot.plotlyLayout), i);
		}
	}
}

function plotlySettingsFromConfig(config: PlotConfig, xValues: number[], yValuesPerFunc: number[][]): [Partial<Plotly.Layout>, Partial<Plotly.Config>] {
	let plotlyLayout: Partial<Plotly.Layout> = {
		margin: { t: 20 },
	};

	let plotlyConfig: Partial<Plotly.Config> = {
		responsive: true,
	};

	viewConfigToPlotly(config.options.view, plotlyLayout, xValues, yValuesPerFunc);

	return [plotlyLayout, plotlyConfig];
}

function viewConfigToPlotly(viewConfig: ViewOptions, plotlyLayout: Partial<Plotly.Layout>, xValues: number[], yValuesPerFunc: number[][]) {
	{
		const xAxisConfig = viewConfig.xAxis;
		let plotlyAxis: Partial<Plotly.LayoutAxis> = {};

		const xMin = xAxisConfig.autoRange
			? xAxisConfig.min ?? xValues.reduce((min, value) => value < min ? value : min)
			: xAxisConfig.min
		const xMax = xAxisConfig.autoRange
			? xAxisConfig.max ?? xValues.reduce((max, value) => value > max ? value : max)
			: xAxisConfig.max;

		plotlyAxis.range = [xMin, xMax];

		if (xAxisConfig.disableZoom) {
			plotlyAxis.fixedrange = true;
		}

		plotlyLayout.xaxis = plotlyAxis;
	}

	{
		const yAxisConfig = viewConfig.yAxis;
		let plotlyAxis: Partial<Plotly.LayoutAxis> = {};

		const reduceMin = (globalMin: number, yValues: number[]) => {
			const localMin = yValues.reduce((min, y) => y < min ? y : min)
			return localMin < globalMin ? localMin : globalMin;
		}

		const reduceMax = (globalMin: number, yValues: number[]) => {
			const localMax = yValues.reduce((max, y) => y > max ? y : max)
			return localMax > globalMin ? localMax : globalMin;
		}

		const yMin = yAxisConfig.autoRange
			? yAxisConfig.min
			: yAxisConfig.min ?? yValuesPerFunc.reduce(reduceMin, Infinity);
		const yMax = yAxisConfig.autoRange
			? yAxisConfig.max
			: yAxisConfig.max ?? yValuesPerFunc.reduce(reduceMax, -Infinity);

		plotlyAxis.range = [yMin, yMax];

		if (yAxisConfig.disableZoom) {
			plotlyAxis.fixedrange = true;
		}

		plotlyLayout.yaxis = plotlyAxis;
	}
}

