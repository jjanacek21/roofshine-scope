import { createFileRoute } from "@tanstack/react-router";
import { SPFCalculator } from "@/components/commercial/spf/SPFCalculator";

export const Route = createFileRoute("/_app/commercial/spf")({
  component: SPFCalculatorPage,
});

function SPFCalculatorPage() {
  return <SPFCalculator />;
}
