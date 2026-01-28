/**
 * Atlas Docker Sandbox Executor
 *
 * Executes commands in isolated Docker containers with strict security constraints.
 * NO SANDBOX = NO EXECUTION - this is enforced, not optional.
 *
 * Addresses: Unrestricted filesystem access; "no such thing as secure config"
 *
 * @module @atlas/gateway/security/sandbox/docker-executor
 */

import Docker from 'dockerode';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SandboxConfig, SandboxExecutionRequest, SandboxExecutionResult } from '@atlas/shared';

// Default secure sandbox configuration
const DEFAULT_CONFIG: SandboxConfig = {
  image: 'alpine:3.19',
  memoryLimit: '512m',
  cpuLimit: '0.5',
  readOnlyRootFs: true,
  dropAllCapabilities: true,
  networkAllowlist: [], // No network access by default
  workspaceDir: '/workspace',
  hostWorkspaceDir: join(homedir(), 'atlas-workspace'),
  timeoutMs: 30000, // 30 second default timeout
};

// Capabilities that are ALWAYS dropped
const DROPPED_CAPABILITIES = [
  'ALL', // Drop everything first
];

// Syscalls that are blocked
const BLOCKED_SYSCALLS = [
  'clone',
  'fork',
  'vfork',
  'keyctl',
  'add_key',
  'request_key',
  'ptrace',
  'personality',
  'setns',
  'unshare',
  'mount',
  'umount',
  'pivot_root',
  'chroot',
  'reboot',
  'kexec_load',
  'kexec_file_load',
  'init_module',
  'finit_module',
  'delete_module',
];

interface ContainerInfo {
  id: string;
  name: string;
  startedAt: Date;
  command: string;
}

/**
 * Docker Sandbox Executor for Atlas
 *
 * Provides isolated command execution with:
 * - Read-only root filesystem
 * - All capabilities dropped
 * - Memory and CPU limits
 * - No network access by default
 * - Scoped workspace mount
 */
