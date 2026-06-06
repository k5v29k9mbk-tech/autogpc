import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./store";
import { AuthProviderComponent } from "./auth";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProviderComponent>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProviderComponent>
    </BrowserRouter>
  </React.StrictMode>,
);
