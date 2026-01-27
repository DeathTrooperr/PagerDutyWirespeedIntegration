import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types.js";
import { getCaseFromRecent } from "./wirespeed.js";
import { sendResolutionToPagerDuty, findPagerDutyIncidentByDedupKey, createPagerDutyNote, updatePagerDutyNote } from "./pagerduty.js";
import { sanitize } from "./utils.js";

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
			if (status?.toLowerCase() === "closed") {
				let closedAt = await this.ctx.storage.get<number>("closedAt");
				
				if (!closedAt) {
					console.log(`Case ${caseId} just closed. Resolving immediately and posting placeholder note.`);
					closedAt = Date.now();
					await this.ctx.storage.put("closedAt", closedAt);

					if (this.env.PAGERDUTY_API_KEY) {
						try {
							const pdIncidentId = await findPagerDutyIncidentByDedupKey(this.env.PAGERDUTY_API_KEY, dedupKey);
							if (pdIncidentId) {
								await this.ctx.storage.put("pdIncidentId", pdIncidentId);
								
								// Find the email of the person who closed the case from the logs
								let fromEmail: string | undefined;
								if (caseData?.logs) {
									const closingLog = [...caseData.logs].reverse().find(l => l.log.includes("closed case"));
									if (closingLog) {
										const emailMatch = closingLog.log.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
										if (emailMatch) {
											fromEmail = emailMatch[0];
										}
									}
								}

								if (fromEmail) {
									await this.ctx.storage.put("fromEmail", fromEmail);
									const verdict = caseData?.verdict || "Unknown";
									const estTimestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST";
									const placeholderContent = `Resolved by ${fromEmail} as ${verdict} at ${estTimestamp}.\n\nWirespeed Summary: Awaiting Summary`;
									
									const noteId = await createPagerDutyNote(this.env.PAGERDUTY_API_KEY, pdIncidentId, placeholderContent, fromEmail);
									await this.ctx.storage.put("noteId", noteId);
									console.log(`Placeholder note created: ${noteId}`);
								} else {
									console.warn(`No from email found for case ${caseId}. Skipping note creation.`);
								}
							}
						} catch (pdError) {
							console.error("Error communicating with PagerDuty API for initial resolution:", pdError);
						}
					}

					await sendResolutionToPagerDuty({
						routing_key: routingKey,
						dedup_key: dedupKey,
						event_action: "resolve"
					});

					await this.ctx.storage.setAlarm(Date.now() + 30000);
					return;
				}

				const now = Date.now();
				const elapsed = now - closedAt;
				if (elapsed < 30000) {
					console.log(`Case ${caseId} closed ${Math.round(elapsed / 1000)}s ago. Waiting until 30s have passed.`);
					await this.ctx.storage.setAlarm(closedAt + 30000);
					return;
				}

				console.log(`Case ${caseId} has been closed for ${Math.round(elapsed / 1000)}s. Updating PagerDuty note with final summary.`);

				const noteId = await this.ctx.storage.get<string>("noteId");
				const pdIncidentId = await this.ctx.storage.get<string>("pdIncidentId");
				const fromEmail = await this.ctx.storage.get<string>("fromEmail");

				if (this.env.PAGERDUTY_API_KEY && noteId && pdIncidentId && fromEmail) {
					try {
						const sanitizedSummary = sanitize(caseData?.summary || "No summary provided.");
						const verdict = caseData?.verdict || "Unknown";
						// Use same format as placeholder but with summary
						const estTimestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST";
						const finalContent = `Resolved by ${fromEmail} as ${verdict} at ${estTimestamp}.\n\nWirespeed Summary: ${sanitizedSummary}`;
						
						await updatePagerDutyNote(this.env.PAGERDUTY_API_KEY, pdIncidentId, noteId, finalContent, fromEmail);
						console.log(`PagerDuty note ${noteId} updated with final summary.`);
					} catch (pdError) {
						console.error("Error updating PagerDuty note:", pdError);
					}
				}

				await this.ctx.storage.deleteAll();
				console.log('Case Resolution logic complete, deleting CaseWatcher.');
			} else {
				// Reset closedAt if it was somehow set but case is now open (unlikely but safe)
				await this.ctx.storage.delete("closedAt");
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
