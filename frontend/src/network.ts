import NetInfo from "@react-native-community/netinfo";

export async function getIsOnline() {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function subscribeToConnectivity(onChange: (isOnline: boolean) => void) {
  return NetInfo.addEventListener((state) => {
    onChange(state.isConnected !== false && state.isInternetReachable !== false);
  });
}
