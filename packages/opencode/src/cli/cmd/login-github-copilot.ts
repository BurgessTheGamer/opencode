import { AuthGithubCopilot } from "../../auth/github-copilot"
import { UI } from "../ui"

export const LoginGithubCopilotCommand = {
  command: "github-copilot",
  describe: "Login to GitHub Copilot",
  handler: async () => {
    const deviceInfo = await AuthGithubCopilot.authorize()

    UI.println("Login to GitHub Copilot")
    UI.println("Open the following URL in your browser:")
    UI.println(deviceInfo.verification_uri)
    UI.println("")
    UI.println(`Enter code: ${deviceInfo.user_code}`)
    UI.println("")

    await UI.input("Press Enter after completing authentication in browser: ")

    UI.println("Waiting for authorization...")
    await AuthGithubCopilot.pollForToken(
      deviceInfo.device_code,
      deviceInfo.interval,
    )

    await AuthGithubCopilot.getCopilotApiToken()
    UI.println("✅ Login successful!")
  },
}
