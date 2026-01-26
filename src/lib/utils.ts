import sanitizeHtml from 'sanitize-html';

export const sanitizerConfig = {
	allowedTags: [],
	allowedAttributes: {},
};

export function sanitize(text: string): string {
	if (!text) return '';

	// Replace block-level tags with newlines to ensure we don't concatenate words
	const withNewlines = text
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<(?:p|div|li|h[1-6]|section|article|table|tr|td|blockquote|pre|ol|ul)\b[^>]*>/gi, '\n')
		.replace(/<\/(?:p|div|li|h[1-6]|section|article|table|tr|td|blockquote|pre|ol|ul)>/gi, '\n');

	return sanitizeHtml(withNewlines, sanitizerConfig)
		.replace(/[^\S\r\n]+/g, ' ')
		.replace(/\n /g, '\n')
		.replace(/ \n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function extractCaseId(text: string, html: string): string | null {
	const caseIdRegex = /https:\/\/app\.wirespeed\.co\/cases\/([a-f0-9-]{36})/;
	let match = text.match(caseIdRegex);
	if (!match) {
		match = html.match(caseIdRegex);
	}
	return (match && match[1]) ? match[1] : null;
}
