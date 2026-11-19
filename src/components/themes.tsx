import type { ThemeKey } from "../data/types";

/** Sustainability themes used on challenge cards: a label, a tint, an illustration and a short fact. */
export const THEME_INFO: Record<ThemeKey, { label: string; tint: string; ink: string; fact: string }> = {
  plastics: { label: "Plastics", tint: "#E3F2F1", ink: "#1E6F73", fact: "A plastic straw is used for minutes and lasts for centuries." },
  energy: { label: "Energy", tint: "#FBF0D2", ink: "#9A7317", fact: "Lighting empty rooms is one of the easiest campus savings." },
  water: { label: "Water", tint: "#DFF0FA", ink: "#1E5B7A", fact: "Every kilolitre billed should be a kilolitre received." },
  ewaste: { label: "E-waste", tint: "#ECE8F5", ink: "#5B4B8A", fact: "Old laptops hold gold, copper and lithium worth recovering." },
  food: { label: "Food waste", tint: "#EAF4DD", ink: "#4D7A1F", fact: "Food in landfill turns into methane, a potent greenhouse gas." },
  climate: { label: "Climate", tint: "#F8E6DE", ink: "#A14B2F", fact: "Measure it, then cut it: emissions start with honest numbers." },
};

export function ThemeArt({ theme, size = 64 }: { theme: ThemeKey; size?: number }) {
  const c = THEME_INFO[theme].ink;
  const common = { width: size, height: size, viewBox: "0 0 64 64", fill: "none", stroke: c, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (theme) {
    case "plastics":
      return <svg {...common}><path d="M22 14h20l-3 40H25z" /><path d="M23 24h18" /><path d="M36 14l6-8" /><path d="M14 52c4-3 8-3 12 0s8 3 12 0 8-3 12 0" opacity=".55" /></svg>;
    case "energy":
      return <svg {...common}><circle cx="32" cy="26" r="12" /><path d="M27 38v6h10v-6" /><path d="M28 48h8" /><path d="M32 6v4M14 26h-4M54 26h-4M19 13l-3-3M45 13l3-3" opacity=".55" /><path d="M30 20l-3 7h6l-3 7" /></svg>;
    case "water":
      return <svg {...common}><path d="M32 8s14 16 14 26a14 14 0 0 1-28 0C18 24 32 8 32 8z" /><path d="M25 36a7 7 0 0 0 7 7" opacity=".55" /><path d="M10 56c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 8 0" opacity=".55" /></svg>;
    case "ewaste":
      return <svg {...common}><rect x="12" y="14" width="40" height="26" rx="3" /><path d="M24 50h16M32 40v10" /><path d="M24 27l5 5 11-11" opacity=".55" /><path d="M8 58l6-6M56 58l-6-6" opacity=".55" /></svg>;
    case "food":
      return <svg {...common}><path d="M32 54c-12 0-20-9-20-20 0-9 6-14 12-14 4 0 6 2 8 2s4-2 8-2c6 0 12 5 12 14 0 11-8 20-20 20z" /><path d="M32 22c0-6 3-11 8-13" /><path d="M32 22c-4-5-10-5-12-3 2 4 8 5 12 3z" opacity=".55" /></svg>;
    case "climate":
      return <svg {...common}><circle cx="32" cy="32" r="20" /><path d="M14 26c6 2 10-2 14 2s2 10 8 10 6-6 12-4" opacity=".55" /><path d="M22 14c2 4 6 4 8 8s-2 6 0 8" opacity=".55" /></svg>;
  }
}
