import { NumberValue, parseYaml } from 'obsidian';
import { boolean, z } from 'zod';

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
	zAxis: AxisOptions,
	splitPlots: 'no' | 'auto' | [number, number],
}

export type PlotOptions = {
	view: ViewOptions,
}

export type PlotConfig = {
	type: '2D' | '3D',
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
		zAxis: defaultAxisOptions,
		splitPlots: 'no',
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
		zAxis: plotAxisConfigSchema.default(defaultPlotOptions.view.zAxis),
		splitPlots: z.union([
			z.enum(['no', 'auto']),
			z.string()
				.regex(/^\d+:\d+$/)
				.transform((value) => { const match = /^(\d+):(\d+)$/.exec(value)!; return [Number(match[1]), Number(match[2])] })
				.pipe(z.tuple([z.int().nonnegative(), z.int().nonnegative()])),
		]).default('no'),
	}).default(defaultPlotOptions.view),
});

const plotTypeEnum = z.enum(['2D', '3D'])

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
		type: plotTypeEnum.extract(['2D']),
		...plotConfigCommonSchema
	}),
	z.strictObject({
		type: plotTypeEnum.extract(['3D']),
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

	if (type == '2D') {
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
