import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";
import { colors, formatBRL, radius, shadows, spacing } from "../../src/theme";

type DashboardData = {
  house_id: string;
  house_name: string;
  currency: string;
  total_expenses_month: number;
  total_contributions_month: number;
  house_balance: number;
  members_summary: Array<{
    user_id: string;
    name: string;
    total_paid: number;
    total_share: number;
    total_contributed: number;
    balance: number;
  }>;
  debts: Array<{
    from_user_id: string;
    from_name: string;
    to_user_id: string;
    to_name: string;
    amount: number;
  }>;
  expenses_by_category: Array<{ name: string; icon: string; color: string; total: number }>;
  recent_expenses: Array<any>;
};

export default function Home() {
  const { house, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!house) return;
    try {
      const d = await api.get<DashboardData>(`/houses/${house.id}/dashboard`);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [house]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!house) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.subtitle}>Nenhuma casa selecionada</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const totalCat = (data?.expenses_by_category || []).reduce((s, c) => s + c.total, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name?.split(" ")[0]}</Text>
            <Text style={styles.houseTitle}>{house.name}</Text>
          </View>
          <TouchableOpacity
            testID="home-settings-btn"
            onPress={() => router.push("/settings")}
            style={styles.iconBtn}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo da casa (mês)</Text>
          <Text
            style={[
              styles.balanceValue,
              { color: (data?.house_balance || 0) >= 0 ? colors.positive : colors.debt },
            ]}
          >
            {formatBRL(data?.house_balance || 0, data?.currency)}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-up" size={14} color={colors.positive} />
              <Text style={styles.balanceItemLabel}>Contribuído</Text>
              <Text style={[styles.balanceItemValue, { color: colors.positive }]}>
                {formatBRL(data?.total_contributions_month || 0, data?.currency)}
              </Text>
            </View>
            <View style={[styles.balanceItem, { alignItems: "flex-end" }]}>
              <Ionicons name="arrow-down" size={14} color={colors.debt} />
              <Text style={styles.balanceItemLabel}>Gasto</Text>
              <Text style={[styles.balanceItemValue, { color: colors.debt }]}>
                {formatBRL(data?.total_expenses_month || 0, data?.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="home-add-expense-btn"
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/expense/new")}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.actionText}>Gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-add-contribution-btn"
            style={[styles.actionBtn, { backgroundColor: colors.positive }]}
            onPress={() => router.push("/contribution/new")}
          >
            <Ionicons name="cash" size={20} color="#fff" />
            <Text style={styles.actionText}>Contribuição</Text>
          </TouchableOpacity>
        </View>

        {/* Debts */}
        {(data?.debts?.length || 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quem deve para quem</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/debts")}>
                <Text style={styles.linkText}>Ver tudo</Text>
              </TouchableOpacity>
            </View>
            {data!.debts.slice(0, 4).map((d, i) => (
              <View key={i} style={styles.debtCard} testID={`debt-${i}`}>
                <View style={styles.debtIcon}>
                  <Ionicons name="arrow-forward" size={18} color={colors.debt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.debtText}>
                    <Text style={{ fontWeight: "700" }}>{d.from_name}</Text> deve para{" "}
                    <Text style={{ fontWeight: "700" }}>{d.to_name}</Text>
                  </Text>
                  <Text style={[styles.debtAmount]}>
                    {formatBRL(d.amount, data?.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Members summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo dos moradores (mês)</Text>
          {(data?.members_summary || []).map((m) => (
            <View key={m.user_id} style={styles.memberCard} testID={`member-${m.user_id}`}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {m.name.substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSub}>
                  Pagou {formatBRL(m.total_paid, data?.currency)} • Cabe{" "}
                  {formatBRL(m.total_share, data?.currency)}
                </Text>
              </View>
              <View
                style={[
                  styles.balancePill,
                  {
                    backgroundColor:
                      m.balance >= 0 ? colors.positiveBg : colors.debtBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.balancePillText,
                    { color: m.balance >= 0 ? colors.positive : colors.debt },
                  ]}
                >
                  {m.balance >= 0 ? "+" : ""}
                  {formatBRL(m.balance, data?.currency)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Categories */}
        {(data?.expenses_by_category?.length || 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoria</Text>
            {data!.expenses_by_category.slice(0, 6).map((c, i) => {
              const pct = totalCat > 0 ? (c.total / totalCat) * 100 : 0;
              return (
                <View key={i} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: c.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catAmount}>
                        {formatBRL(c.total, data?.currency)}
                      </Text>
                    </View>
                    <View style={styles.catBarBg}>
                      <View
                        style={[
                          styles.catBarFill,
                          { width: `${pct}%`, backgroundColor: c.color },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gastos recentes</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/expenses")}>
              <Text style={styles.linkText}>Ver tudo</Text>
            </TouchableOpacity>
          </View>
          {(data?.recent_expenses || []).slice(0, 5).map((e: any) => (
            <View key={e.id} style={styles.expenseCard}>
              <View
                style={[
                  styles.catIconBg,
                  { backgroundColor: (e.category_color || colors.neutral) + "22" },
                ]}
              >
                <Ionicons name="receipt-outline" size={18} color={e.category_color || colors.neutral} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expDesc}>{e.description}</Text>
                <Text style={styles.expMeta}>
                  {e.payer_name} • {e.category_name || "Sem categoria"}
                </Text>
              </View>
              <Text style={styles.expAmount}>{formatBRL(e.amount, data?.currency)}</Text>
            </View>
          ))}
          {(data?.recent_expenses?.length || 0) === 0 && (
            <Text style={styles.empty}>Nenhum gasto ainda. Adicione o primeiro!</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  subtitle: { color: colors.textSecondary },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: colors.textSecondary, fontSize: 14 },
  houseTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  balanceLabel: { color: "#d6d3d1", fontSize: 13 },
  balanceValue: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: 4 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  balanceItem: { flex: 1 },
  balanceItemLabel: { color: "#d6d3d1", fontSize: 12, marginTop: 4 },
  balanceItemValue: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.lg,
    gap: 6,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  section: { marginTop: spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  linkText: { color: colors.neutral, fontWeight: "600", fontSize: 13 },
  debtCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debtIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.debtBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  debtText: { color: colors.textPrimary },
  debtAmount: { color: colors.debt, fontWeight: "700", fontSize: 15, marginTop: 2 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  memberAvatarText: { color: colors.neutral, fontWeight: "800", fontSize: 16 },
  memberName: { fontWeight: "700", color: colors.textPrimary, fontSize: 15 },
  memberSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  balancePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  balancePillText: { fontSize: 12, fontWeight: "800" },
  catRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  catName: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  catAmount: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  catBarBg: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3 },
  catBarFill: { height: 6, borderRadius: 3 },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  expDesc: { color: colors.textPrimary, fontWeight: "600" },
  expMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  expAmount: { color: colors.textPrimary, fontWeight: "800", fontSize: 15 },
  empty: { color: colors.textSecondary, textAlign: "center", padding: spacing.lg },
});
