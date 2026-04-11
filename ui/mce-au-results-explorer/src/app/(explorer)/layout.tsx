import type { ReactNode } from "react";
import { ExplorerProvider } from "../_explorer/context";
import { ExplorerShell } from "../_explorer/ExplorerShell";

export default function ExplorerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ExplorerProvider>
      <ExplorerShell>{children}</ExplorerShell>
    </ExplorerProvider>
  );
}
