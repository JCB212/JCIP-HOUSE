import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/AuthContext";
import { formatBRL, formatDateBR, radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

type StatementRow = {
  id: string;
  type: "expense" | "contribution" | "payment";
  direction: "in" | "out" | "transfer";
  date: string;
  amount: number;
  title: string;
  subtitle: string;
};

export default function Statement() {
  const { house } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    setLoading(true);
    try {
      setRows(await api.get<StatementRow[]>(`/houses/${house.id}/statement`));
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }, [house]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = rows.reduce(
    (acc, row) => {
      if (row.direction === "in") acc.in += row.amount;
      if (row.direction === "out") acc.out += row.amount;
      return acc;
    },
    { in: 0, out: 0 }
  );

  function iconFor(row: StatementRow) {
    if (row.type === "contribution") return "cash-outline";
    if (row.type === "payment") return "swap-horizontal-outline";
    return "receipt-outline";
  }

  function colorFor(row: StatementRow) {
    if (row.direction === "in") return colors.positive;
    if (row.direction === "out") return colors.debt;
    return colors.neutral;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Extrato da casa</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Entradas</Text>
            <Text style={[styles.summaryValue, { color: colors.positive }]}>{formatBRL(totals.in, house?.currency)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.summaryLabel}>Saídas</Text>
            <Text style={[styles.summaryValue, { color: colors.debt }]}>{formatBRL(totals.out, house?.currency)}</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Sem movimentações</Text>
            <Text style={styles.emptyText}>Gastos, contribuições e acertos aparecerão aqui.</Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={`${row.type}-${row.id}`} style={styles.rowCard}>
              <View style={[styles.rowIcon, { backgroundColor: `${colorFor(row)}22` }]}>
                <Ionicons name={iconFor(row) as any} size={20} color={colorFor(row)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowSub}>{row.subtitle}</Text>
                <Text style={styles.rowDate}>{formatDateBR(row.date)}</Text>
              </View>
              <Text style={[styles.rowAmount, { color: colorFor(row) }]}>
                {row.direction === "out" ? "-" : row.direction === "in" ? "+" : ""}
                {formatBRL(row.amount, house?.currency)}
              </Text>
            </View>
          ))
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
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: { color: colors.primaryText, opacity: 0.75, fontSize: 12, fontWeight: "700" },
  summaryValue: { fontSize: 20, fontWeight: "900", marginTop: 4 },
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
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowAmount: { fontWeight: "900", fontSize: 13, marginLeft: spacing.sm },
});
