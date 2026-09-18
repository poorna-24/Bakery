/** The square-with-a-dot mark Indian menus use: green = veg, red = non-veg. */
export default function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "#15803d" : "#b91c1c";
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border-2"
      style={{ borderColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}
