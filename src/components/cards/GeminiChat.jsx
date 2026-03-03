import { useState, useRef, useEffect, memo } from 'react';

const API_KEY = 'AIzaSyCwd5YzDDycQdFK78rguzuFSEV9ikSFmww';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

const GeminiChat = memo(function GeminiChat({ stats, historicalStats, monthlyTrends }) {
    const [messages, setMessages] = useState([
        { role: 'model', content: '您好！我是 NeuroBI™ 營運顧問。我已經讀取了儀表板上的最新維修與績效數據。您可以問我關於目前毛利狀況、生產力瓶頸、或是表現最佳的機型與工程師等問題！' }
    ]);
    const [inputUrl, setInputUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const buildContextPrompt = () => {
        let context = "你是一位專業的硬體維修與售後服務營運顧問。請根據以下當前的 KPI 數據回答使用者的問題，如果問題與數據無關，可以簡單回答但不需過度發散。\n\n";

        if (stats) {
            context += `[當前數據摘要]\n`;
            context += `- 總案件數: ${stats.total.cases} 件\n`;
            context += `- 總產能點數: ${stats.total.points.toFixed(1)} 點\n`;
            context += `- 預估淨毛利: NT$${stats.grossMargin.toLocaleString()}\n`;
            context += `- SLA 超標率: ${stats.slaRate}%\n`;
            context += `- 返修率 (14天內): ${stats.recallRate.toFixed(1)}%\n`;
            context += `- 平均淨 TAT: ${stats.avgTat} 天\n`;
            context += `- 保固內案件佔比: ${stats.warRate}%\n`;
            if (stats.topEngineer) {
                context += `- 表現最佳工程師: ${stats.topEngineer.name} (產出 ${stats.topEngineer.points.toFixed(1)} 點)\n`;
            }
            if (stats.topPart) {
                context += `- 消耗最多零件: ${stats.topPart.name} (${stats.topPart.count} 件)\n`;
            }
        }

        context += "\n請使用繁體中文，語氣專業且精煉。必要時可使用 Markdown 標籤標記重點。";
        return context;
    };

    const handleSend = async () => {
        if (!inputUrl.trim() || isLoading) return;

        const userMsg = inputUrl.trim();
        setInputUrl('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            // Prepare the conversation history for Gemini API
            const geminiHistory = [
                { role: 'user', parts: [{ text: buildContextPrompt() }] },
                { role: 'model', parts: [{ text: "了解，我會根據這些數據提供專業的顧問建議。" }] }
            ];

            messages.forEach(msg => {
                // Gemini uses 'model' and 'user' roles
                geminiHistory.push({
                    role: msg.role === 'model' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            });

            // Append the new user message
            geminiHistory.push({ role: 'user', parts: [{ text: userMsg }] });

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: geminiHistory })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我現在無法產生回應，請稍後再試。";

            setMessages(prev => [...prev, { role: 'model', content: reply }]);
        } catch (error) {
            console.error("Gemini API Error:", error);
            setMessages(prev => [...prev, { role: 'model', content: `⚠️ 連線至 AI 伺服器失敗 (${error.message})。請檢查網路或 API 金鑰限制。` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Simple markdown to HTML parser for basic formatting in chat bubbles
    const parseMarkdown = (text) => {
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br />');
        return html;
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)',
            background: 'var(--color-surface)', borderRadius: 12,
            border: '1px solid var(--color-border)', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(90deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(139,92,246,0.3)' }}>
                    🤖
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>NeuroBI™ AI 營運顧問</h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>搭載 Gemini 1.5 Flash · 已載入當前儀表板數據</div>
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--color-surface-alt)' }}>
                {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                        <div key={idx} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                background: isUser ? 'var(--color-primary)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem'
                            }}>
                                {isUser ? '👤' : '🤖'}
                            </div>
                            <div style={{
                                maxWidth: '75%', padding: '12px 16px', borderRadius: 12,
                                borderTopRightRadius: isUser ? 0 : 12,
                                borderTopLeftRadius: isUser ? 12 : 0,
                                background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: isUser ? 'white' : 'var(--color-text)',
                                border: isUser ? 'none' : '1px solid var(--color-border)',
                                fontSize: '0.95rem', lineHeight: 1.6,
                                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                            }} dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                        </div>
                    );
                })}
                {isLoading && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem' }}>🤖</div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px 16px', borderRadius: '0 12px 12px 12px', display: 'flex', gap: 6 }}>
                            <span className="dot-pulse" style={{ animationDelay: '0s' }}>●</span>
                            <span className="dot-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                            <span className="dot-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: 16, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', gap: 12 }}>
                <textarea
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="詢問任何關於目前 KPI 數據、效率瓶頸或改善建議的問題... (按 Enter 傳送)"
                    style={{
                        flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: '0.95rem',
                        resize: 'none', height: 48, outline: 'none', fontFamily: 'inherit'
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !inputUrl.trim()}
                    style={{
                        padding: '0 24px', borderRadius: 12, border: 'none', background: 'var(--color-primary)',
                        color: 'white', fontWeight: 700, fontSize: '1rem', cursor: (isLoading || !inputUrl.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (isLoading || !inputUrl.trim()) ? 0.6 : 1, transition: 'all 0.2s'
                    }}
                >
                    送出
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .dot-pulse { font-size: 0.6rem; color: #8b5cf6; animation: blink 1.4s infinite; }
                @keyframes blink { 0%, 100% { opacity: 0.2; } 20% { opacity: 1; } }
            `}} />
        </div>
    );
});

export default GeminiChat;
