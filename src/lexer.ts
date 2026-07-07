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
	type: TokenType.Plus | TokenType.Minus | TokenType.Star | TokenType.Slash | TokenType.Caret | TokenType.LeftParen | TokenType.RightParen
}

export type Token =
	| TokenIdentifier
	| TokenLiteral
	| TokenOp;


export function lexMathExpr(expr: string) {
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
			case '+': tokens.push({ type: TokenType.Plus }); break;
			case '-': tokens.push({ type: TokenType.Minus }); break;
			case '*': tokens.push({ type: TokenType.Star }); break;
			case '/': tokens.push({ type: TokenType.Slash }); break;
			case '^': tokens.push({ type: TokenType.Caret }); break;
			case '(': tokens.push({ type: TokenType.LeftParen }); break;
			case ')': tokens.push({ type: TokenType.RightParen }); break;
			default: throw new SyntaxError(`Unexpected character ${c} at position ${i}.`);
		}

		i++;
	}

	return tokens;
}
