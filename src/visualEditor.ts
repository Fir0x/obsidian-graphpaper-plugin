import { App, BaseComponent, ButtonComponent, DropdownComponent, ExtraButtonComponent, MarkdownView, Modal, stringifyYaml, TextComponent, ToggleComponent } from 'obsidian';
import { AxisOptions, ConstantConfig, defaultPlotOptions, FunctionConfig, PlotConfig, ViewOptions } from './plotConfigParser';

export class VisualEditor extends Modal {
	plotEdit: PlotConfig;

	constructor(app: App, defaults?: PlotConfig) {
		super(app);
		this.setTitle('Graphpaper visual editor');

		if (defaults === undefined) {
			this.plotEdit = {
				type: '2D',
				xMin: -5,
				xMax: 5,
				sampleCountPerAxis: 100,
				functions: [{ name: 'f', def: 'x' }],
				constants: [],
				options: defaultPlotOptions
			};
		} else {
			this.plotEdit = defaults;
		}
	}

	onOpen() {
		const dropdown = new DropdownComponent(this.contentEl)
			.addOptions({
				'2D': '2D',
				'3D': '3D'
			})
			.setValue(this.plotEdit.type);

		let dummyContainer = this.contentEl.createDiv();
		let funcEditorContainer = this.generateFuncEditor(dummyContainer);

		dropdown.onChange((value: string) => {
			this.plotEdit.type = value as typeof this.plotEdit.type;
			if (value === '2D') {
				this.plotEdit.yMin = undefined;
				this.plotEdit.yMax = undefined;
			} else {
				this.plotEdit.yMin = this.plotEdit.yMin ?? -5;
				this.plotEdit.yMax = this.plotEdit.yMax ?? 5;
			}

			funcEditorContainer.remove();
			funcEditorContainer = this.generateFuncEditor(dummyContainer);
		});

		new ButtonComponent(this.contentEl)
			.setClass('graphpaper-vedit-confirm')
			.setButtonText('Confirm')
			.onClick(() => {
				this.writePlotConfig(this.plotEdit);
				this.close();
			});

		// Prevent autofocus of first focuable element.
		// Need a delay because Obsidian focus after onOpen ends.
		window.requestAnimationFrame(() => this.modalEl.focus());
	}

	private generateFuncEditor(containerEl: HTMLElement): HTMLDivElement {
		if (this.plotEdit.type == '2D') {
			return this.generate2DFuncEditor(containerEl);
		}

		return this.generate3DFuncEditor(containerEl);
	}

	private generate2DFuncEditor(containerEl: HTMLElement): HTMLDivElement {
		const rootEl = containerEl.createDiv()
		const generalContainer = rootEl.createDiv({ cls: 'graphpaper-vedit-section' });
		generalContainer.setText('General');
		new LabeledComponent(generalContainer)
			.setLabel('X min:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.xMin).onNumberChange((value: number) => this.plotEdit.xMin = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('X max:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.xMax).onNumberChange((value: number) => this.plotEdit.xMax = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('Sample count:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.sampleCountPerAxis).onNumberChange((value: number) => this.plotEdit.sampleCountPerAxis = value);
			});


		this.generateFunctionDefsEditor(generalContainer);
		this.generateConstantsEditor(rootEl)

		const optionsContainer = rootEl.createDiv({ cls: 'graphpaper-vedit-section' });
		optionsContainer.setText('Options');
		this.generateAxisOptionsEditor(optionsContainer, 'X axis', this.plotEdit.options.view.xAxis);
		this.generateAxisOptionsEditor(optionsContainer, 'Y axis', this.plotEdit.options.view.yAxis);
		this.generateSplitOptionsEditor(optionsContainer, this.plotEdit.options.view);

		return rootEl;
	}

	private generate3DFuncEditor(containerEl: HTMLElement): HTMLDivElement {
		const rootEl = containerEl.createDiv()
		const generalContainer = rootEl.createDiv({ cls: 'graphpaper-vedit-section' });
		generalContainer.setText('General');
		new LabeledComponent(generalContainer)
			.setLabel('X min:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.xMin).onNumberChange((value: number) => this.plotEdit.xMin = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('X max:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.xMax).onNumberChange((value: number) => this.plotEdit.xMax = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('Y min:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.yMin!).onNumberChange((value: number) => this.plotEdit.yMin = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('Y max:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.yMax!).onNumberChange((value: number) => this.plotEdit.yMax = value);
			});

