import { App, BaseComponent, ButtonComponent, DropdownComponent, MarkdownView, Modal, Setting, stringifyYaml, TextComponent, Value } from 'obsidian';
import { AxisOptions, ConstantConfig, defaultPlotOptions, FunctionConfig, PlotConfig, ViewOptions } from './plotConfigParser';

export class VisualEditor extends Modal {
	funcEditorContainer: HTMLElement;

	constructor(app: App, defaults?: PlotConfig) {
		super(app);
		this.setTitle('Graphpaper visual editor');

		let plotEdit = defaults;
		if (plotEdit === undefined) {
			plotEdit = {
				type: '2D',
				xMin: -5,
				xMax: 5,
				sampleCountPerAxis: 100,
				functions: [{ name: 'f', def: 'x' }],
				constants: [],
				options: defaultPlotOptions
			};
		}

		new DropdownComponent(this.contentEl)
			.addOptions({
				'2D': '2D',
				'3D': '3D'
			})
			.setValue(plotEdit.type)
			.onChange((value: string) => {
				plotEdit.type = value as typeof plotEdit.type;
				let newFuncEditorContainer = this.generateFuncEditor(this.contentEl, plotEdit);
				this.funcEditorContainer.replaceWith(newFuncEditorContainer);
				this.funcEditorContainer = newFuncEditorContainer;
			});

		this.funcEditorContainer = this.generateFuncEditor(this.contentEl, plotEdit);

		new ButtonComponent(this.contentEl).setButtonText('Confirm').onClick(() => this.writePlotConfig(plotEdit));
	}

	private generateFuncEditor(containerEl: HTMLElement, plotEdit: PlotConfig): HTMLDivElement {
		let rootEl = containerEl.createDiv();
		if (plotEdit.type == '2D') {
			this.generate2DFuncEditor(rootEl, plotEdit);
		} else {
			this.generate3DFuncEditor(rootEl, plotEdit);
		}

		return rootEl;
	}

