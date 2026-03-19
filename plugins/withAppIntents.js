/**
 * Expo Config Plugin — inject App Intents Swift file into the MAIN app target.
 *
 * Apple requires AppShortcutsProvider to be in the main app target (not an extension)
 * for Shortcuts & Action Button to discover the intents. The @bacons/apple-targets
 * plugin creates a separate extension which iOS doesn't index for Shortcuts.
 *
 * This plugin:
 * 1. Copies GlitchIntents.swift into the Xcode project's main target
 * 2. Creates an empty bridging header (required for Swift in ObjC projects)
 * 3. Sets Swift version and bridging header build settings
 */

const { withXcodeProject, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SWIFT_FILE_NAME = "GlitchIntents.swift";

const SWIFT_CODE = `import AppIntents

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
// IMPORTANT: Every phrase MUST contain \\(.applicationName) — Apple requires it
struct GlitchShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenGlitchIntent(),
            phrases: [
                "Open \\(.applicationName)",
                "Launch \\(.applicationName)"
            ],
            shortTitle: "Open G!itch",
            systemImageName: "sparkles"
        )
        AppShortcut(
            intent: ChatWithBestieIntent(),
            phrases: [
                "Chat with my bestie in \\(.applicationName)",
                "Talk to \\(.applicationName)",
                "Message my bestie in \\(.applicationName)"
            ],
            shortTitle: "Chat with Bestie",
            systemImageName: "bubble.left.fill"
        )
        AppShortcut(
            intent: CheckBalanceIntent(),
            phrases: [
                "Check my balance in \\(.applicationName)",
                "Show my \\(.applicationName) balance",
                "How much GLITCH do I have in \\(.applicationName)"
            ],
            shortTitle: "Check Balance",
            systemImageName: "creditcard.fill"
        )
        AppShortcut(
            intent: BuyGlitchIntent(),
            phrases: [
                "Buy GLITCH in \\(.applicationName)",
                "Swap SOL for GLITCH in \\(.applicationName)"
            ],
            shortTitle: "Buy $GLITCH",
            systemImageName: "cart.fill"
        )
        AppShortcut(
            intent: VoiceChatIntent(),
            phrases: [
                "Voice chat in \\(.applicationName)",
                "Talk to my bestie in \\(.applicationName)"
            ],
            shortTitle: "Voice Chat",
            systemImageName: "mic.fill"
        )
    }
}
`;

function withAppIntents(config) {
  // Step 1: Write Swift file into the iOS project directory
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const appName = config.modRequest.projectName || "glitchbestie";

      // Write the Swift file into the app source directory
      const swiftDir = path.join(projectRoot, appName);
      if (!fs.existsSync(swiftDir)) {
        fs.mkdirSync(swiftDir, { recursive: true });
      }

      const swiftPath = path.join(swiftDir, SWIFT_FILE_NAME);
      fs.writeFileSync(swiftPath, SWIFT_CODE);

      // Create bridging header if it doesn't exist (required for Swift in ObjC projects)
      const bridgingHeader = path.join(swiftDir, `${appName}-Bridging-Header.h`);
      if (!fs.existsSync(bridgingHeader)) {
        fs.writeFileSync(
          bridgingHeader,
          "// Bridging header for Swift/ObjC interop\n// Required for App Intents in the main target\n"
        );
      }

      return config;
    },
  ]);

  // Step 2: Add the Swift file to the Xcode project and configure build settings
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const appName = config.modRequest.projectName || "glitchbestie";

    // Find the main target
    const mainTarget = project.getFirstTarget();
    if (!mainTarget) {
      console.warn("[withAppIntents] Could not find main target");
      return config;
    }

    // Add the Swift file to the project
    const swiftFilePath = `${appName}/${SWIFT_FILE_NAME}`;
    const groupKey = project.findPBXGroupKey({ name: appName }) || project.getFirstProject().firstProject.mainGroup;

    // Check if file already added
    const existingFile = project.pbxFileReferenceSection();
    const alreadyAdded = Object.values(existingFile).some(
      (ref) => typeof ref === "object" && ref.path === SWIFT_FILE_NAME
    );

    if (!alreadyAdded) {
      project.addSourceFile(swiftFilePath, null, groupKey);
    }

    // Set Swift version and bridging header
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      const config_item = buildConfigs[key];
      if (typeof config_item === "object" && config_item.buildSettings) {
        // Only modify app target configs (not test targets, etc.)
        if (
          config_item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER ||
          config_item.buildSettings.INFOPLIST_FILE
        ) {
          config_item.buildSettings.SWIFT_VERSION = "5.0";
          config_item.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `${appName}/${appName}-Bridging-Header.h`;
        }
      }
    }

    return config;
  });

  return config;
}

module.exports = withAppIntents;
