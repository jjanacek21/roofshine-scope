import { createFileRoute } from "@tanstack/react-router";
import { SPFCalculator } from "@/components/roofking/spf/SPFCalculator";

export const Route = createFileRoute("/_app/roofking/spf")({
  component: SPFCalculatorPage,
});

function SPFCalculatorPage() {
  return <SPFCalculator />;
}
