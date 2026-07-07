import { lexMathExpr } from './lexer';
import * as Parser from './parser';

export default class MathInterpreter {
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
				return this.resolveIdentifier(node.name, x)!;
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

	private resolveIdentifier(identifier: string, x: number) {
		switch (identifier) {
			case 'x': return x;
			case 'e': return Math.E;
			case 'pi': return Math.PI;
			default: throw new SyntaxError(`Unknown identifier '${identifier}'.`)
		}
	}
}
