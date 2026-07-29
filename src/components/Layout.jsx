import { Outlet } from "react-router-dom";
import { Header } from "./Header.jsx";
import { Footer } from "./Footer.jsx";
import { ScrollManager } from "./ScrollManager.jsx";

export function Layout() {
  return (
    <>
      <ScrollManager />
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
