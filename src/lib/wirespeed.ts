import type { WirespeedCase, CasesResponse } from './types.js';

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

export async function getCaseFromRecent(token: string, caseId: string, size: number = 10): Promise<WirespeedCase | null> {
	const searchData = await searchCases(token, size);
	return searchData.data.find((c: WirespeedCase) => c.id === caseId) || null;
}
