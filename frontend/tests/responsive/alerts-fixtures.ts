import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";
export const sampleAlerts = [
  {
    key: "coordinates:2026-09-16:001",
    severity: "warning",
    title: "3 admission rooms need coordinates",
    detail: "Check latitude and longitude before relying on proximity checks.",
    target: "/admin/spatial",
  },
  {
    key: "office_closed:o1:001",
    severity: "critical",
    title: "6 tickets remain at closed offices",
    detail:
      "Student affairs has remaining tickets while its open switch is off. Review the line and any service in progress.",
    target: "/admin/services",
  },
  {
    key: "room_queue:r1:002",
    severity: "warning",
    title: "Design studio is past its line limit",
    detail:
      "18 active tickets against a maximum of 15. Review queue policy before changing the line limit.",
    target: "/admin/services",
  },
  {
    key: "policy:002",
    severity: "info",
    title: "A configuration review was reported",
    detail: "This information condition was included in the server snapshot.",
    target: "/admin/settings",
  },
];
export async function alertsSession(page: Page) {
  await webSession(page, "admin");
  const state = {
    alerts: structuredClone(sampleAlerts),
    counts: { critical: 1, warning: 2, acknowledged: 12 },
    generated_at: "2026-09-16T10:42:00Z",
    reads: 0,
    writes: [] as Record<string, unknown>[],
    readStatus: 200,
    writeStatus: 201,
    readPayload: undefined as unknown,
    ackPayload: undefined as unknown,
    delayRead: 0,
    delayWrite: 0,
    keepAfterAck: false,
  };
  await page.route("**/api/v1/admin/alerts{,/ack}", async (route) => {
    const writing = route.request().method() === "POST";
    if (writing) {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      if (state.delayWrite)
        await new Promise((resolve) => setTimeout(resolve, state.delayWrite));
      if (state.writeStatus >= 400)
        return route.fulfill({
          status: state.writeStatus,
          json: {
            success: false,
            message: `Acknowledgement refused (${state.writeStatus}).`,
            errors: { note: ["Review could not be saved."] },
          },
        });
      if (!state.keepAfterAck && state.ackPayload === undefined)
        state.alerts = state.alerts.filter((a) => a.key !== body.fingerprint);
      return route.fulfill({
        status: 201,
        json: {
          success: true,
          data: state.ackPayload ?? { acknowledged: body.fingerprint },
        },
      });
    }
    state.reads++;
    if (state.delayRead)
      await new Promise((resolve) => setTimeout(resolve, state.delayRead));
    if (state.readStatus >= 400)
      return route.fulfill({
        status: state.readStatus,
        json: {
          success: false,
          message: `Alert snapshot unavailable (${state.readStatus}).`,
        },
      });
    return route.fulfill({
      json: {
        success: true,
        data: state.readPayload ?? {
          alerts: state.alerts,
          counts: state.counts,
          generated_at: state.generated_at,
        },
      },
    });
  });
  return state;
}
