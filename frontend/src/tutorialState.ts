import AsyncStorage from "@react-native-async-storage/async-storage";

export const TUTORIAL_KEY = "jcip_tutorial_done_v1_2";

export async function hasSeenTutorial() {
  return (await AsyncStorage.getItem(TUTORIAL_KEY)) === "yes";
}

export async function markTutorialSeen() {
  await AsyncStorage.setItem(TUTORIAL_KEY, "yes");
}

export async function resetTutorialSeen() {
  await AsyncStorage.removeItem(TUTORIAL_KEY);
}
