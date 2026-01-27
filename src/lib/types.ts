export interface Env {
	WIRESPEED_API_TOKEN: string;
	PAGERDUTY_ROUTING_KEY: string;
	POLLING_INTERVAL_SECONDS: number;
	CASE_WATCHER: DurableObjectNamespace;
}

export interface WirespeedCase {
	id: string;
	sid: string;
	teamId: string;
	lastNotifiedClientAt: string | null;
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

export interface CasesResponse {
	data: WirespeedCase[];
	totalCount: number;
}

export interface PagerDutyPayload {
	summary: string;
	timestamp: string;
	source: string;
	severity: string;
	component: string;
	group: string;
	class: string;
	custom_details: Record<string, any>;
}

export interface PagerDutyLink {
	href: string;
	text: string;
}

export interface PagerDutyAlert {
	payload: PagerDutyPayload;
	routing_key: string;
	event_action: 'trigger';
	dedup_key: string;
	links: PagerDutyLink[];
}

export interface PagerDutyResolve {
	routing_key: string;
	dedup_key: string;
	event_action: 'resolve';
}

export interface ParsedEmail {
	subject?: string | undefined;
	text?: string | undefined;
	html?: string | undefined;
	from: string;
	to: string[];
}
