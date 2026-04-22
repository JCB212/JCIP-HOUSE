import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/AuthContext";
import { colors } from "../src/theme";

export default function Index() {
  const { user, house, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!house) {
      router.replace("/onboarding");
    } else {
      router.replace("/(tabs)");
    }
  }, [user, house, loading]);

  return (
    <View style={styles.c}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
