import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth/AuthContext";

// Shown on every page until someone on a temporary password chooses their own.
function TemporaryPasswordNotice() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  if (!session?.mustChangePassword) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-med-bg text-[13px] rounded-lg px-3.5 py-2.5 mb-5">
      <span className="flex-1 min-w-[220px]">
        <b>You're using a temporary password.</b> Create your own to secure your account.
      </span>
      {pathname !== "/settings" && (
        <Link to="/settings#password" className="text-xs font-semibold text-white bg-accent px-3 py-1.5 rounded-lg">
          Create password
        </Link>
      )}
    </div>
  );
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/25 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0">
        <div className="flex lg:hidden items-center gap-3 px-4 py-3.5 border-b border-border bg-elevated sticky top-0 z-20">
          <button
            className="w-9 h-9 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-surface"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <span className="block w-4 h-0.5 bg-ink rounded-full" />
            <span className="block w-4 h-0.5 bg-ink rounded-full" />
            <span className="block w-4 h-0.5 bg-ink rounded-full" />
          </button>
          <div className="text-[15px] font-semibold">QC Road Safety</div>
        </div>

        <div className="p-5 pb-14 md:p-6 xl:p-9 xl:max-w-[1320px] xl:mx-auto">
          <TemporaryPasswordNotice />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
