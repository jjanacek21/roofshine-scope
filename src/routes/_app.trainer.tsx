import { createFileRoute } from "@tanstack/react-router";
import { TrainerChat } from "@/components/training/TrainerChat";

export const Route = createFileRoute("/_app/trainer")({
  component: TrainerPage,
});

function TrainerPage() {
  return (
    <div className="flex h-[calc(100dvh-140px)] flex-col space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Trainer</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Ask the Survival Guide anything, or practise a door against a homeowner who will not make it easy.
        </p>
      </div>
      <TrainerChat />
    </div>
  );
}
