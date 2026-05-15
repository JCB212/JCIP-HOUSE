import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../src/theme";
import { useAppMode } from "../src/AppModeContext";
import { useAppTheme } from "../src/ThemeContext";

type HelpItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
};

const COMMON_STEPS = [
  "Na tela inicial existe um botão com dois lados: JCIP HOUSE e JCIP HOUSE FINANCE.",
  "Toque em JCIP HOUSE para cuidar da rotina da casa.",
  "Toque em JCIP HOUSE FINANCE para cuidar do dinheiro.",
  "Quando você muda o modo, o menu de baixo também muda. Isso evita misturar tarefas com finanças.",
  "A lista de compras pode ser usada nos dois modos, porque ela ajuda tanto na casa quanto nos gastos de mercado.",
];

const HOUSE_STEPS = [
  "Abra JCIP HOUSE.",
  "Entre em Afazeres para criar tarefas como lavar louça, tirar lixo, limpar banheiro ou organizar a sala.",
  "Escolha data, hora e repetição. Pode ser uma vez, todo dia, várias vezes por dia, semanal, quinzenal, mensal ou personalizado.",
  "Se a tarefa tiver responsável, marque a pessoa. Se não tiver, deixe sem responsável para alguém assumir depois.",
  "Use Compras para montar a lista do mercado com quantidade, unidade e observação.",
  "Use Contas para registrar contas a pagar ou valores a receber.",
  "Use Perfil para trocar tema, abrir configurações, permissões, relatórios e este painel de ajuda.",
];

const FINANCE_STEPS = [
  "Abra JCIP HOUSE FINANCE.",
  "Entre em Gastos sempre que sair dinheiro da casa.",
  "Escolha quem pagou, valor, data, categoria e se o gasto será dividido entre todos ou lançado para uma pessoa.",
  "Use Recorrentes para aluguel, internet, energia, condomínio e contribuições mensais.",
  "Depois de cadastrar recorrentes, gere as fixas do mês para não digitar tudo de novo.",
  "Entre em Acertos para ver quem precisa transferir para quem.",
  "Abra Relatórios para conferir quem cadastrou gastos, quem pagou, quem comprou, quem fez tarefas e o histórico do período.",
];

const HOUSE_GUIDE: HelpItem[] = [
  {
    icon: "home-outline",
    title: "O que é o modo JCIP HOUSE",
    text: "É a parte do app feita para a rotina da casa. Aqui ficam afazeres, lista de compras, contas a pagar ou receber, combinados e organização dos moradores.",
  },
  {
    icon: "grid-outline",
    title: "Menu do modo casa",
    text: "No modo casa, o menu de baixo mostra Lar, Afazeres, Compras, Contas e Perfil. Gastos, Recorrentes e Acertos saem do menu para a tela ficar limpa.",
  },
  {
    icon: "checkbox-outline",
    title: "Afazeres da casa",
    text: "Use para dividir tarefas. O dono ou sub-dono cria a tarefa, escolhe data, hora, repetição e responsável. Quem recebeu a tarefa marca como feita, e o app registra dia e hora.",
  },
  {
    icon: "repeat-outline",
    title: "Tarefas recorrentes",
    text: "Uma tarefa pode acontecer todo dia, várias vezes ao dia, toda semana, a cada 15 dias, todo mês ou em um intervalo personalizado. Isso serve para coisas como lavar pratos, tirar lixo ou limpar banheiro.",
  },
  {
    icon: "person-add-outline",
    title: "Tarefa sem responsável",
    text: "Se ninguém for escolhido, a tarefa fica aberta para qualquer morador assumir. Isso é útil para coisas simples, como comprar água ou levar uma encomenda.",
  },
  {
    icon: "cart-outline",
    title: "Lista de compras",
    text: "Coloque produto, quantidade, unidade e observação. Durante o mercado, marque o item quando pegar. O app guarda quem colocou o item e quem marcou como comprado.",
  },
  {
    icon: "calendar-outline",
    title: "Contas da casa",
    text: "Use para lembrar boletos, faturas, aluguel, internet, ou valores que alguém precisa pagar para a casa. Cadastre vencimento, valor e depois marque como pago.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Permissões",
    text: "O dono decide o que cada morador pode ver ou alterar. Pode liberar ou bloquear afazeres, compras, contas, relatórios, moradores e configurações.",
  },
  {
    icon: "key-outline",
    title: "Passar a casa para outra pessoa",
    text: "A transferência de dono exige dupla confirmação. Você escolhe o novo dono, digita o nome exato da casa e confirma a palavra TRANSFERIR.",
  },
];

