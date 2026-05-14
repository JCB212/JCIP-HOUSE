import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { formatBRL, radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

type MonthOut = {
  id: string; year: number; month_number: number; status: string;
  start_date: string; end_date: string; carried_balance: number; closed_at?: string | null;
};

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Home() {
  const { house, user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [months, setMonths] = useState<MonthOut[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    try {
      const mlist = await api.get<MonthOut[]>(`/houses/${house.id}/months`);
      const monthId = selectedMonth || mlist.find((m) => m.status === "open")?.id || mlist[0]?.id;
      const dash = await api.get<any>(
        `/houses/${house.id}/dashboard${monthId ? `?month_id=${monthId}` : ""}`
      );
      setMonths(mlist);
      setData(dash);
      if (!selectedMonth) setSelectedMonth(dash.current_month.id);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [house, selectedMonth]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function generateRecurring() {
    if (!house) return;
    setGenerating(true);
    try {
      const r: any = await api.post(`/houses/${house.id}/months/current/generate`);
      Alert.alert("✅ Gerado", `Despesas fixas: ${r.created_expenses}\nContribuições: ${r.created_contributions}`);
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function closeMonth() {
    if (!data?.current_month) return;
    const confirm = async (carry: boolean) => {
      try {
        await api.post(`/houses/${house!.id}/months/${data.current_month.id}/close`,
          { carry_balance: carry });
        Alert.alert("✅", "Mês fechado!");
        load();
      } catch (e: any) {
        Alert.alert("Erro", e.message);
      }
    };
    if (Platform.OS === "web") {
      const carry = window.confirm("Fechar o mês?\n\nCarregar saldo para o próximo mês?");
      if (carry !== null) await confirm(carry);
      return;
    }
    Alert.alert("Fechar mês", "Deseja carregar o saldo para o próximo mês?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Não carregar", onPress: () => confirm(false) },
      { text: "Carregar saldo", onPress: () => confirm(true) },
    ]);
  }

  if (!house) {
    return <SafeAreaView style={styles.center}><Text>Nenhuma casa</Text></SafeAreaView>;
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.primary}/></SafeAreaView>;
  }

  const cm = data?.current_month as MonthOut;
  const isClosed = cm?.status === "closed";
  const totalCat = (data?.expenses_by_category || []).reduce((s: number, c: any) => s + c.total, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name?.split(" ")[0]}</Text>
            <Text style={styles.houseTitle}>{house.name}</Text>
          </View>
          <TouchableOpacity testID="home-settings-btn" onPress={() => router.push("/settings")} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Month selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: spacing.md }}>
          {months.slice(0, 12).reverse().map((m) => {
            const sel = m.id === selectedMonth;
            return (
              <TouchableOpacity key={m.id} testID={`month-${m.year}-${m.month_number}`}
                style={[styles.monthChip, sel && styles.monthChipActive,
                        m.status === "closed" && styles.monthChipClosed]}
                onPress={() => setSelectedMonth(m.id)}>
                <Text style={[styles.monthChipTxt, sel && styles.monthChipTxtActive]}>
                  {MONTH_NAMES[m.month_number - 1]}/{String(m.year).slice(2)}
                </Text>
                {m.status === "closed" && <Ionicons name="lock-closed" size={10} color={sel ? colors.primaryText : colors.debt} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.balanceLabel}>Saldo do mês</Text>
            {isClosed && (
              <View style={styles.closedBadge}>
                <Ionicons name="lock-closed" size={10} color={colors.primaryText} />
                <Text style={styles.closedBadgeTxt}>FECHADO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.balanceValue, { color: (data?.house_balance || 0) >= 0 ? "#86efac" : "#fca5a5" }]}>
            {formatBRL(data?.house_balance || 0, data?.currency)}
          </Text>
          {(data?.carried_balance || 0) !== 0 && (
            <Text style={styles.carriedTxt}>
              📤 Saldo carregado: {formatBRL(data.carried_balance, data?.currency)}
            </Text>
          )}
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Contribuído</Text>
              <Text style={[styles.balanceItemValue, { color: "#86efac" }]}>
                {formatBRL(data?.total_contributions_month || 0, data?.currency)}
              </Text>
            </View>
            <View style={[styles.balanceItem, { alignItems: "flex-end" }]}>
              <Text style={styles.balanceItemLabel}>Gasto</Text>
              <Text style={[styles.balanceItemValue, { color: "#fca5a5" }]}>
                {formatBRL(data?.total_expenses_month || 0, data?.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Fixed vs Variable */}
        <View style={styles.fvRow}>
          <View style={[styles.fvCard, { backgroundColor: colors.neutralBg }]}>
            <Ionicons name="repeat" size={18} color={colors.neutral} />
            <Text style={[styles.fvLabel, { color: colors.neutral }]}>Fixas</Text>
            <Text style={styles.fvValue}>{formatBRL(data?.total_fixed_expenses || 0, data?.currency)}</Text>
          </View>
          <View style={[styles.fvCard, { backgroundColor: colors.positiveBg }]}>
            <Ionicons name="flash" size={18} color={colors.positive} />
            <Text style={[styles.fvLabel, { color: colors.positive }]}>Variáveis</Text>
            <Text style={styles.fvValue}>{formatBRL(data?.total_variable_expenses || 0, data?.currency)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity testID="home-add-expense-btn"
            style={[styles.actionBtn, { backgroundColor: colors.primary }, isClosed && { opacity: 0.4 }]}
            disabled={isClosed}
            onPress={() => router.push("/expense/new")}>
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.actionText}>Gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="home-add-contribution-btn"
            style={[styles.actionBtn, { backgroundColor: colors.positive }, isClosed && { opacity: 0.4 }]}
            disabled={isClosed}
            onPress={() => router.push("/contribution/new")}>
            <Ionicons name="cash" size={18} color={colors.primaryText} />
            <Text style={styles.actionText}>Contrib.</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="home-generate-recurring-btn"
            style={[styles.actionBtn, { backgroundColor: colors.neutral }]}
            disabled={generating}
            onPress={generateRecurring}>
            {generating ? <ActivityIndicator color={colors.primaryText} size="small"/> : <Ionicons name="repeat" size={18} color={colors.primaryText} />}
            <Text style={styles.actionText}>Gerar fixas</Text>
          </TouchableOpacity>
        </View>

        {!isClosed && (
          <TouchableOpacity testID="btn-close-month" onPress={closeMonth} style={styles.closeMonthBtn}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.debt} />
            <Text style={styles.closeMonthTxt}>Fechar mês</Text>
          </TouchableOpacity>
        )}

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/statement")}>
            <Ionicons name="analytics-outline" size={18} color={colors.neutral} />
            <Text style={styles.quickText}>Extrato</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/bills")}>
            <Ionicons name="wallet-outline" size={18} color={colors.debt} />
            <Text style={styles.quickText}>Contas</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/shopping-list")}>
            <Ionicons name="cart-outline" size={18} color={colors.positive} />
            <Text style={styles.quickText}>Compras</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/chores" as any)}>
            <Ionicons name="checkbox-outline" size={18} color={colors.neutral} />
            <Text style={styles.quickText}>Afazeres</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/help")}>
            <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.quickText}>Ajuda</Text>
          </TouchableOpacity>
        </View>

        {/* Debts */}
        {(data?.debts?.length || 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quem deve para quem</Text>
            {data.debts.slice(0, 4).map((d: any, i: number) => (
              <View key={i} style={styles.debtCard}>
                <View style={styles.debtIcon}>
                  <Ionicons name="arrow-forward" size={16} color={colors.debt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.debtText}>
                    <Text style={{ fontWeight: "700" }}>{d.from_name}</Text> deve para <Text style={{ fontWeight: "700" }}>{d.to_name}</Text>
                  </Text>
                  <Text style={styles.debtAmount}>{formatBRL(d.amount, data?.currency)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo dos moradores</Text>
          {(data?.members_summary || []).map((m: any) => (
            <View key={m.user_id} style={styles.memberCard}>
              <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSub}>
                  Pagou {formatBRL(m.total_paid, data?.currency)} • Cabe {formatBRL(m.total_share, data?.currency)}
                </Text>
              </View>
              <View style={[styles.balancePill, { backgroundColor: m.balance >= 0 ? colors.positiveBg : colors.debtBg }]}>
                <Text style={[styles.balancePillText, { color: m.balance >= 0 ? colors.positive : colors.debt }]}>
                  {m.balance >= 0 ? "+" : ""}{formatBRL(m.balance, data?.currency)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Categories */}
        {(data?.expenses_by_category?.length || 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoria</Text>
            {data.expenses_by_category.slice(0, 6).map((c: any, i: number) => {
              const pct = totalCat > 0 ? (c.total / totalCat) * 100 : 0;
              return (
                <View key={i} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: c.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catAmount}>{formatBRL(c.total, data?.currency)}</Text>
                    </View>
                    <View style={styles.catBarBg}>
                      <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: c.color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gastos recentes</Text>
          {(data?.recent_expenses || []).length === 0 ? (
            <Text style={styles.empty}>Nenhum gasto neste mês ainda.</Text>
          ) : (
            data.recent_expenses.slice(0, 5).map((e: any) => (
              <View key={e.id} style={styles.expCard}>
                <View style={[styles.catIconBg, { backgroundColor: (e.category_color || colors.neutral) + "22" }]}>
                  <Ionicons name={e.is_recurring_instance ? "repeat" : "receipt-outline"} size={16} color={e.category_color || colors.neutral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expDesc}>{e.description}</Text>
                  <Text style={styles.expMeta}>
                    {e.payer_name} • {e.category_name || "—"}{e.has_items ? " • 🛒" : ""}{!e.is_paid ? " • PENDENTE" : ""}
                  </Text>
                </View>
                <Text style={styles.expAmount}>{formatBRL(e.amount, data?.currency)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: colors.textSecondary, fontSize: 14 },
  houseTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  iconBtn: { width: 40, height: 40, backgroundColor: colors.surface, borderRadius: 12,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

  monthChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border },
  monthChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthChipClosed: { borderStyle: "dashed" },
  monthChipTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  monthChipTxtActive: { color: "#fff" },

  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, marginTop: 4 },
  balanceLabel: { color: "#d6d3d1", fontSize: 13 },
  balanceValue: { fontSize: 32, fontWeight: "800", marginTop: 4 },
  carriedTxt: { color: "#d6d3d1", fontSize: 12, marginTop: 4 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  balanceItem: { flex: 1 },
  balanceItemLabel: { color: "#d6d3d1", fontSize: 11, marginTop: 4 },
  balanceItemValue: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  closedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.debt,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  closedBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  fvRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  fvCard: { flex: 1, padding: spacing.md, borderRadius: radius.lg, gap: 4 },
  fvLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  fvValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },

  actionsRow: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: radius.lg, gap: 4 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  closeMonthBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    marginTop: spacing.sm, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, borderStyle: "dashed" },
  closeMonthTxt: { color: colors.debt, fontWeight: "700", fontSize: 13 },
  quickRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    gap: 4,
  },
  quickText: { color: colors.textPrimary, fontWeight: "700", fontSize: 12 },

  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  debtCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.lg, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  debtIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.debtBg,
    alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  debtText: { color: colors.textPrimary, fontSize: 13 },
  debtAmount: { color: colors.debt, fontWeight: "700", fontSize: 14, marginTop: 2 },

  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.lg, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.neutralBg,
    alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  memberAvatarText: { color: colors.neutral, fontWeight: "800" },
  memberName: { fontWeight: "700", color: colors.textPrimary, fontSize: 14 },
  memberSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  balancePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  balancePillText: { fontSize: 11, fontWeight: "800" },

  catRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  catName: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  catAmount: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  catBarBg: { height: 5, backgroundColor: colors.borderLight, borderRadius: 3 },
  catBarFill: { height: 5, borderRadius: 3 },

  expCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.lg, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  catIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    marginRight: spacing.md },
  expDesc: { color: colors.textPrimary, fontWeight: "600", fontSize: 14 },
  expMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  expAmount: { color: colors.textPrimary, fontWeight: "800", fontSize: 14 },
  empty: { color: colors.textSecondary, textAlign: "center", padding: spacing.lg },
});
