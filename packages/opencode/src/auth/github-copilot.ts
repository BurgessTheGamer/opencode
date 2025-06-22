import { Auth } from "./index"

export namespace AuthGithubCopilot {
  const CLIENT_ID = "Iv1.b507a08c87ecfe98"
  const DEVICE_CODE_URL = "https://github.com/login/device/code"
  const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
  const COPILOT_API_KEY_URL = "https://api.github.com/copilot_internal/v2/token"

  interface DeviceCodeResponse {
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval: number
  }

  interface AccessTokenResponse {
    access_token?: string
    error?: string
    error_description?: string
  }

  interface CopilotTokenResponse {
    token: string
    expires_at: number
    refresh_in: number
    endpoints: {
      api: string
    }
  }

  export async function authorize() {
    const deviceResponse = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "GithubCopilot/1.155.0",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: "read:user",
      }),
    })

    if (!deviceResponse.ok) {
      throw new DeviceCodeError("Failed to get device code")
    }

    const deviceData: DeviceCodeResponse = await deviceResponse.json()

    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      interval: deviceData.interval || 5,
      expires_in: deviceData.expires_in,
    }
  }

  export async function pollForToken(device_code: string, interval: number = 5, maxAttempts: number = 36) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "GithubCopilot/1.155.0",
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      })

      if (!response.ok) {
        throw new TokenExchangeError("Failed to poll for access token")
      }

      const data: AccessTokenResponse = await response.json()

      if (data.access_token) {
        // Store the GitHub OAuth token
        await Auth.set("github-copilot-oauth", {
          type: "api",
          key: data.access_token,
        })
        return data.access_token
      }

      if (data.error === "authorization_pending") {
        await new Promise(resolve => setTimeout(resolve, interval * 1000))
        continue
      }

      if (data.error) {
        throw new TokenExchangeError(`OAuth error: ${data.error}`)
      }
    }

    throw new TokenExchangeError("Polling timeout exceeded")
  }

  export async function getCopilotApiToken() {
    const oauthInfo = await Auth.get("github-copilot-oauth")
    if (!oauthInfo || oauthInfo.type !== "api") {
      throw new AuthenticationError("No GitHub OAuth token found")
    }

    // Check if we have a cached Copilot API token that's still valid
    const copilotInfo = await Auth.get("github-copilot")
    if (copilotInfo && copilotInfo.type === "oauth" && copilotInfo.expires > Date.now()) {
      return {
        token: copilotInfo.access,
        apiEndpoint: "https://api.githubcopilot.com",
      }
    }

    // Get new Copilot API token
    const response = await fetch(COPILOT_API_KEY_URL, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${oauthInfo.key}`,
        "User-Agent": "GithubCopilot/1.155.0",
        "Editor-Version": "vscode/1.85.1",
        "Editor-Plugin-Version": "copilot/1.155.0",
      },
    })

    if (!response.ok) {
      throw new CopilotTokenError("Failed to get Copilot API token")
    }

    const tokenData: CopilotTokenResponse = await response.json()

    // Store the Copilot API token
    await Auth.set("github-copilot", {
      type: "oauth",
      refresh: "", // GitHub Copilot doesn't use refresh tokens
      access: tokenData.token,
      expires: tokenData.expires_at * 1000, // Convert to milliseconds
    })

    return {
      token: tokenData.token,
      apiEndpoint: tokenData.endpoints.api,
    }
  }

  export async function access() {
    try {
      const result = await getCopilotApiToken()
      return result.token
    } catch (error) {
      return null
    }
  }

  export class DeviceCodeError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "DeviceCodeError"
    }
  }

  export class TokenExchangeError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "TokenExchangeError"
    }
  }

  export class AuthenticationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AuthenticationError"
    }
  }

  export class CopilotTokenError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "CopilotTokenError"
    }
  }
}
