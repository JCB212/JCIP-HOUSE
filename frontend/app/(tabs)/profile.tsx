import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { radius, spacing } from "../../src/theme";
import { useAppTheme } from "../../src/ThemeContext";

export default function Profile() {
  const { user, house, houses, setHouse, logout } = useAuth();
  const { colors, mode, toggleTheme } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  async function onLogout() {
    const doLogout = async () => {
      await logout();
      router.replace("/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Tem certeza que deseja sair?")) {
        await doLogout();
      }
      return;
    }
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: doLogout },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.title}>Perfil</Text>

        <View style={styles.userCard}>
          <Image source={require("../../assets/images/jcip-house-logo.png")} style={styles.logo} resizeMode="contain" />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>Minhas casas</Text>
        {houses.map((h) => (
          <TouchableOpacity
            key={h.id}
            onPress={() => setHouse(h)}
            style={[styles.row, h.id === house?.id && { borderColor: colors.primary, borderWidth: 2 }]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="home" size={18} color={colors.neutral} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{h.name}</Text>
              <Text style={styles.rowSub}>{h.members.length} moradores • {h.invite_code}</Text>
            </View>
            {h.id === house?.id && <Ionicons name="checkmark-circle" size={22} color={colors.positive} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.row} onPress={() => router.push("/onboarding")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.positiveBg }]}>
            <Ionicons name="add" size={18} color={colors.positive} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Criar ou entrar em outra casa</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.section}>Conta</Text>
        <TouchableOpacity style={styles.row} onPress={toggleTheme}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={mode === "dark" ? "sunny-outline" : "moon-outline"} size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>{mode === "dark" ? "Usar modo claro" : "Usar modo escuro"}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/settings")}>
          <View style={styles.rowIcon}>
            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Configurações da casa</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/statement")}>
          <View style={styles.rowIcon}>
            <Ionicons name="analytics-outline" size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Extrato da casa</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/reports" as any)}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="bar-chart-outline" size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Relatórios completos</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/bills")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.debtBg }]}>
            <Ionicons name="wallet-outline" size={18} color={colors.debt} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Contas a pagar/receber</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/shopping-list")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.positiveBg }]}>
            <Ionicons name="cart-outline" size={18} color={colors.positive} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Lista de compras</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/chores" as any)}>
          <View style={[styles.rowIcon, { backgroundColor: colors.neutralBg }]}>
            <Ionicons name="checkbox-outline" size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Afazeres da casa</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/help")}>
          <View style={[styles.rowIcon, { backgroundColor: colors.neutralBg }]}>
            <Ionicons name="help-circle-outline" size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Ajuda e tutorial</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/tutorial" as any)}>
          <View style={[styles.rowIcon, { backgroundColor: colors.neutralBg }]}>
            <Ionicons name="game-controller-outline" size={18} color={colors.neutral} />
          </View>
          <Text style={[styles.rowTitle, { flex: 1 }]}>Ver tutorial inicial</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity testID="profile-logout-btn" style={[styles.row, { marginTop: spacing.md }]} onPress={onLogout}>
          <View style={[styles.rowIcon, { backgroundColor: colors.debtBg }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.debt} />
          </View>
          <Text style={[styles.rowTitle, { color: colors.debt, flex: 1 }]}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>JCIP House Finance v1.2</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.lg },
  userCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: { width: 92, height: 92, borderRadius: 20, marginBottom: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "900", color: "#fff" },
  name: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.md },
  email: { color: colors.textSecondary, marginTop: 2 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  rowTitle: { color: colors.textPrimary, fontWeight: "600" },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  footer: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 12,
    marginTop: spacing.xl,
  },
});
