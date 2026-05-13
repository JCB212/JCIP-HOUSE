import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext";
import { colors } from "./theme";

export function SyncStatusBanner() {
  const { isOnline, pendingSyncCount, syncNow } = useAuth();

  if (isOnline && pendingSyncCount === 0) return null;

  const text = !isOnline
    ? pendingSyncCount > 0
      ? `${pendingSyncCount} alteração${pendingSyncCount > 1 ? "es" : ""} salva${pendingSyncCount > 1 ? "s" : ""} no aparelho`
      : "Modo offline"
    : `${pendingSyncCount} alteração${pendingSyncCount > 1 ? "es" : ""} aguardando sincronização`;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.wrap} edges={["top"]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (isOnline) syncNow().catch(() => undefined);
        }}
        style={[styles.banner, isOnline ? styles.online : styles.offline]}
      >
        <Text style={[styles.text, isOnline ? styles.onlineText : styles.offlineText]}>
          {text}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  banner: {
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  offline: {
    backgroundColor: "#fffbeb",
    borderColor: "#f59e0b",
  },
  online: {
    backgroundColor: colors.neutralBg,
    borderColor: colors.neutral,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
  offlineText: {
    color: "#92400e",
  },
  onlineText: {
    color: colors.neutral,
  },
});
