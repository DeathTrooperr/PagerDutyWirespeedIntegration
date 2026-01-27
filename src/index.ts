import type { Env, WirespeedCase } from './lib/types.js';
import { sanitize } from './lib/utils.js';
import { getCaseFromRecent } from './lib/wirespeed.js';
import { createPagerDutyAlert, sendToPagerDuty } from './lib/pagerduty.js';
import { parseEmail, extractCaseId, isWirespeedEmail } from './lib/email.js';
import { CaseWatcher } from './lib/caseWatcher.js';

export { CaseWatcher };

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		if (!isWirespeedEmail(message.from)) {
			console.log(`Ignoring email from ${message.from}`);
			return;
		}

		const parsedEmail = await parseEmail(message);

		const textBody = parsedEmail.text || '';
		const htmlBody = parsedEmail.html || '';

		const caseId = extractCaseId(textBody, htmlBody);

		if (!caseId) {
			console.error('Could not find Wirespeed case ID in email body');
			return;
		}

		console.log(`Extracted Case ID: ${caseId}`);

		let caseData: WirespeedCase | null = null;
		let apiError: string | undefined;

		try {
			caseData = await getCaseFromRecent(env.WIRESPEED_API_TOKEN, caseId);

			if (!caseData) {
				console.log(`Case ${caseId} not found in recent cases.`);
			}
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

			// Start the Durable Object to watch for case resolution
			const watcherId = env.CASE_WATCHER.idFromName(caseId);
			const watcherStub = env.CASE_WATCHER.get(watcherId) as DurableObjectStub<CaseWatcher>;
			await watcherStub.start(caseId, env.PAGERDUTY_ROUTING_KEY, caseId);
			console.log(`Started CaseWatcher for case ${caseId}`);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
		}
	},
};