const FINANCE_GUIDE: HelpItem[] = [
  {
    icon: "wallet-outline",
    title: "O que é o modo financeiro",
    text: "É a parte do app feita para controlar o dinheiro da casa. Aqui ficam saldo, gastos, contribuições, recorrentes, acertos, extrato e relatórios.",
  },
  {
    icon: "grid-outline",
    title: "Menu do modo financeiro",
    text: "No modo financeiro, o menu de baixo mostra Início, Gastos, Recorrentes, Acertos e Perfil. Afazeres e Contas da casa saem do menu para não misturar assuntos.",
  },
  {
    icon: "receipt-outline",
    title: "Gastos",
    text: "Use quando alguém pagou alguma coisa. Informe nome, valor, data, categoria e quem pagou. O app calcula a divisão entre moradores conforme o tipo escolhido.",
  },
  {
    icon: "people-outline",
    title: "Divisão de gastos",
    text: "Um gasto coletivo pode ser dividido igual para todos, por peso ou de forma personalizada. Um gasto individual fica ligado a uma pessoa específica.",
  },
  {
    icon: "repeat-outline",
    title: "Recorrentes",
    text: "Cadastre aluguel, internet, energia, condomínio e contribuições mensais. Depois use Gerar fixas para criar os lançamentos do mês automaticamente.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Acertos",
    text: "O app mostra a menor quantidade de transferências para quitar as diferenças. Quando alguém pagar, registre o acerto para o saldo ficar correto.",
  },
  {
    icon: "analytics-outline",
    title: "Extrato e relatórios",
    text: "O extrato mostra a linha do tempo de entradas, saídas e transferências. Os relatórios mostram totais, quem fez cada ação e o histórico por período.",
  },
  {
    icon: "cart-outline",
    title: "Compras no financeiro",
    text: "A lista de compras continua disponível porque mercado também mexe no orçamento. Você pode montar a lista antes e depois lançar o gasto com mais controle.",
  },
  {
    icon: "cloud-offline-outline",
    title: "Sem internet",
    text: "Se aparecer Falta de sincronização, o celular está sem conexão ou sem falar com a nuvem. Algumas ações ficam no aparelho e sincronizam depois.",
  },
];

export default function Help() {
  const router = useRouter();
  const { appMode, setAppMode } = useAppMode();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isHouse = appMode === "house";
  const title = isHouse ? "Ajuda do JCIP HOUSE" : "Ajuda do Finance";
  const subtitle = isHouse
    ? "Rotina da casa, tarefas, compras, contas e permissões."
    : "Gastos, recorrentes, acertos, extrato e relatórios.";
  const steps = isHouse ? HOUSE_STEPS : FINANCE_STEPS;
  const guide = isHouse ? HOUSE_GUIDE : FINANCE_GUIDE;

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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeBtn, isHouse && styles.modeBtnActive]}
              onPress={() => setAppMode("house")}
            >
              <Ionicons name="home-outline" size={16} color={isHouse ? colors.primaryText : colors.textSecondary} />
              <Text style={[styles.modeText, isHouse && styles.modeTextActive]}>JCIP HOUSE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, !isHouse && styles.modeBtnActive]}
              onPress={() => setAppMode("finance")}
            >
              <Ionicons name="wallet-outline" size={16} color={!isHouse ? colors.primaryText : colors.textSecondary} />
              <Text style={[styles.modeText, !isHouse && styles.modeTextActive]}>FINANCE</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.tutorialBtn} onPress={() => router.push("/tutorial" as any)}>
            <Ionicons name="play-circle-outline" size={18} color={colors.primaryText} />
            <Text style={styles.tutorialBtnText}>Abrir tutorial guiado</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>Como mudar de modo</Text>
          {COMMON_STEPS.map((step, index) => (
            <Text key={step} style={styles.stepText}>{index + 1}. {step}</Text>
          ))}
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>Passo a passo deste modo</Text>
          {steps.map((step, index) => (
            <Text key={step} style={styles.stepText}>{index + 1}. {step}</Text>
          ))}
        </View>

        {guide.map((item) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon} size={20} color={colors.neutral} />
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
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "900", marginTop: spacing.md, textAlign: "center" },
  subtitle: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, lineHeight: 20 },
  modeSwitch: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginTop: spacing.md,
    width: "100%",
  },
  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { color: colors.textSecondary, fontSize: 11, fontWeight: "900", textAlign: "center" },
  modeTextActive: { color: colors.primaryText },
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
    width: "100%",
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
  stepText: { color: colors.textSecondary, lineHeight: 22, marginTop: 3 },
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
