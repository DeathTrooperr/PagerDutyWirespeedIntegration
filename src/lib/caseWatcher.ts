import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types.js";
import { getCaseFromRecent } from "./wirespeed.js";
import { sendResolutionToPagerDuty } from "./pagerduty.js";

export class CaseWatcher extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async start(caseId: string, routingKey: string, dedupKey: string) {
		await this.ctx.storage.put("caseId", caseId);
		await this.ctx.storage.put("routingKey", routingKey);
		await this.ctx.storage.put("dedupKey", dedupKey);

		// Set alarm for the configured interval from now
		const intervalMs = (this.env.POLLING_INTERVAL_SECONDS || 30) * 1000;
		await this.ctx.storage.setAlarm(Date.now() + intervalMs);
	}

	async alarm() {
		const caseId = await this.ctx.storage.get<string>("caseId");
		const routingKey = await this.ctx.storage.get<string>("routingKey");
		const dedupKey = await this.ctx.storage.get<string>("dedupKey");

		if (!caseId || !routingKey || !dedupKey) {
			console.error("Missing state in CaseWatcher alarm");
			return;
		}

		const intervalMs = (this.env.POLLING_INTERVAL_SECONDS || 30) * 1000;

		try {
			const caseData = await getCaseFromRecent(this.env.WIRESPEED_API_TOKEN, caseId, 50);
			
			const status = caseData?.status?.toLowerCase();
			if (status === "closed" || status === "close") {
				console.log(`Case ${caseId} is closed. Sending resolution to PagerDuty.`);
				await sendResolutionToPagerDuty({
					routing_key: routingKey,
					dedup_key: dedupKey,
					event_action: "resolve"
				});
				await this.ctx.storage.deleteAll();
				console.log('Case Resolution Sent, deleting CaseWatcher.');
			} else {
				console.log(`Case ${caseId} is still open (status: ${caseData?.status || 'unknown'}). Re-scheduling alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + intervalMs);
			}
		} catch (error) {
			console.error(`Error in CaseWatcher alarm for case ${caseId}:`, error);
			// Re-schedule alarm even on error to keep trying
			await this.ctx.storage.setAlarm(Date.now() + intervalMs);
		}
	}
}
