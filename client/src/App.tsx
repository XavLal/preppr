import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import SettingsPage from "@/pages/Settings.jsx";
import PwaInstallHelpPage from "@/pages/PwaInstallHelpPage";
import RecipePage from "@/pages/RecipePage";
import ShoppingPage from "@/pages/ShoppingPage";
import MenuGeneratorPage from "@/pages/MenuGenerator.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<ShoppingPage />} />
          <Route path="recette/:id" element={<RecipePage />} />
          <Route path="parametres" element={<SettingsPage />} />
          <Route path="parametres/installation-pwa" element={<PwaInstallHelpPage />} />
          <Route path="generateur-menus" element={<MenuGeneratorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
