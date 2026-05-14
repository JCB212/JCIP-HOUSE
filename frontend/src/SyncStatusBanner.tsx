import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext";
import { useAppTheme } from "./ThemeContext";

export function SyncStatusBanner() {
  const { isOnline, pendingSyncCount, syncNow } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (isOnline && pendingSyncCount === 0) return null;

  const text = !isOnline
    ? pendingSyncCount > 0
      ? `Falta de sincronização • ${pendingSyncCount} pendente${pendingSyncCount > 1 ? "s" : ""}`
      : "Falta de sincronização"
    : `${pendingSyncCount} alteração${pendingSyncCount > 1 ? "es" : ""} aguardando sincronização`;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.wrap} edges={["top"]}>
      <View style={styles.line}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (isOnline) syncNow().catch(() => undefined);
          }}
          style={styles.touch}
        >
          <Text style={[styles.text, isOnline ? styles.onlineText : styles.offlineText]}>{text}</Text>
          {!isOnline && <Text style={styles.helper}>Conecte à internet para enviar os dados à nuvem.</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  wrap: {
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  line: {
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  touch: { alignItems: "flex-end" },
  text: {
    fontSize: 11,
    fontWeight: "900",
  },
  offlineText: { color: colors.debt },
  onlineText: {
    color: colors.neutral,
  },
  helper: { color: colors.debt, fontSize: 9, fontWeight: "700", marginTop: 1 },
});
