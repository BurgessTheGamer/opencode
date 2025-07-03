import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import type { App } from "../app/app"
import path from "path"
import { Global } from "../global"
import { Log } from "../util/log"
import { BunProc } from "../bun"

export namespace LSPServer {
  const log = Log.create({ service: "lsp.server" })

  export interface Handle {
    process: ChildProcessWithoutNullStreams
    initialization?: Record<string, any>
  }

  export interface Info {
    id: string
    extensions: string[]
    spawn(app: App.Info): Promise<Handle | undefined>
  }

  export const Typescript: Info = {
    id: "typescript",
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    async spawn(app) {
      const tsserver = await Bun.resolve(
        "typescript/lib/tsserver.js",
        app.path.cwd,
      ).catch(() => {})
      if (!tsserver) return
      const proc = spawn(
        BunProc.which(),
        ["x", "typescript-language-server", "--stdio"],
        {
          env: {
            ...process.env,
            BUN_BE_BUN: "1",
          },
        },
      )
      return {
        process: proc,
        initialization: {
          tsserver: {
            path: tsserver,
          },
        },
      }
    },
  }

  export const Gopls: Info = {
    id: "golang",
    extensions: [".go"],
    async spawn() {
      let bin = Bun.which("gopls", {
        PATH: process.env["PATH"] + ":" + Global.Path.bin,
      })
      if (!bin) {
        if (!Bun.which("go")) return
        log.info("installing gopls")
        const proc = Bun.spawn({
          cmd: ["go", "install", "golang.org/x/tools/gopls@latest"],
          env: { ...process.env, GOBIN: Global.Path.bin },
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install gopls")
          return
        }
        bin = path.join(
          Global.Path.bin,
          "gopls" + (process.platform === "win32" ? ".exe" : ""),
        )
        log.info(`installed gopls`, {
          bin,
        })
      }
      return {
        process: spawn(bin!),
      }
    },
  }

  export const Aiken: Info = {
    id: "aiken",
    extensions: [".ak"],
    async spawn() {
      // Check if aiken is already installed
      let bin = Bun.which("aiken", {
        PATH: process.env["PATH"] + ":" + Global.Path.bin,
      })

      if (!bin) {
        log.info("Installing Aiken language server...")

        // Use bun x to run aikup without global installation
        const proc = Bun.spawn({
          cmd: [BunProc.which(), "x", "@aiken-lang/aikup"],
          env: {
            ...process.env,
            AIKUP_ROOT: Global.Path.data, // Install to opencode's data directory
          },
          stdout: "pipe",
          stderr: "pipe",
        })

        const exitCode = await proc.exited
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text()
          log.error("Failed to install Aiken", { stderr })
          throw new Error("Failed to install Aiken language server")
        }

        // After aikup installation, aiken should be available
        bin = Bun.which("aiken", {
          PATH: [
            path.join(Global.Path.data, "bin"),
            Global.Path.bin,
            process.env["PATH"] || "",
          ].join(":"),
        })

        if (!bin) {
          // Fallback: check common installation paths
          const possiblePaths = [
            path.join(Global.Path.data, "bin", "aiken"),
            path.join(process.env["HOME"] || "", ".aiken", "bin", "aiken"),
            path.join(Global.Path.bin, "aiken"),
          ]

          for (const p of possiblePaths) {
            if (await Bun.file(p).exists()) {
              bin = p
              break
            }
          }
        }

        if (!bin) {
          throw new Error("Aiken binary not found after installation")
        }

        log.info("Aiken installed successfully", { bin })
      }

      log.info("Starting Aiken language server", { bin })

      return {
        process: spawn(bin, ["lsp"]),
      }
    },
  }

  export const RubyLsp: Info = {
    id: "ruby-lsp",
    extensions: [".rb", ".rake", ".gemspec", ".ru"],
    async spawn() {
      let bin = Bun.which("ruby-lsp", {
        PATH: process.env["PATH"] + ":" + Global.Path.bin,
      })
      if (!bin) {
        const ruby = Bun.which("ruby")
        const gem = Bun.which("gem")
        if (!ruby || !gem) {
          log.info("Ruby not found, please install Ruby first")
          return
        }
        log.info("installing ruby-lsp")
        const proc = Bun.spawn({
          cmd: ["gem", "install", "ruby-lsp", "--bindir", Global.Path.bin],
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install ruby-lsp")
          return
        }
        bin = path.join(
          Global.Path.bin,
          "ruby-lsp" + (process.platform === "win32" ? ".exe" : ""),
        )
        log.info(`installed ruby-lsp`, {
          bin,
        })
      }
      return {
        process: spawn(bin!, ["--stdio"]),
      }
    },
  }

  export const Pyright: Info = {
    id: "pyright",
    extensions: [".py", ".pyi"],
    async spawn() {
      const proc = spawn(
        BunProc.which(),
        ["x", "pyright-langserver", "--stdio"],
        {
          env: {
            ...process.env,
            BUN_BE_BUN: "1",
          },
        },
      )
      return {
        process: proc,
      }
    },
  }
}
