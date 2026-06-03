import { useState } from "react";
import { ShieldCheck, BarChart3, Users, Tag, Car } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/NavBar";
import OverviewTab from "../components/OverviewTab";
import UsersTab from "../components/UsersTab";
import CategoriesTab from "../components/CategoriesTab";
import VehiclesTab from "../components/VehiclesTab";

const TABS = [
  { key: "overview", label: "Overview", Icon: BarChart3 },
  { key: "users", label: "Users", Icon: Users },
  { key: "categories", label: "Categories", Icon: Tag },
  { key: "vehicles", label: "Vehicles", Icon: Car },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("overview");

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar user={user} logout={logout} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7 flex-1 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-txt-primary">
              Admin Dashboard
            </h1>
            <p className="text-xs text-txt-muted mt-0.5">
              Manage users, categories and vehicles
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-elevated border border-border-subtle rounded-xl p-1 mb-6 w-fit overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === key
                  ? "bg-bg-card text-txt-primary shadow-sm border border-border-subtle"
                  : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "vehicles" && <VehiclesTab />}
      </div>
    </div>
  );
}
