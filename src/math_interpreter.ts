enum TokenType {
	Identifier,
	Literal,
	OpAdd,
	OpSub,
	OpMul,
	OpDiv,
	OpPow,
	LeftParen,
	RightParen,
}

enum AstNodeType {
	Identifier,
	Literal,
	BinaryOp,
	UnaryOp,
	Call
}

enum BinaryOp {
	Add,
	Subtract,
	Multiply,
	Divide,
	Power
}

enum UnaryOp {
	Negate
}

type TokenIdentifier = {
	type: TokenType.Identifier,
	value: string
}

type TokenLiteral = {
	type: TokenType.Literal,
	value: number
}

type TokenOp = {
	type: TokenType.OpAdd | TokenType.OpSub | TokenType.OpMul | TokenType.OpDiv | TokenType.OpPow | TokenType.LeftParen | TokenType.RightParen
}

type Token =
	| TokenIdentifier
	| TokenLiteral
	| TokenOp;

type AstNode =
	| { type: AstNodeType.Identifier, name: string }
	| { type: AstNodeType.Literal, value: number }
	| { type: AstNodeType.BinaryOp, opType: BinaryOp, left: AstNode, right: AstNode }
	| { type: AstNodeType.UnaryOp, opType: UnaryOp, right: AstNode };

function lexMathExpr(expr: string) {
	let tokens: Token[] = []
	let i = 0;
	while (i < expr.length) {
		const c = expr[i]!;

		if (/\s/.test(c)) {
			i++;
			continue;
		}

		if (/[\d\.]/.test(c)) {
			let literalEnd = i + 1;
			let floatingPointFound = c === '.';
			while (literalEnd < expr.length && /[\d\.]/.test(expr[literalEnd]!)) {
				if (expr[literalEnd] === '.') {
					if (floatingPointFound) {
						throw SyntaxError(`Multiple floating part detected at position ${literalEnd} for number.`);
					} else {
						floatingPointFound = true;
					}
				}
				literalEnd++;
			}

			const literalStr = expr.substring(i, literalEnd);
			tokens.push({ type: TokenType.Literal, value: +literalStr });
			i = literalEnd;
			continue;
		}

		if (/[A-Za-z]/.test(c)) {
			let identifierEnd = i;
			while (identifierEnd < expr.length && /[A-Za-z]/.test(expr[identifierEnd]!)) {
				identifierEnd++;
			}

			const identifier = expr.substring(i, identifierEnd);
			tokens.push({ type: TokenType.Identifier, value: identifier });
			i = identifierEnd;
			continue;
		}

		switch (c) {
			case '+': tokens.push({ type: TokenType.OpAdd }); break;
			case '-': tokens.push({ type: TokenType.OpSub }); break;
			case '*': tokens.push({ type: TokenType.OpMul }); break;
			case '/': tokens.push({ type: TokenType.OpDiv }); break;
			case '^': tokens.push({ type: TokenType.OpPow }); break;
			case '(': tokens.push({ type: TokenType.LeftParen }); break;
			case ')': tokens.push({ type: TokenType.RightParen }); break;
			default: throw new SyntaxError(`Unexpected character ${c} at position ${i}.`);
		}

		i++;
	}

	return tokens;
}

