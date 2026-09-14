import packageJson from "../../../package.json";

function formatBuildTime(iso: string | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
}

export function AppFooter() {
  const buildTime = formatBuildTime(process.env.NEXT_PUBLIC_BUILD_TIME);

  return (
    <footer className="text-muted-foreground px-4 py-3 text-center text-[10px] sm:px-6">
      v{packageJson.version}
      {buildTime ? ` · built ${buildTime}` : ""}
    </footer>
  );
}
