import AppIntents

// MARK: - Open App Intent
struct OpenGlitchIntent: AppIntent {
    static var title: LocalizedStringResource = "Open G!itch"
    static var description = IntentDescription("Opens the G!itch app")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Chat with Bestie Intent
struct ChatWithBestieIntent: AppIntent {
    static var title: LocalizedStringResource = "Chat with Bestie"
    static var description = IntentDescription("Open G!itch and start chatting with your AI bestie")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Check Balance Intent
struct CheckBalanceIntent: AppIntent {
    static var title: LocalizedStringResource = "Check $GLITCH Balance"
    static var description = IntentDescription("Open G!itch and view your SOL and $GLITCH token balance")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Buy GLITCH Intent
struct BuyGlitchIntent: AppIntent {
    static var title: LocalizedStringResource = "Buy $GLITCH"
    static var description = IntentDescription("Open G!itch and go to the Buy screen to swap SOL for $GLITCH")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Voice Chat Intent
struct VoiceChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Chat with Bestie"
    static var description = IntentDescription("Open G!itch and start a voice conversation with your AI bestie")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - App Shortcuts Provider
// IMPORTANT: Every phrase MUST contain \(.applicationName) — Apple rejects builds without it
struct GlitchShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenGlitchIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Launch \(.applicationName)"
            ],
            shortTitle: "Open G!itch",
            systemImageName: "sparkles"
        )
        AppShortcut(
            intent: ChatWithBestieIntent(),
            phrases: [
                "Chat with my bestie in \(.applicationName)",
                "Talk to \(.applicationName)",
                "Message my bestie in \(.applicationName)"
            ],
            shortTitle: "Chat with Bestie",
            systemImageName: "bubble.left.fill"
        )
        AppShortcut(
            intent: CheckBalanceIntent(),
            phrases: [
                "Check my balance in \(.applicationName)",
                "Show my \(.applicationName) balance",
                "How much GLITCH do I have in \(.applicationName)"
            ],
            shortTitle: "Check Balance",
            systemImageName: "creditcard.fill"
        )
        AppShortcut(
            intent: BuyGlitchIntent(),
            phrases: [
                "Buy GLITCH in \(.applicationName)",
                "Swap SOL for GLITCH in \(.applicationName)"
            ],
            shortTitle: "Buy $GLITCH",
            systemImageName: "cart.fill"
        )
        AppShortcut(
            intent: VoiceChatIntent(),
            phrases: [
                "Voice chat in \(.applicationName)",
                "Talk to my bestie in \(.applicationName)"
            ],
            shortTitle: "Voice Chat",
            systemImageName: "mic.fill"
        )
    }
}
