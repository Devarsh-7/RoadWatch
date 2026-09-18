import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { sendChatMessage } from '../api';

const suggestions = [
  { text: 'Who maintains NH44?', icon: '🛣️' },
  { text: 'Roads in poor condition', icon: '⚠️' },
  { text: 'Budget spent on NH8?', icon: '💰' },
  { text: 'Engineer for SH-17?', icon: '👷' },
  { text: 'Last repair of NH-48?', icon: '🔧' },
  { text: 'Karnataka road status', icon: '📊' },
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hi! I'm **RoadWatch AI** — ask me about any road's contractor, budget, repair history, or responsible authority. I have data on 20+ roads across 5 Indian states.", sources: [] },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    setMessages((p) => [...p, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await sendChatMessage(msg);
      setMessages((p) => [...p, { role: 'bot', content: res.data.reply, sources: res.data.sources || [] }]);
    } catch {
      setMessages((p) => [...p, { role: 'bot', content: "Sorry, I'm having trouble connecting. Please try again.", sources: [] }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <PageTransition>
      <div className="min-h-screen pt-28 pb-6 flex flex-col">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 w-full flex flex-col flex-1">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4 mb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </div>
              <h1 className="text-xl font-bold font-heading">RoadWatch AI</h1>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="pulse-live" />
              <span className="text-text-secondary text-xs">Powered by RAG + Gemini</span>
            </div>
          </motion.div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mr-2 mt-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    </div>
                  )}
                  <div className={`max-w-[80%] p-4 ${msg.role === 'user' ? 'chat-user' : 'chat-bot'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources?.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-white/10">
                        <p className="text-[0.65rem] text-text-secondary mb-1 uppercase tracking-wider">Sources</p>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((s, j) => <span key={j} className="text-[0.65rem] bg-white/5 px-2 py-0.5 rounded-md text-text-secondary border border-white/5">{s}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mr-2 mt-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                <div className="chat-bot p-4 flex items-center gap-1">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </motion.div>
            )}
            <div ref={chatEnd} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => send(s.text)}
                  className="px-3.5 py-2 rounded-xl text-xs bg-surface-light/80 text-text-secondary hover:text-secondary hover:bg-surface-light border border-white/5 hover:border-secondary/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>{s.icon}</span> {s.text}
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="glass p-3 flex gap-3">
            <input
              ref={inputRef}
              type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={loading}
              placeholder="Ask about any road..."
              className="input-field flex-1 py-3 text-sm disabled:opacity-50"
            />
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              type="submit" disabled={loading || !input.trim()}
              className="btn-primary px-6 text-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </motion.button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
