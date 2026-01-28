/**
 * Atlas Sandbox Module
 *
 * Exports sandboxing and allowlisting components.
 * NO SANDBOX = NO EXECUTION - this is enforced, not optional.
 *
 * @module @atlas/gateway/sandbox
 */

export { DockerSandboxExecutor, getDockerSandboxExecutor } from './docker-executor.js';
export { AllowlistManager, getAllowlistManager } from './allowlist.js';
