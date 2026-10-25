// Phone app (production): the server wakes the phone up when a computer asks for the Coffre; touching the notification
// opens the request. Off until the push keys of both stores exist (NEXT_PUBLIC_PUSH=1): registering would fail without them.
import { Capacitor } from "@capacitor/core";
import { savePushToken } from "./api";
import { PROD, PUSH } from "./env";
import { isNative } from "./native";

let started = false;

export async function startPush(go: (path: string) => void) {
  if (started || !PROD || !PUSH || !isNative()) return;
  started = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  if ((await PushNotifications.requestPermissions()).receive !== "granted") return;
  await PushNotifications.addListener("registration", (t) => void savePushToken(t.value, Capacitor.getPlatform() as "ios" | "android").catch(console.error));
  await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const r = a.notification.data?.request;
    if (typeof r === "string") go(`/appareil/?r=${encodeURIComponent(r)}`);
  });
  await PushNotifications.register();
}