class MathParser {
	private tokens: Token[];
	private index: number;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.index = 0;
	}

	parse(): AstNode {
		this.index = 0;
		const result = this.parseAddSub();
		if (this.index < this.tokens.length) {
			this.throwSyntaxError('Unexpected token');
		}

		return result;
	}

	private parseAddSub(): AstNode {
		let left = this.parseMultiply();
		let token = this.tokens[this.index];
		while (token !== undefined && [TokenType.OpAdd, TokenType.OpSub].includes(token.type)) {
			++this.index;
			const right = this.parseMultiply();
			if (token?.type == TokenType.OpAdd) {
				left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Add, left, right };
			} else {
				left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Subtract, left, right };
			}
			token = this.tokens[this.index];
		}

		return left;
	}

	private parseMultiply(): AstNode {
		let left = this.parseDivide();
		let token = this.tokens[this.index];
		while (token?.type == TokenType.OpMul) {
			++this.index;
			const right = this.parseDivide();
			left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Multiply, left, right };
			token = this.tokens[this.index];
		}

		return left;
	}

	private parseDivide(): AstNode {
		let left = this.parsePow();
		let token = this.tokens[this.index];
		while (token?.type == TokenType.OpDiv) {
			++this.index;
			const right = this.parsePow();
			left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Divide, left, right };
			token = this.tokens[this.index];
		}

		return left;
	}

	private parsePow(): AstNode {
		let left = this.parseUnary();
		let token = this.tokens[this.index];
		while (token?.type == TokenType.OpPow) {
			++this.index;
			const right = this.parseUnary();
			left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Power, left, right };
			token = this.tokens[this.index];
		}

		return left;
	}

	private parseUnary(): AstNode {
		const token = this.tokens[this.index]!;

		if (token?.type == TokenType.OpSub) {
			++this.index;
			return { type: AstNodeType.UnaryOp, opType: UnaryOp.Negate, right: this.parseValue() };
		}

		return this.parseValue();
	}

	private parseValue(): AstNode {
		const token = this.tokens[this.index++]!;

		if (token.type == TokenType.LeftParen) {
			const exprNode = this.parseAddSub();
			if (this.tokens[this.index]?.type == TokenType.RightParen) {
				++this.index;
				return exprNode;
			}

			this.throwSyntaxError('Missing closing parenthesis found');
		}

		if (token.type == TokenType.Identifier) {
			return { type: AstNodeType.Identifier, name: token.value };
		}

		if (token.type == TokenType.Literal) {
			return { type: AstNodeType.Literal, value: (token as TokenLiteral).value };
		}

		this.throwSyntaxError('Unexpected token');
	}

	private throwSyntaxError(errorType: string): never {
		let errorMessage = errorType + ` at index ${this.index}.\nExpression is currently parsed as follow:\n`
		for (let i = 0; i < this.tokens.length; i++) {
			const token = this.tokens[i]!;
			let tokenStr = '';
			switch (token.type) {
				case TokenType.Identifier: tokenStr += token.value; break;
				case TokenType.Literal: tokenStr += token.value; break;
				case TokenType.OpAdd: tokenStr += '+'; break;
				case TokenType.OpSub: tokenStr += '-'; break;
				case TokenType.OpMul: tokenStr += '*'; break;
				case TokenType.OpDiv: tokenStr += '/'; break;
				case TokenType.OpPow: tokenStr += '^'; break;
				case TokenType.LeftParen: tokenStr += '('; break;
				case TokenType.RightParen: tokenStr += ')'; break;
			}

			errorMessage += tokenStr;
			if (i < this.tokens.length - 1) {
				errorMessage += ' | ';
			}
		}

		throw new SyntaxError(errorMessage);
	}
}

export default class MathInterpreter {
	interpret(expr: string, xValues: number[]) {
		let tokens = lexMathExpr(expr);
		let parser = new MathParser(tokens);
		const root = parser.parse();

		let result = []
		for (const x of xValues) {
			result.push(this.evaluateAst(root, x))
		}

		return result;
	}

	private evaluateAst(node: AstNode, x: number): number {
		switch (node.type) {
			case AstNodeType.Literal:
				return node.value;
			case AstNodeType.Identifier:
				return this.resolveIdentifier(node.name, x)!;
			case AstNodeType.BinaryOp: {
				const left = this.evaluateAst(node.left, x);
				const right = this.evaluateAst(node.right, x);
				switch (node.opType) {
					case BinaryOp.Add: return left + right;
					case BinaryOp.Subtract: return left - right;
					case BinaryOp.Multiply: return left * right;
					case BinaryOp.Divide: return left / right;
					case BinaryOp.Power: return Math.pow(left, right);
				}
			}
			case AstNodeType.UnaryOp: {
				const right = this.evaluateAst(node.right, x);
				switch (node.opType) {
					case UnaryOp.Negate: return -right;
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
