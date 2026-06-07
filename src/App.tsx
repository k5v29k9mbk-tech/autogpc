import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireSession } from "./components/RequireSession";

// Route-level code splitting: each screen ships as its own chunk so heavy,
// screen-specific dependencies stay out of the initial bundle. In particular
// pdfjs (Scan) and the lazy jsPDF export (RecordDetail) only download when the
// user actually navigates there. Screens are named exports, so map them to the
// default export lazy() expects.
const Landing = lazy(() => import("./screens/Landing").then((m) => ({ default: m.Landing })));
const Home = lazy(() => import("./screens/Home").then((m) => ({ default: m.Home })));
const Scan = lazy(() => import("./screens/Scan").then((m) => ({ default: m.Scan })));
const Review = lazy(() => import("./screens/Review").then((m) => ({ default: m.Review })));
const Records = lazy(() => import("./screens/Records").then((m) => ({ default: m.Records })));
const RecordDetail = lazy(() =>
  import("./screens/RecordDetail").then((m) => ({ default: m.RecordDetail })),
);
const Account = lazy(() => import("./screens/Account").then((m) => ({ default: m.Account })));
const Login = lazy(() => import("./screens/auth/Login").then((m) => ({ default: m.Login })));
const CreateAccount = lazy(() =>
  import("./screens/auth/CreateAccount").then((m) => ({ default: m.CreateAccount })),
);
const AuthCallback = lazy(() =>
  import("./screens/auth/AuthCallback").then((m) => ({ default: m.AuthCallback })),
);
const ForgotPassword = lazy(() =>
  import("./screens/auth/ForgotPassword").then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import("./screens/auth/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const SsoAuthorize = lazy(() =>
  import("./screens/auth/SsoAuthorize").then((m) => ({ default: m.SsoAuthorize })),
);

export default function App() {
  return (
    <Suspense fallback={<div className="muted" style={{ padding: "var(--s6)" }}>Loading…</div>}>
      <Routes>
        {/* Pre-app auth screens — full-screen, outside the app shell. */}
        <Route path="login" element={<Login />} />
        <Route path="create-account" element={<CreateAccount />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route path="auth/reset" element={<ResetPassword />} />

        {/* SSO handoff for partner apps ("Sign in with Nexus"). */}
        <Route path="sso/authorize" element={<SsoAuthorize />} />

        {/* Marketing site — public, stashed off the main flow. Reachable from the
            app nav (after sign-in) and from the login screen. */}
        <Route path="marketing" element={<Landing />} />

        {/* App shell — the front door. Requires a session or guest mode, so an
            anonymous visit to "/" lands on the login screen. */}
        <Route
          element={
            <RequireSession>
              <Layout />
            </RequireSession>
          }
        >
          <Route index element={<Home />} />
          <Route path="scan" element={<Scan />} />
          <Route path="review" element={<Review />} />
          <Route path="records" element={<Records />} />
          <Route path="records/:id" element={<RecordDetail />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
