
import { useState, useEffect, useRef } from 'react';
import { Send, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}


interface DataChatInterfaceProps {
    onSendMessage: (message: string) => Promise<{ reply: string }>;
    userName?: string;
    usageStatus?: {
        current: number;
        limit: number;
        remaining: number;
    } | null;
    initialMessages?: any[]; // Changed type to any[] as per instruction snippet
    isLoadingHistory?: boolean; // 新增此 prop
}

export function DataChatInterface({
    onSendMessage,
    userName,
    usageStatus,
    initialMessages,
    isLoadingHistory = false // 預設為 false
}: DataChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);

    // NOTE: 當載入完成或有初始訊息時更新
    useEffect(() => {
        // 1. 如果正在載入歷史資料，先不進行初始化
        if (isLoadingHistory) return;

        // 2. 如果有歷史對話紀錄，則填入紀錄，並不顯示歡迎語
        if (initialMessages && initialMessages.length > 0) {
            const formattedHistory = initialMessages.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }));
            setMessages(formattedHistory);
            return; // 歷史對話優先
        }

        // 3. 只有在【沒有歷史對話紀錄】且【目前訊息陣列為空】且【有使用者名稱】時，才顯示歡迎語
        if (messages.length === 0 && userName) {
            const welcomeMsg: Message = {
                id: 'welcome',
                role: 'assistant',
                content: `你好 ${userName}！我是 TCU AI 功率教練。你可以問我關於你的騎乘表現、比較歷史數據，或是詢問訓練建議。試試看問我：「上個月的爬坡表現跟去年比如何？」`,
                timestamp: new Date()
            };
            setMessages([welcomeMsg]);
        }
    }, [userName, initialMessages, isLoadingHistory]);

    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // NOTE: 自動捲動至最下方
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isSending]);

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
            const response = await onSendMessage(userMsg.content);

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.reply,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat failed:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '抱歉，發生錯誤，請稍後再試。',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsSending(false);
        }
    };


    return (
        <div className="bg-white rounded-lg shadow flex flex-col min-h-[500px] h-[600px] lg:h-[800px]">
            <div className="p-3 md:p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    TCU AI 功率教練
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col">
                <div className="mt-auto space-y-4 w-full">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`
                                max-w-[85%] md:max-w-[80%] rounded-lg p-3 text-sm
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-none'}
                            `}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-red-600 prose-a:font-bold">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                )}
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
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="p-4 border-t border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={usageStatus ? `詢問你的數據... (今日剩餘 ${usageStatus.remaining} 次)` : "詢問你的數據..."}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-gray-900 bg-white placeholder-gray-400"
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
