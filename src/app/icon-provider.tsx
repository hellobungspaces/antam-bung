"use client";
import { IconContext } from "@phosphor-icons/react";

// Semua ikon memakai bobot "bold" supaya serasi dengan teks extrabold; ikon tab aktif menimpa jadi "fill"
export default function IconProvider({ children }: { children: React.ReactNode }) {
  return <IconContext.Provider value={{ weight: "bold" }}>{children}</IconContext.Provider>;
}
