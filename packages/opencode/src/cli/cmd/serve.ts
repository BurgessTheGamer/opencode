import { App } from "../../app/app"
import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { Share } from "../../share/share"
import { cmd } from "./cmd"
import { spawn, ChildProcess } from "child_process"
import { join } from "path"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    yargs
      .option("port", {
        alias: ["p"],
        type: "number",
        describe: "port to listen on",
        default: 4096,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      }),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    const cwd = process.cwd()

    // Start browser and storage servers
    let browserServer: ChildProcess | null = null
    let storageServer: ChildProcess | null = null

    const startBackgroundServers = () => {
      const tuiPath = join(__dirname, "../../../../tui")

      // Start browser server
      console.log("Starting browser server...")
      browserServer = spawn(join(tuiPath, "browser-server"), [], {
        env: {
          ...process.env,
          OPENCODE_BROWSER_PORT: "9876",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      })

      browserServer.on("error", (err) => {
        console.error("Browser server error:", err)
      })

      // Start storage server
      console.log("Starting storage server...")
      storageServer = spawn(join(tuiPath, "storage-server"), [], {
        env: {
          ...process.env,
          OPENCODE_STORAGE_PORT: "9877",
          OPENCODE_STORAGE_DB: join(
            process.env["HOME"] || "",
            ".opencode",
            "storage.db",
          ),
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      })

      storageServer.on("error", (err) => {
        console.error("Storage server error:", err)
      })
    }

    // Cleanup on exit
    const cleanup = () => {
      if (browserServer) {
        browserServer.kill("SIGTERM")
      }
      if (storageServer) {
        storageServer.kill("SIGTERM")
      }
    }

    process.on("exit", cleanup)
    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)

    await App.provide({ cwd }, async () => {
      const providers = await Provider.list()
      if (Object.keys(providers).length === 0) {
        return "needs_provider"
      }

      const hostname = args.hostname
      const port = args.port

      // Start background servers
      startBackgroundServers()

      // Wait a bit for servers to start
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await Share.init()
      const server = Server.listen({
        port,
        hostname,
      })

      console.log(
        `opencode server listening on http://${server.hostname}:${server.port}`,
      )
      console.log("Browser server running on port 9876")
      console.log("Storage server running on port 9877")

      await new Promise(() => {})

      server.stop()
      cleanup()
    })
  },
})
