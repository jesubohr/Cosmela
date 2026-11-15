import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // shadcn's sidebar stores its collapsed state in this cookie.
  const sidebarState = (await cookies()).get("sidebar_state")?.value;
  return <AppShell defaultOpen={sidebarState !== "false"}>{children}</AppShell>;
}
