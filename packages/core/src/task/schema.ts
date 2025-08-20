import { Schema } from "effect";

export type TaskID = typeof TaskID.Type;
export const TaskID = Schema.String.pipe(Schema.brand("TaskID"));

export type TaskSchema = typeof TaskSchema.Type;
export const TaskSchema = Schema.Struct({
  id: TaskID,
  name: Schema.String,
  status: Schema.Union(
    Schema.Literal("todo"),
    Schema.Literal("in_progress"),
    Schema.Literal("completed"),
  ),
  description: Schema.String,
  dependencies: Schema.Array(Schema.String),
});

export type CreateTaskSchema = typeof CreateTaskSchema.Type;
export const CreateTaskSchema = TaskSchema.pick(
  "name",
  "description",
  "dependencies",
);
