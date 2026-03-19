import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { StatusBar, View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as QuickActions from "expo-quick-actions";

import SplashScreen from "./src/screens/SplashScreen";
import WalletScreen from "./src/screens/WalletScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ChatScreen from "./src/screens/ChatScreen";
import VoiceChatScreen from "./src/screens/VoiceChatScreen";
import BuyGlitchScreen from "./src/screens/BuyGlitchScreen";
import ContentStudioScreen from "./src/screens/ContentStudioScreen";
import { WalletProvider, usePhantomWallet } from "./src/hooks/usePhantomWallet";
import { GenerationProvider } from "./src/hooks/GenerationContext";

// Quick action context — passes pending action from root to AppContent
const QuickActionContext = createContext<{ pending: string | null; clear: () => void }>({ pending: null, clear: () => {} });

// Admin wallet — only this address sees the Studio tab
const ADMIN_WALLET = "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  dark: true as const,
  colors: {
    ...DefaultTheme.colors,
    primary: "#7c3aed",
    background: "#000000",
    card: "#000000",
    text: "#ffffff",
    border: "#2a2a2a",
    notification: "#ef4444",
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: "#000000" },
  headerTintColor: "#ffffff",
  headerTitleStyle: { fontWeight: "600" as const, fontSize: 16 },
  headerBackTitle: "Back",
  headerShadowVisible: false,
};

// Tab icon component
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>{emoji}</Text>
    </View>
  );
}

// Home tab has its own stack for Chat/VoiceChat navigation
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }: { route: any }) => ({
          headerTitle: route.params?.title || "Chat",
        })}
      />
      <Stack.Screen
        name="VoiceChat"
        component={VoiceChatScreen}
        options={{
          headerTitle: "Voice Chat",
          headerTransparent: true,
          headerTintColor: "#ffffff",
          presentation: "fullScreenModal",
        }}
      />
    </Stack.Navigator>
  );
}

// Main app content — checks wallet and shows login gate or tabs
function AppContent() {
  const { walletAddress, isLoading } = usePhantomWallet();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const { pending, clear } = useContext(QuickActionContext);

  // Handle quick action navigation after nav is ready
  useEffect(() => {
    if (!pending || !walletAddress || !navigationRef.current) return;
    const nav = navigationRef.current;
    try {
      if (pending === "buy") {
        nav.navigate("Buy");
      }
      // "chat" and "voice" land on the Home tab (default), which is already the initial route
    } catch (_) {}
    clear();
  }, [pending, walletAddress]);

  // Still loading wallet from SecureStore
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  // No wallet connected — show login page
  if (!walletAddress) {
    return <WalletScreen />;
  }

  // Check if connected wallet is the admin wallet
  const isAdmin = walletAddress === ADMIN_WALLET;

  // Wallet connected — show main app
  return (
    <NavigationContainer ref={navigationRef} theme={DarkTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: tabStyles.tabBar,
          tabBarActiveTintColor: "#a855f7",
          tabBarInactiveTintColor: "#555555",
          tabBarLabelStyle: tabStyles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Buy"
          component={BuyGlitchScreen}
          options={{
            headerShown: true,
            headerTitle: "Buy $GLITCH",
            headerStyle: { backgroundColor: "#000000" },
            headerTintColor: "#ffffff",
            headerTitleStyle: { fontWeight: "700", fontSize: 18 },
            headerShadowVisible: false,
            tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
            tabBarLabel: "Buy",
          }}
        />
        {isAdmin && (
          <Tab.Screen
            name="Studio"
            component={ContentStudioScreen}
            options={{
              headerShown: true,
              headerTitle: "Creative Hub",
              headerStyle: { backgroundColor: "#000000" },
              headerTintColor: "#ffffff",
              headerTitleStyle: { fontWeight: "700", fontSize: 18 },
              headerShadowVisible: false,
              tabBarIcon: ({ focused }) => <TabIcon emoji="🎨" focused={focused} />,
              tabBarLabel: "Studio",
            }}
          />
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Set up quick actions (home screen long-press shortcuts)
  useEffect(() => {
    QuickActions.setItems([
      { id: "chat", title: "Chat with Bestie", subtitle: "Open AI chat", icon: "message" },
      { id: "voice", title: "Voice Chat", subtitle: "Talk to your bestie", icon: "audio" },
      { id: "buy", title: "Buy $GLITCH", subtitle: "Swap SOL for $GLITCH", icon: "cloud" },
    ]);
  }, []);

  // Listen for quick action triggers
  useEffect(() => {
    // Check if app was launched via a quick action
    if (QuickActions.initial) {
      setPendingAction(QuickActions.initial.id);
    }
    // Listen for quick actions while app is running
    const sub = QuickActions.addListener((action) => {
      setPendingAction(action.id);
    });
    return () => sub.remove();
  }, []);

  if (showSplash) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <QuickActionContext.Provider value={{ pending: pendingAction, clear: () => setPendingAction(null) }}>
        <WalletProvider>
          <GenerationProvider>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <AppContent />
          </GenerationProvider>
        </WalletProvider>
      </QuickActionContext.Provider>
    </SafeAreaProvider>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0a0a0a",
    borderTopColor: "#1a1a1a",
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 88 : 65,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 28,
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  icon: {
    fontSize: 20,
  },
  iconActive: {
    fontSize: 22,
  },
});
