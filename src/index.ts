import PostalMime from 'postal-mime';
import sanitizeHtml from 'sanitize-html';

export interface Env {
	WIRESPEED_API_TOKEN: string;
	PAGERDUTY_ROUTING_KEY: string;
}

interface WirespeedCase {
	id: string;
	sid: string;
	teamId: string;
	lastNotifiedClientAt: any;
	status: string;
	createdAt: string;
	detectionSids: string[];
	testMode: boolean;
	firstDetectionSourceIngestedAt: string;
	firstDetectionSourceDetectedAt: string;
	logs: {
		log: string;
		timestamp: string;
		debug: boolean;
	}[];
	contained: boolean;
	reingested: boolean;
	verdict: string;
	title: string;
	categories: string[];
	excludeFromMeans: boolean;
	firstRun: boolean;
	containsVIP: boolean;
	containsHVA: boolean;
	containsMobile: boolean;
	severity: string;
	severityOrdinal: number;
	name: string;
	updatedAt: string;
	closedAt: string;
	verdictedAt: string;
	detectionCount: number;
	mttr: number;
	teamName: string;
	externalTicketId: string;
	externalTicketIntegrationId: string;
	autoContained: boolean;
	respondedAt: string;
	platforms: string[];
	notes: string;
	clientNotified: boolean;
	summary: string;
	hasPassedAql: boolean;
}

// @ts-ignore
export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const emailRegex = /.*@.+\.wirespeed\.co$/;
		if (!emailRegex.test(message.from)) {
			console.log(`Ignoring email from ${message.from}`);
			return;
		}

		const parser = new PostalMime();
		const rawEmail = await new Response(message.raw).arrayBuffer();
		const parsedEmail = await parser.parse(rawEmail);

		const textBody = parsedEmail.text || '';
		const htmlBody = parsedEmail.html || '';

		// Check for link in text body
		let caseIdMatch = textBody.match(/https:\/\/app\.wirespeed\.co\/cases\/([a-f0-9-]{36})/);

		// If not found in text, check in HTML
		if (!caseIdMatch) {
			caseIdMatch = htmlBody.match(/https:\/\/app\.wirespeed\.co\/cases\/([a-f0-9-]{36})/);
		}

		if (!caseIdMatch) {
			console.error('Could not find Wirespeed case ID in email body');
			return;
		}

		const caseId = caseIdMatch[1];
		console.log(`Extracted Case ID: ${caseId}`);

		// Fetch Case details from Wirespeed
		const wirespeedResponse = await fetch(`https://api.wirespeed.co/cases/${caseId}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${env.WIRESPEED_API_TOKEN}`,
			},
		});

		if (!wirespeedResponse.ok) {
			console.error(`Failed to fetch case from Wirespeed: ${wirespeedResponse.statusText}`);
			return;
		}

		const caseData = (await wirespeedResponse.json()) as WirespeedCase;
		const sanitizerConfig = {
			allowedTags: [],
			allowedAttributes: {},
		}
		const sanitizedSummary = sanitizeHtml(caseData.summary || '', sanitizerConfig);
		const sanitizedNotes = sanitizeHtml(caseData.notes || 'None', sanitizerConfig);

		const pdAlert = {
			payload: {
				summary: `Wirespeed Case: ${caseData.name || caseData.title} (${caseData.sid})`,
				timestamp: caseData.createdAt,
				source: 'Wirespeed',
				severity: 'critical',
				component: 'Security Operations',
				group: 'Wirespeed Alerts',
				class: 'Security Case',
				// PagerDuty lists custom details alphabetically so order here doesn't matter'
				custom_details: {
					priority: caseData.severity,
					caseID: caseData.id,
					caseSID: caseData.sid,
					containsVIP: caseData.containsVIP,
					containsHVA: caseData.containsHVA,
					containsMobile: caseData.containsMobile,
					status: caseData.status,
					summary: sanitizedSummary,
					verdict: caseData.verdict,
					notes: sanitizedNotes,
					teamID: caseData.teamId,
					contained: caseData.contained,
					test_mode: caseData.testMode,
				},
			},
			routing_key: env.PAGERDUTY_ROUTING_KEY,
			event_action: 'trigger',
			dedup_key: caseData.id,
			links: [
				{
					href: `https://app.wirespeed.co/cases/${caseData.id}`,
					text: 'View Case in Wirespeed',
				},
			],
		};

		const pdResponse = await fetch('https://events.pagerduty.com/v2/enqueue', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(pdAlert),
		});

		if (!pdResponse.ok) {
			console.error(`Failed to send alert to PagerDuty: ${pdResponse.statusText}`);
			const errBody = await pdResponse.text();
			console.error(`PagerDuty error body: ${errBody}`);
		} else {
			console.log('Successfully sent alert to PagerDuty');
		}
	},
};
