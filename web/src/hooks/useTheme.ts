import { useEffect, useState } from "react";

const KEY = "ryukage-pulse-theme";

function inicial(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved === "dark";
  } catch {
    /* armazenamento indisponível (modo privado) */
  }
  return false;
}

export function useTheme() {
  const [dark, setDark] = useState(inicial);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      /* idem */
    }
  }, [dark]);
  return [dark, setDark] as const;
}
