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
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/AuthContext";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

export default function Register() {
  const { register } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (name.trim().length < 2 || !email.trim() || pwd.length < 8) {
      Alert.alert("Atenção", "Preencha nome, email e senha (mín. 8 caracteres)");
      return;
    }
    if (!accepted) {
      Alert.alert("Atenção", "Leia e aceite o termo LGPD do programa teste.");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), name.trim(), pwd, accepted);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  function socialSoon(provider: string) {
    Alert.alert(
      "Cadastro social",
      `A estrutura para cadastro com ${provider} já está prevista. Para ativar de verdade, ainda precisamos cadastrar o app no provedor e colocar as chaves no .env.`
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
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Comece a gerenciar sua casa em segundos</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              testID="register-name-input"
              style={styles.input}
              placeholder="João Silva"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
            <TextInput
              testID="register-email-input"
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
              testID="register-password-input"
              style={styles.input}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={pwd}
              onChangeText={setPwd}
            />

            <TouchableOpacity style={styles.consentRow} onPress={() => setAccepted((v) => !v)}>
              <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
                {accepted && <Ionicons name="checkmark" size={16} color={colors.primaryText} />}
              </View>
              <Text style={styles.consentText}>
                Li e aceito o termo LGPD do programa teste.{" "}
                <Link href={"/terms-lgpd" as any} asChild>
                  <Text style={styles.link}>Ver termo</Text>
                </Link>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="register-submit-button"
              style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
              disabled={loading}
              onPress={onSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.btnPrimaryText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <View style={styles.separatorRow}>
              <View style={styles.separator} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separator} />
            </View>

            <TouchableOpacity style={styles.socialBtn} onPress={() => socialSoon("Google")}>
              <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
              <Text style={styles.socialText}>Criar com Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={() => socialSoon("Facebook")}>
              <Ionicons name="logo-facebook" size={18} color={colors.neutral} />
              <Text style={styles.socialText}>Criar com Facebook</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem conta? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Entrar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scroll: { padding: spacing.lg, flexGrow: 1, paddingTop: spacing.xxl },
  back: { marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "800", color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
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
  consentRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
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
