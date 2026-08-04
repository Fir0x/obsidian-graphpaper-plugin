import { parseYaml } from 'obsidian';
import { z } from 'zod';

const plotInfoSchema = z.strictObject({
	xMin: z.number(),
	xMax: z.number(),
	sampleCount: z.number(),
	function: z.coerce.string(),
	options: z.strictObject({
		view: z.strictObject({
			xMin: z.number().optional(),
			xMax: z.number().optional(),
			yMin: z.number().optional(),
			yMax: z.number().optional(),
		}).optional(),
	}).optional(),
});

export type PlotConfig = {
	xMin: number,
	xMax: number,
	sampleCount: number,
	mathFunc: string,
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

	const zodResult = plotInfoSchema.safeParse(yaml);
	if (!zodResult.success) {
		const msg = zodResult.error.issues
			.map(issue => `'${issue.path.join('.')}': ${issue.message}`)
			.join('\n');
		throw new SyntaxError(msg);
	}

	const { function: mathFunc, ...rest } = zodResult.data;
	return {
		...rest,
		mathFunc
	} as PlotConfig;
}
