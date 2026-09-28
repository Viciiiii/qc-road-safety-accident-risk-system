export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-elevated border border-border rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}
