import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SANDBOX_HOME_CONTAINER_PATH,
  DEFAULT_WORKSPACE_CONTAINER_PATH,
  buildDockerExecArguments,
  buildDockerRunArguments,
  createSandboxState,
  resolveSandboxPaths,
  type GuySandboxRuntimeContext
} from "./index.js";

const runtimeContext: GuySandboxRuntimeContext = {
  buildContextPath: "/tmp/the-guy-bundle",
  dockerfilePath: "/tmp/the-guy-bundle/docker/guy-sandbox/Dockerfile",
  buildContextReady: true
};

test("resolveSandboxPaths stores state beneath ~/.guy/sandboxes", () => {
  const paths = resolveSandboxPaths("default", "/tmp/guy-home");

  assert.equal(paths.sandboxDir, "/tmp/guy-home/.guy/sandboxes/default");
  assert.equal(paths.stateFile, "/tmp/guy-home/.guy/sandboxes/default/sandbox.json");
  assert.equal(paths.bootstrapLogFile, "/tmp/guy-home/.guy/sandboxes/default/bootstrap.log");
});

test("createSandboxState records workspace and sandbox-home grants", () => {
  const state = createSandboxState("/tmp/workspace", runtimeContext, "/tmp/guy-home");

  assert.equal(state.driverId, "docker-local");
  assert.equal(state.workspaceHostPath, "/tmp/workspace");
  assert.equal(state.workspaceContainerPath, DEFAULT_WORKSPACE_CONTAINER_PATH);
  assert.equal(state.sandboxHomeContainerPath, DEFAULT_SANDBOX_HOME_CONTAINER_PATH);
  assert.equal(state.capabilities.filesystem.length, 2);
  assert.equal(state.capabilities.filesystem[0]?.label, "workspace");
  assert.equal(state.capabilities.filesystem[1]?.label, "sandbox-home");
});

test("buildDockerRunArguments wires the workspace bind and home volume", () => {
  const state = createSandboxState("/tmp/workspace", runtimeContext, "/tmp/guy-home");
  const args = buildDockerRunArguments(state);
  const joined = args.join(" ");

  assert.match(joined, /--mount type=volume,source=the-guy-sandbox-default-home,target=\/home\/guy/);
  assert.match(joined, /--mount type=bind,source=\/tmp\/workspace,target=\/workspace/);
  assert.match(joined, /the-guy-sandbox:0\.1\.0$/);
});

test("buildDockerExecArguments adds tty flags only for interactive commands", () => {
  const state = createSandboxState("/tmp/workspace", runtimeContext, "/tmp/guy-home");

  assert.deepEqual(buildDockerExecArguments(state, ["bash"], { interactive: true }).slice(0, 4), [
    "exec",
    "--interactive",
    "--tty",
    "--workdir"
  ]);

  assert.deepEqual(buildDockerExecArguments(state, ["pwd"]).slice(0, 4), [
    "exec",
    "--workdir",
    "/workspace",
    state.containerName
  ]);
});
