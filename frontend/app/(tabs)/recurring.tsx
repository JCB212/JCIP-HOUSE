import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Alert, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { formatBRL, radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

type Rec = {
  id: string; name: string; amount: number; category_id?: string | null;
  category_name?: string | null; payer_id: string; payer_name: string;
  frequency: string; day_of_month: number; expense_type: string;
  split_type: string; is_active: boolean; last_generated_month?: string | null;
};

type Plan = {
  id: string; user_id: string; user_name: string; amount: number;
  is_active: boolean; last_generated_month?: string | null;
};

type Cat = { id: string; name: string };

export default function Recurring() {
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [tab, setTab] = useState<"fixed" | "plans">("fixed");
  const [recurs, setRecurs] = useState<Rec[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);

  const [showRec, setShowRec] = useState(false);
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("1");
  const [recPayer, setRecPayer] = useState<string | null>(null);
  const [recCat, setRecCat] = useState<string | null>(null);

  const [showPlan, setShowPlan] = useState(false);
  const [planUser, setPlanUser] = useState<string | null>(null);
  const [planAmount, setPlanAmount] = useState("");

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      const [r, p, c] = await Promise.all([
        api.get<Rec[]>(`/houses/${house.id}/recurring`),
        api.get<Plan[]>(`/houses/${house.id}/contribution-plans`),
        api.get<Cat[]>(`/houses/${house.id}/categories`),
      ]);
      setRecurs(r); setPlans(p); setCats(c);
    } finally { setLoading(false); }
  }, [house]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveRec() {
    const amt = parseFloat(recAmount.replace(",", ".")) || 0;
    if (!recName.trim() || amt <= 0 || !recPayer) {
      Alert.alert("Atenção", "Preencha nome, valor e quem paga");
      return;
    }
    try {
      await api.post(`/houses/${house!.id}/recurring`, {
        name: recName.trim(), amount: amt, category_id: recCat, payer_id: recPayer,
        frequency: "monthly", day_of_month: parseInt(recDay) || 1,
        expense_type: "collective", split_type: "equal", is_active: true,
      });
      setShowRec(false); setRecName(""); setRecAmount(""); setRecDay("1"); setRecPayer(null); setRecCat(null);
      load();
    } catch (e: any) { Alert.alert("Erro", e.message); }
  }

  async function delRec(id: string) {
    try { await api.del(`/houses/${house!.id}/recurring/${id}`); load(); }
    catch (e: any) { Alert.alert("Erro", e.message); }
  }

  async function savePlan() {
    const amt = parseFloat(planAmount.replace(",", ".")) || 0;
    if (!planUser || amt <= 0) { Alert.alert("Atenção", "Selecione morador e valor"); return; }
    try {
      await api.post(`/houses/${house!.id}/contribution-plans`, {
        user_id: planUser, amount: amt, is_active: true,
      });
      setShowPlan(false); setPlanUser(null); setPlanAmount("");
      load();
    } catch (e: any) { Alert.alert("Erro", e.message); }
  }

  async function delPlan(id: string) {
    try { await api.del(`/houses/${house!.id}/contribution-plans/${id}`); load(); }
    catch (e: any) { Alert.alert("Erro", e.message); }
  }

  if (!house) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recorrentes</Text>
        <TouchableOpacity testID="recurring-add-btn" style={styles.addBtn}
          onPress={() => (tab === "fixed" ? setShowRec(true) : setShowPlan(true))}>
          <Ionicons name="add" size={20} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity testID="tab-fixed"
          style={[styles.tab, tab === "fixed" && styles.tabActive]} onPress={() => setTab("fixed")}>
          <Ionicons name="repeat" size={14} color={tab === "fixed" ? colors.textPrimary : colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === "fixed" && styles.tabTxtActive]}>Despesas fixas</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-plans"
          style={[styles.tab, tab === "plans" && styles.tabActive]} onPress={() => setTab("plans")}>
          <Ionicons name="cash" size={14} color={tab === "plans" ? colors.textPrimary : colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === "plans" && styles.tabTxtActive]}>Contribuições</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {tab === "fixed" ? (
          recurs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="repeat" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma despesa fixa</Text>
              <Text style={styles.emptyTxt}>Cadastre aluguel, internet, luz... elas aparecem automaticamente todo mês.</Text>
            </View>
          ) : (
            recurs.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{r.name}</Text>
                  <Text style={styles.itemSub}>
                    {r.payer_name} • {r.category_name || "sem categoria"} • dia {r.day_of_month}
                  </Text>
                  {r.last_generated_month && (
                    <Text style={styles.itemTag}>✓ Gerada em {r.last_generated_month}</Text>
                  )}
                </View>
                <Text style={styles.itemAmount}>{formatBRL(r.amount, house.currency)}</Text>
                <TouchableOpacity onPress={() => delRec(r.id)} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={16} color={colors.debt} />
                </TouchableOpacity>
              </View>
            ))
          )
        ) : plans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cash" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum plano</Text>
            <Text style={styles.emptyTxt}>Defina quanto cada morador contribui por mês. O app gera automaticamente.</Text>
          </View>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{p.user_name}</Text>
                <Text style={styles.itemSub}>Mensal</Text>
                {p.last_generated_month && (
                  <Text style={styles.itemTag}>✓ Gerada em {p.last_generated_month}</Text>
                )}
              </View>
              <Text style={[styles.itemAmount, { color: colors.positive }]}>
                {formatBRL(p.amount, house.currency)}
              </Text>
              <TouchableOpacity onPress={() => delPlan(p.id)} style={styles.delBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.debt} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal: Recurring */}
      <Modal visible={showRec} animationType="slide" onRequestClose={() => setShowRec(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRec(false)}>
                <Ionicons name="close" size={26} color={colors.textPrimary}/>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nova despesa fixa</Text>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} placeholder="Ex.: Aluguel, Internet..." placeholderTextColor={colors.textMuted}
                value={recName} onChangeText={setRecName}/>
              <Text style={styles.label}>Valor</Text>
              <TextInput style={styles.input} placeholder="0,00" placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad" value={recAmount} onChangeText={setRecAmount}/>
              <Text style={styles.label}>Dia do mês (1-28)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={recDay} onChangeText={setRecDay}/>
              <Text style={styles.label}>Quem paga</Text>
              <View style={styles.chipsWrap}>
                {house.members.map((m) => (
                  <TouchableOpacity key={m.user_id}
                    style={[styles.chip, recPayer === m.user_id && styles.chipActive]}
                    onPress={() => setRecPayer(m.user_id)}>
                    <Text style={[styles.chipTxt, recPayer === m.user_id && styles.chipTxtActive]}>{m.name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.chipsWrap}>
                {cats.map((c) => (
                  <TouchableOpacity key={c.id}
                    style={[styles.chip, recCat === c.id && styles.chipActive]}
                    onPress={() => setRecCat(c.id)}>
                    <Text style={[styles.chipTxt, recCat === c.id && styles.chipTxtActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity testID="save-recurring" style={styles.submit} onPress={saveRec}>
                <Text style={styles.submitTxt}>Cadastrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal: Plan */}
      <Modal visible={showPlan} animationType="slide" onRequestClose={() => setShowPlan(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPlan(false)}>
                <Ionicons name="close" size={26} color={colors.textPrimary}/>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Plano de contribuição</Text>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.label}>Morador</Text>
              <View style={styles.chipsWrap}>
                {house.members.map((m) => (
                  <TouchableOpacity key={m.user_id}
                    style={[styles.chip, planUser === m.user_id && styles.chipActive]}
                    onPress={() => setPlanUser(m.user_id)}>
                    <Text style={[styles.chipTxt, planUser === m.user_id && styles.chipTxtActive]}>{m.name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Valor mensal</Text>
              <TextInput style={styles.input} placeholder="0,00" placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad" value={planAmount} onChangeText={setPlanAmount}/>
              <TouchableOpacity testID="save-plan" style={[styles.submit, { backgroundColor: colors.positive }]}
                onPress={savePlan}>
                <Text style={styles.submitTxt}>Salvar plano</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: 6, marginBottom: spacing.sm },
  tab: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.borderLight },
  tabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  tabTxtActive: { color: colors.textPrimary, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.lg, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  itemTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  itemSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemTag: { color: colors.positive, fontSize: 11, marginTop: 3, fontWeight: "600" },
  itemAmount: { color: colors.textPrimary, fontWeight: "800", fontSize: 15, marginRight: spacing.md },
  delBtn: { padding: 6 },
  emptyCard: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  emptyTxt: { color: colors.textSecondary, textAlign: "center", fontSize: 13, lineHeight: 18 },

  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md,
    paddingVertical: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTxtActive: { color: "#fff" },
  submit: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: radius.lg, alignItems: "center" },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
