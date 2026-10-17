import React from "react";
import { NotebookProvider } from "../../../src/ui/notebook/Notebook";
import { SleepScreen } from "../../../src/sleep/SleepScreen";

export default function SleepIndex() {
  return <NotebookProvider><SleepScreen /></NotebookProvider>;
}
