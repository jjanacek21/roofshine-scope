import { useEffect, useState, useCallback } from "react";

const KEY = "sidebar-collapsed";
const EVT = "sidebar-collapsed-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(read);

  useEffect(() => {
    const onChange = () => setCollapsedState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, v ? "1" : "0");
      window.dispatchEvent(new Event(EVT));
    }
    setCollapsedState(v);
  }, []);

  return [collapsed, setCollapsed];
}
