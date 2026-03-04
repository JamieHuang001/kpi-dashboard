const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || '';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

/**
 * 透過 Google Gemini API 生成內容
 * @param {string} prompt - 提示詞
 * @param {boolean} isJson - 是否要求回傳嚴格的 JSON 格式
 * @returns {Promise<any|string>}
 */
export async function generateGeminiResponse(prompt, isJson = false) {
    try {
        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        if (isJson) {
            payload.generationConfig = {
                responseMimeType: "application/json"
            };
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error ${response.status}: ${errorData?.error?.message || 'Unknown'}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('未收到有效的 AI 回應');
        }

        if (isJson) {
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                console.error("Failed to parse JSON directly. Raw text:", text);
                // Attempt to extract JSON if markdown wrapped
                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch && jsonMatch[1]) {
                    return JSON.parse(jsonMatch[1]);
                }
                throw new Error("AI 回傳的格式不是正確的 JSON");
            }
        }

        return text;
    } catch (err) {
        console.error("Gemini API Request failed:", err);
        throw err;
    }
}
