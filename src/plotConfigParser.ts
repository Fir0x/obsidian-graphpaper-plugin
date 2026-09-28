import { parseYaml } from 'obsidian';
import { z } from 'zod';

export class ConfigError extends SyntaxError {
	constructor(message: string) {
		super(message);
	}
}

export type FunctionConfig = {
	name: string,
	def: string
}

export type ConstantConfig = {
	name: string,
	value: number,
	range?: {
		min: number,
		max: number,
		step: number
	}
}

export type AxisOptions = {
	min: number | null,
	max: number | null,
	disableZoom: boolean,
	autoRange: boolean
}

export type ViewOptions = {
	xAxis: AxisOptions,
	yAxis: AxisOptions,
}

export type PlotOptions = {
	view: ViewOptions,
}

export type PlotConfig = {
	type: '1D' | '2D',
	xMin: number,
	xMax: number,
	yMin: number,
	yMax: number,
	sampleCountPerAxis: number,
	functions: FunctionConfig[],
	constants: ConstantConfig[],
	options: PlotOptions,
}

const defaultAxisOptions: AxisOptions = {
	min: null,
	max: null,
	disableZoom: false,
	autoRange: true,
};

const defaultPlotOptions: PlotOptions = {
	view: {
		xAxis: defaultAxisOptions,
		yAxis: defaultAxisOptions,
	}
}

const functionConfigSchema = z.array(z.strictObject({
	name: z.string(),
	def: z.coerce.string()
})).or(z.coerce.string());

const constantConfigSchema = z.array(z.strictObject({
	name: z.string(),
	value: z.number(),
	range: z.strictObject({
		min: z.number(),
		max: z.number(),
		step: z.number()
	}).optional()
}));

const plotAxisConfigSchema = z.strictObject({
	min: z.number().nullable().default(defaultAxisOptions.min),
	max: z.number().nullable().default(defaultAxisOptions.max),
	disableZoom: z.boolean().default(defaultAxisOptions.disableZoom),
	autoRange: z.boolean().default(defaultAxisOptions.autoRange),
});

const plotOptionsSchema = z.strictObject({
	view: z.strictObject({
		xAxis: plotAxisConfigSchema.default(defaultPlotOptions.view.xAxis),
		yAxis: plotAxisConfigSchema.default(defaultPlotOptions.view.yAxis),
	}).default(defaultPlotOptions.view),
});

const plotTypeEnum = z.enum(['1D', '2D'])

const plotConfigCommonSchema = {
	xMin: z.number(),
	xMax: z.number(),
	sampleCountPerAxis: z.number(),
	functions: functionConfigSchema,
	constants: constantConfigSchema.optional(),
	options: plotOptionsSchema.default(defaultPlotOptions),
};

const plotConfigSchema = z.discriminatedUnion('type', [
	z.strictObject({
		type: plotTypeEnum.extract(['1D']),
		...plotConfigCommonSchema
	}),
	z.strictObject({
		type: plotTypeEnum.extract(['2D']),
		yMin: z.number(),
		yMax: z.number(),
		...plotConfigCommonSchema
	}),
]);

export function parsePlotConfig(source: string) {
	const yaml = parseYaml(source);

	const zodResult = plotConfigSchema.safeParse(yaml);
	if (!zodResult.success) {
		const msg = zodResult.error.issues
			.map(issue => `'${issue.path.join('.')}': ${issue.message}`)
			.join('\n');
		throw new ConfigError(msg);
	}

	let { functions, type, ...rest } = zodResult.data;
	if (typeof functions == 'string') {
		functions = [{ name: 'f', def: functions }];
	}

	if (type == '1D') {
		return {
			type,
			yMin: 0,
			yMax: 0,
			functions,
			...rest
		} as PlotConfig
	}

	return {
		functions,
		...rest
	} as PlotConfig;
}
