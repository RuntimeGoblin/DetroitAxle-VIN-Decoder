import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Hash,
  Clock,
  Car,
  Rss,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getRecentNotes } from "../api/admin";
import { getVehicleById } from "../api/vehicles";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NoteRow({ note }) {
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isPart = note.note_type === "part_number";
  const isError = note.note_type === "listing_error";

  const handleVehicleClick = async (e) => {
    e.preventDefault();
    if (isRedirecting) return;
    try {
      setIsRedirecting(true);
      const res = await getVehicleById(note.vehicle_id);
      // After the axios interceptor, res.data is the VehicleResponse (snake_case)
      const buildKey = res.data?.build_key;
      if (buildKey) navigate(`/v/${buildKey}`);
    } catch {
      // silently ignore — redirect is best-effort
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="group flex items-start gap-3 p-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/40 transition-colors rounded-xl">
      {/* Icon badge */}
      <div
        className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ring-1 ${
          isError
            ? "bg-red-500/10 ring-red-500/20"
            : isPart
              ? "bg-emerald-500/10 ring-emerald-500/20"
              : "bg-accent/10 ring-accent/20"
        }`}
      >
        {isError ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        ) : isPart ? (
          <Hash className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <MessageSquare className="w-3.5 h-3.5 text-accent" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: username + badge */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-txt-primary leading-none">
            {note.username}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide uppercase ${
              isError
                ? "bg-red-500/10 text-red-500"
                : isPart
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-accent/10 text-accent"
            }`}
          >
            {isError ? "Error" : isPart ? "Part" : "Note"}
          </span>
          {note.part_category?.name && (
            <span className="text-xs text-txt-muted truncate max-w-[120px]">
              {note.part_category.name}
            </span>
          )}
        </div>

        {/* Body text */}
        <p
          className={`text-sm truncate leading-relaxed ${
            isError ? "text-red-500 font-medium" : "text-txt-secondary"
          }`}
        >
          {isPart ? (
            <>
              <span className="text-txt-muted mr-1">Part #</span>
              <span className="font-medium text-txt-primary">
                {note.part_number}
              </span>
            </>
          ) : (
            note.free_text
          )}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2">
          {/* Clickable Vehicle Badge */}
          <button
            onClick={handleVehicleClick}
            disabled={isRedirecting}
            className="flex items-center gap-1.5 text-xs text-txt-muted hover:text-accent transition-colors disabled:opacity-70 focus:outline-none"
          >
            {isRedirecting ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-accent" />
            ) : (
              <Car className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hover:underline font-medium">
              #{note.vehicle_id}
            </span>
          </button>

          <span className="w-px h-3 bg-border-subtle" />
          <span className="flex items-center gap-1.5 text-xs text-txt-muted">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {timeAgo(note.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-3 border-b border-border-subtle last:border-0">
      <div className="w-8 h-8 rounded-xl bg-bg-elevated shrink-0 animate-pulse" />
      <div className="flex-1 space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-3 bg-bg-elevated rounded-full w-24 animate-pulse" />
          <div className="h-3 bg-bg-elevated rounded-md w-12 animate-pulse" />
        </div>
        <div className="h-3 bg-bg-elevated rounded-full w-3/4 animate-pulse" />
        <div className="h-2.5 bg-bg-elevated rounded-full w-1/3 animate-pulse" />
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["recent-notes"],
    queryFn: () => getRecentNotes(15).then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="section-card flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0 px-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Rss className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-base font-semibold text-txt-primary leading-none">
              Recent activity
            </p>
            <p className="text-xs text-txt-muted mt-1">
              Latest notes across all vehicles
            </p>
          </div>
        </div>
        {notes.length > 0 && (
          <span className="text-xs font-medium text-txt-muted tabular-nums bg-bg-elevated border border-border-subtle rounded-lg px-2.5 py-1">
            {notes.length} notes
          </span>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 pr-2 space-y-1 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : notes.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-bg-elevated flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-txt-muted" />
            </div>
            <p className="text-sm text-txt-muted">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => <NoteRow key={note.id} note={note} />)
        )}
      </div>
    </div>
  );
}
