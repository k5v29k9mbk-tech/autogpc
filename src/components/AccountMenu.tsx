// The top-nav account control: a single button (email or "Guest") that opens a
// dropdown with Account settings + Sign out — replacing the old separate chip
// and sign-out button. Closes on outside-click or Escape.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { IconChevronRight, IconLogOut, IconShield, IconUser } from "./icons";

export function AccountMenu() {
  const { mode, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isGuest = mode === "guest";
  // Prefer the user's name (from our signup fields or the OAuth profile), falling
  // back to email, then a generic label.
  const name = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const accountLabel = (name && name.length ? name : null) ?? user?.email ?? "Account";
  const label = isGuest ? "Guest" : accountLabel;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={isGuest ? "Guest mode" : accountLabel}
      >
        {isGuest ? (
          <span className="dot" style={{ background: "var(--warn)" }} />
        ) : (
          <IconUser width={15} height={15} />
        )}
        <span className="who">{label}</span>
        <IconChevronRight className="chev" width={14} height={14} />
      </button>

      {open && (
        <div className="account-pop" role="menu">
          <div className="account-pop-head">
            <span className="muted">{isGuest ? "Guest mode" : "Signed in as"}</span>
            {!isGuest && user?.email && <div className="account-pop-email">{user.email}</div>}
          </div>

          {!isGuest && (
            <button
              type="button"
              className="account-pop-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate("/account");
              }}
            >
              <IconShield width={15} height={15} />
              Account settings
            </button>
          )}

          <button type="button" className="account-pop-item danger" role="menuitem" onClick={signOut}>
            <IconLogOut width={15} height={15} />
            {isGuest ? "Exit guest" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
