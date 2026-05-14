import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { markTutorialSeen } from "../src/tutorialState";
import { radius, spacing } from "../src/theme";
import { useAppTheme } from "../src/ThemeContext";

const SLIDES = [
  {
    icon: "home-outline",
    title: "Início: o resumo da casa",
    text: "Aqui você vê o mês atual, o saldo da casa, quanto entrou, quanto saiu e um resumo de cada morador. Se algo estiver estranho, comece conferindo essa tela.",
    tip: "Toque no mês para acompanhar o ciclo financeiro que está aberto.",
  },
  {
    icon: "receipt-outline",
    title: "Gastos: tudo que saiu",
    text: "Use Gastos para registrar mercado, aluguel, luz, internet ou qualquer compra. Você escolhe quem pagou e se o gasto é dividido entre todos ou só uma pessoa.",
    tip: "Quando for mercado, use itens para colocar quantidade e valor de cada produto.",
  },
  {
    icon: "repeat-outline",
    title: "Recorrentes: contas que voltam",
    text: "Aqui ficam as despesas fixas, como aluguel e internet, e também os planos de contribuição mensal. Assim você não precisa digitar tudo de novo todo mês.",
    tip: "Depois de cadastrar, toque em gerar fixas para criar os lançamentos do mês.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Acertos: quem deve para quem",
    text: "O app calcula automaticamente a menor quantidade de transferências para deixar todo mundo certo. Quando alguém pagar, registre o acerto.",
    tip: "Isso evita várias transferências pequenas e deixa a casa organizada.",
  },
  {
    icon: "cart-outline",
    title: "Lista de compras",
    text: "Antes de ir ao mercado, coloque os produtos, quantidades e observações. Durante a compra, marque cada item como comprado.",
    tip: "O relatório mostra quem criou itens e quem marcou como comprado.",
  },
  {
    icon: "checkbox-outline",
    title: "Afazeres da casa",
    text: "O dono ou sub-dono cria tarefas, escolhe responsáveis e define dia e hora. Quem recebeu a tarefa marca como feita, e o app guarda data e hora.",
    tip: "Use isso para pratos, lixo, limpeza, compras ou qualquer rotina da casa.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Permissões e segurança",
    text: "Em Configurações, o dono decide o que cada morador pode ver ou alterar. Também dá para transferir a casa para outro morador com dupla confirmação.",
    tip: "Dê acesso total só para pessoas de confiança.",
  },
  {
    icon: "analytics-outline",
    title: "Relatórios",
    text: "Os relatórios mostram gastos, contribuições, compras, afazeres e atividades. É o lugar para entender quem fez cada coisa dentro da casa.",
    tip: "Use relatórios quando quiser conferir o histórico do mês.",
  },
  {
    icon: "cloud-offline-outline",
    title: "Sem internet",
    text: "Quando o celular ficar sem internet, o app avisa falta de sincronização. Algumas ações ficam salvas no aparelho e são enviadas quando a conexão voltar.",
    tip: "Transferência de dono e permissões exigem internet por segurança.",
  },
];

export default function Tutorial() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  async function finish() {
    await markTutorialSeen();
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Image source={require("../assets/images/jcip-house-logo.png")} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Pular</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / SLIDES.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Passo {index + 1} de {SLIDES.length}</Text>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name={slide.icon as any} size={34} color={colors.neutral} />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.text}>{slide.text}</Text>
          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={18} color={colors.warning} />
            <Text style={styles.tipText}>{slide.tip}</Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            disabled={index === 0}
            onPress={() => setIndex((v) => Math.max(0, v - 1))}
            style={[styles.navBtn, index === 0 && { opacity: 0.35 }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            <Text style={styles.navText}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (last ? finish() : setIndex((v) => v + 1))}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryText}>{last ? "Começar" : "Próximo"}</Text>
            <Ionicons name={last ? "checkmark" : "chevron-forward"} size={20} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 120 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 72, height: 72, borderRadius: 18 },
  skipBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  skipText: { color: colors.textSecondary, fontWeight: "800" },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  progressFill: { height: "100%", backgroundColor: colors.neutral, borderRadius: radius.pill },
  progressText: { color: colors.textSecondary, marginTop: spacing.sm, fontWeight: "700" },
  card: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: colors.neutralBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "900", lineHeight: 34 },
  text: { color: colors.textSecondary, fontSize: 16, lineHeight: 25, marginTop: spacing.md },
  tipBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipText: { flex: 1, color: colors.textPrimary, lineHeight: 21, fontWeight: "600" },
  bottomRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.surface,
  },
  navText: { color: colors.textPrimary, fontWeight: "800" },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  primaryText: { color: colors.primaryText, fontWeight: "900" },
});