		new LabeledComponent(generalContainer)
			.setLabel('Sample count:')
			.setElement((containerEl: HTMLElement) => {
				return new NumberComponent(containerEl).setNumber(this.plotEdit.sampleCountPerAxis).onNumberChange((value: number) => this.plotEdit.sampleCountPerAxis = value);
			});


		this.generateFunctionDefsEditor(generalContainer);
		this.generateConstantsEditor(rootEl)

		const optionsContainer = rootEl.createDiv({ cls: 'graphpaper-vedit-section' });
		optionsContainer.setText('Options');
		this.generateAxisOptionsEditor(optionsContainer, 'X axis', this.plotEdit.options.view.xAxis);
		this.generateAxisOptionsEditor(optionsContainer, 'Y axis', this.plotEdit.options.view.yAxis);
		this.generateAxisOptionsEditor(optionsContainer, 'Z axis', this.plotEdit.options.view.zAxis);
		this.generateSplitOptionsEditor(optionsContainer, this.plotEdit.options.view);

		return rootEl;
	}

	private generateFunctionDefsEditor(containerEl: HTMLElement) {
		const constructFunctionEdit = (containerEl: HTMLElement, functionDef: FunctionConfig) => {
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

		const functionDefs = new ListComponent(containerEl)
			.setText('Function definitions')
			.addStaticElement((containerEl: HTMLElement) => {
				constructFunctionEdit(containerEl, this.plotEdit.functions[0]!);
			})
			.onAdd((containerEl: HTMLElement) => {
				const defaultNames = ['f', 'g', 'h'];
				const def = { name: defaultNames[this.plotEdit.functions.length % defaultNames.length], def: 'x' } as FunctionConfig;
				this.plotEdit.functions.push(def);

				constructFunctionEdit(containerEl, def);
			})
			.onDelete((index: number) => {
				this.plotEdit.functions.splice(index, 1);
			});

		// Add existing defs to UI
		for (let i = 1; i < this.plotEdit.functions.length; i++) {
			functionDefs.addDynamicElement((containerEl: HTMLElement) => {
				constructFunctionEdit(containerEl, this.plotEdit.functions[i]!);
			});
		}
	}

	private generateConstantsEditor(containerEl: HTMLElement) {
		const rootEl = containerEl.createDiv({ cls: 'graphpaper-vedit-section' });
		rootEl.setText('Constants');
		const constructConstantEdit = (containerEl: HTMLElement, constant: ConstantConfig) => {
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

			const toggle = new LabeledComponent<ToggleComponent>(containerEl)
				.setLabel('Dynamic mode:')
				.setElement((containerEl: HTMLElement) => {
					return new ToggleComponent(containerEl).setValue(constant.range != undefined);
				})
				.element!;

			const dynamicEdit = containerEl.createDiv();
			const constantRange = constant.range ?? { min: -5, max: 5, step: 0.1 };
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

			toggle.onChange((value: boolean) => {
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

		const constantDefs = new ListComponent(rootEl)
			.onAdd((containerEl: HTMLElement) => {
				const defaultNames = ['a', 'b', 'c', 'd'];
				const constant = { name: defaultNames[this.plotEdit.constants.length % defaultNames.length], value: 0 } as ConstantConfig;
				this.plotEdit.constants.push(constant);
				constructConstantEdit(containerEl, constant);
			})
			.onDelete((index: number) => this.plotEdit.constants.splice(index, 1));

		// Add existing constants to UI
		for (let i = 0; i < this.plotEdit.constants.length; i++) {
			constantDefs.addDynamicElement((containerEl: HTMLElement) => {
				const constant = this.plotEdit.constants[i]!;
				constructConstantEdit(containerEl, constant);
			});
		}
	}

	private generateAxisOptionsEditor(containerEl: HTMLElement, name: string, config: AxisOptions) {
		const axisOptionsContainer = containerEl.createDiv({ cls: 'graphpaper-vedit-subsection' });
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
				return new ToggleComponent(containerEl).setValue(config.disableZoom).onChange((value: boolean) => config.disableZoom = value);
			});
		new LabeledComponent(axisOptionsContainer)
			.setLabel('Autorange:')
			.setElement((containerEl: HTMLElement) => {
				return new ToggleComponent(containerEl).setValue(config.autoRange).onChange((value: boolean) => config.autoRange = value);
			});
	}

	private generateSplitOptionsEditor(containerEl: HTMLElement, config: ViewOptions) {
		const confUsesCustomSplit = Array.isArray(config.splitPlots);
		const splitTypeSelector = new LabeledComponent<DropdownComponent>(containerEl)
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

		const customSplitValues: [number, number] = confUsesCustomSplit ? config.splitPlots as [number, number] : [0, 0];
		const customSplitContainer = containerEl.createDiv();
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
		const { functions, constants, options, sampleCountPerAxis, ...general } = plotConfig;
		const sortedPlotConfig = {
			...general,
			sampleCountPerAxis,
			functions,
			constants,
			options
		};
		const yaml = `\`\`\`graphpaper\n${stringifyYaml(sortedPlotConfig)}\`\`\`\n`;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			return;
		}

		view.editor.replaceSelection(yaml);
	}
}

