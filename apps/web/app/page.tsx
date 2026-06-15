import type { Metadata } from "next";
import { Landing } from "@/components/Landing";

export const metadata: Metadata = {
  title: "entri — your own notes, taken seriously",
  description:
    "Photograph your handwritten notes. entri reads them — never rewrites them — and quizzes you on a forgetting curve tuned to your exam date. Every card links back to the page you actually wrote.",
};

export default function Home() {
  return <Landing />;
}
