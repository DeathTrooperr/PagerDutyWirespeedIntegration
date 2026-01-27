import type { WirespeedCase, PagerDutyAlert, Env, PagerDutyResolve } from './types.js';
import { sanitize } from './utils.js';

export function createPagerDutyAlert(
	env: Env,
	caseId: string,
	caseData: WirespeedCase | null,
	emailSubject?: string,
	emailBody?: string,
	apiError?: string
): PagerDutyAlert {
	if (caseData) {
		const sanitizedSummary = sanitize(caseData.summary);
		const sanitizedNotes = sanitize(caseData.notes || 'None');

		return {
			payload: {
				summary: `Wirespeed Case: ${caseData.name || caseData.title} (${caseData.sid})`,
				timestamp: caseData.createdAt,
				source: 'Wirespeed',
				severity: 'critical',
				component: 'Security Operations',
				group: 'Wirespeed Alerts',
				class: 'Security Case',
				custom_details: {
					priority: caseData.severity.toLowerCase(),
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
	} else {
		// Failsafe alert
		return {
			payload: {
				summary: `Wirespeed Case: ${emailSubject || 'New Alert'} (Failsafe)`,
				timestamp: new Date().toISOString(),
				source: 'Wirespeed',
				severity: 'critical',
				component: 'Security Operations',
				group: 'Wirespeed Alerts',
				class: 'Security Case',
				custom_details: {
					priority: 'critical',
					caseID: caseId,
					emailSubject: emailSubject,
					emailBody: emailBody,
					apiError: apiError,
					info: 'Failed to fetch full case details from Wirespeed API. This is a failsafe alert containing extracted information from the notification email.',
				},
			},
			routing_key: env.PAGERDUTY_ROUTING_KEY,
			event_action: 'trigger',
			dedup_key: caseId,
			links: [
				{
					href: `https://app.wirespeed.co/cases/${caseId}`,
					text: 'View Case in Wirespeed',
				},
			],
		};
	}
}

export async function sendToPagerDuty(alert: PagerDutyAlert): Promise<void> {
	const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(alert),
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(`Failed to send alert to PagerDuty: ${response.statusText}. Body: ${errBody}`);
	}
}

export async function sendResolutionToPagerDuty(resolveEvent: PagerDutyResolve): Promise<void> {
	const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(resolveEvent),
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(`Failed to send resolution to PagerDuty: ${response.statusText}. Body: ${errBody}`);
	}
}

export async function findPagerDutyIncidentByDedupKey(apiKey: string, dedupKey: string): Promise<string | null> {
	const params = new URLSearchParams({
		incident_key: dedupKey,
		limit: '1',
	});

	const response = await fetch(`https://api.pagerduty.com/incidents?${params.toString()}`, {
		method: 'GET',
		headers: {
			'Accept': 'application/vnd.pagerduty+json;version=2',
			'Authorization': `Token token=${apiKey}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(`Failed to search PagerDuty incidents: ${response.statusText}. Body: ${errBody}`);
	}

	const data = (await response.json()) as { incidents: { id: string }[] };
	return data.incidents[0]?.id || null;
}

export async function createPagerDutyNote(apiKey: string, incidentId: string, content: string, fromEmail: string): Promise<string> {
	const response = await fetch(`https://api.pagerduty.com/incidents/${incidentId}/notes`, {
		method: 'POST',
		headers: {
			'Accept': 'application/vnd.pagerduty+json;version=2',
			'Authorization': `Token token=${apiKey}`,
			'Content-Type': 'application/json',
			'From': fromEmail,
		},
		body: JSON.stringify({
			note: {
				content: content,
			},
		}),
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(`Failed to create PagerDuty note: ${response.statusText}. Body: ${errBody}`);
	}

	const data = (await response.json()) as { note: { id: string } };
	return data.note.id;
}

export async function updatePagerDutyNote(apiKey: string, incidentId: string, noteId: string, content: string, fromEmail: string): Promise<void> {
	const response = await fetch(`https://api.pagerduty.com/incidents/${incidentId}/notes/${noteId}`, {
		method: 'PUT',
		headers: {
			'Accept': 'application/vnd.pagerduty+json;version=2',
			'Authorization': `Token token=${apiKey}`,
			'Content-Type': 'application/json',
			'From': fromEmail,
		},
		body: JSON.stringify({
			note: {
				content: content,
			},
		}),
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(`Failed to update PagerDuty note: ${response.statusText}. Body: ${errBody}`);
	}
}
