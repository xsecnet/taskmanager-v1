import { cn } from "../../lib/utils";

interface Props {
  className?: string;
}

export function Skeleton({ className }: Props) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border hairline bg-surface-1 p-5 shadow-soft">
      <Skeleton className="h-5 w-1/3 mb-3" />
      <SkeletonText lines={3} />
    </div>
  );
}
