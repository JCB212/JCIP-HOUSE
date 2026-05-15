import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { dateBRToISO, formatBRL, formatDateBR, radius, spacing, todayISODate } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";
import { scheduleLocalReminder } from "../src/notifications";

type Bill = {
  id: string;
  bill_type: "payable" | "receivable";
  title: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: "open" | "paid" | string;
  party_name?: string | null;
};

export default function Bills() {
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const pathname = usePathname();
  const openedFromTab = pathname === "/house-bills";
  const [tab, setTab] = useState<"payable" | "receivable">("payable");
  const [items, setItems] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(formatDateBR(todayISODate()));
  const [party, setParty] = useState("");

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      setItems(await api.get<Bill[]>(`/houses/${house.id}/bills?bill_type=${tab}`));
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }, [house, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function addBill() {
    if (!house) return;
    const value = parseFloat(amount.replace(",", ".")) || 0;
    const dueDateISO = dateBRToISO(dueDate);
    if (!title.trim() || value <= 0 || !dueDateISO.trim()) {
      Alert.alert("Atenção", "Informe descrição, valor e vencimento");
      return;
    }
    try {
      await api.post(`/houses/${house.id}/bills`, {
        bill_type: tab,
        title: title.trim(),
        amount: value,
        due_date: dueDateISO,
        party_name: party.trim() || null,
      });
      await scheduleLocalReminder(
        tab === "payable" ? "Conta a pagar" : "Conta a receber",
        `${title.trim()} vence em ${formatDateBR(dueDateISO)}`,
        `${dueDateISO}T09:00:00`
      ).catch(() => undefined);
      setTitle("");
      setAmount("");
      setParty("");
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function markPaid(item: Bill) {
    if (!house) return;
    try {
      await api.put(`/houses/${house.id}/bills/${item.id}`, {
        status: item.status === "paid" ? "open" : "paid",
        paid_amount: item.status === "paid" ? 0 : item.amount,
      });
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function remove(item: Bill) {
    if (!house) return;
    Alert.alert("Remover conta", `Remover ${item.title}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/houses/${house.id}/bills/${item.id}`);
            setItems((prev) => prev.filter((p) => p.id !== item.id));
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        },
      },
    ]);
  }

  const openTotal = items.filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.amount, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        {openedFromTab ? <View style={styles.iconBtn} /> : (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Contas</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === "payable" && styles.tabActive]} onPress={() => setTab("payable")}>
            <Ionicons name="arrow-up-circle-outline" size={16} color={tab === "payable" ? colors.primaryText : colors.textSecondary} />
            <Text style={[styles.tabText, tab === "payable" && styles.tabTextActive]}>A pagar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "receivable" && styles.tabActive]} onPress={() => setTab("receivable")}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={tab === "receivable" ? colors.primaryText : colors.textSecondary} />
            <Text style={[styles.tabText, tab === "receivable" && styles.tabTextActive]}>A receber</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{tab === "payable" ? "Total aberto a pagar" : "Total aberto a receber"}</Text>
          <Text style={[styles.summaryValue, { color: tab === "payable" ? colors.debt : colors.positive }]}>
            {formatBRL(openTotal, house?.currency)}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput style={styles.input} placeholder="Ex.: Internet, aluguel, cliente..." placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Valor</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={colors.textMuted} value={amount} onChangeText={setAmount} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Vencimento</Text>
              <TextInput style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor={colors.textMuted} value={dueDate} onChangeText={setDueDate} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <Text style={styles.label}>{tab === "payable" ? "Fornecedor" : "Quem vai pagar"}</Text>
          <TextInput style={styles.input} placeholder="Opcional" placeholderTextColor={colors.textMuted} value={party} onChangeText={setParty} />
          <TouchableOpacity style={styles.submit} onPress={addBill}>
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.submitText}>Adicionar conta</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="wallet-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma conta</Text>
            <Text style={styles.emptyText}>{tab === "payable" ? "Cadastre contas da casa para não perder vencimentos." : "Cadastre valores que alguém precisa receber."}</Text>
          </View>
        ) : (
          items.map((item) => {
            const paid = item.status === "paid";
            return (
              <TouchableOpacity key={item.id} style={[styles.billCard, paid && { opacity: 0.65 }]} onPress={() => markPaid(item)} onLongPress={() => remove(item)}>
                <View style={[styles.billIcon, { backgroundColor: tab === "payable" ? colors.debtBg : colors.positiveBg }]}>
                  <Ionicons name={paid ? "checkmark" : tab === "payable" ? "arrow-up" : "arrow-down"} size={18} color={tab === "payable" ? colors.debt : colors.positive} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.billTitle}>{item.title}</Text>
                  <Text style={styles.billSub}>{item.party_name || "Sem nome"} • vence {formatDateBR(item.due_date)}</Text>
                </View>
                <Text style={[styles.billAmount, { color: tab === "payable" ? colors.debt : colors.positive }]}>
                  {formatBRL(item.amount, house?.currency)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  content: { padding: spacing.lg, paddingBottom: 120 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontWeight: "800" },
  tabTextActive: { color: colors.primaryText },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: { color: colors.textSecondary, fontWeight: "700" },
  summaryValue: { fontSize: 26, fontWeight: "900", marginTop: 4 },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", marginTop: spacing.sm, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  submit: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  submitText: { color: colors.primaryText, fontWeight: "900" },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  billCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  billIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  billTitle: { color: colors.textPrimary, fontWeight: "800" },
  billSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  billAmount: { fontWeight: "900", marginLeft: spacing.sm },
});
