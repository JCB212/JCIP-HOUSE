import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/AuthContext";
import { colors, radius, spacing } from "../src/theme";

export default function Onboarding() {
  const { createHouse, joinHouse, logout } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      if (mode === "create") {
        if (name.trim().length < 2) throw new Error("Informe um nome para a casa");
        await createHouse(name.trim());
      } else {
        if (code.trim().length < 4) throw new Error("Informe um código válido");
        await joinHouse(code.trim().toUpperCase());
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="home" size={22} color="#fff" />
            </View>
            <TouchableOpacity onPress={logout}>
              <Text style={styles.logoutTxt}>Sair</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Bem-vindo(a)! 🏡</Text>
          <Text style={styles.subtitle}>
            Crie uma casa para começar ou entre em uma existente usando o código.
          </Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              testID="onb-tab-create"
              style={[styles.tab, mode === "create" && styles.tabActive]}
              onPress={() => setMode("create")}
            >
              <Text style={[styles.tabTxt, mode === "create" && styles.tabTxtActive]}>
                Criar casa
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="onb-tab-join"
              style={[styles.tab, mode === "join" && styles.tabActive]}
              onPress={() => setMode("join")}
            >
              <Text style={[styles.tabTxt, mode === "join" && styles.tabTxtActive]}>
                Entrar em uma casa
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {mode === "create" ? (
              <>
                <Text style={styles.label}>Nome da casa</Text>
                <TextInput
                  testID="onb-house-name"
                  style={styles.input}
                  placeholder="Ex.: República dos Amigos"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Código de convite</Text>
                <TextInput
                  testID="onb-invite-code"
                  style={[styles.input, { letterSpacing: 2, fontWeight: "700" }]}
                  placeholder="ABC12345"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                />
              </>
            )}

            <TouchableOpacity
              testID="onb-submit"
              style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
              disabled={loading}
              onPress={onSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {mode === "create" ? "Criar casa" : "Entrar na casa"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, flexGrow: 1, paddingTop: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBadge: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  logoutTxt: { color: colors.textSecondary, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.lg },
  subtitle: { color: colors.textSecondary, marginTop: 6, lineHeight: 22 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: 4,
    marginTop: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center" },
  tabActive: { backgroundColor: colors.surface },
  tabTxt: { color: colors.textSecondary, fontWeight: "600" },
  tabTxtActive: { color: colors.textPrimary },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 13, color: colors.textSecondary, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
