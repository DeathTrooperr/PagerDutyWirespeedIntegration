import type { WirespeedCase, Team, CasesResponse, JWTResponse, PagerDutyAlert } from './types.js';

export async function fetchCurrentTeam(token: string): Promise<Team> {
	const response = await fetch('https://api.wirespeed.co/team', {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch current team: ${response.statusText}`);
	}

	return (await response.json()) as Team;
}

export async function searchCases(token: string, size: number = 10): Promise<CasesResponse> {
	const response = await fetch('https://api.wirespeed.co/cases', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ size }),
	});

	if (!response.ok) {
		throw new Error(`Failed to search cases: ${response.statusText}`);
	}

	return (await response.json()) as CasesResponse;
}

export async function switchTeam(token: string, teamId: string): Promise<string> {
	const response = await fetch('https://api.wirespeed.co/team/switch', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ teamId }),
	});

	if (!response.ok) {
		throw new Error(`Failed to switch team: ${response.statusText}`);
	}

	const data = (await response.json()) as JWTResponse;
	return data.accessToken;
}

export async function fetchCaseDetails(token: string, caseId: string): Promise<WirespeedCase> {
	const response = await fetch(`https://api.wirespeed.co/cases/${caseId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch case from Wirespeed: ${response.statusText}`);
	}

	return (await response.json()) as WirespeedCase;
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
