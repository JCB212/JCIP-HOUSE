import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

const TOPICS = [
  {
    title: "Programa teste",
    text: "O JCIP House está em fase de testes. Podem existir falhas, interrupções, ajustes de banco de dados e mudanças nas funcionalidades antes de uma versão comercial final.",
  },
  {
    title: "Dados tratados",
    text: "O app pode armazenar nome, e-mail, casas, moradores, gastos, contribuições, acertos, contas, lista de compras, afazeres, datas, horários e registros de sincronização.",
  },
  {
    title: "Finalidade",
    text: "Os dados são usados para autenticação, organização financeira, divisão de despesas, controle da casa, sincronização entre dispositivos e melhoria do serviço.",
  },
  {
    title: "Segurança",
    text: "Usamos senha protegida por hash, autenticação por token, comunicação HTTPS na API publicada, permissões por casa e separação de dados por usuário/casa.",
  },
  {
    title: "Responsabilidade do usuário",
    text: "Use senhas fortes, não compartilhe acesso, confirme os dados lançados e mantenha o app atualizado. Durante os testes, evite cadastrar informações sensíveis que não sejam necessárias.",
  },
  {
    title: "Direitos LGPD",
    text: "Você pode solicitar correção, exportação ou remoção dos seus dados entrando em contato com o suporte do projeto.",
  },
];

export default function TermsLgpd() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termo LGPD</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Aviso de privacidade e uso de dados</Text>
        <Text style={styles.subtitle}>Versão 1.2-test</Text>
        {TOPICS.map((topic) => (
          <View key={topic.title} style={styles.card}>
            <Text style={styles.cardTitle}>{topic.title}</Text>
            <Text style={styles.cardText}>{topic.text}</Text>
          </View>
        ))}
        <Text style={styles.footer}>
          Ao criar conta, você declara que leu este termo e concorda com o tratamento dos dados para operar o programa teste.
        </Text>
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
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "900" },
  cardText: { color: colors.textSecondary, marginTop: 4, lineHeight: 20, fontSize: 13 },
  footer: { color: colors.textPrimary, fontWeight: "700", lineHeight: 20, marginTop: spacing.md },
});
