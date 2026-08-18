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

export class MathInterpreter {
	constants: ConstantDef[];
	currentExpr?: FunctionConfig;

	constructor(constants: ConstantDef[]) {
		if (constants) {
			let constantNames = new Set<string>();
			for (let constant of constants) {
				if (constantNames.has(constant.name)) {
					throw new InterpreterError(`Constant with name '${constant.name}' already exists. Constants must have a unique name.`);
				} else if (['x', 'e', 'pi'].includes(constant.name)) {
					throw new InterpreterError(`Constant cannot have reserved name '${constant.name}'.`)
				} else {
					constantNames.add(constant.name);
				}
			}
		}

		this.constants = constants;
	}

	interpret(expr: FunctionConfig, xValues: number[]) {
		this.currentExpr = expr;

		let tokens = lexMathExpr(expr.def);
		let parser = new Parser.MathParser(tokens);
		const root = parser.parse();

		let results = [];
		for (const x of xValues) {
			results.push(this.evaluateAst(root, x));
		}

		return results;
	}

	private evaluateAst(node: Parser.AstNode, x: number): number {
		switch (node.type) {
			case Parser.AstNodeType.Literal:
				return node.value;
			case Parser.AstNodeType.Identifier:
				return this.resolveValueIdentifier(node.name, x)!;
			case Parser.AstNodeType.Call:
				let evaluatedArgs: number[] = [];
				for (const argNode of node.args) {
					evaluatedArgs.push(this.evaluateAst(argNode, x));
				}

				return this.resolveCallIdentifier(node.identifier)(...evaluatedArgs);
			case Parser.AstNodeType.BinaryOp: {
				const left = this.evaluateAst(node.left, x);
				const right = this.evaluateAst(node.right, x);
				switch (node.opType) {
					case Parser.BinaryOp.Add: return left + right;
					case Parser.BinaryOp.Subtract: return left - right;
					case Parser.BinaryOp.Multiply: return left * right;
					case Parser.BinaryOp.Divide: return left / right;
					case Parser.BinaryOp.Power: return Math.pow(left, right);
				}
			}
			case Parser.AstNodeType.UnaryOp: {
				const right = this.evaluateAst(node.right, x);
				switch (node.opType) {
					case Parser.UnaryOp.Negate: return -right;
				}
			}
		}
	}

	private resolveValueIdentifier(identifier: string, x: number) {
		switch (identifier) {
			case 'x': return x;
			case 'e': return Math.E;
			case 'pi': return Math.PI;
			default:
				const constant = this.constants.find((constant) => constant.name === identifier);
				if (constant) {
					return constant.value;
				}

				throw new InterpreterError(`Unknown identifier '${identifier}' in function '${this.currentExpr!.name}'.`);
		}
	}

	private resolveCallIdentifier(identifier: string): (...x: number[]) => number {
		switch (identifier) {
			case 'sqrt': return Math.sqrt;
			case 'log': return Math.log;
			case 'cos': return Math.cos;
			case 'acos': return Math.acos;
			case 'sin': return Math.sin;
			case 'asin': return Math.asin;
			case 'tan': return Math.tan;
			case 'atan': return Math.atan;
			default: throw new InterpreterError(`Unknown identifier '${identifier}' in function '${this.currentExpr!.name}'.`);
		}
	}
}
