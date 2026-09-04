import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * This used to be a standalone chat trainer, and it should not have been.
 *
 * The classroom already existed — courses, modules, lessons, quizzes, live
 * sessions, a per-course tutor — and putting a chat box in the sidebar beside
 * it read as a replacement for it rather than an addition. Company Training is
 * the training feature; anything the trainer did that is worth keeping belongs
 * inside a course, next to the material it is teaching from.
 *
 * Kept as a redirect rather than deleted because the link is in people's
 * history and a dead URL is a worse answer than the right page.
 */
export const Route = createFileRoute("/_app/trainer")({
  beforeLoad: () => {
    throw redirect({ to: "/training", replace: true });
  },
});
