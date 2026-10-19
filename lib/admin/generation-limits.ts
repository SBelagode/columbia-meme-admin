// Shared by the generation Server Actions and their forms. Kept out of the
// "use server" file, which may only export async functions.
export const MAX_GENERATED_TEXT = 5_000;
export const MAX_GENERATION_PROMPT = 20_000;

export type UpdateGenerationState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export type CreateGenerationState =
  | { status: "idle" }
  | { status: "error"; message: string };

export type DeleteGenerationState =
  | { status: "idle" }
  | { status: "error"; message: string };
