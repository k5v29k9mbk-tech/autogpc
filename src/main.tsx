import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./store";
import { AuthProviderComponent } from "./auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// A deploy renames every hashed chunk, so a tab left open across one can no
// longer import the screen it navigates to — and vercel.json's catch-all
// rewrite answers the missing file with index.html, which isn't a module. The
// import rejects, React unmounts, blank page. It bites /review hardest: Home
// and Scan were downloaded before the deploy, Review only after it.
// Vite fires this event for exactly that case — reload to pick up the new
// asset manifest, but only once, so a genuinely broken build surfaces in the
// error boundary instead of reload-looping.
const RELOAD_KEY = "nexus:chunk-reload";
window.addEventListener("vite:preloadError", (e) => {
  if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 10_000) return;
  e.preventDefault();
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProviderComponent>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AuthProviderComponent>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
