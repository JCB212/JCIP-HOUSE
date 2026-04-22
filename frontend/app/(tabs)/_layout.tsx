import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Gastos",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: "Acertos",
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Moradores",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
