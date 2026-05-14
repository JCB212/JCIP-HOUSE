import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

export default function ForgotPassword() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!email.trim()) {
      Alert.alert("Atenção", "Informe seu e-mail");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() }, false);
      setStep("code");
      Alert.alert("Código enviado", "Confira seu e-mail e digite o código recebido.");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível enviar o e-mail");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!code.trim() || password.length < 6 || password !== confirm) {
      Alert.alert("Atenção", "Digite o código e confirme uma senha com no mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim(),
        code: code.trim(),
        password,
      }, false);
      Alert.alert("Senha alterada", "Agora você já pode entrar com a nova senha.");
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>Recuperar senha</Text>
            <Text style={styles.subtitle}>
              {step === "email"
                ? "Enviaremos um código para o e-mail cadastrado."
                : "Digite o código recebido e escolha sua nova senha."}
            </Text>

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={step === "email"}
              value={email}
              onChangeText={setEmail}
            />

            {step === "code" && (
              <>
                <Text style={styles.label}>Código</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                />
                <Text style={styles.label}>Nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="mínimo 6 caracteres"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Text style={styles.label}>Confirmar senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="repita a senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.submit, loading && { opacity: 0.65 }]}
              onPress={step === "email" ? sendCode : resetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.submitText}>{step === "email" ? "Enviar código" : "Alterar senha"}</Text>
              )}
            </TouchableOpacity>

            {step === "code" && (
              <TouchableOpacity onPress={sendCode} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Reenviar código</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  backBtn: { position: "absolute", top: spacing.lg, left: spacing.lg, padding: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: "center",
    paddingVertical: 16,
    marginTop: spacing.lg,
  },
  submitText: { color: colors.primaryText, fontSize: 16, fontWeight: "800" },
  secondaryBtn: { alignItems: "center", paddingTop: spacing.md },
  secondaryText: { color: colors.neutral, fontWeight: "700" },
});
