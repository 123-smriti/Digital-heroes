export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>digital.heroes — play your round, back a cause.</span>
        <span>© {new Date().getFullYear()} Digital Heroes</span>
      </div>
      <style>{`
        .footer { border-top: 1px solid var(--line); margin-top: 80px; padding: 28px 0; }
        .footer-inner { display: flex; justify-content: space-between; color: var(--ink-faint); font-size: 0.85rem; flex-wrap: wrap; gap: 8px; }
      `}</style>
    </footer>
  )
}
