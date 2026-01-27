import PostalMime from 'postal-mime';
import type { ParsedEmail } from './types.js';

export async function parseEmail(message: ForwardableEmailMessage): Promise<ParsedEmail> {
	const parser = new PostalMime();
	const rawEmail = await new Response(message.raw).arrayBuffer();
	const parsed = await parser.parse(rawEmail);

	return {
		subject: parsed.subject,
		text: parsed.text,
		html: parsed.html,
		from: message.from,
		to: message.to ? [message.to] : [],
	};
}

export function extractCaseId(text: string, html: string): string | null {
	const caseIdRegex = /https:\/\/app\.wirespeed\.co\/cases\/([a-f0-9-]{36})/;
	let match = text.match(caseIdRegex);
	if (!match) {
		match = html.match(caseIdRegex);
	}
	return (match && match[1]) ? match[1] : null;
}

export function isWirespeedEmail(from: string): boolean {
	const emailRegex = /.*@.+\.wirespeed\.co$/;
	return emailRegex.test(from);
}
