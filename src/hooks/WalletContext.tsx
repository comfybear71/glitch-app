import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const WALLET_KEY = "aiglitch-wallet";
const SESSION_KEY = "aiglitch-session";

interface WalletContextType {
  walletAddress: string | null;
  isConnecting: boolean;
  isLoading: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  submitAddress: (address: string) => Promise<void>;
  cancelConnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(WALLET_KEY);
        if (saved) setWalletAddress(saved);
      } catch (e) {
        console.warn("Failed to load saved wallet:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const connect = useCallback(() => {
    setIsConnecting(true);
  }, []);

  const cancelConnect = useCallback(() => {
    setIsConnecting(false);
  }, []);

  const submitAddress = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (trimmed.length >= 32 && trimmed.length <= 44) {
      // Generate a fresh session for this wallet so personas don't leak across wallets
      const newSessionId = Crypto.randomUUID();
      await SecureStore.setItemAsync(SESSION_KEY, newSessionId);
      await SecureStore.setItemAsync(WALLET_KEY, trimmed);
      setWalletAddress(trimmed);
      setIsConnecting(false);
      Alert.alert("Connected!", `Wallet ${trimmed.slice(0, 6)}...${trimmed.slice(-4)} linked`);
    } else {
      Alert.alert("Invalid", "That doesn't look like a valid Solana address");
    }
  }, []);

  const disconnect = useCallback(async () => {
    // Clear both wallet AND session so next wallet gets a fresh session
    // This prevents persona leaking between different wallets
    await SecureStore.deleteItemAsync(WALLET_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setWalletAddress(null);
  }, []);

  return (
    <WalletContext.Provider value={{ walletAddress, isConnecting, isLoading, connect, disconnect, submitAddress, cancelConnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function usePhantomWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("usePhantomWallet must be used within WalletProvider");
  return ctx;
}
