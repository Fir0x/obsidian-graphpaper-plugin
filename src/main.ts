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

import { LexerError, TokenType } from './mathLexer';
import { ParserError } from './mathParser';
import { InterpreterError } from './mathInterpreter';
import { ConfigError, PlotConfig, parsePlotConfig, ConstantConfig } from './plotConfigParser';
import { Plot, PlotOneVar, PlotTwoVar } from './plots';


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
	plot: Plot,
	constantsDiv?: HTMLDivElement
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
				const plotInfo = this.generatePlot(el, infos);
				this.plots.push(plotInfo);

				const plugin = this;
				ctx.addChild(new (class extends MarkdownRenderChild {
					onunload() {
						plugin.plots.remove(plotInfo);
					}
				})(plotInfo.plot.getContainer()));
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
		for (const plotInfo of this.plots) {
			plotInfo.plot.updateRender();
		}
	}

	private generatePlot(el: HTMLElement, config: PlotConfig): PlotInfo {
		const rootContainer = el.createDiv({ cls: 'graphpaper-root' });

		const plotlyContainer = rootContainer.createDiv({ cls: 'graphpaper-plot' });
		let plot;
		if (config.type == '2D') {
			plot = new PlotOneVar(plotlyContainer, config, this.settings);
		} else {
			plot = new PlotTwoVar(plotlyContainer, config, this.settings);
		}

		let plotInfo: PlotInfo = {
			plot
		};

		if (config.constants) {
			const constantsContainer = this.createConstantsContainer(rootContainer, config.constants, plotInfo);
			plotInfo.constantsDiv = constantsContainer;
		}

		return plotInfo
	}

	private createConstantsContainer(rootContainer: HTMLElement, constantConfigs: ConstantConfig[], plotInfo: PlotInfo) {
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
				.onChange((newValue) => plotInfo.plot.updateConstant(constantConfig.name, newValue));

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
}


