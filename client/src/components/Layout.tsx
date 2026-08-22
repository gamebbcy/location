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
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased">
      <div
        className={activeNotification ? "animate-[poke-screen-shake_520ms_ease-in-out] motion-reduce:animate-none" : ""}
      >
        <main
          className={`mx-auto w-full max-w-md ${
            isTabPage ? "pb-16" : ""
          } ${isFullscreenPage ? "" : "min-h-screen"}`}
        >
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <PokeNotification notification={activeNotification} onDismiss={dismissNotification} />
      <style>{`
        @keyframes poke-screen-shake {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0); }
          12% { transform: translate3d(-7px, 1px, 0) rotate(-0.35deg); }
          24% { transform: translate3d(7px, -1px, 0) rotate(0.35deg); }
          38% { transform: translate3d(-6px, 0, 0) rotate(-0.25deg); }
          52% { transform: translate3d(6px, 1px, 0) rotate(0.25deg); }
          68% { transform: translate3d(-3px, -1px, 0) rotate(-0.12deg); }
          84% { transform: translate3d(3px, 0, 0) rotate(0.12deg); }
        }
      `}</style>
    </div>
  );
};

export default Layout;
