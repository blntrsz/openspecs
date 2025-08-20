#!/usr/bin/env node
import { McpServer } from "@effect/ai";
import { NodeRuntime, NodeSink, NodeStream } from "@effect/platform-node";
import { Layer, Logger } from "effect";
import { TaskMcpTools } from "./task.js";

McpServer.layerStdio({
  name: "openspec-mcp",
  version: "0.1.0",
  stdin: NodeStream.stdin,
  stdout: NodeSink.stdout,
}).pipe(
  Layer.provide([TaskMcpTools]),
  Layer.provide(Logger.add(Logger.prettyLogger({ stderr: true }))),
  Layer.launch,
  NodeRuntime.runMain,
);
