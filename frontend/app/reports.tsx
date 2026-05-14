import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { formatBRL, radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

type Report = {
  house_name: string;
  period: { from: string; to: string };
  summary: {
    expenses_count: number;
    expenses_total: number;
    contributions_count: number;
    contributions_total: number;
    shopping_items_count: number;
    shopping_items_checked: number;
    chores_count: number;
    chores_done: number;
    house_balance: number;
  };
  bills_by_status: Array<{ bill_type: string; status: string; total_count: number; total_amount: number }>;
  expenses_by_person: Array<{ user_id: string; name: string; purchase_count: number; total_paid: number }>;
  expenses_registered_by: Array<{ user_id: string | null; name: string; registered_count: number; total_amount: number }>;
  contributions_by_person: Array<{ user_id: string; name: string; contribution_count: number; total_contributed: number }>;
  shopping_added_by: Array<{ user_id: string | null; name: string; added_count: number }>;
  shopping_checked_by: Array<{ user_id: string | null; name: string; checked_count: number }>;
  chores_by_person: Array<{ user_id: string; name: string; assigned_count: number; completed_count: number; last_completed_at: string | null }>;
  activity: Array<{ id: string; user_name: string; action_label: string; details: string | null; created_at: string }>;
};

function shortDate(value?: string | null) {
  if (!value) return "";
  const [date, time] = String(value).split(" ");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

export default function Reports() {
  const router = useRouter();
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!house) return;
    setError("");
    const data = await api.get<Report>(`/houses/${house.id}/reports`);
    setReport(data);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message || "Não foi possível carregar os relatórios."))
      .finally(() => setLoading(false));
  }, [house?.id]);

  async function refresh() {
    setRefreshing(true);
    await load().catch((e) => setError(e.message || "Não foi possível atualizar."));
    setRefreshing(false);
  }

  const maxExpense = Math.max(1, ...(report?.expenses_by_person || []).map((p) => p.total_paid));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <TouchableOpacity onPress={refresh} style={styles.iconBtn}>
          <Ionicons name="refresh" size={21} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : report ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <Text style={styles.period}>{report.house_name} • {shortDate(report.period.from)} até {shortDate(report.period.to)}</Text>

          <View style={styles.summaryGrid}>
            <SummaryCard icon="trending-down-outline" label="Gastos" value={formatBRL(report.summary.expenses_total)} sub={`${report.summary.expenses_count} registros`} styles={styles} colors={colors} />
            <SummaryCard icon="trending-up-outline" label="Entradas" value={formatBRL(report.summary.contributions_total)} sub={`${report.summary.contributions_count} registros`} styles={styles} colors={colors} />
            <SummaryCard icon="cart-outline" label="Compras" value={`${report.summary.shopping_items_checked}/${report.summary.shopping_items_count}`} sub="itens marcados" styles={styles} colors={colors} />
            <SummaryCard icon="checkbox-outline" label="Afazeres" value={`${report.summary.chores_done}/${report.summary.chores_count}`} sub="concluídos" styles={styles} colors={colors} />
          </View>

          <Section title="Quem pagou compras e gastos" styles={styles}>
            {report.expenses_by_person.length === 0 ? <Empty styles={styles} text="Nenhum gasto neste período." /> : report.expenses_by_person.map((p) => (
              <View key={p.user_id} style={styles.personRow}>
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{p.name[0]?.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowSub}>{p.purchase_count} compra(s) ou gasto(s)</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(8, (p.total_paid / maxExpense) * 100)}%` }]} />
                  </View>
                </View>
                <Text style={styles.amount}>{formatBRL(p.total_paid)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Quem cadastrou gastos" styles={styles}>
            {report.expenses_registered_by.length === 0 ? <Empty styles={styles} text="Nenhum cadastro no período." /> : report.expenses_registered_by.map((p, i) => (
              <MiniRow key={`${p.user_id || "none"}-${i}`} icon="create-outline" title={p.name} sub={`${p.registered_count} lançamento(s)`} right={formatBRL(p.total_amount)} styles={styles} colors={colors} />
            ))}
          </Section>

          <Section title="Contribuições" styles={styles}>
            {report.contributions_by_person.length === 0 ? <Empty styles={styles} text="Nenhuma contribuição neste período." /> : report.contributions_by_person.map((p) => (
              <MiniRow key={p.user_id} icon="cash-outline" title={p.name} sub={`${p.contribution_count} contribuição(ões)`} right={formatBRL(p.total_contributed)} styles={styles} colors={colors} />
            ))}
          </Section>

          <Section title="Lista de compras" styles={styles}>
            <Text style={styles.sectionHint}>Mostra quem colocou produtos na lista e quem marcou como comprado.</Text>
            {report.shopping_added_by.map((p, i) => (
              <MiniRow key={`add-${p.user_id || i}`} icon="add-circle-outline" title={p.name} sub="adicionou itens" right={`${p.added_count}`} styles={styles} colors={colors} />
            ))}
            {report.shopping_checked_by.map((p, i) => (
              <MiniRow key={`check-${p.user_id || i}`} icon="checkmark-circle-outline" title={p.name} sub="marcou comprado" right={`${p.checked_count}`} styles={styles} colors={colors} />
            ))}
            {!report.shopping_added_by.length && !report.shopping_checked_by.length && <Empty styles={styles} text="Nenhum item de compra no período." />}
          </Section>

          <Section title="Afazeres" styles={styles}>
            {report.chores_by_person.length === 0 ? <Empty styles={styles} text="Nenhum afazer no período." /> : report.chores_by_person.map((p) => (
              <MiniRow
                key={p.user_id}
                icon="person-outline"
                title={p.name}
                sub={`Fez ${p.completed_count} de ${p.assigned_count}${p.last_completed_at ? ` • último ${shortDate(p.last_completed_at)}` : ""}`}
                right={`${p.completed_count}/${p.assigned_count}`}
                styles={styles}
                colors={colors}
              />
            ))}
          </Section>

          <Section title="Contas a pagar e receber" styles={styles}>
            {report.bills_by_status.length === 0 ? <Empty styles={styles} text="Nenhuma conta neste período." /> : report.bills_by_status.map((b, i) => (
              <MiniRow
                key={`${b.bill_type}-${b.status}-${i}`}
                icon={b.bill_type === "payable" ? "arrow-down-circle-outline" : "arrow-up-circle-outline"}
                title={b.bill_type === "payable" ? "A pagar" : "A receber"}
                sub={`${b.status} • ${b.total_count} conta(s)`}
                right={formatBRL(b.total_amount)}
                styles={styles}
                colors={colors}
              />
            ))}
          </Section>

          <Section title="Atividades recentes" styles={styles}>
            {report.activity.length === 0 ? <Empty styles={styles} text="Nenhuma atividade no período." /> : report.activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{a.action_label}</Text>
                  <Text style={styles.rowSub}>{a.user_name}{a.details ? ` • ${a.details}` : ""}</Text>
                  <Text style={styles.dateText}>{shortDate(a.created_at)}</Text>
                </View>
              </View>
            ))}
          </Section>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value, sub, styles, colors }: any) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={18} color={colors.neutral} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function Section({ title, children, styles }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MiniRow({ icon, title, sub, right, styles, colors }: any) {
  return (
    <View style={styles.miniRow}>
      <View style={styles.miniIcon}><Ionicons name={icon} size={18} color={colors.neutral} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.rightText}>{right}</Text>
    </View>
  );
}

function Empty({ text, styles }: any) {
  return <Text style={styles.emptyText}>{text}</Text>;
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
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.md, lineHeight: 20 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  period: { color: colors.textSecondary, fontWeight: "700", marginBottom: spacing.md },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  summaryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  summaryValue: { color: colors.textPrimary, fontSize: 19, fontWeight: "900", marginTop: 2 },
  summarySub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  sectionHint: { color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 19 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: colors.neutral, fontWeight: "900" },
  rowTitle: { color: colors.textPrimary, fontWeight: "800" },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  amount: { color: colors.textPrimary, fontWeight: "900" },
  barTrack: {
    height: 7,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  barFill: { height: "100%", backgroundColor: colors.neutral, borderRadius: radius.pill },
  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rightText: { color: colors.textPrimary, fontWeight: "900" },
  activityRow: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.neutral, marginTop: 4 },
  dateText: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  emptyText: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    lineHeight: 19,
  },
});