class LabeledComponent<T> extends BaseComponent {
	rootEl: HTMLElement;
	label: HTMLElement;
	element?: T;

	constructor(containerEl: HTMLElement) {
		super();

		this.rootEl = containerEl.createDiv({ cls: 'graphpaper-vedit-label-container' });
		this.label = this.rootEl.createSpan({ cls: 'graphpaper-vedit-label' });
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
			const numberValue = Number(value);
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
	dynamicElements: HTMLElement[];
	addCallback?: (containerEl: HTMLElement) => void;
	deleteCallback?: (index: number) => void;

	constructor(containerEl: HTMLElement) {
		super();

		this.rootEl = containerEl.createDiv();
		this.label = this.rootEl.createSpan({ cls: 'graphpaper-vedit-label' });

		const listsContainer = this.rootEl.createDiv({ cls: 'graphpaper-vedit-list' });
		this.staticSection = listsContainer.createDiv({ cls: 'graphpaper-vedit-list' });
		this.staticElementCount = 0;
		this.dynamicSection = listsContainer.createDiv({ cls: 'graphpaper-vedit-list' });
		listsContainer.createDiv();
		this.dynamicElements = [];
		const addButton = new ButtonComponent(this.rootEl)
			.setClass('graphpaper-vedit-list-add')
			.setIcon('plus')
			.onClick(() => {
				if (this.addCallback == null) {
					return;
				}

				const container = this.createDynamicElementSlot();
				this.addCallback(container);
			});
		addButton.buttonEl.createSpan({ text: 'Add' });
	}

	setText(value: string) {
		this.label.setText(value);

		return this;
	}

	addStaticElement(constructor: (containerEl: HTMLElement) => void) {
		const row = this.staticSection.createDiv({ cls: 'graphpaper-vedit-list-row' });
		constructor(row.createDiv({ cls: 'graphpaper-vedit-list-content' }));
		this.staticElementCount += 1;

		return this;
	}

	addDynamicElement(constructor: (containerEl: HTMLElement) => void) {
		const container = this.createDynamicElementSlot();
		constructor(container);
	}

	private createDynamicElementSlot(): HTMLElement {
		const container = this.dynamicSection.createDiv({ cls: 'graphpaper-vedit-list-row' });
		const deleteButton = new ExtraButtonComponent(container)
			.setIcon('x')
			.onClick(() => {
				const index = this.dynamicElements.indexOf(container) + this.staticElementCount;
				if (index != -1) {
					this.dynamicElements.splice(index, 1);
					this.deleteCallback?.(index);
				}
				container.remove();
			});

		deleteButton.extraSettingsEl.addClass('graphpaper-vedit-list-delete');

		this.dynamicElements.push(container);

		return container.createDiv({ cls: 'graphpaper-vedit-list-content' });
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

