import PostalMime from 'postal-mime';
import type { Env, WirespeedCase } from './lib/types.js';
import { extractCaseId, sanitize } from './lib/utils.js';
import { fetchCurrentTeam, searchCases, switchTeam, fetchCaseDetails, sendToPagerDuty } from './lib/wirespeed.js';
import { createPagerDutyAlert } from './lib/pagerduty.js';

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

		const caseId = extractCaseId(textBody, htmlBody);

		if (!caseId) {
			console.error('Could not find Wirespeed case ID in email body');
			return;
		}

		console.log(`Extracted Case ID: ${caseId}`);

		let caseData: WirespeedCase | null = null;
		let activeToken = env.WIRESPEED_API_TOKEN;
		let apiError: string | undefined;

		try {
			// 1. Get current team information
			const currentTeam = await fetchCurrentTeam(activeToken);
			console.log(`Current team: ${currentTeam.name} (${currentTeam.id})`);

			// 2. Search for the case in recent cases
			const searchData = await searchCases(activeToken);
			const foundCase = searchData.data.find((c: WirespeedCase) => c.id === caseId);

			// 3. Check if the found case is in the same team
			if (foundCase && foundCase.teamId !== currentTeam.id) {
				console.log(`Case belongs to a different team: ${foundCase.teamId}. Switching teams...`);
				// 4. Switch teams
				activeToken = await switchTeam(activeToken, foundCase.teamId);
				console.log('Successfully switched team context.');
			}

			// Fetch Case details from Wirespeed
			caseData = await fetchCaseDetails(activeToken, caseId);
		} catch (error) {
			apiError = error instanceof Error ? error.message : String(error);
			console.error(`Error during Wirespeed API calls: ${apiError}`);
		}

		const pdAlert = createPagerDutyAlert(
			env,
			caseId,
			caseData,
			parsedEmail.subject,
			sanitize(textBody || htmlBody || 'No content found'),
			apiError
		);

		try {
			await sendToPagerDuty(pdAlert);
			console.log('Successfully sent alert to PagerDuty');
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
		}
	},
};
