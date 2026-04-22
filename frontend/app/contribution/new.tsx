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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { colors, radius, spacing } from "../../src/theme";

export default function NewContribution() {
  const { house, user } = useAuth();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [who, setWho] = useState<string | null>(user?.id || null);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const v = parseFloat(amount.replace(",", ".")) || 0;
    if (v <= 0) {
      Alert.alert("Atenção", "Informe um valor");
      return;
    }
    if (!who) {
      Alert.alert("Atenção", "Selecione o morador");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/houses/${house!.id}/contributions`, {
        user_id: who,
        amount: v,
        description: desc.trim() || null,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!house) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova contribuição</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <Text style={styles.label}>Valor</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currency}>R$</Text>
            <TextInput
              testID="new-contrib-amount"
              style={styles.amount}
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <Text style={styles.label}>Quem está contribuindo</Text>
          <View style={styles.chipsWrap}>
            {house.members.map((m) => (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.chip, who === m.user_id && styles.chipActive]}
                onPress={() => setWho(m.user_id)}
              >
                <Text style={[styles.chipTxt, who === m.user_id && styles.chipTxtActive]}>
                  {m.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Descrição (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex.: Mensalidade de Janeiro"
            placeholderTextColor={colors.textMuted}
            value={desc}
            onChangeText={setDesc}
          />

          <TouchableOpacity
            testID="new-contrib-submit"
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            disabled={loading}
            onPress={submit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitTxt}>Registrar contribuição</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.positiveBg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.positive + "40",
  },
  currency: { fontSize: 20, color: colors.positive, fontWeight: "700", marginRight: 8 },
  amount: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.positive,
    minWidth: 120,
    textAlign: "center",
    padding: 0,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.positive, borderColor: colors.positive },
  chipTxt: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTxtActive: { color: "#fff" },
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.positive,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
