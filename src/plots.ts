import * as Plotly from 'plotly.js-dist-min';
import { PlotConfig } from './plotConfigParser';
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
		let layoutUpdate: Partial<Plotly.Layout> = {};
		if (this.config.options.view.splitPlots == 'auto') {
			layoutUpdate.grid = {};
			const funcCount = this.config.functions.length;
			layoutUpdate.grid.columns = Math.min(funcCount, this.pluginSettings.splitPlotAutoMaxColumns);
			layoutUpdate.grid.rows = Math.ceil(funcCount / layoutUpdate.grid.columns);
		}

		Plotly.update(this.container, {
			line: {
				dash: this.pluginSettings.curveLineType
			}
		}, layoutUpdate);
	}

	protected generatePlotlyInfos(): [Plotly.Data[], Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		const values = this.generateFunctionsData();
		let plotlyData: Plotly.Data[] = [];
		const [xValues, yValuesPerFunc] = values;
		for (let i = 0; i < yValuesPerFunc.length; ++i) {
			const yValues = yValuesPerFunc[i];
			const functionConfig = this.config.functions[i]!;
			const axisIndex = this.config.options.view.splitPlots == 'no' ? 1 : i + 1;
			plotlyData.push({
				x: xValues,
				y: yValues,
				xaxis: axisIndex == 1 ? 'x' : `x${axisIndex}`,
				yaxis: axisIndex == 1 ? 'y' : `y${axisIndex}`,
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

		this.viewConfigToPlotly(plotlyLayout, xValues, yValuesPerFunc);

		return [plotlyLayout, plotlyConfig];
	}

	private viewConfigToPlotly(plotlyLayout: Partial<Plotly.Layout>, xValues: number[], yValuesPerFunc: number[][]) {
		let viewConfig = this.config.options.view;
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

		if (viewConfig.splitPlots != 'no') {
			plotlyLayout.grid = {};
			if (viewConfig.splitPlots == 'auto') {
				let funcCount = this.config.functions.length;
				plotlyLayout.grid.columns = Math.min(funcCount, this.pluginSettings.splitPlotAutoMaxColumns);
				plotlyLayout.grid.rows = Math.ceil(funcCount / plotlyLayout.grid.columns);
			} else {
				plotlyLayout.grid.columns = viewConfig.splitPlots[0];
				plotlyLayout.grid.rows = viewConfig.splitPlots[1];
			}
			plotlyLayout.grid.pattern = 'independent';
		}
	}
}

export class PlotTwoVar extends Plot {
	updateConstant(name: string, value: number) {
		const [xValues, yValues, zValuesPerFunc] = this.generateFunctionsData([{ name, value }]);
		this.updatePlotValues(xValues, yValues, zValuesPerFunc);
	}

	updateRender(): void {
		if (this.config.options.view.splitPlots != 'auto') {
			return;
		}

		let layoutUpdate: Partial<Plotly.Layout> = {};
		const sceneCount = this.config.functions.length;
		const funcCount = this.config.functions.length;
		const columns = Math.min(funcCount, this.pluginSettings.splitPlotAutoMaxColumns);
		const rows = Math.ceil(funcCount / columns);

		const cellWidth = 1.0 / columns;
		const cellHeight = 1.0 / rows;
		const barStripWidth = 0.1;
		const plotWidth = cellWidth - barStripWidth;

		for (let i = 0; i < sceneCount; ++i) {
			const rowIdx = Math.floor(i / columns);
			const columnIdx = i % columns;
			const x0 = columnIdx * cellWidth;
			const y0 = 1 - (rowIdx + 1) * cellHeight;

			const sceneId: any = i == 0 ? 'scene' : `scene${i + 1}`;
			layoutUpdate[sceneId] = {};
			const scene = layoutUpdate[sceneId]! as Plotly.Scene;
			scene.domain = {
				x: [x0, x0 + plotWidth],
				y: [y0, y0 + cellHeight],
			}

			{
				const coloraxisId: any = i == 0 ? 'coloraxis' : `coloraxis${i + 1}`;
				layoutUpdate[coloraxisId] = {
					colorscale: 'Jet',
					colorbar: {
						x: x0 + plotWidth,
						y: y0 + cellHeight / 2.0,
						len: cellHeight,
					}
				}
			}
		}

		Plotly.update(this.container, {}, layoutUpdate);
	}

	protected generatePlotlyInfos(): [Plotly.Data[], Partial<Plotly.Layout>, Partial<Plotly.Config>] {
		const values = this.generateFunctionsData();
		let plotlyData: Plotly.Data[] = [];
		const [xValues, yValues, zValuesPerFunc] = values;

		for (let i = 0; i < zValuesPerFunc.length; ++i) {
			const zValues = zValuesPerFunc[i];
			const functionConfig = this.config.functions[i]!;
			const sceneIndex = this.config.options.view.splitPlots == 'no' ? 1 : i + 1;

			plotlyData.push({
				x: xValues,
				y: yValues,
				z: zValues,
				type: 'surface',
				name: functionConfig.name,
				scene: sceneIndex == 1 ? 'scene' : `scene${sceneIndex}`,
				coloraxis: sceneIndex == 1 ? 'coloraxis' : `coloraxis${sceneIndex}`,
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

		let viewConfig = this.config.options.view;
		let plotlyConfig: Partial<Plotly.Config> = {
			responsive: true,
			scrollZoom: !(viewConfig.xAxis.disableZoom || viewConfig.yAxis.disableZoom || viewConfig.zAxis.disableZoom),
		};

		this.viewConfigToPlotly(plotlyLayout, xValues, yValues, zValuesPerFunc);

		return [plotlyLayout, plotlyConfig];
	}

	private viewConfigToPlotly(plotlyLayout: Partial<Plotly.Layout>, xValues: number[], yValues: number[], zValuesPerFunc: number[][][]) {
		let viewConfig = this.config.options.view;
		const sceneCount = viewConfig.splitPlots == 'no' ? 1 : this.config.functions.length;
		let rows = 1;
		let columns = 1;
		if (this.config.options.view.splitPlots != 'no') {
			if (this.config.options.view.splitPlots == 'auto') {
				const funcCount = this.config.functions.length;
				columns = Math.min(funcCount, this.pluginSettings.splitPlotAutoMaxColumns);
				rows = Math.ceil(funcCount / columns);
			} else {
				rows = this.config.options.view.splitPlots[0];
				columns = this.config.options.view.splitPlots[1];
			}
		}
		const cellWidth = 1.0 / columns;
		const cellHeight = 1.0 / rows;
		const barStripWidth = 0.1;
		const plotWidth = cellWidth - barStripWidth;

		for (let i = 0; i < sceneCount; ++i) {
			const rowIdx = Math.floor(i / columns);
			const columnIdx = i % columns;
			const x0 = columnIdx * cellWidth;
			const y0 = 1 - (rowIdx + 1) * cellHeight;

			const sceneId: any = i == 0 ? 'scene' : `scene${i + 1}`;
			plotlyLayout[sceneId] = {};
			const scene = plotlyLayout[sceneId]! as Plotly.Scene;
			scene.domain = {
				x: [x0, x0 + plotWidth],
				y: [y0, y0 + cellHeight],
			}

			{
				scene.xaxis = {}
				const xAxisConfig = viewConfig.xAxis;

				const xMin = xAxisConfig.autoRange
					? xAxisConfig.min ?? xValues.reduce((min, value) => value < min ? value : min)
					: xAxisConfig.min
				const xMax = xAxisConfig.autoRange
					? xAxisConfig.max ?? xValues.reduce((max, value) => value > max ? value : max)
					: xAxisConfig.max;

				scene.xaxis.range = [xMin, xMax];
			}

			{
				const yAxisConfig = viewConfig.yAxis;
				scene.yaxis = {}

				const yMin = yAxisConfig.autoRange
					? yAxisConfig.min ?? yValues.reduce((min, value) => value < min ? value : min)
					: yAxisConfig.min
				const yMax = yAxisConfig.autoRange
					? yAxisConfig.max ?? yValues.reduce((max, value) => value > max ? value : max)
					: yAxisConfig.max;

				scene.yaxis.range = [yMin, yMax];
			}

			{
				const zAxisConfig = viewConfig.zAxis;
				scene.zaxis = {}


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

				scene.zaxis.range = [zMin, zMax];
			}

			{
				const coloraxisId: any = i == 0 ? 'coloraxis' : `coloraxis${i + 1}`;
				plotlyLayout[coloraxisId] = {
					colorscale: 'Jet',
					colorbar: {
						x: x0 + plotWidth,
						xanchor: 'left',
						y: y0 + cellHeight / 2.0,
						yanchor: 'middle',
						len: cellHeight,
						lenmode: 'fraction'
					}
				}
			}
		}
	}
}

