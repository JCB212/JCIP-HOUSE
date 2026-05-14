import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

const SECTIONS = [
  {
    icon: "home-outline",
    title: "Casa e moradores",
    text: "Crie uma casa, convide moradores pelo código e acompanhe quanto cada pessoa pagou, quanto cabe para cada uma e o saldo final.",
  },
  {
    icon: "receipt-outline",
    title: "Gastos",
    text: "Cadastre gastos coletivos ou individuais, escolha categoria, pagador e forma de divisão. Em compras de mercado, lance itens com quantidade e valor.",
  },
  {
    icon: "repeat-outline",
    title: "Recorrentes",
    text: "Registre despesas fixas como aluguel, internet e luz. Também crie planos de contribuição mensal para gerar tudo com um toque.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Acertos",
    text: "O app calcula o menor número de transferências para equilibrar as dívidas da casa e permite registrar quando alguém quitou.",
  },
  {
    icon: "analytics-outline",
    title: "Extrato",
    text: "Veja entradas, saídas e acertos da casa em uma linha do tempo. O dono escolhe quais moradores podem acessar essa área.",
  },
  {
    icon: "wallet-outline",
    title: "Contas a pagar/receber",
    text: "Cadastre vencimentos, fornecedores ou pessoas que devem pagar. Marque como pago quando a conta for quitada.",
  },
  {
    icon: "cart-outline",
    title: "Lista de compras",
    text: "Anote produtos, quantidades, unidade e marque o que já foi comprado durante a ida ao mercado.",
  },
  {
    icon: "checkbox-outline",
    title: "Afazeres da casa",
    text: "O dono ou sub-dono cria tarefas, escolhe responsáveis e define dia e hora. Quem recebeu a tarefa marca quando fez, e o app registra data e horário.",
  },
  {
    icon: "cloud-done-outline",
    title: "Offline e nuvem",
    text: "Quando o celular estiver sem internet, alterações permitidas ficam salvas no aparelho. Assim que a conexão voltar, o app sincroniza com a API.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Permissões",
    text: "Em Configurações, o dono controla o que cada morador pode ver ou alterar: gastos, extrato, recorrentes, acertos, lista e configurações.",
  },
  {
    icon: "moon-outline",
    title: "Modo claro e escuro",
    text: "A interface acompanha o modo do celular e usa a identidade JCIP-HOUSE: azul profundo, ciano e tons claros de apoio.",
  },
];

export default function Help() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={require("../assets/images/jcip-house-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Tutorial JCIP House</Text>
          <Text style={styles.subtitle}>Guia rápido para organizar as finanças da casa e da vida pessoal.</Text>
        </View>

        {SECTIONS.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon as any} size={20} color={colors.neutral} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.text}</Text>
            </View>
          </View>
        ))}
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
  hero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  logo: { width: 104, height: 104, borderRadius: 24 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "900", marginTop: spacing.md },
  subtitle: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.textPrimary, fontWeight: "800", fontSize: 15 },
  cardText: { color: colors.textSecondary, marginTop: 3, lineHeight: 19, fontSize: 13 },
});
