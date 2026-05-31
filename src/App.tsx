import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./screens/Home";
import { Scan } from "./screens/Scan";
import { Review } from "./screens/Review";
import { Records } from "./screens/Records";
import { RecordDetail } from "./screens/RecordDetail";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
