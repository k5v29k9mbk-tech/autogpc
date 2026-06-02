import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireSession } from "./components/RequireSession";
import { Home } from "./screens/Home";
import { Scan } from "./screens/Scan";
import { Review } from "./screens/Review";
import { Records } from "./screens/Records";
import { RecordDetail } from "./screens/RecordDetail";
import { Login } from "./screens/auth/Login";
import { CreateAccount } from "./screens/auth/CreateAccount";
import { AuthCallback } from "./screens/auth/AuthCallback";

export default function App() {
  return (
    <Routes>
      {/* Pre-app auth screens — full-screen, outside the app shell. */}
      <Route path="login" element={<Login />} />
      <Route path="create-account" element={<CreateAccount />} />
      <Route path="auth/callback" element={<AuthCallback />} />

      {/* App shell — requires an authenticated session or guest mode. */}
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
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
