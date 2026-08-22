import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BottomNav from "./BottomNav";
import { useWebSocket } from "@client/src/hooks/useWebSocket";
import { usePoke } from "@client/src/hooks/usePoke";
import PokeNotification from "@client/src/components/PokeNotification";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { connect, isConnected, on, off } = useWebSocket();
  const { activeNotification, dismissNotification } = usePoke(true);

  // Keep presence alive on every protected page, including friend details.
  useEffect(() => {
    if (!isConnected) connect();
  }, [connect, isConnected]);

  useEffect(() => {
    const handleDrawing = (payload: unknown): void => {
      const sender = (payload as { fromNickname?: string })?.fromNickname || "好友";
      toast(`${sender} 给你发来一幅画`, {
        action: { label: "查看", onClick: () => navigate("/drawings") },
      });
    };
    on("drawing:receive", handleDrawing);
    return () => off("drawing:receive", handleDrawing);
  }, [navigate, off, on]);

  const isFullscreenPage =
    location.pathname === "/map" ||
    location.pathname === "/fake-call" ||
    location.pathname.startsWith("/draw/") ||
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
      <PokeNotification notification={activeNotification} onDismiss={dismissNotification} />
    </div>
  );
};

export default Layout;
