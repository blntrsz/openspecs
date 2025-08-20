import { Effect, Schema } from "effect";
import { CreateTaskSchema, TaskID, TaskSchema } from "./schema.js";

export const create = Effect.fn(function* (input: CreateTaskSchema) {
  const model = yield* Schema.decode(TaskSchema)({
    id: TaskID.make(""),
    name: input.name,
    status: "todo",
    description: input.description,
    dependencies: input.dependencies,
  });

  return model;
});

export * as TaskModel from "./model.js";
