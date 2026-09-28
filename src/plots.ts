import * as Plotly from 'plotly.js-dist-min';
import { PlotConfig, ViewOptions } from './plotConfigParser';
import { ConstantDef, MathInterpreterOneVar, MathInterpreterTwoVar } from './mathInterpreter';
import { GraphpaperPluginSettings } from './settings';

export abstract class Plot {
	protected container: HTMLDivElement;
	protected config: PlotConfig;
	protected pluginSettings: GraphpaperPluginSettings;
	// Needed because of a Plotly bug in their autorange system on update/react (see isssue #7024)
	protected plotlyLayout: Partial<Plotly.Layout>;

	constructor(container: HTMLDivElement, config: PlotConfig, pluginSettings: GraphpaperPluginSettings) {
		this.container = container;
		this.config = config;
		this.pluginSettings = pluginSettings;

		const [plotlyData, plotlyLayout, plotlyConfig] = this.generatePlotlyInfos();
		this.plotlyLayout = plotlyLayout;

		Plotly.newPlot(container, plotlyData, structuredClone(plotlyLayout), plotlyConfig);
	};

	getContainer(): HTMLDivElement {
		return this.container;
	}

	abstract updateConstant(name: string, value: number): void;
	abstract updateRender(): void;

	release(): void {
		Plotly.purge(this.container);
	}

	protected abstract generatePlotlyInfos(): [Plotly.Data[], Partial<Plotly.Layout>, Partial<Plotly.Config>];
}

export class PlotOneVar extends Plot {
	updateConstant(name: string, value: number) {
		const [xValues, yValuesPerFunc] = this.generateFunctionsData([{ name, value }]);
		this.updatePlotValues(xValues, yValuesPerFunc);
	}

	updateRender(): void {
		Plotly.update(this.container, {
			line: {
				dash: this.pluginSettings.curveLineType
			}
		}, {});
	}

	protected generatePlotlyInfos(): [Plotly.Data[], Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		const values = this.generateFunctionsData();
		let plotlyData: Plotly.Data[] = [];
		const [xValues, yValuesPerFunc] = values;
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i];
			const functionConfig = this.config.functions[i]!;
			plotlyData.push({
				x: xValues,
				y: yValues,
				type: 'scatter',
				mode: 'lines',
				name: functionConfig.name,
				line: {
					dash: this.pluginSettings.curveLineType,
				}
			});
		}

		const [plotlyLayout, plotlyConfig] = this.plotlySettingsFromConfig(xValues, yValuesPerFunc);

		return [plotlyData, plotlyLayout, plotlyConfig];
	}

	private generateFunctionsData(constantOverrides?: ConstantDef[]): [number[], number[][]] {
		const xSampleOffset = Math.max(1e-10, (this.config.xMax - this.config.xMin) / this.config.sampleCountPerAxis);
		const xValues = Array.from({ length: this.config.sampleCountPerAxis + 1 }, (_, i) => this.config.xMin + i * xSampleOffset);

		let constants: ConstantDef[] = [];
		if (this.config.constants) {
			for (const constantConfig of this.config.constants) {
				const constantOverride = constantOverrides?.find((value) => value.name === constantConfig.name);
				if (constantOverride) {
					constants.push({ name: constantConfig.name, value: constantOverride.value });
				} else {
					constants.push({ name: constantConfig.name, value: constantConfig.value });
				}
			}
		}

		let interpreter = new MathInterpreterOneVar(constants);
		let yValuesPerFunc = []
		for (const expr of this.config.functions) {
			yValuesPerFunc.push(interpreter.interpret(expr, xValues));
		}

		return [xValues, yValuesPerFunc];
	}

	private updatePlotValues(xValues: number[], yValuesPerFunc: number[][]) {
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i]!;
			Plotly.update(this.container, {
				x: [xValues],
				y: [yValues],
			}, structuredClone(this.plotlyLayout), i);
		}
	}

	private plotlySettingsFromConfig(xValues: number[], yValuesPerFunc: number[][]): [Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		let plotlyLayout: Partial<Plotly.Layout> = {
			margin: { t: 20 },
		};

		let plotlyConfig: Partial<Plotly.Config> = {
			responsive: true,
		};

		this.viewConfigToPlotly(this.config.options.view, plotlyLayout, xValues, yValuesPerFunc);

		return [plotlyLayout, plotlyConfig];
	}

	private viewConfigToPlotly(viewConfig: ViewOptions, plotlyLayout: Partial<Plotly.Layout>, xValues: number[], yValuesPerFunc: number[][]) {
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
}

export class PlotTwoVar extends Plot {
	updateConstant(name: string, value: number) {
		const [xValues, yValues, zValuesPerFunc] = this.generateFunctionsData([{ name, value }]);
		this.updatePlotValues(xValues, yValues, zValuesPerFunc);
	}

	updateRender(): void {
	}

