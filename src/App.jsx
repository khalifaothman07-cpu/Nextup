import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { Home } from "./pages/Home.jsx";
import { Artist } from "./pages/Artist.jsx";
import { HowItWorks } from "./pages/HowItWorks.jsx";
import { Pricing } from "./pages/Pricing.jsx";
import { Discover } from "./pages/Discover.jsx";
import { About } from "./pages/About.jsx";
import { Faq } from "./pages/Faq.jsx";
import { Press } from "./pages/Press.jsx";
import { Terms } from "./pages/Terms.jsx";
import { RiskDisclosure } from "./pages/RiskDisclosure.jsx";
import { Privacy } from "./pages/Privacy.jsx";
import { Account } from "./pages/Account.jsx";
import { Apply } from "./pages/Apply.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { NotFound } from "./pages/NotFound.jsx";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/artist/:slug" element={<Artist />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/press" element={<Press />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/risk-disclosure" element={<RiskDisclosure />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/account" element={<Account />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
