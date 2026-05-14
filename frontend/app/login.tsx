import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/AuthContext";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

export default function Login() {
  const { login } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !pwd) {
      Alert.alert("Atenção", "Preencha email e senha");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), pwd);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  function socialSoon(provider: string) {
    Alert.alert(
      "Login social",
      `A estrutura para entrar com ${provider} já está prevista. Para ativar de verdade, ainda precisamos cadastrar o app no provedor e colocar as chaves no .env.`
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.logoWrap}>
            <Image source={require("../assets/images/jcip-house-logo.png")} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>JCIP House Finance</Text>
            <Text style={styles.subtitle}>Controle financeiro compartilhado</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Senha</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={pwd}
              onChangeText={setPwd}
            />

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
              disabled={loading}
              onPress={onSubmit}
            >
              {loading ? (
              <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.btnPrimaryText}>Entrar</Text>
              )}
            </TouchableOpacity>
            <Link href="/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.link}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </Link>

            <View style={styles.separatorRow}>
              <View style={styles.separator} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separator} />
            </View>

            <TouchableOpacity style={styles.socialBtn} onPress={() => socialSoon("Google")}>
              <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
              <Text style={styles.socialText}>Continuar com Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={() => socialSoon("Facebook")}>
              <Ionicons name="logo-facebook" size={18} color={colors.neutral} />
              <Text style={styles.socialText}>Continuar com Facebook</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Ainda não tem conta? </Text>
            <Link href="/register" asChild>
              <TouchableOpacity testID="login-goto-register">
                <Text style={styles.link}>Criar conta</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: spacing.xl },
  logoImage: { width: 108, height: 108, borderRadius: 24, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: {
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
  btnPrimaryText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
  forgotBtn: { alignItems: "center", paddingTop: spacing.md },
  separatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  separator: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { color: colors.textMuted, fontWeight: "700" },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 13,
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
  },
  socialText: { color: colors.textPrimary, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: colors.textSecondary },
  link: { color: colors.neutral, fontWeight: "700" },
});