	protected generatePlotlyInfos(): [Plotly.Data[], Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		const values = this.generateFunctionsData();
		let plotlyData: Plotly.Data[] = [];
		const [xValues, yValues, zValuesPerFunc] = values;
		for (let i = 0; i < zValuesPerFunc.length; ++i) {
			const zValues = zValuesPerFunc[i];
			const functionConfig = this.config.functions[i]!;
			plotlyData.push({
				x: xValues,
				y: yValues,
				z: zValues,
				type: 'surface',
				name: functionConfig.name,
			});
		}

		const [plotlyLayout, plotlyConfig] = this.plotlySettingsFromConfig(xValues, yValues, zValuesPerFunc);

		return [plotlyData, plotlyLayout, plotlyConfig];
	}

	private generateFunctionsData(constantOverrides?: ConstantDef[]): [number[], number[], number[][][]] {
		const xSampleOffset = Math.max(1e-10, (this.config.xMax - this.config.xMin) / this.config.sampleCountPerAxis);
		const xValues = Array.from({ length: this.config.sampleCountPerAxis + 1 }, (_, i) => this.config.xMin + i * xSampleOffset);
		const ySampleOffset = Math.max(1e-10, (this.config.yMax - this.config.yMin) / this.config.sampleCountPerAxis);
		const yValues = Array.from({ length: this.config.sampleCountPerAxis + 1 }, (_, i) => this.config.yMin + i * ySampleOffset);

		let constants: ConstantDef[] = [];
		if (this.config.constants) {
			for (const constantConfig of this.config.constants) {
				const constantOverride = constantOverrides?.find((value) => value.name === constantConfig.name);
				if (constantOverride) {
					constants.push({ name: constantConfig.name, value: constantOverride.value });
				} else {
					constants.push({ name: constantConfig.name, value: constantConfig.value });
				}
			}
		}

		let interpreter = new MathInterpreterTwoVar(constants);
		let zValuesPerFunc = []
		for (const expr of this.config.functions) {
			zValuesPerFunc.push(interpreter.interpret(expr, xValues, yValues));
		}

		return [xValues, yValues, zValuesPerFunc];
	}

	private updatePlotValues(xValues: number[], yValues: number[], zValuesPerFunc: number[][][]) {
		for (let i = 0; i < zValuesPerFunc.length; ++i) {
			const zValues = zValuesPerFunc[i]!;
			Plotly.update(this.container, {
				x: [xValues],
				y: [yValues],
				z: zValues
			}, structuredClone(this.plotlyLayout), i);
		}
	}

	private plotlySettingsFromConfig(xValues: number[], yValues: number[], zValuesPerFunc: number[][][]): [Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		let plotlyLayout: Partial<Plotly.Layout> = {
			margin: { t: 20 },
		};

		let plotlyConfig: Partial<Plotly.Config> = {
			responsive: true,
		};

		this.viewConfigToPlotly(this.config.options.view, plotlyLayout, xValues, yValues, zValuesPerFunc);

		return [plotlyLayout, plotlyConfig];
	}

	private viewConfigToPlotly(viewConfig: ViewOptions, plotlyLayout: Partial<Plotly.Layout>, xValues: number[], yValues: number[], zValuesPerFunc: number[][][]) {
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

			const yMin = yAxisConfig.autoRange
				? yAxisConfig.min ?? yValues.reduce((min, value) => value < min ? value : min)
				: yAxisConfig.min
			const yMax = yAxisConfig.autoRange
				? yAxisConfig.max ?? yValues.reduce((max, value) => value > max ? value : max)
				: yAxisConfig.max;

			plotlyAxis.range = [yMin, yMax];

			if (yAxisConfig.disableZoom) {
				plotlyAxis.fixedrange = true;
			}

			plotlyLayout.xaxis = plotlyAxis;
		}

		{
			const zAxisConfig = viewConfig.yAxis;
			let plotlzAxis: Partial<Plotly.LayoutAxis> = {};


			let zMin: number | null = Infinity;
			let zMax: number | null = -Infinity;
			if (zAxisConfig.autoRange) {
				zMin = zAxisConfig.min;
				zMax = zAxisConfig.max;
			} else {
				let min = Infinity;
				let max = -Infinity;
				for (let i = 0; i < zValuesPerFunc.length; ++i) {
					for (let j = 0; j < zValuesPerFunc[i]!.length; ++j) {
						for (let k = 0; k < zValuesPerFunc[i]![j]!.length; ++k) {
							min = Math.min(zValuesPerFunc[i]![j]![k]!, min);
							max = Math.max(zValuesPerFunc[i]![j]![k]!, min);
						}
					}
				}

				zMin = zAxisConfig.min ?? min;
				zMax = zAxisConfig.max ?? max;
			}

			plotlzAxis.range = [zMin, zMax];

			if (zAxisConfig.disableZoom) {
				plotlzAxis.fixedrange = true;
			}

			plotlyLayout.yaxis = plotlzAxis;
		}
	}
}

