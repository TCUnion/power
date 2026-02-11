
import { useState } from 'react';
import { Send, Bot } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function DataChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '你好！我是你的 AI 數據教練。你可以問我關於你的騎乘表現、比較歷史數據，或是詢問訓練建議。試試看問我：「上個月的爬坡表現跟去年比如何？」',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!inputValue.trim() || isSending) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsSending(true);

        try {
            // TODO: Call API endpoint /api/ai/chat
            // const response =await apiFetch(...)

            // Simulating a delay and response for now
            await new Promise(resolve => setTimeout(resolve, 1500));

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '這個功能還在開發中！目前我可以為你生成每日訓練摘要，請使用上方的生成按鈕。',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat failed:', error);
            // Handle error
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="bg-white rounded-lg shadow flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    數據對話助手
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`
                            max-w-[80%] rounded-lg p-3 text-sm
                            ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'}
                        `}>
                            {msg.content}
                            <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}
                {isSending && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg p-3 rounded-bl-none">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="詢問你的數據..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        disabled={isSending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || !inputValue.trim()}
                        className="bg-indigo-600 text-white rounded-lg p-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
