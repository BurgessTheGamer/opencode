import type {
  CreateProfileParams,
  DeleteProfileParams,
  ListProfilesParams,
  ToolResult,
} from "../types.js"
import { BrowserManager } from "../browser/manager.js"

export async function createProfile(
  params: CreateProfileParams,
): Promise<ToolResult> {
  try {
    const profileData: Parameters<typeof BrowserManager.createProfile>[0] = {
      name: params.name,
    }

    if (params.userAgent) profileData.userAgent = params.userAgent
    if (params.viewport) profileData.viewport = params.viewport
    if (params.proxy) profileData.proxy = params.proxy

    const profile = await BrowserManager.createProfile(profileData)

    return {
      content: [
        {
          type: "text",
          text: `Profile "${profile.name}" created successfully with ID: ${profile.id}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating profile: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}

export async function deleteProfile(
  params: DeleteProfileParams,
): Promise<ToolResult> {
  try {
    const success = await BrowserManager.deleteProfile(params.name)

    if (success) {
      return {
        content: [
          {
            type: "text",
            text: `Profile "${params.name}" deleted successfully`,
          },
        ],
      }
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Profile "${params.name}" not found`,
          },
        ],
        isError: true,
      }
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error deleting profile: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}

export async function listProfiles(
  _params: ListProfilesParams,
): Promise<ToolResult> {
  try {
    const profiles = await BrowserManager.listProfiles()

    if (profiles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No browser profiles found",
          },
        ],
      }
    }

    const profileList = profiles
      .map(
        (p) =>
          `- ${p.name} (ID: ${p.id}, Created: ${new Date(p.created).toLocaleString()})`,
      )
      .join("\n")

    return {
      content: [
        {
          type: "text",
          text: `Browser profiles:\n${profileList}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing profiles: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
