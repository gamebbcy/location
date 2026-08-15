import { NavLink, useLocation } from "react-router-dom";
import { Map, Users, Zap, User } from "lucide-react";
import { useEffect, useState } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Map;
}

const navItems: NavItem[] = [
  { path: "/map", label: "地图", icon: Map },
  { path: "/friends", label: "好友", icon: Users },
  { path: "/shortcuts", label: "快捷指令", icon: Zap },
  { path: "/profile", label: "我的", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  const isTabPage = navItems.some((item) =>
    location.pathname === item.path || location.pathname === "/"
  );

  useEffect(() => {
    setVisible(isTabPage);
  }, [isTabPage]);

  if (!visible) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/80 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md items-end justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 transition-transform ${
                      isActive ? "scale-110" : ""
                    }`}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
