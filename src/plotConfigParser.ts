import { parseYaml } from 'obsidian';
import { z } from 'zod';

const functionConfigSchema = z.array(z.strictObject({
	name: z.string(),
	def: z.coerce.string()
})).or(z.coerce.string());

const plotConfigSchema = z.strictObject({
	xMin: z.number(),
	xMax: z.number(),
	sampleCount: z.number(),
	functions: functionConfigSchema,
	options: z.strictObject({
		view: z.strictObject({
			xMin: z.number().optional(),
			xMax: z.number().optional(),
			yMin: z.number().optional(),
			yMax: z.number().optional(),
		}).optional(),
	}).optional(),
});

export type FunctionConfig = {
	name: string,
	def: string
}

export type PlotConfig = {
	xMin: number,
	xMax: number,
	sampleCount: number,
	functions: FunctionConfig[],
	options?: {
		view?: {
			xMin?: number,
			xMax?: number,
			yMin?: number,
			yMax?: number,
		},
	}
}

export function parsePlotConfig(source: string) {
	const yaml = parseYaml(source);

	const zodResult = plotConfigSchema.safeParse(yaml);
	if (!zodResult.success) {
		const msg = zodResult.error.issues
			.map(issue => `'${issue.path.join('.')}': ${issue.message}`)
			.join('\n');
		throw new SyntaxError(msg);
	}

	let { functions, ...rest } = zodResult.data;
	if (typeof functions == 'string') {
		functions = [{ name: 'f', def: functions }]
	}
	return {
		functions,
		...rest
	} as PlotConfig;
}
