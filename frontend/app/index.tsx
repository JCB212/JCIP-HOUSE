import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/AuthContext";
import { useAppTheme } from "../src/ThemeContext";

export default function Index() {
  const { user, house, loading } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
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
  }, [user, house, loading, router]);

  return (
    <View style={styles.c}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
