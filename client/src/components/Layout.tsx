import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";

const Layout = () => {
  const location = useLocation();

  const isFullscreenPage =
    location.pathname === "/map" ||
    location.pathname === "/fake-call" ||
    location.pathname.startsWith("/friend/");

  const isTabPage = ["/map", "/friends", "/shortcuts", "/profile", "/"].some(
    (p) => location.pathname === p
  );

  return (
    <div className="relative min-h-screen bg-background font-sans text-foreground antialiased">
      <main
        className={`mx-auto w-full max-w-md ${
          isTabPage ? "pb-16" : ""
        } ${isFullscreenPage ? "" : "min-h-screen"}`}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
