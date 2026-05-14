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
    text: "A casa é o grupo principal. Ela pode ser sua família, república, casal, escritório pequeno ou qualquer grupo que divide contas. O dono cria a casa e passa o código para os moradores entrarem. Cada morador aparece no resumo com quanto pagou, quanto contribuiu, quanto cabe para ele e se está devendo ou recebendo.",
  },
  {
    icon: "receipt-outline",
    title: "Gastos",
    text: "Use Gastos quando saiu dinheiro. Informe o nome do gasto, valor, data, quem pagou e a categoria. Um gasto coletivo é dividido entre moradores. Um gasto individual fica para uma pessoa só. Em compras de mercado, você pode lançar produtos com quantidade e valor para ter controle mais detalhado.",
  },
  {
    icon: "repeat-outline",
    title: "Recorrentes",
    text: "Recorrentes são coisas que acontecem todo mês, como aluguel, internet, energia, condomínio ou uma contribuição fixa de cada pessoa. Você cadastra uma vez e depois gera no mês atual. Isso evita esquecer uma conta importante.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Acertos",
    text: "Acertos mostram quem precisa transferir dinheiro para quem. O app faz a conta para reduzir a quantidade de transferências. Quando uma pessoa pagar a outra, registre o acerto para o saldo ficar correto.",
  },
  {
    icon: "analytics-outline",
    title: "Extrato",
    text: "O extrato é a linha do tempo da casa. Ele junta entradas, saídas e acertos. Use quando quiser conferir o que aconteceu no mês, procurar um lançamento ou entender por que o saldo mudou.",
  },
  {
    icon: "bar-chart-outline",
    title: "Relatórios",
    text: "Relatórios mostram tudo de forma resumida: quem pagou compras, quem cadastrou gastos, quem contribuiu, quem adicionou itens na lista de compras, quem marcou como comprado, quem fez afazeres e quais atividades aconteceram na casa.",
  },
  {
    icon: "wallet-outline",
    title: "Contas a pagar/receber",
    text: "Contas a pagar são compromissos futuros, como uma fatura ou boleto. Contas a receber são valores que alguém precisa pagar para você ou para a casa. Cadastre vencimento, valor e pessoa/fornecedor. Depois marque como pago quando resolver.",
  },
  {
    icon: "cart-outline",
    title: "Lista de compras",
    text: "A lista de compras ajuda antes e durante o mercado. Coloque produto, quantidade, unidade e observação. Durante a compra, marque o item quando pegar. O app registra quem criou e quem marcou.",
  },
  {
    icon: "checkbox-outline",
    title: "Afazeres da casa",
    text: "Afazeres são tarefas da rotina: lavar pratos, tirar lixo, limpar banheiro, comprar água, organizar sala. O dono ou sub-dono cria a tarefa, escolhe uma ou mais pessoas, coloca dia e hora, e quem recebeu marca quando fez. O app guarda data e horário.",
  },
  {
    icon: "cloud-done-outline",
    title: "Offline e nuvem",
    text: "Sem internet, o app mostra Falta de sincronização em vermelho. Algumas ações ficam guardadas no celular e são enviadas quando a internet voltar. Ações muito sensíveis, como permissões e transferência de dono, exigem internet para proteger a casa.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Permissões",
    text: "Em Configurações, o dono escolhe o que cada morador pode fazer. Dá para liberar ou bloquear gastos, extrato, relatórios, lista de compras, contas, afazeres, moradores e configurações. Sub-dono é uma pessoa de confiança que ajuda na administração.",
  },
  {
    icon: "key-outline",
    title: "Transferir a casa",
    text: "O dono pode passar a casa para outro morador. Por segurança, o app pede dupla confirmação: escolher a pessoa, digitar o nome exato da casa e escrever TRANSFERIR. Faça isso só com alguém de confiança.",
  },
  {
    icon: "moon-outline",
    title: "Modo claro e escuro",
    text: "O modo claro usa fundo claro com letras escuras. O modo escuro usa fundo escuro com letras claras. Você troca pelo Perfil. A ideia é manter leitura boa em qualquer horário.",
  },
];

const DAILY_STEPS = [
  "Crie a casa e convide os moradores pelo código.",
  "Confira as permissões de cada pessoa em Configurações.",
  "Cadastre gastos sempre que alguém pagar algo.",
  "Use Recorrentes para contas fixas e contribuições mensais.",
  "Use Lista de compras antes de ir ao mercado.",
  "Use Afazeres para dividir tarefas da rotina.",
  "Veja Acertos quando chegar a hora de transferir dinheiro.",
  "Abra Relatórios para conferir quem fez cada ação.",
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
          <Text style={styles.subtitle}>Guia simples para organizar finanças, compras e tarefas da casa.</Text>
          <TouchableOpacity style={styles.tutorialBtn} onPress={() => router.push("/tutorial" as any)}>
            <Ionicons name="game-controller-outline" size={18} color={colors.primaryText} />
            <Text style={styles.tutorialBtnText}>Abrir tutorial passo a passo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>Ordem recomendada para começar</Text>
          {DAILY_STEPS.map((step, index) => (
            <Text key={step} style={styles.stepText}>{index + 1}. {step}</Text>
          ))}
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
  tutorialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  tutorialBtnText: { color: colors.primaryText, fontWeight: "900" },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stepTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "900", marginBottom: spacing.sm },
  stepText: { color: colors.textSecondary, lineHeight: 22, marginTop: 2 },
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
