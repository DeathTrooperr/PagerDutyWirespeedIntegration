# Wirespeed PagerDuty Integration

This Cloudflare Worker integrates Wirespeed security cases with PagerDuty. It receives email notifications from Wirespeed via Cloudflare Email Routing, extracts the case ID, fetches case details from the Wirespeed API, and triggers an informational alert in PagerDuty.

## Prerequisites

Before you begin, you will need:
- A **PagerDuty Events Integration key** from either a service or an AI Ops router.
- A **Wirespeed API key** with **read-only** permissions.
- A domain configured on **Cloudflare** with **Email Routing** enabled.

## Deployment Steps

1. **Clone the project locally:**
   ```bash
   git clone <repository-url>
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
   - Create a new route (e.g., `wirespeed@yourdomain.com`).
   - Set the destination to **Send to Worker** and select `wirespeed-pagerduty-integration`.

6. **Configure Wirespeed Team Mailbox:**
   - Launch your **Wirespeed console** and go to **Team Settings** (this can be done as an MSP or regular tenant).
   - Scroll down to **Team Mailbox**.
   - Add a new mailbox setting the address to the one you set up in Cloudflare earlier (e.g., `wirespeed@yourdomain.com`).

7. **Adjust Notification Severity:**
   - Finally, set the **Notification Escalation Severity** in Wirespeed to the lowest level (**Informational**).

That's it! Now you will be getting escalations at PagerDuty from Wirespeed!