export class DockerSandboxExecutor {
  private docker: Docker;
  private config: SandboxConfig;
  private initialized = false;
  private activeContainers: Map<string, ContainerInfo> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.docker = new Docker();
  }

  /**
   * Initialize the sandbox executor
   * Verifies Docker is available and pulls the required image
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Verify Docker is available
    try {
      await this.docker.ping();
    } catch (error) {
      throw new Error(
        'SANDBOX_UNAVAILABLE: Docker is not available. Atlas requires Docker for secure command execution.'
      );
    }

    // Ensure the sandbox image is available
    try {
      await this.docker.getImage(this.config.image).inspect();
    } catch {
      console.log(`[Atlas] Pulling sandbox image: ${this.config.image}`);
      await this.pullImage(this.config.image);
    }

    // Ensure workspace directory exists
    await mkdir(this.config.hostWorkspaceDir, { recursive: true });

    this.initialized = true;
  }

  /**
   * Pull a Docker image
   */
  private async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(new Error(`Failed to pull image ${image}: ${err.message}`));
          return;
        }

        this.docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  }

  /**
   * Execute a command in the sandbox
   *
   * CRITICAL: No sandbox = no execution. This is enforced, not optional.
   */
  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
    await this.ensureInitialized();

    const startTime = Date.now();
    const containerId = `atlas-sandbox-${randomBytes(8).toString('hex')}`;
    const timeout = request.timeoutMs ?? this.config.timeoutMs;

    // Build the command to execute
    const cmd = [request.command, ...request.args];

    // Create container with strict security settings
    const container = await this.docker.createContainer({
      name: containerId,
      Image: this.config.image,
      Cmd: cmd,
      WorkingDir: request.workingDir ?? this.config.workspaceDir,
      Env: request.env ? Object.entries(request.env).map(([k, v]) => `${k}=${v}`) : [],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!request.stdin,
      OpenStdin: !!request.stdin,
      Tty: false,
      HostConfig: {
        // Memory limit
        Memory: this.parseMemoryLimit(this.config.memoryLimit),
        MemorySwap: this.parseMemoryLimit(this.config.memoryLimit), // No swap

        // CPU limit
        NanoCpus: Math.floor(parseFloat(this.config.cpuLimit) * 1e9),

        // Read-only root filesystem
        ReadonlyRootfs: this.config.readOnlyRootFs,

        // Drop ALL capabilities
        CapDrop: DROPPED_CAPABILITIES,
        CapAdd: [], // Add nothing back

        // Security options
        SecurityOpt: [
          'no-new-privileges:true',
          // Use seccomp profile to block dangerous syscalls
          `seccomp=${JSON.stringify(this.getSeccompProfile())}`,
        ],

        // Mount workspace as writable
        Binds: [
          `${this.config.hostWorkspaceDir}:${this.config.workspaceDir}:rw`,
          // Add a tmpdir since root is read-only
          `/tmp/${containerId}:/tmp:rw`,
        ],

        // Network configuration
        NetworkMode: this.config.networkAllowlist.length > 0 ? 'bridge' : 'none',

        // Don't allow privilege escalation
        Privileged: false,

        // User namespace remapping (run as non-root)
        User: '1000:1000',

        // PID namespace isolation
        PidMode: 'container',

        // IPC namespace isolation
        IpcMode: 'private',

        // Limit number of processes
        PidsLimit: 100,

        // Disable OOM killer adjustment
        OomScoreAdj: 500,

        // Auto-remove container when done
        AutoRemove: false, // We'll remove it manually after getting output
      },
    });

    // Track the container
    this.activeContainers.set(containerId, {
      id: container.id,
      name: containerId,
      startedAt: new Date(),
      command: cmd.join(' '),
    });

    // Create temp directory for container
    await mkdir(`/tmp/${containerId}`, { recursive: true });

    try {
      // Start the container
      await container.start();

      // Collect output with timeout
      const result = await this.waitForCompletion(container, timeout, request.stdin);

      const duration = Date.now() - startTime;

      // Get memory usage
      let memoryUsed: number | undefined;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsed = stats.memory_stats?.usage;
      } catch {
        // Stats may not be available after container exits
      }

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: duration,
        timedOut: result.timedOut,
        memoryUsedBytes: memoryUsed,
      };
    } finally {
      // Clean up
      try {
        await container.remove({ force: true });
      } catch {
        // Container may already be removed
      }
      try {
        await rm(`/tmp/${containerId}`, { recursive: true, force: true });
      } catch {
        // Temp dir may not exist
      }
      this.activeContainers.delete(containerId);
    }
  }

  /**
   * Wait for container completion with timeout
   */
  private async waitForCompletion(
    container: Docker.Container,
    timeoutMs: number,
    stdin?: string
  ): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise(async (resolve) => {
      let timedOut = false;
      let stdout = '';
      let stderr = '';

      // Set up timeout
      const timeoutId = setTimeout(async () => {
        timedOut = true;
        try {
          await container.kill();
        } catch {
          // Container may have already exited
        }
      }, timeoutMs);

      try {
        // Attach to container streams
        const stream = await container.attach({
          stream: true,
          stdout: true,
          stderr: true,
          stdin: !!stdin,
        });

        // Write stdin if provided
        if (stdin) {
          stream.write(stdin);
          stream.end();
        }

        // Demultiplex stdout/stderr
        const chunks: { stream: 'stdout' | 'stderr'; data: Buffer }[] = [];

        stream.on('data', (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr with an 8-byte header
          // First byte: 1 = stdout, 2 = stderr
          // Bytes 5-8: size of following data
          let offset = 0;
          while (offset < chunk.length) {
            if (offset + 8 > chunk.length) break;

            const streamType = chunk[offset];
            const size = chunk.readUInt32BE(offset + 4);

            if (offset + 8 + size > chunk.length) break;

            const data = chunk.subarray(offset + 8, offset + 8 + size);
            chunks.push({
              stream: streamType === 1 ? 'stdout' : 'stderr',
              data,
            });

            offset += 8 + size;
          }
        });

        // Wait for container to exit
        const result = await container.wait();

        clearTimeout(timeoutId);

        // Combine output
        for (const chunk of chunks) {
          if (chunk.stream === 'stdout') {
            stdout += chunk.data.toString();
          } else {
            stderr += chunk.data.toString();
          }
        }

        resolve({
          exitCode: timedOut ? 137 : result.StatusCode,
          stdout,
          stderr,
          timedOut,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + `\nExecution error: ${error}`,
          timedOut,
        });
      }
    });
  }

  /**
   * Generate a seccomp profile that blocks dangerous syscalls
   */
  private getSeccompProfile(): object {
    return {
      defaultAction: 'SCMP_ACT_ALLOW',
      syscalls: BLOCKED_SYSCALLS.map((name) => ({
        names: [name],
        action: 'SCMP_ACT_ERRNO',
        errnoRet: 1, // EPERM
      })),
    };
  }

  /**
   * Parse memory limit string (e.g., "512m") to bytes
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg])?$/i);
    if (!match) {
      return 512 * 1024 * 1024; // Default 512MB
    }

    const value = parseInt(match[1]!, 10);
    const unit = (match[2] ?? '').toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  /**
   * Ensure the executor is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Check if Docker is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get active container information
   */
  getActiveContainers(): ContainerInfo[] {
    return Array.from(this.activeContainers.values());
  }

  /**
   * Kill all active containers (for cleanup)
   */
  async killAllContainers(): Promise<number> {
    let killed = 0;
    for (const [id, info] of this.activeContainers.entries()) {
      try {
        const container = this.docker.getContainer(info.id);
        await container.kill();
        await container.remove({ force: true });
        killed++;
      } catch {
        // Container may already be gone
      }
      this.activeContainers.delete(id);
    }
    return killed;
  }

  /**
   * Get executor configuration (for debugging)
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Execute a simple command (convenience method)
   */
  async exec(command: string, args: string[] = []): Promise<SandboxExecutionResult> {
    return this.execute({ command, args });
  }

  /**
   * Execute a shell command
   */
  async shell(script: string): Promise<SandboxExecutionResult> {
    return this.execute({
      command: '/bin/sh',
      args: ['-c', script],
    });
  }
}

// Default singleton instance
let defaultExecutor: DockerSandboxExecutor | null = null;

export function getDockerSandboxExecutor(config?: Partial<SandboxConfig>): DockerSandboxExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new DockerSandboxExecutor(config);
  }
  return defaultExecutor;
}

export default DockerSandboxExecutor;
