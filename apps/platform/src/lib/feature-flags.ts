export const PUBLISHER_GET_PAID_TASKS_ENABLED = false;

export function publisherGetPaidTasksDisabledResponse() {
  return Response.json(
    { error: { code: "NOT_FOUND", message: "Get Paid Tasks is not available", status: 404 } },
    { status: 404 },
  );
}
