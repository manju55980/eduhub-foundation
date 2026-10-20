import { createFileRoute } from "@tanstack/react-router";

import { LearningAssistantScreen } from "@/features/student/learning-assistant-screen";

export const Route = createFileRoute("/student/assistant")({
  component: LearningAssistantScreen,
});
