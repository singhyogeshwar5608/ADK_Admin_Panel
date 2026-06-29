import { AppShell } from "@/components/layout/AppShell";
import { RequireAdmin } from "@/components/layout/RequireAdmin";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { AdkEventsPage } from "@/pages/AdkEventsPage";
import { AdkKitProductsPage } from "@/pages/AdkKitProductsPage";
import { BinaryTreePage } from "@/pages/BinaryTreePage";
import { CataloguePage } from "@/pages/CataloguePage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DeliveryCentersPage } from "@/pages/DeliveryCentersPage";
import { HeroSliderPage } from "@/pages/HeroSliderPage";
import { HomeRedirect } from "@/pages/HomeRedirect";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { MlmIncomePage } from "@/pages/MlmIncomePage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SocialLinksPage } from "@/pages/SocialLinksPage";
import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/adk-kit-products" element={<AdkKitProductsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/delivery-centers" element={<DeliveryCentersPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/hero-slider" element={<HeroSliderPage />} />
          <Route path="/adk-events" element={<AdkEventsPage />} />
          <Route path="/social-links" element={<SocialLinksPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/binary-tree" element={<BinaryTreePage />} />
            <Route path="/mlm-income" element={<MlmIncomePage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
