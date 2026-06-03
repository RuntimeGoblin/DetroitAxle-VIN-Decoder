import { useQuery } from "@tanstack/react-query";
import { Car, Users, Tag, MessageSquare, Activity } from "lucide-react";
import { getStats } from "../api/admin";
import StatCard from "./StatCard";
import NotesChart from "./NotesChart";
import ActivityFeed from "./Activityfeed.jsx";
import UsageBreakdown from "./UsageBreakdown";

export default function OverviewTab() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const typeSplit = data
    ? { free_text: data.total_free_notes, part_number: data.total_part_notes }
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Vehicles",
            value: data?.vehicles_count,
            icon: Car,
            color: "accent",
          },
          {
            label: "Users",
            value: data?.user_count,
            icon: Users,
            color: "accent",
          },
          {
            label: "Notes",
            value: data?.notes_count,
            icon: MessageSquare,
            color: "accent",
          },
          {
            label: "Notes Today",
            value: data?.notes_today_count,
            icon: Activity,
            color: "success",
          },
          {
            label: "Categories",
            value: data?.categories_count,
            icon: Tag,
            color: "accent",
          },
        ].map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Chart + feed — equal-height columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <NotesChart typeSplit={typeSplit} />
        <ActivityFeed />
      </div>

      {/* Usage breakdown — full width */}
      <UsageBreakdown data={data} />
    </div>
  );
}
