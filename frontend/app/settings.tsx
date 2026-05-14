import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  view_dashboard: "Pode abrir o início e ver o resumo financeiro da casa.",
  view_statement: "Pode ver o extrato com entradas, saídas e acertos.",
  manage_expenses: "Pode cadastrar e remover gastos.",
  manage_recurring: "Pode criar despesas fixas e contribuições mensais.",
  manage_contributions: "Pode registrar dinheiro que entrou para a casa.",
  manage_payments: "Pode registrar acertos entre moradores.",
  manage_bills: "Pode mexer em contas a pagar e a receber.",
  manage_shopping_list: "Pode usar e alterar a lista de compras.",
  manage_chores: "Pode criar, atribuir e remover afazeres da casa.",
  view_reports: "Pode ver relatórios completos e histórico de atividades.",
  manage_members: "Pode mexer nos moradores, pesos e permissões.",
  manage_settings: "Pode mudar nome da casa e configurações importantes.",
};

const SUB_OWNER_KEYS = ["manage_members", "manage_settings", "manage_chores", "view_reports"];

export default function Settings() {
  const { house, user, refreshHouses, setHouse, updateUserName } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    house?.members.forEach((m) => (w[m.user_id] = String(m.weight)));
    return w;
  });
  const [startDay, setStartDay] = useState(String(house?.month_start_day || 1));
  const [houseName, setHouseName] = useState(house?.name || "");
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferHouseName, setTransferHouseName] = useState("");
  const [transferText, setTransferText] = useState("");

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

  async function saveProfile() {
    try {
      await updateUserName(displayName.trim());
      Alert.alert("Pronto", "Seu nome foi atualizado.");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function savePermissions(userId: string, permissions: Record<string, boolean>) {
    try {
      const updated = await api.put(`/houses/${house!.id}/members/${userId}/permissions`, { permissions });
      setHouse(updated as any);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function toggleSubOwner(member: any, enabled: boolean) {
    const next = { ...(member.permissions || {}) };
    for (const key of SUB_OWNER_KEYS) next[key] = enabled;
    await savePermissions(member.user_id, next);
  }

  async function transferOwnershipFinal() {
    try {
      const updated = await api.post(`/houses/${house!.id}/transfer-owner`, {
        new_owner_user_id: transferUserId,
        confirm_house_name: transferHouseName.trim(),
        confirm_text: transferText.trim(),
      });
      setHouse(updated as any);
      await refreshHouses();
      setTransferUserId("");
      setTransferHouseName("");
      setTransferText("");
      Alert.alert("Dono alterado", "A casa foi transferida com segurança.");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  function transferOwnership() {
    if (!transferUserId) {
      Alert.alert("Atenção", "Escolha o novo dono da casa.");
      return;
    }
    if (transferHouseName.trim() !== house?.name || transferText.trim().toUpperCase() !== "TRANSFERIR") {
      Alert.alert("Confirmação incompleta", "Digite o nome exato da casa e a palavra TRANSFERIR.");
      return;
    }
    const target = house?.members.find((m) => m.user_id === transferUserId);
    Alert.alert(
      "Transferir casa",
      `Você está passando a casa "${house?.name}" para ${target?.name}. Depois disso, essa pessoa vira dona principal.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmação final",
              "Essa ação é importante. Confirme apenas se você confia nessa pessoa.",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Transferir", style: "destructive", onPress: transferOwnershipFinal },
              ]
            );
          },
        },
      ]
    );
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
  const currentMember = house.members.find((m) => m.user_id === user?.id);
  const canManageSettings = isOwner || currentMember?.permissions?.manage_settings === true;
  const canManageMembers = isOwner || currentMember?.permissions?.manage_members === true;

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
          <Text style={styles.section}>Perfil</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Seu nome</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Nome para exibição"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnTxt}>Salvar nome</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>Casa</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              testID="settings-house-name"
              style={styles.textInput}
              value={houseName}
              onChangeText={setHouseName}
              editable={canManageSettings}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Dia de início do mês (1-28)</Text>
            <TextInput
              testID="settings-start-day"
              style={styles.textInput}
              value={startDay}
              onChangeText={setStartDay}
              keyboardType="number-pad"
              editable={canManageSettings}
            />
            <Text style={styles.hint}>
              Define quando começa um novo ciclo financeiro. Ex.: dia 5 = mês vai do dia 5 ao dia 5 seguinte.
            </Text>

            {canManageSettings && (
              <TouchableOpacity testID="save-house-settings" style={styles.saveBtn} onPress={saveHouseSettings}>
                <Text style={styles.saveBtnTxt}>Salvar casa</Text>
              </TouchableOpacity>
            )}
          </View>

          {canManageMembers && (
            <>
              <Text style={styles.section}>Controle de acessos</Text>
              <View style={styles.ownerNotice}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.neutral} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerTitle}>Permissões dos moradores</Text>
                  <Text style={styles.hint}>
                    O dono sempre tem acesso total. Para criar um sub-dono, ligue o atalho de sub-dono ou escolha cada permissão manualmente.
                  </Text>
                </View>
              </View>
              {house.members.filter((m) => m.user_id !== house.owner_id).map((m) => {
                const subOwner = SUB_OWNER_KEYS.every((key) => m.permissions?.[key] === true);
                return (
                  <View key={`perm-${m.user_id}`} style={styles.permissionsCard}>
                    <View style={styles.permissionHeader}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{m.name[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{m.name}</Text>
                        <Text style={styles.memberSub}>{m.email}</Text>
                      </View>
                    </View>
                    <View style={styles.subOwnerBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subOwnerTitle}>Sub-dono</Text>
                        <Text style={styles.memberSub}>Pode ajudar a administrar moradores, configurações, relatórios e afazeres.</Text>
                      </View>
                      <Switch
                        value={subOwner}
                        onValueChange={(value) => toggleSubOwner(m, value)}
                        trackColor={{ false: colors.border, true: colors.neutralBg }}
                        thumbColor={subOwner ? colors.neutral : colors.textMuted}
                      />
                    </View>
                    {Object.entries(house.permissions_catalog || {}).map(([key, label]) => {
                      const enabled = m.permissions?.[key] === true;
                      return (
                        <View key={key} style={styles.permissionRow}>
                          <View style={{ flex: 1, paddingRight: spacing.md }}>
                            <Text style={styles.permissionLabel}>{label}</Text>
                            <Text style={styles.permissionDescription}>{PERMISSION_DESCRIPTIONS[key] || "Controla uma parte do aplicativo."}</Text>
                          </View>
                          <Switch
                            value={enabled}
                            onValueChange={(value) =>
                              savePermissions(m.user_id, { ...(m.permissions || {}), [key]: value })
                            }
                            trackColor={{ false: colors.border, true: colors.neutralBg }}
                            thumbColor={enabled ? colors.neutral : colors.textMuted}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}

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
                editable={canManageMembers}
              />
              {canManageMembers && m.user_id !== house.owner_id && (
                <TouchableOpacity onPress={() => remove(m.user_id)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.debt} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {isOwner && house.members.some((m) => m.user_id !== house.owner_id) && (
            <>
              <Text style={styles.section}>Transferir casa</Text>
              <View style={styles.dangerCard}>
                <Text style={styles.dangerTitle}>Passar a casa para outro morador</Text>
                <Text style={styles.hint}>
                  Use apenas quando outra pessoa precisa virar dona principal. O novo dono passa a ter acesso total.
                </Text>
                <Text style={[styles.label, { marginTop: spacing.md }]}>Escolha o novo dono</Text>
                {house.members.filter((m) => m.user_id !== house.owner_id).map((m) => (
                  <TouchableOpacity
                    key={`transfer-${m.user_id}`}
                    style={[styles.choiceRow, transferUserId === m.user_id && styles.choiceSelected]}
                    onPress={() => setTransferUserId(m.user_id)}
                  >
                    <Text style={styles.choiceText}>{m.name}</Text>
                    {transferUserId === m.user_id && <Ionicons name="checkmark-circle" size={20} color={colors.neutral} />}
                  </TouchableOpacity>
                ))}
                <Text style={[styles.label, { marginTop: spacing.md }]}>Digite o nome exato da casa</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferHouseName}
                  onChangeText={setTransferHouseName}
                  placeholder={house.name}
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.label, { marginTop: spacing.md }]}>Digite TRANSFERIR</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferText}
                  onChangeText={setTransferText}
                  autoCapitalize="characters"
                  placeholder="TRANSFERIR"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity style={styles.dangerBtn} onPress={transferOwnership}>
                  <Text style={styles.dangerBtnText}>Transferir com dupla confirmação</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  ownerNotice: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  ownerTitle: { color: colors.textPrimary, fontWeight: "900", fontSize: 15 },
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
  permissionsCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  subOwnerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subOwnerTitle: { color: colors.textPrimary, fontWeight: "900" },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  permissionLabel: { color: colors.textPrimary, fontWeight: "700" },
  permissionDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  dangerCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.debt,
  },
  dangerTitle: { color: colors.debt, fontSize: 16, fontWeight: "900" },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  choiceSelected: { borderColor: colors.neutral, backgroundColor: colors.neutralBg },
  choiceText: { color: colors.textPrimary, fontWeight: "800" },
  dangerBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.debt,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "900" },
});
