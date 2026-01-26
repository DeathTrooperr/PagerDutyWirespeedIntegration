import type { WirespeedCase, PagerDutyAlert, Env } from './types.js';
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
