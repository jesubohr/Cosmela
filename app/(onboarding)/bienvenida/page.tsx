import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Te damos la bienvenida" };

export default function BienvenidaPage() {
  return <OnboardingFlow />;
}