	private generate2DFuncEditor(containerEl: HTMLElement, plotEdit: PlotConfig): HTMLDivElement {
		let container = containerEl.createDiv()
		let generalContainer = container.createDiv({ cls: 'graphpaper-vedit-section' });
		generalContainer.setText('General');
		new LabeledComponent(generalContainer)
			.setLabel('X min:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(plotEdit.xMin).onNumberChange((value: number) => plotEdit.xMin = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('X max:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(plotEdit.xMax).onNumberChange((value: number) => plotEdit.xMax = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('Sample count:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(plotEdit.sampleCountPerAxis).onNumberChange((value: number) => plotEdit.sampleCountPerAxis = value);
			});


		this.generateFunctionDefsEditor(container, plotEdit);
		this.generateConstantsEditor(containerEl, plotEdit)

		let optionsContainer = containerEl.createDiv({ cls: 'graphpaper-vedit-section' });
		optionsContainer.setText('Options');
		this.generateAxisOptionsEditor(optionsContainer, 'X axis', plotEdit.options.view.xAxis);
		this.generateAxisOptionsEditor(optionsContainer, 'Y axis', plotEdit.options.view.yAxis);
		this.generateSplitOptionsEditor(optionsContainer, plotEdit.options.view);

		return generalContainer;
	}

	private generate3DFuncEditor(parentContainer: HTMLElement, plotEdit: PlotConfig): HTMLDivElement {
		let container = parentContainer.createDiv();

		return container;
	}

	private generateFunctionDefsEditor(containerEl: HTMLElement, plotEdit: PlotConfig) {
		let constructFunctionEdit = (containerEl: HTMLElement, functionDef: FunctionConfig) => {
			new LabeledComponent(containerEl)
				.setLabel('Name:')
				.setElement((containerEl: HTMLElement) => {
					return new TextComponent(containerEl).setValue(functionDef.name).onChange((value: string) => functionDef.name = value);
				});

			new LabeledComponent(containerEl)
				.setLabel('Definition:')
				.setElement((containerEl: HTMLElement) => {
					return new TextComponent(containerEl).setValue(functionDef.def).onChange((value: string) => functionDef.def = value);
				});
		}

		let functionDefs = new ListComponent(containerEl)
			.setText('Function definitions')
			.addStaticElement((containerEl: HTMLElement) => {
				constructFunctionEdit(containerEl, plotEdit.functions[0]!);
			})
			.onAdd((containerEl: HTMLElement) => {
				let defaultNames = ['f', 'g', 'h'];
				let def = { name: defaultNames[plotEdit.functions.length % defaultNames.length], def: 'x' } as FunctionConfig;
				plotEdit.functions.push(def);

				constructFunctionEdit(containerEl, def);
			})
			.onDelete((index: number) => {
				plotEdit.functions.splice(index, 1);
			});

		// Add existing defs to UI
		for (let i = 1; i < plotEdit.functions.length; i++) {
			functionDefs.addDynamicElement((containerEl: HTMLElement) => {
				constructFunctionEdit(containerEl, plotEdit.functions[i]!);
			});
		}
	}

	private generateConstantsEditor(containerEl: HTMLElement, plotEdit: PlotConfig) {
		let rootEl = containerEl.createDiv({ cls: 'graphpaper-vedit-section' });
		rootEl.setText('Constants');
		let constructConstantEdit = (containerEl: HTMLElement, constant: ConstantConfig) => {
			new LabeledComponent(containerEl)
				.setLabel('Name:')
				.setElement((containerEl: HTMLElement) => {
					return new TextComponent(containerEl).setValue(constant.name).onChange((value: string) => constant.name = value);
				});

			new LabeledComponent(containerEl)
				.setLabel('Value:')
				.setElement((containerEl: HTMLElement) => {
					return new NumberComponent(containerEl).setNumber(constant.value).onNumberChange((value: number) => constant.value = value);
				});

			let checkbox = new LabeledComponent<CheckboxComponent>(containerEl)
				.setLabel('Dynamic mode:')
				.setElement((containerEl: HTMLElement) => {
					return new CheckboxComponent(containerEl);
				})
				.element!;

			let dynamicEdit = containerEl.createDiv();
			let constantRange = constant.range ?? { min: -5, max: 5, step: 0.1 };
			new LabeledComponent(dynamicEdit)
				.setLabel('Min:')
				.setElement((containerEl: HTMLElement) => {
					return new NumberComponent(containerEl).setNumber(constantRange.min).onNumberChange((value: number) => constantRange.min = value);
				});
			new LabeledComponent(dynamicEdit)
				.setLabel('Max:')
				.setElement((containerEl: HTMLElement) => {
					return new NumberComponent(containerEl).setNumber(constantRange.max).onNumberChange((value: number) => constantRange.max = value);
				});
			new LabeledComponent(dynamicEdit)
				.setLabel('Step:')
				.setElement((containerEl: HTMLElement) => {
					return new NumberComponent(containerEl).setNumber(constantRange.step).onNumberChange((value: number) => constantRange.step = value);
				});

			checkbox.onChange((value: boolean) => {
				if (value) {
					dynamicEdit.removeAttribute('hidden');
				} else {
					dynamicEdit.setAttr('hidden', '');
				}
			});

			if (constant.range == undefined) {
				dynamicEdit.setAttr('hidden', '');
			}
		}

		let constantDefs = new ListComponent(rootEl)
			.onAdd((containerEl: HTMLElement) => {
				let defaultNames = ['a', 'b', 'c', 'd'];
				let constant = { name: defaultNames[plotEdit.constants.length % defaultNames.length], value: 0 } as ConstantConfig;
				plotEdit.constants.push(constant);
				constructConstantEdit(containerEl, constant);
			})
			.onDelete((index: number) => plotEdit.constants.splice(index, 1));

		// Add existing constants to UI
		for (let i = 0; i < plotEdit.constants.length; i++) {
			constantDefs.addDynamicElement((containerEl: HTMLElement) => {
				let constant = plotEdit.constants[i]!;
				constructConstantEdit(containerEl, constant);
			});
		}
	}

	private generateAxisOptionsEditor(containerEl: HTMLElement, name: string, config: AxisOptions) {
		let axisOptionsContainer = containerEl.createDiv();
		axisOptionsContainer.setText(name);
		new LabeledComponent(axisOptionsContainer)
			.setLabel('Min:')
			.setElement((containerEl: HTMLElement) => {

				return new NumberComponent(containerEl)
					.setValue(config.min?.toString() ?? '')
					.onNumberChange((value: number) => config.min = value);
			});
		new LabeledComponent(axisOptionsContainer)
			.setLabel('Max:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl)
					.setValue(config.max?.toString() ?? '')
					.onNumberChange((value: number) => config.max = value);
			});
		new LabeledComponent(axisOptionsContainer)
			.setLabel('Disable zoom:')
			.setElement((containerEl: HTMLElement) => {
				return new CheckboxComponent(containerEl).setValue(config.disableZoom).onChange((value: boolean) => config.disableZoom = value);
			});
		new LabeledComponent(axisOptionsContainer)
			.setLabel('Autorange:')
			.setElement((containerEl: HTMLElement) => {
				return new CheckboxComponent(containerEl).setValue(config.autoRange).onChange((value: boolean) => config.autoRange = value);
			});
	}

