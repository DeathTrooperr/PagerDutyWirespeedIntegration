# Wirespeed PagerDuty Integration

This is a Cloudflare Email Worker-based integration that connects Wirespeed security alerts to PagerDuty. It allows security teams to be quickly alerted to security escalations within the platform. The integration receives email notifications from Wirespeed via Cloudflare Email Routing, extracts the case ID, fetches case details from the Wirespeed API, and triggers a critical alert in PagerDuty. Advanced users can also configure PagerDuty to match the alert severity with the Wirespeed case severity.

## Prerequisites
Before you begin, you will need:
- A **Cloudflare-hosted** domain with **Email Routing** enabled.
- A **PagerDuty Events Integration key** from either a Service or an Event Orchestration.
- A **Wirespeed API key** with **read-only** permissions.

## Deployment Steps

1. **Clone the project locally:**
   ```bash
   git clone https://github.com/DeathTrooperr/PagerDutyWirespeedIntegration
   cd PagerDutyWirespeedIntegration
   ```

2. **Configure Secrets:**
   Use Wrangler to set the required secrets for your Cloudflare Worker:
   ```bash
   npx wrangler secret put WIRESPEED_API_TOKEN
   npx wrangler secret put PAGERDUTY_ROUTING_KEY
   ```

3. **Deploy the project to Cloudflare:**
   ```bash
   npx wrangler deploy
   ```

4. **Set up Cloudflare Email Routing:**
   Follow the [Cloudflare guide on setting up email routing](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/) if you haven't already.

5. **Create a new Email Route:**
   - Go to your domain's **Email Routing** settings in the Cloudflare dashboard.
   - Create a new address (e.g., `wirespeed@yourdomain.com`).
   - Set the destination to **Send to Worker** and select `wirespeed-pagerduty-integration`.

6. **Configure Wirespeed Team Mailbox:**
   - Launch your **Wirespeed console** and navigate to **Team Settings** (this can be done at the MSP or client tenant levels based on the API key scope).
   - Scroll down to the **Team Mailbox** section.
   - Add a new mailbox, setting the address to the one you created in Cloudflare (e.g., `wirespeed@yourdomain.com`).
   - Finally, set the **Notification Escalation Severity** to the lowest level (**Informational**).

**That's it!** You will now receive escalations in PagerDuty from Wirespeed as quickly as possible.

## Advanced Deployment (PagerDuty AIOps)

For more granular control over alert severity and incident priority, you can use PagerDuty Event Orchestrations to route and modify events based on Wirespeed case data.

1. **Create an Orchestration:**
   - In PagerDuty, navigate to **Automation** > **Event Orchestration**.
   - Create a new Orchestration.

2. **Configure Service Routes:**
   - Open your Orchestration and go to **Service Routes**.
   - Create a new service route and route it to your Wirespeed or Security service.
   - In the "When should events be routed to the service?" dropdown, select **Always (for all events)**.

3. **Create Event Rules for Severity Mapping:**
   The integration sends the Wirespeed case severity in the `event.custom_details.priority` field. You can create rules to map these to PagerDuty levels.
   - Within the Service Orchestration, create new event rules using `if / else if` statements.
   - Create five rules, one for each severity level (Critical, High, Medium, Low, Informational).
   - For each rule, check the event priority:
     - **Condition:** `event.custom_details.priority` matches the Wirespeed level.
     - **Actions:** Set **Incident Priority** and **Severity** to the desired levels for your organization.

4. **Test the Integration:**
   - Once complete, test the routing and rules using a **ChatOps Test event** or by triggering a test case in Wirespeed.

With this setup, Wirespeed alerts will be automatically categorized and prioritized in PagerDuty based on their actual severity.
