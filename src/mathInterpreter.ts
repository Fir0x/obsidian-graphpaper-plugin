import { lexMathExpr } from './mathLexer';
import * as Parser from './mathParser';

export class InterpreterError extends SyntaxError {
	constructor(message: string) {
		super(message);
	}
}

export class MathInterpreter {
	interpret(expr: string, xValues: number[]) {
		let tokens = lexMathExpr(expr);
		let parser = new Parser.MathParser(tokens);
		const root = parser.parse();

		let result = []
		for (const x of xValues) {
			result.push(this.evaluateAst(root, x))
		}

		return result;
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
			default: throw new InterpreterError(`Unknown identifier '${identifier}'.`)
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
			default: throw new InterpreterError(`Unknown identifier '${identifier}'.`)
		}
	}
}
