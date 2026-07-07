import * as Lexer from './lexer'

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
			this.throwSyntaxError('Unexpected token');
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

			this.throwSyntaxError('Missing closing parenthesis found');
		}

		if (token.type == Lexer.TokenType.Identifier) {
			return { type: AstNodeType.Identifier, name: token.value };
		}

		if (token.type == Lexer.TokenType.Literal) {
			return { type: AstNodeType.Literal, value: (token as Lexer.TokenLiteral).value };
		}

		this.throwSyntaxError('Unexpected token');
	}

	private throwSyntaxError(errorType: string): never {
		let errorMessage = errorType + ` at index ${this.index}.\nExpression is currently parsed as follow:\n`
		for (let i = 0; i < this.tokens.length; i++) {
			const token = this.tokens[i]!;
			let tokenStr = '';
			switch (token.type) {
				case Lexer.TokenType.Identifier: tokenStr += token.value; break;
				case Lexer.TokenType.Literal: tokenStr += token.value; break;
				case Lexer.TokenType.Plus: tokenStr += '+'; break;
				case Lexer.TokenType.Minus: tokenStr += '-'; break;
				case Lexer.TokenType.Star: tokenStr += '*'; break;
				case Lexer.TokenType.Slash: tokenStr += '/'; break;
				case Lexer.TokenType.Caret: tokenStr += '^'; break;
				case Lexer.TokenType.LeftParen: tokenStr += '('; break;
				case Lexer.TokenType.RightParen: tokenStr += ')'; break;
			}

			errorMessage += tokenStr;
			if (i < this.tokens.length - 1) {
				errorMessage += ' | ';
			}
		}

		throw new SyntaxError(errorMessage);
	}
}
