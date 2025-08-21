import { Effect, Schema } from "effect";
import { CreateTaskSchema, TaskID, TaskSchema } from "./schema.js";
import { createID } from "../id.js";

export const create = Effect.fn(function* (input: CreateTaskSchema) {
  const model = yield* Schema.decode(TaskSchema)({
    id: TaskID.make(createID()),
    name: input.name,
    status: "todo",
    description: input.description,
    dependencies: input.dependencies,
  });

  return model;
});

export * as TaskModel from "./model.js";
