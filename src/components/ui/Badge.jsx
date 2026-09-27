// <Badge level="High" /> | "Medium" | "Low"
const styles = {
  High: "bg-high-bg text-high",
  Medium: "bg-med-bg text-med",
  Low: "bg-low-bg text-low",
};

export default function Badge({ level }) {
  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
        styles[level] || styles.Low
      }`}
    >
      {level} Priority
    </span>
  );
}
