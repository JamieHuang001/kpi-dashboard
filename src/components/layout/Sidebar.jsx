import { useTheme } from '../../hooks/useTheme';

const navItems = [
    { icon: '📊', label: '儀表板總覽', id: 'dashboard' },
    { icon: '👷', label: '工程師績效', id: 'engineers' },
    { icon: '🔧', label: '零件消耗', id: 'parts' },
    { icon: '🏆', label: '重點客戶', id: 'customers' },
];

export default function Sidebar({ activeSection, onNavigate }) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <div className="sidebar">
            {/* Logo */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #0284c7, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '1.1rem', fontWeight: 800
                    }}>YD</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.2 }}>永定生物科技</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>技術部 BI Dashboard</div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', padding: '8px 12px', letterSpacing: '0.08em' }}>功能選單</div>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', marginBottom: 2,
                            border: 'none', borderRadius: 8, cursor: 'pointer',
                            background: activeSection === item.id ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                            color: activeSection === item.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            fontWeight: activeSection === item.id ? 700 : 500,
                            fontSize: '0.85rem',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== item.id) e.target.style.background = 'var(--color-surface-alt)';
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== item.id) e.target.style.background = 'transparent';
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleTheme}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8,
                        background: 'var(--color-surface-alt)', cursor: 'pointer',
                        color: 'var(--color-text)', fontSize: '0.8rem', fontWeight: 600,
                    }}
                >
                    <span>{isDark ? '🌙 深色模式' : '☀️ 淺色模式'}</span>
                    <div style={{
                        width: 36, height: 20, borderRadius: 10, padding: 2,
                        background: isDark ? 'var(--color-primary)' : '#cbd5e1',
                        transition: 'background 0.2s',
                        display: 'flex', alignItems: isDark ? undefined : undefined,
                    }}>
                        <div style={{
                            width: 16, height: 16, borderRadius: '50%', background: 'white',
                            transition: 'transform 0.2s',
                            transform: isDark ? 'translateX(16px)' : 'translateX(0)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                    </div>
                </button>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                    V5.0 BI Dashboard
                </div>
            </div>
        </div>
    );
}
