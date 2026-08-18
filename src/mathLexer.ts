export enum TokenType {
	Identifier,
	Literal,
	Plus,
	Minus,
	Star,
	Slash,
	Caret,
	LeftParen,
	RightParen,
	Comma
}

export type TokenIdentifier = {
	type: TokenType.Identifier,
	value: string
}

export type TokenLiteral = {
	type: TokenType.Literal,
	value: number
}

export type TokenOp = {
	type: TokenType.Plus | TokenType.Minus | TokenType.Star | TokenType.Slash | TokenType.Caret | TokenType.LeftParen | TokenType.RightParen | TokenType.Comma
}

export type Token =
	| TokenIdentifier
	| TokenLiteral
	| TokenOp;

export class LexerError extends SyntaxError {
	source: string;
	index: number;

	constructor(message: string, source: string, index: number) {
		super(message);

		this.source = source;
		this.index = index;
	}
}

export function lexMathExpr(source: string) {
	let tokens: Token[] = []
	let i = 0;
	while (i < source.length) {
		const c = source[i]!;

		if (/\s/.test(c)) {
			i++;
			continue;
		}

		if (/[\d\.]/.test(c)) {
			let literalEnd = i + 1;
			let floatingPointFound = c === '.';
			while (literalEnd < source.length && /[\d\.]/.test(source[literalEnd]!)) {
				if (source[literalEnd] === '.') {
					if (floatingPointFound) {
						throw new LexerError(`Multiple floating part detected at position ${literalEnd} for number.`, source, i);
					} else {
						floatingPointFound = true;
					}
				}
				literalEnd++;
			}

			const literalStr = source.substring(i, literalEnd);
			tokens.push({ type: TokenType.Literal, value: +literalStr });
			i = literalEnd;
			continue;
		}

		if (/[A-Za-z]/.test(c)) {
			let identifierEnd = i;
			while (identifierEnd < source.length && /[A-Za-z]/.test(source[identifierEnd]!)) {
				identifierEnd++;
			}

			const identifier = source.substring(i, identifierEnd);
			tokens.push({ type: TokenType.Identifier, value: identifier });
			i = identifierEnd;
			continue;
		}

		switch (c) {
			case '+': tokens.push({ type: TokenType.Plus }); break;
			case '-': tokens.push({ type: TokenType.Minus }); break;
			case '*': tokens.push({ type: TokenType.Star }); break;
			case '/': tokens.push({ type: TokenType.Slash }); break;
			case '^': tokens.push({ type: TokenType.Caret }); break;
			case '(': tokens.push({ type: TokenType.LeftParen }); break;
			case ')': tokens.push({ type: TokenType.RightParen }); break;
			case ',': tokens.push({ type: TokenType.Comma }); break;
			default: throw new LexerError(`Unexpected character ${c} at position ${i}.`, source, i);
		}

		i++;
	}

	return tokens;
}
