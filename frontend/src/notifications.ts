import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function prepareNotifications() {
  if (!Device.isDevice) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("jcip-house", {
      name: "JCIP House",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7dd3fc",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleLocalReminder(title: string, body: string, when?: string | Date | null) {
  const granted = await prepareNotifications();
  if (!granted) return null;
  const date = when ? new Date(when) : new Date(Date.now() + 1500);
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 1000) {
    return null;
  }
  return await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { channelId: "jcip-house", date } as any,
  });
}
