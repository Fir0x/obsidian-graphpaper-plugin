import { lexMathExpr } from './mathLexer';
import * as Parser from './mathParser';
import { FunctionConfig } from './plotConfigParser';

export class InterpreterError extends SyntaxError {
	constructor(message: string) {
		super(message);
	}
}

export type ConstantDef = {
	name: string,
	value: number
}

const reservedValueIdentifiersMap = new Map<string, number>();
reservedValueIdentifiersMap.set('e', Math.E);
reservedValueIdentifiersMap.set('pi', Math.PI);

const reservedCallIdentifiersMap = new Map<string, (...x: number[]) => number>();
reservedCallIdentifiersMap.set('sqrt', Math.sqrt);
reservedCallIdentifiersMap.set('log', Math.log);
reservedCallIdentifiersMap.set('cos', Math.cos);
reservedCallIdentifiersMap.set('acos', Math.acos);
reservedCallIdentifiersMap.set('sin', Math.sin);
reservedCallIdentifiersMap.set('asin', Math.asin);
reservedCallIdentifiersMap.set('tan', Math.tan);
reservedCallIdentifiersMap.set('atan', Math.atan);

class MathInterpreter {
	constants: Map<string, number>;
	currentExpr?: FunctionConfig;

	constructor(constants: ConstantDef[]) {
		this.constants = new Map<string, number>();
		if (constants) {
			for (let constant of constants) {
				if (this.constants.has(constant.name)) {
					throw new InterpreterError(`Constant with name '${constant.name}' already exists. Constants must have a unique name.`);
				} else if (reservedValueIdentifiersMap.has(constant.name) || ['x', 'y'].contains(constant.name)) {
					throw new InterpreterError(`Constant cannot have reserved name '${constant.name}'.`)
				} else {
					this.constants.set(constant.name, constant.value);
				}
			}
		}
	}

	protected evaluateAst(node: Parser.AstNode): number {
		switch (node.type) {
			case Parser.AstNodeType.Literal:
				return node.value;
			case Parser.AstNodeType.Identifier:
				return this.resolveValueIdentifier(node.name)!;
			case Parser.AstNodeType.Call:
				let evaluatedArgs: number[] = [];
				for (const argNode of node.args) {
					evaluatedArgs.push(this.evaluateAst(argNode));
				}

				return this.resolveCallIdentifier(node.identifier)(...evaluatedArgs);
			case Parser.AstNodeType.BinaryOp: {
				const left = this.evaluateAst(node.left);
				const right = this.evaluateAst(node.right);
				switch (node.opType) {
					case Parser.BinaryOp.Add: return left + right;
					case Parser.BinaryOp.Subtract: return left - right;
					case Parser.BinaryOp.Multiply: return left * right;
					case Parser.BinaryOp.Divide: return left / right;
					case Parser.BinaryOp.Power: return Math.pow(left, right);
				}
			}
			case Parser.AstNodeType.UnaryOp: {
				const right = this.evaluateAst(node.right);
				switch (node.opType) {
					case Parser.UnaryOp.Negate: return -right;
				}
			}
		}
	}

	protected resolveValueIdentifier(identifier: string): number {
		if (reservedValueIdentifiersMap.has(identifier)) {
			return reservedValueIdentifiersMap.get(identifier)!;
		}

		if (this.constants.has(identifier)) {
			return this.constants.get(identifier)!;
		}

		throw new InterpreterError(`Unknown identifier '${identifier}' in function '${this.currentExpr!.name}'.`);
	}

	protected resolveCallIdentifier(identifier: string): (...x: number[]) => number {
		if (reservedCallIdentifiersMap.has(identifier)) {
			return reservedCallIdentifiersMap.get(identifier)!;
		}

		throw new InterpreterError(`Unknown identifier '${identifier}' in function '${this.currentExpr!.name}'.`);
	}
}

export class MathInterpreterOneVar extends MathInterpreter {
	currentX?: number;

	interpret(expr: FunctionConfig, xValues: number[]): number[] {
		this.currentExpr = expr;

		let tokens = lexMathExpr(expr.def);
		let parser = new Parser.MathParser(tokens);
		const root = parser.parse();

		let results = [];
		for (const x of xValues) {
			this.constants.set('x', x);
			results.push(this.evaluateAst(root));
		}

		return results;
	}
}

export class MathInterpreterTwoVar extends MathInterpreter {
	currentX?: number;
	currentY?: number;

	interpret(expr: FunctionConfig, xValues: number[], yValues: number[]): number[][] {
		this.currentExpr = expr;

		let tokens = lexMathExpr(expr.def);
		let parser = new Parser.MathParser(tokens);
		const root = parser.parse();

		let results = [];
		for (const x of xValues) {
			let tmp = []
			for (const y of yValues) {
				this.constants.set('x', x);
				this.constants.set('y', y);
				tmp.push(this.evaluateAst(root));
			}
			results.push(tmp)
		}

		return results;
	}
}

