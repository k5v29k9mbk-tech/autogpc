// Loud, persistent indicator that the app is in guest mode. Deliberately uses
// the clay "danger" tint so it can't be mistaken for a signed-in account.

import { useAuth } from "../auth";
import { IconAlert } from "./icons";

export function GuestBanner() {
  const { mode } = useAuth();
  if (mode !== "guest") return null;
  return (
    <div className="guest-banner" role="status">
      <div className="container">
        <IconAlert width={15} height={15} />
        <span>
          <strong>Guest mode.</strong> You're not signed in — records won't be saved to an account.
        </span>
      </div>
    </div>
  );
}
