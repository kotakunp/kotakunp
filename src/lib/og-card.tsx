export const ogSize = { width: 1200, height: 630 };

export function OgCard({ tag, title, sub }: { tag: string; title: string; sub?: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: 72, background: "#f8f7f3", color: "#17191a",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#626561" }}>
        <span>kotakunp</span>
        <span>{tag}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", width: 64, height: 2, background: "#17191a" }} />
        <div style={{ display: "flex", fontSize: title.length > 32 ? 56 : 72, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        {sub ? <div style={{ display: "flex", fontSize: 28, color: "#626561" }}>{sub}</div> : null}
      </div>
    </div>
  );
}
