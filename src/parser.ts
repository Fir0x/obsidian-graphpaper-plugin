import * as Lexer from './lexer';

export enum AstNodeType {
	Identifier,
	Literal,
	BinaryOp,
	UnaryOp,
	Call
}

export enum BinaryOp {
	Add,
	Subtract,
	Multiply,
	Divide,
	Power
}

export enum UnaryOp {
	Negate
}

export type AstNode =
	| { type: AstNodeType.Identifier, name: string }
	| { type: AstNodeType.Literal, value: number }
	| { type: AstNodeType.BinaryOp, opType: BinaryOp, left: AstNode, right: AstNode }
	| { type: AstNodeType.UnaryOp, opType: UnaryOp, right: AstNode };

export class ParserError extends SyntaxError {
	tokens: Lexer.Token[];
	index: number;

	constructor(message: string, tokens: Lexer.Token[], index: number) {
		super(message);

		this.tokens = tokens;
		this.index = index;
	}
}

export class MathParser {
	private tokens: Lexer.Token[];
	private index: number;

	constructor(tokens: Lexer.Token[]) {
		this.tokens = tokens;
		this.index = 0;
	}

	parse(): AstNode {
		this.index = 0;
		const result = this.parseAddSub();
		if (this.index < this.tokens.length) {
			this.throwSyntaxError(`End of expression expected, but ${this.tokens.length - this.index} tokens remaining.`, this.index - 1);
		}

		return result;
	}

	private parseAddSub(): AstNode {
		let left = this.parseMultiply();
		let token = this.tokens[this.index];
		while (token !== undefined && [Lexer.TokenType.Plus, Lexer.TokenType.Minus].includes(token.type)) {
			++this.index;
			const right = this.parseMultiply();
			if (token?.type == Lexer.TokenType.Plus) {
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
		while (token?.type == Lexer.TokenType.Star) {
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
		while (token?.type == Lexer.TokenType.Slash) {
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
		while (token?.type == Lexer.TokenType.Caret) {
			++this.index;
			const right = this.parseUnary();
			left = { type: AstNodeType.BinaryOp, opType: BinaryOp.Power, left, right };
			token = this.tokens[this.index];
		}

		return left;
	}

	private parseUnary(): AstNode {
		const token = this.tokens[this.index]!;

		if (token?.type == Lexer.TokenType.Minus) {
			++this.index;
			return { type: AstNodeType.UnaryOp, opType: UnaryOp.Negate, right: this.parseValue() };
		}

		return this.parseValue();
	}

	private parseValue(): AstNode {
		const token = this.tokens[this.index++]!;

		if (token.type == Lexer.TokenType.LeftParen) {
			const exprNode = this.parseAddSub();
			if (this.tokens[this.index]?.type == Lexer.TokenType.RightParen) {
				++this.index;
				return exprNode;
			}

			this.throwSyntaxError('Missing closing parenthesis found', this.index);
		}

		if (token.type == Lexer.TokenType.Identifier) {
			return { type: AstNodeType.Identifier, name: token.value };
		}

		if (token.type == Lexer.TokenType.Literal) {
			return { type: AstNodeType.Literal, value: (token as Lexer.TokenLiteral).value };
		}

		this.throwSyntaxError('Unexpected token', this.index - 1);
	}

	private throwSyntaxError(errorType: string, index: number): never {
		throw new ParserError(`${errorType} at index ${this.index}.`, this.tokens, index);
	}
}
