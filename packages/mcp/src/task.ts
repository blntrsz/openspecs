import { AiError, AiTool, AiToolkit, McpServer } from "@effect/ai";
import { Effect, Layer, Schema } from "effect";
import {
  CreateTaskSchema,
  TaskID,
  TaskSchema,
} from "@openspecs/core/task/schema";
import { TaskService } from "@openspecs/core/task";
import { TaskModel } from "@openspecs/core/task/model";

const toolkit = AiToolkit.make(
  AiTool.make("list_tasks", {
    description: "List all tasks in the current spec.",
    parameters: {
      spec: Schema.String.annotations({
        description: "The name of the spec to list tasks from.",
      }),
    },
    success: Schema.Struct({
      results: Schema.Array(TaskSchema),
    }),
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),

  AiTool.make("add_task", {
    description: "Add a new task to the current spec.",
    parameters: {
      spec: Schema.String.annotations({
        description: "The name of the spec to add the task to.",
      }),
      task: CreateTaskSchema.annotations({
        description: "The task to add to the spec.",
      }),
    },
    success: TaskSchema,
  })
    .annotate(AiTool.Destructive, false)
    .annotate(AiTool.Readonly, false),

  AiTool.make("work_on_task", {
    description: "Work on the next available task in the current spec.",
    parameters: {
      spec: Schema.String.annotations({
        description: "The name of the spec to work on tasks from.",
      }),
    },
    success: Schema.String,
  }),

  AiTool.make("complete_task", {
    description: "Complete the current task in the spec.",
    parameters: {
      id: TaskID.annotations({
        description: "The ID of the task to complete.",
      }),
      spec: Schema.String.annotations({
        description: "The name of the spec to complete the task in.",
      }),
    },
    success: TaskSchema,
  })
);

const ToolkitLayer = toolkit.toLayer(
  Effect.gen(function* () {
    const service = yield* TaskService;

    return toolkit.of({
      list_tasks: Effect.fn(function* (params) {
        const tasks = yield* service.list(params.spec).pipe(
          Effect.catchTag("ParseError", (error: unknown) =>
            Effect.fail(
              AiError.AiError.make({
                module: "task",
                method: "list_tasks",
                description: `Failed to parse tasks for spec ${params.spec}`,
                cause: error,
              })
            )
          )
        );

        return {
          results: [...tasks.values()],
        };
      }),
      add_task: Effect.fn(function* (params) {
        const model = yield* TaskModel.create(params.task).pipe(
          Effect.catchTag("ParseError", (error: unknown) =>
            Effect.fail(
              AiError.AiError.make({
                module: "task",
                method: "add_task",
                description: `Failed to create task model for ${params.task.name}`,
                cause: error,
              })
            )
          )
        );
        return yield* service.add(params.spec, model).pipe(
          Effect.catchAll((error: unknown) =>
            Effect.fail(
              AiError.AiError.make({
                module: "task",
                method: "add_task",
                description: `Failed to add task ${params.task.name}`,
                cause: error,
              })
            )
          )
        );
      }),
      work_on_task: Effect.fn(function* (params) {
        return yield* service.workOnNextAvailable(params.spec).pipe(
          Effect.catchAll((error: unknown) =>
            Effect.fail(
              AiError.AiError.make({
                module: "task",
                method: "work_on_task",
                description: `Failed to work on task in spec ${params.spec}`,
                cause: error,
              })
            )
          )
        );
      }),
      complete_task: Effect.fn(function* (params) {
        const task = yield* service.find(params.spec, params.id).pipe(
          Effect.catchAll((error: unknown) =>
            Effect.fail(
              AiError.AiError.make({
                module: "task",
                method: "complete_task",
                description: `Failed to find task with ID ${params.id} in spec ${params.spec}`,
                cause: error,
              })
            )
          )
        );

        if (!task) {
          return yield* Effect.fail(
            AiError.AiError.make({
              module: "task",
              method: "complete_task",
              description: `Task with ID ${params.id} not found in spec ${params.spec}`,
            })
          );
        }

        return yield* service
          .update(
            params.spec,
            TaskSchema.make({
              ...task,
              status: "completed",
            })
          )
          .pipe(
            Effect.catchAll((error: unknown) =>
              Effect.fail(
                AiError.AiError.make({
                  module: "task",
                  method: "complete_task",
                  description: `Failed to complete task with ID ${params.id} in spec ${params.spec}`,
                  cause: error,
                })
              )
            )
          );
      }),
    });
  })
);

export const TaskMcpTools = McpServer.toolkit(toolkit).pipe(
  Layer.provide(ToolkitLayer.pipe(Layer.provide(TaskService.Default)))
);
