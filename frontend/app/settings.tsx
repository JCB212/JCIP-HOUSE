import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { colors, radius, spacing } from "../src/theme";

export default function Settings() {
  const { house, user, refreshHouses, setHouse } = useAuth();
  const router = useRouter();
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    house?.members.forEach((m) => (w[m.user_id] = String(m.weight)));
    return w;
  });
  const [startDay, setStartDay] = useState(String(house?.month_start_day || 1));
  const [houseName, setHouseName] = useState(house?.name || "");

  async function saveWeight(userId: string) {
    const v = parseFloat((weights[userId] || "1").replace(",", ".")) || 1;
    try {
      const updated = await api.put(`/houses/${house!.id}/members/weight`, {
        user_id: userId,
        weight: v,
      });
      setHouse(updated as any);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function saveHouseSettings() {
    const day = parseInt(startDay) || 1;
    if (day < 1 || day > 28) { Alert.alert("Atenção", "Dia entre 1 e 28"); return; }
    try {
      const updated: any = await api.put(`/houses/${house!.id}/settings`, {
        name: houseName.trim() || undefined,
        month_start_day: day,
      });
      setHouse(updated);
      Alert.alert("✅", "Configurações salvas!");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function remove(userId: string) {
    Alert.alert("Remover membro", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/houses/${house!.id}/members/${userId}`);
            const list = await refreshHouses();
            const refreshed = list.find((h) => h.id === house!.id);
            if (refreshed) setHouse(refreshed);
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        },
      },
    ]);
  }

  if (!house) return null;
  const isOwner = house.owner_id === user?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <Text style={styles.section}>Casa</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              testID="settings-house-name"
              style={styles.textInput}
              value={houseName}
              onChangeText={setHouseName}
              editable={house.owner_id === user?.id}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Dia de início do mês (1-28)</Text>
            <TextInput
              testID="settings-start-day"
              style={styles.textInput}
              value={startDay}
              onChangeText={setStartDay}
              keyboardType="number-pad"
              editable={house.owner_id === user?.id}
            />
            <Text style={styles.hint}>
              Define quando começa um novo "mês financeiro". Ex.: dia 5 = mês vai do dia 5 ao dia 5 seguinte.
            </Text>

            {house.owner_id === user?.id && (
              <TouchableOpacity testID="save-house-settings" style={styles.saveBtn} onPress={saveHouseSettings}>
                <Text style={styles.saveBtnTxt}>Salvar casa</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.section}>Pesos de divisão</Text>
          <Text style={styles.hint}>
            O peso afeta a divisão por peso. Exemplo: quem tem peso 2 paga o dobro de quem tem peso 1.
          </Text>

          {house.members.map((m) => (
            <View key={m.user_id} style={styles.weightRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{m.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSub}>{m.role === "owner" ? "Dono da casa" : "Membro"}</Text>
              </View>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                value={weights[m.user_id] || ""}
                onChangeText={(v) => setWeights({ ...weights, [m.user_id]: v })}
                onEndEditing={() => saveWeight(m.user_id)}
              />
              {isOwner && m.user_id !== house.owner_id && (
                <TouchableOpacity onPress={() => remove(m.user_id)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.debt} />
                </TouchableOpacity>
              )}
            </View>
          ))}
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
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textSecondary, fontSize: 12 },
  value: { color: colors.textPrimary, fontWeight: "700", fontSize: 16, marginTop: 2 },
  textInput: { backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, marginTop: 4 },
  saveBtn: { marginTop: spacing.md, backgroundColor: colors.primary, paddingVertical: 12,
    borderRadius: radius.md, alignItems: "center" },
  saveBtnTxt: { color: "#fff", fontWeight: "700" },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 16 },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarTxt: { color: colors.neutral, fontWeight: "800", fontSize: 16 },
  memberName: { color: colors.textPrimary, fontWeight: "700" },
  memberSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  weightInput: {
    width: 70,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
  },
  removeBtn: { marginLeft: spacing.sm, padding: 8 },
});
