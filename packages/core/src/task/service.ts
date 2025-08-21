import { Data, Effect, Schema } from "effect";
import { NodeFileSystem } from "@effect/platform-node";
import { FileSystem } from "@effect/platform";
import { BASE_PATH, TASK_FILE } from "../constants.js";
import yaml from "yaml";
import { TaskSchema } from "./schema.js";
import { createPrompt } from "../prompt.js";

export class YamlParseError extends Data.Error<{
  message: string;
  cause: unknown;
}> {}

export class TaskNotFoundError extends Data.Error<{
  message: string;
}> {}

export class NoAvailableTaskAtTheMoment extends Data.Error<{
  message: string;
}> {}

export class TaskService extends Effect.Service<TaskService>()(
  "app/Task/Service",
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      const list = Effect.fn(function* (spec: string) {
        const plain = yield* fs
          .readFileString(`${BASE_PATH}/${spec}/${TASK_FILE}`)
          .pipe(
            Effect.catchTag("SystemError", () => Effect.succeed("")),
            Effect.catchTag("BadArgument", () => Effect.succeed(""))
          );

        const parsed = yaml.parse(plain) || [];

        const arr = yield* Schema.decodeUnknown(Schema.Array(TaskSchema))(
          parsed
        );

        const map = new Map<string, TaskSchema>();
        for (const task of arr) {
          map.set(task.id, task);
        }

        return map;
      });

      const find = Effect.fn(function* (spec: string, id: string) {
        const tasks = yield* list(spec);
        const task = tasks.get(id);
        if (!task) {
          throw new TaskNotFoundError({
            message: `Task with ID ${id} not found in spec ${spec}`,
          });
        }

        return task;
      });

      const save = Effect.fn(function* (
        spec: string,
        tasks: Map<string, TaskSchema>
      ) {
        // Ensure the file path exists
        const exists = yield* fs.exists(`${BASE_PATH}/${spec}/${TASK_FILE}`);

        if (!exists) {
          yield* fs.makeDirectory(`${BASE_PATH}/${spec}`, { recursive: true });
        }

        yield* fs.writeFileString(
          `${BASE_PATH}/${spec}/${TASK_FILE}`,
          yaml.stringify([...tasks.values()])
        );
      });

      const add = Effect.fn(function* (spec: string, task: TaskSchema) {
        const tasks = yield* list(spec);
        tasks.set(task.id, task);

        yield* save(spec, tasks);

        return task;
      });

      const update = Effect.fn(function* (spec: string, task: TaskSchema) {
        const tasks = yield* list(spec);

        if (!tasks.has(task.id)) {
          throw new TaskNotFoundError({
            message: `Task with ID ${task.id} not found in spec ${spec}`,
          });
        }

        tasks.set(task.id, task);

        yield* save(spec, tasks);

        return task;
      });

      const destroy = Effect.fn(function* (spec: string, id: string) {
        const tasks = yield* list(spec);

        if (!tasks.has(id)) {
          throw new TaskNotFoundError({
            message: `Task with ID ${id} not found in spec ${spec}`,
          });
        }
        tasks.delete(id);
        yield* save(spec, tasks);
      });

      const getNextAvailableTask = Effect.fn(function* (spec: string) {
        const mapTasks = yield* list(spec);
        const tasks = Array.from(mapTasks.values());

        const nextTask = tasks.find((task) => {
          const isTodo = task.status === "todo";
          const hasNoDependencies = task.dependencies.length === 0;
          const dependenciesCompleted = task.dependencies.every(
            (depId) => mapTasks.get(depId)?.status === "completed"
          );

          return isTodo && hasNoDependencies && dependenciesCompleted;
        });

        if (!nextTask) {
          if (tasks.every((task) => task.status === "completed")) {
            return null;
          } else {
            return yield* new NoAvailableTaskAtTheMoment({
              message:
                "No available tasks to work on at the moment, check dependencies or statuses",
            });
          }
        }

        return nextTask;
      });

      const workOnNextAvailable = Effect.fn(function* (spec: string) {
        let task = yield* getNextAvailableTask(spec);

        if (!task) {
          return "All tasks are completed.";
        }

        task = TaskSchema.make({
          ...task,
          status: "in_progress",
        });
        yield* update(spec, task);

        return createPrompt({
          taskContext:
            "You will be acting as AI assistant working on a task. Your persona is a Senior Software Engineer with expertise in executing tasks efficiently step-by-step.",
          toneContext: "Professional and concise",
          backgroundData: "",
          detailedTaskInstructions: "Follow the task instructions carefully.",
          chainOfThought: "Think about your answer first",
          finalRequest: `<task><id>${task.id}</id><name>${task.name}</name><description>${task.description}</description></task>`,
        });
      });

      return { list, find, add, update, destroy, workOnNextAvailable } as const;
    }),
    dependencies: [NodeFileSystem.layer],
  }
) {}