	private generateSplitOptionsEditor(containerEl: HTMLElement, config: ViewOptions) {
		let confUsesCustomSplit = Array.isArray(config.splitPlots);
		let splitTypeSelector = new LabeledComponent<DropdownComponent>(containerEl)
			.setLabel('Split plots:')
			.setElement((containerEl: HTMLElement) => {
				return new DropdownComponent(containerEl)
					.addOptions({
						no: 'No',
						auto: 'Auto',
						custom: 'Custom'
					})
					.setValue(confUsesCustomSplit ? 'custom' : config.splitPlots as string);
			})
			.element!;

		let customSplitValues: [number, number] = confUsesCustomSplit ? config.splitPlots as [number, number] : [0, 0];
		let customSplitContainer = containerEl.createDiv();
		if (!confUsesCustomSplit) {
			customSplitContainer.setAttr('hidden', '');
		}
		new LabeledComponent(customSplitContainer)
			.setLabel('Rows:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(customSplitValues[0]).onNumberChange((value: number) => customSplitValues[0] = value);
			});
		new LabeledComponent(customSplitContainer)
			.setLabel('Columns:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(customSplitValues[1]).onNumberChange((value: number) => customSplitValues[1] = value);
			});

		splitTypeSelector.onChange((value: string) => {
			if (value != 'custom') {
				customSplitContainer.setAttr('hidden', '');
			} else {
				customSplitContainer.removeAttribute('hidden');
			}
		});
	}

	private writePlotConfig(plotConfig: PlotConfig) {
		let yaml = `\`\`\`graphpaper\n${stringifyYaml(plotConfig)}\n\`\`\`\n`;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			return;
		}

		view.editor.replaceSelection(yaml);
		this.close();
	}
}

class LabeledComponent<T> extends BaseComponent {
	rootEl: HTMLElement;
	label: HTMLElement;
	element?: T;

	constructor(containerEl: HTMLElement) {
		super();

		this.rootEl = containerEl.createDiv();
		this.label = this.rootEl.createSpan({ cls: 'graphpaper-vedit-label' })
	}

	setLabel(text: string): this {
		this.label.textContent = text;

		return this;
	}

	setElement(constructor: (containerEl: HTMLElement) => T) {
		this.element = constructor(this.rootEl);

		return this;
	}
}

class NumberComponent extends TextComponent {
	constructor(containerEl: HTMLElement) {
		super(containerEl);

		this.inputEl.type = 'number';
		this.setMaxVisibleDigits(10);
	}

	setNumber(value: number) {
		this.inputEl.value = value.toString();

		return this;
	}

	setMaxVisibleDigits(value: number) {
		if (value <= 0) {
			return this;
		}

		this.inputEl.style.width = `${value + 3}ch`; // Add 1 for floating point, and 2 because there's not enough width otherwise?
		return this;
	}

	onNumberChange(callback: (value: number) => void) {
		this.onChange((value: string) => {
			let numberValue = Number(value);
			if (!isNaN(numberValue)) {
				callback(numberValue);
			}
		});

		return this;
	}
}

class ListComponent extends BaseComponent {
	rootEl: HTMLElement;
	label: HTMLElement;
	staticSection: HTMLElement;
	staticElementCount: number;
	dynamicSection: HTMLElement;
	elements: HTMLElement[];
	addCallback?: (containerEl: HTMLElement) => void;
	deleteCallback?: (index: number) => void;

	constructor(containerEl: HTMLElement) {
		super();

		this.rootEl = containerEl.createDiv();
		this.label = this.rootEl.createSpan();

		this.staticSection = this.rootEl.createDiv();
		this.staticElementCount = 0;
		this.dynamicSection = this.rootEl.createDiv();
		this.elements = [];
		new ButtonComponent(this.rootEl)
			.setButtonText('+')
			.onClick(() => {
				if (this.addCallback == null) {
					return;
				}

				let container = this.dynamicSection.createDiv();
				new ButtonComponent(container)
					.setButtonText('X')
					.onClick(() => {
						let index = this.elements.indexOf(container) + this.staticElementCount;
						if (index != -1) {
							this.elements.splice(index, 1);
							this.deleteCallback?.(index);
						}
						container.remove();
					});

				this.addCallback(container.createDiv());
			});
	}

	setText(value: string) {
		this.label.setText(value);

		return this;
	}

	addStaticElement(constructor: (containerEl: HTMLElement) => void) {
		constructor(this.staticSection.createDiv());
		this.staticElementCount += 1;

		return this;
	}

	addDynamicElement(constructor: (containerEl: HTMLElement) => void) {
		let container = this.dynamicSection.createDiv();
		new ButtonComponent(container)
			.setButtonText('X')
			.onClick(() => {
				let index = this.elements.indexOf(container) + this.staticElementCount;
				if (index != -1) {
					this.elements.splice(index, 1);
					this.deleteCallback?.(index);
				}
				container.remove();
			});

		constructor(container.createDiv());
		this.elements.push(container);
	}

	onAdd(callback: (containerEl: HTMLElement) => void) {
		this.addCallback = callback;

		return this;
	}

	onDelete(callback: (index: number) => void) {
		this.deleteCallback = callback;

		return this;
	}
}

class CheckboxComponent extends BaseComponent {
	inputEl: HTMLInputElement;
	changeCallback?: (value: boolean) => void;

	constructor(containerEl: HTMLElement) {
		super();

		this.inputEl = containerEl.createEl('input', { type: 'checkbox' });
		this.inputEl.onClickEvent(() => {
			this.changeCallback?.(this.inputEl.checked);
		})
	}

	setValue(value: boolean) {
		this.inputEl.checked = value;

		return this;
	}

	onChange(callback: (value: boolean) => void) {
		this.changeCallback = callback;

		return this;
	}
}


