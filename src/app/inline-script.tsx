// Skrip inline yang jalan saat HTML di-parse (sebelum cat pertama). Di client dibuat text/plain supaya React
// tidak memperingatkan soal <script> di dalam komponen; lihat docs "preventing-flash-before-hydration".
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
