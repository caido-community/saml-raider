import { type NotificationSink } from "@/types";

let sink: NotificationSink | undefined = undefined;

export const setNotificationSink = (next: NotificationSink) => {
  sink = next;
};

export const notify = (): NotificationSink =>
  sink ?? { showSuccess: () => undefined, showError: () => undefined };
