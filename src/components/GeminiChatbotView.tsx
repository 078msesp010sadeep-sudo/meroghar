import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Zap,
  Brain,
  Scale,
  Calculator,
  Droplets,
  Mic,
  RotateCcw,
  Loader2,
  CheckCircle,
  Copy,
  Info,
} from 'lucide-react';
import { AudioTranscribeModal } from './AudioTranscribeModal';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-init-1',
    role: 'model',
    text: `Namaste! I am your Nepali Home AI Assistant. I can assist you with:
• **Nepal Civil Code 2074** tenancy rules & lease termination notices
• **KUKL & NEA utility billing formulas** and sub-meter split calculations
• **Apartment maintenance mediation** and repair obligations
• **Kathmandu neighborhood utilities** and water safety testing

Select a specialized persona or model above, or ask any question!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'gemini-3.5-flash',
  },
];

export function GeminiChatbotView() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('general_advisor');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    // Save to Firestore if user is authenticated
    if (auth.currentUser) {
      const path = `chat_messages/${userMsg.id}`;
      try {
        await setDoc(doc(db, 'chat_messages', userMsg.id), {
          id: userMsg.id,
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Resident',
          role: 'user',
          text: userMsg.text,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, path);
        } catch (loggedErr) {
          console.warn('Firestore chat log note:', loggedErr);
        }
      }
    }

    try {
      // Determine task complexity flag
      let taskComplexity = 'general';
      if (selectedModel === 'gemini-3.1-pro-preview') {
        taskComplexity = 'complex';
      } else if (selectedModel === 'gemini-3.1-flash-lite') {
        taskComplexity = 'fast';
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, text: m.text })),
          systemRole: selectedRole,
          modelChoice: selectedModel,
          taskComplexity,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const botMsg: Message = {
        id: `msg-bot-${Date.now()}`,
        role: 'model',
        text: data.reply || 'No response returned from model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || selectedModel,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Save bot reply to Firestore if authenticated
      if (auth.currentUser) {
        const path = `chat_messages/${botMsg.id}`;
        try {
          await setDoc(doc(db, 'chat_messages', botMsg.id), {
            id: botMsg.id,
            senderId: 'ai-gemini',
            senderName: 'Gemini AI Assistant',
            role: 'model',
            text: botMsg.text,
            modelUsed: botMsg.modelUsed,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (loggedErr) {
            console.warn('Firestore bot chat log note:', loggedErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: `msg-err-${Date.now()}`,
        role: 'model',
        text: `Error processing request: ${err.message || 'Please check connection'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'system_error',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Role & Model Selector Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Bot className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">KinHome Gemini Multi-Turn Assistant</h2>
                <p className="text-xs text-slate-500">
                  Intelligent tenancy governance, math calculations, and legal mediation
                </p>
              </div>
            </div>
          </div>

          {/* Model Selection Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider">Model:</span>
            <button
              type="button"
              onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                selectedModel === 'gemini-3.1-pro-preview'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Complex (gemini-3.1-pro-preview)
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('gemini-3.5-flash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                selectedModel === 'gemini-3.5-flash'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              General (gemini-3.5-flash)
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Fast (gemini-3.1-flash-lite)
            </button>
          </div>
        </div>

        {/* Persona Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedRole('general_advisor')}
            className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2 ${
              selectedRole === 'general_advisor'
                ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <Bot className="w-4 h-4 text-indigo-600 shrink-0" />
            <div className="truncate text-xs">Home Living Advisor</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('legal_arbitrator')}
            className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2 ${
              selectedRole === 'legal_arbitrator'
                ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-semibold shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <Scale className="w-4 h-4 text-purple-600 shrink-0" />
            <div className="truncate text-xs">Nepal Civil Code Arbitrator</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('meter_billing_expert')}
            className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2 ${
              selectedRole === 'meter_billing_expert'
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="truncate text-xs">Sub-Meter Utility Math</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('water_science_expert')}
            className={`p-2.5 rounded-xl text-left border transition flex items-center gap-2 ${
              selectedRole === 'water_science_expert'
                ? 'border-cyan-500 bg-cyan-50/50 text-cyan-900 font-semibold shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <Droplets className="w-4 h-4 text-cyan-600 shrink-0" />
            <div className="truncate text-xs">Water Science & Quality</div>
          </button>
        </div>
      </div>

      {/* Main Chat Thread Window */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[580px] overflow-hidden">
        {/* Chat Thread Header */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Multi-turn Conversation Thread</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-500">{messages.length} messages</span>
          </div>

          <button
            type="button"
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition py-1 px-2 rounded-lg hover:bg-slate-200/60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Thread
          </button>
        </div>

        {/* Scrollable Message List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                    isUser
                      ? 'bg-slate-800'
                      : 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className="space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs'
                        : 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60 whitespace-pre-line'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Metadata & Copy action */}
                  <div
                    className={`flex items-center gap-2 text-[11px] text-slate-400 px-1 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">
                        {msg.modelUsed}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="hover:text-slate-600 transition"
                      title="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <CheckCircle className="w-3 h-3 text-emerald-600 inline" />
                      ) : (
                        <Copy className="w-3 h-3 inline" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 mr-auto items-center text-slate-500 text-sm py-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 bg-slate-100 py-2.5 px-4 rounded-2xl rounded-tl-xs border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="text-xs font-medium text-slate-600">
                  {selectedModel === 'gemini-3.1-pro-preview'
                    ? 'Reasoning with gemini-3.1-pro-preview...'
                    : selectedModel === 'gemini-3.1-flash-lite'
                    ? 'Speed replying with gemini-3.1-flash-lite...'
                    : 'Thinking with gemini-3.5-flash...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-5 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Info className="w-3 h-3" /> Quick:
          </span>
          <button
            type="button"
            onClick={() => handleSendMessage('How are KUKL water cubes (m³) calculated for sub-meters?')}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 whitespace-nowrap hover:bg-indigo-50/30 transition text-xs"
          >
            KUKL water cube formula
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('What is the statutory notice period for lease non-renewal in Nepal?')}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 whitespace-nowrap hover:bg-indigo-50/30 transition text-xs"
          >
            Lease termination notice (Civil Code 2074)
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('How much bleaching powder is safe for a 1,000L water tank?')}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 whitespace-nowrap hover:bg-indigo-50/30 transition text-xs"
          >
            Bleaching powder dosing for 1,000L tank
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Audio Voice Input Button */}
            <button
              type="button"
              onClick={() => setIsAudioModalOpen(true)}
              className="p-3 rounded-xl border border-slate-200 text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
              title="Voice Input (Microphone + gemini-3.5-transcribe)"
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about rental rights, NEA electricity slabs, maintenance, or water quality..."
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Voice Audio Transcription Modal */}
      <AudioTranscribeModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        onTranscriptionComplete={(text) => {
          setInputText((prev) => (prev ? `${prev} ${text}` : text));
        }}
        title="Voice Input via Microphone"
        subtitle="Speaks in Nepali or English. Automatically transcribed using gemini-3.5-transcribe."
      />
    </div>
  );
}
