"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  BookOpen,
  ChevronRight,
  Clock,
  Heart,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { askFiscalAI, getQuickQuestions, applyAISuggestions } from "@/lib/services/fiscal/fiscal-ai-service";
import type { FiscalAiResponse, FiscalAiSuggestion, FiscalAiAction, CorrectionType } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: FiscalAiResponse;
  timestamp: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  favorite: boolean;
};

const CONVERSATIONS_KEY = "ns-fiscal-ai-conversations";
const TYPE_COLORS: Record<CorrectionType, string> = {
  AUTO_SAFE: "bg-lime text-ink",
  AUTO_CONFIRM: "bg-blue-50 text-blue-700",
  MANUAL_GUIDED: "bg-muted text-subtle",
  ACCOUNTANT_REVIEW: "bg-purple-50 text-purple-700",
  RETRY_ONLY: "bg-orange-50 text-orange-700",
};

const ACTION_VARIANTS: Record<string, "lime" | "default" | "outline" | "ghost"> = {
  apply_all: "lime",
  apply_selected: "lime",
  send_to_accountant: "outline",
  view_details: "ghost",
  ignore: "ghost",
};

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(CONVERSATIONS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return [];
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }
}

export function FiscalAiView() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);
    if (convs.length > 0) setActiveConversationId(convs[0].id);
    getQuickQuestions().then(setQuickQuestions);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConversationId]);

  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null;

  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: "conv-" + Date.now(),
      title: "Nova conversa",
      messages: [],
      createdAt: new Date().toISOString(),
      favorite: false,
    };
    const updated = [newConv, ...conversations];
    setConversations(updated);
    setActiveConversationId(newConv.id);
    saveConversations(updated);
    return newConv.id;
  }, [conversations]);

  const handleAsk = useCallback(async (q?: string) => {
    const query = q ?? question;
    if (!query.trim()) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = createNewConversation();
    }

    const userMsg: ChatMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id !== convId) return c;
        const isFirst = c.messages.length === 0;
        return {
          ...c,
          title: isFirst ? query.slice(0, 60) : c.title,
          messages: [...c.messages, userMsg],
        };
      });
      saveConversations(updated);
      return updated;
    });
    setQuestion("");
    setLoading(true);

    const res = await askFiscalAI(query);

    const assistantMsg: ChatMessage = {
      id: "msg-" + Date.now() + "-ai",
      role: "assistant",
      content: res.answer,
      response: res,
      timestamp: new Date().toISOString(),
    };

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id !== convId) return c;
        return { ...c, messages: [...c.messages, assistantMsg] };
      });
      saveConversations(updated);
      return updated;
    });
    setLoading(false);
  }, [question, activeConversationId, createNewConversation]);

  const handleApplySuggestions = async (suggestionIds: string[]) => {
    const result = await applyAISuggestions(suggestionIds);
    notify({ title: `${result.success} correcoes aplicadas`, tone: "success" });
  };

  const handleSendToAccountant = (suggestionIds: string[]) => {
    notify({ title: "Enviado para contador", description: `${suggestionIds.length} itens enviados`, tone: "success" });
  };

  const handleAction = async (action: FiscalAiAction, suggestions: FiscalAiSuggestion[]) => {
    const applicable = suggestions.filter(s => s.type === action.type).map(s => s.id);
    if (applicable.length === 0) return;

    if (action.action === "send_to_accountant") {
      handleSendToAccountant(applicable);
    } else if (action.action === "apply_all" || action.action === "apply_selected") {
      await handleApplySuggestions(applicable);
    } else {
      notify({ title: action.label, description: "Acao registrada" });
    }
  };

  const toggleFavorite = (convId: string) => {
    setConversations(prev => {
      const updated = prev.map(c => c.id === convId ? { ...c, favorite: !c.favorite } : c);
      saveConversations(updated);
      return updated;
    });
  };

  const deleteConversation = (convId: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId);
      saveConversations(updated);
      return updated;
    });
    if (activeConversationId === convId) {
      setActiveConversationId(null);
    }
  };

  const favorites = conversations.filter(c => c.favorite);
  const recentConvs = conversations.filter(c => !c.favorite).slice(0, 10);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-6rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">Chat Fiscal</h1>
              <p className="text-sm text-subtle">Motor de decisao fiscal - Pergunte, receba sugestoes com regra, confianca e acao</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSidePanelOpen(!sidePanelOpen)} className="hidden lg:flex">
                <BookOpen className="h-4 w-4" /> {sidePanelOpen ? "Ocultar" : "Painel"}
              </Button>
              <Button variant="lime" size="sm" onClick={createNewConversation}>
                Nova conversa
              </Button>
            </div>
          </div>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeConversation && activeConversation.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bot className="h-16 w-16 text-lime-500 mb-4" />
                <h2 className="text-xl font-bold text-ink mb-2">Ola! Sou a FiscalAI</h2>
                <p className="text-sm text-subtle max-w-md mb-6">
                  Posso analisar notas, corrigir cadastros, orientar sobre impostos e ajudar no fechamento fiscal. Pergunte algo ou use uma sugestao rapida:
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {quickQuestions.map(q => (
                    <Button key={q} variant="outline" size="sm" onClick={() => handleAsk(q)} disabled={loading}>
                      <Sparkles className="h-3 w-3" /> {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {activeConversation?.messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 h-8 w-8 rounded-full bg-lime-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-lime-700" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === "user" ? "bg-ink text-white" : "bg-muted border border-line"}`}>
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : msg.response ? (
                    <StructuredResponse response={msg.response} onAction={handleAction} />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-white/50" : "text-subtle"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 h-8 w-8 rounded-full bg-lime-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-lime-700" />
                </div>
                <div className="bg-muted border border-line rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-bounce h-2 w-2 rounded-full bg-lime-400" style={{ animationDelay: "0ms" }} />
                    <div className="animate-bounce h-2 w-2 rounded-full bg-lime-400" style={{ animationDelay: "150ms" }} />
                    <div className="animate-bounce h-2 w-2 rounded-full bg-lime-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!activeConversation && (
            <div className="flex-1 flex items-center justify-center text-subtle">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3" />
                <p>Selecione uma conversa ou crie uma nova</p>
              </div>
            </div>
          )}

          <div className="border-t border-line p-4">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder="Pergunte ao FiscalAI..."
                disabled={loading}
                className="flex-1"
              />
              <Button variant="lime" onClick={() => handleAsk()} disabled={loading || !question.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {quickQuestions.slice(0, 4).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={loading}
                  className="text-[11px] px-2 py-1 rounded-full border border-line text-subtle hover:bg-muted disabled:opacity-50 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {sidePanelOpen && (
        <div className="hidden lg:block w-72 shrink-0 space-y-4 overflow-y-auto">
          <Card className="p-3">
            <Tabs defaultValue="history">
              <TabsList className="w-full">
                <TabsTrigger value="history" className="flex-1 text-xs">
                  <Clock className="h-3 w-3" /> Historico
                </TabsTrigger>
                <TabsTrigger value="favorites" className="flex-1 text-xs">
                  <Heart className="h-3 w-3" /> Favoritos
                </TabsTrigger>
                <TabsTrigger value="prompts" className="flex-1 text-xs">
                  <Star className="h-3 w-3" /> Prompts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history">
                <div className="space-y-1 mt-2">
                  {recentConvs.length === 0 && (
                    <p className="text-xs text-subtle py-4 text-center">Nenhuma conversa ainda</p>
                  )}
                  {recentConvs.map(conv => (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${conv.id === activeConversationId ? "bg-lime-50 border border-lime-200" : "hover:bg-muted"}`}
                      onClick={() => setActiveConversationId(conv.id)}
                    >
                      <MessageSquare className="h-3 w-3 text-subtle shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{conv.title}</p>
                        <p className="text-[10px] text-subtle">{conv.messages.length} mensagens</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={e => { e.stopPropagation(); toggleFavorite(conv.id); }} className="p-1 hover:bg-muted rounded">
                          <Heart className={`h-3 w-3 ${conv.favorite ? "text-red-500 fill-red-500" : "text-subtle"}`} />
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }} className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="h-3 w-3 text-subtle hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="favorites">
                <div className="space-y-1 mt-2">
                  {favorites.length === 0 && (
                    <p className="text-xs text-subtle py-4 text-center">Nenhum favorito</p>
                  )}
                  {favorites.map(conv => (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${conv.id === activeConversationId ? "bg-lime-50 border border-lime-200" : "hover:bg-muted"}`}
                      onClick={() => setActiveConversationId(conv.id)}
                    >
                      <Heart className="h-3 w-3 text-red-500 fill-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{conv.title}</p>
                        <p className="text-[10px] text-subtle">{conv.messages.length} mensagens</p>
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); toggleFavorite(conv.id); }} className="p-1 hover:bg-muted rounded">
                        <Heart className="h-3 w-3 text-red-500 fill-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="prompts">
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-bold text-subtle uppercase">Sugestoes rapidas</p>
                  {quickQuestions.map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleAsk(q)}
                      disabled={loading}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-left hover:bg-lime-50 hover:text-lime-700 transition disabled:opacity-50"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="p-3">
            <p className="text-xs font-bold text-subtle uppercase mb-2">Sobre a FiscalAI</p>
            <div className="space-y-2 text-xs text-subtle">
              <p className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-lime-500" /> Respostas baseadas em regras fiscais</p>
              <p className="flex items-center gap-2"><BookOpen className="h-3 w-3 text-blue-500" /> Fontes: MOC, SPED, ICP-Brasil, LC 116</p>
              <p className="flex items-center gap-2"><Play className="h-3 w-3 text-purple-500" /> Acoes diretas: corrigir, enviar, confirmar</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StructuredResponse({
  response,
  onAction,
}: {
  response: FiscalAiResponse;
  onAction: (action: FiscalAiAction, suggestions: FiscalAiSuggestion[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-lime-500" />
        <span className="text-sm font-bold">Resposta da FiscalAI</span>
        <Badge variant="outline">Confianca: {Math.round(response.confidence * 100)}%</Badge>
      </div>

      <p className="text-sm text-ink">{response.answer}</p>

      {response.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] text-subtle">Fontes:</span>
          {response.sources.map(s => (
            <Badge key={s} variant="neutral" className="text-[9px]">{s}</Badge>
          ))}
        </div>
      )}

      {response.suggestions.length > 0 && (
        <div className="space-y-2 mt-3 border-t border-line pt-3">
          <p className="text-xs font-bold text-subtle uppercase">Sugestoes ({response.suggestions.length})</p>
          {response.suggestions.map(s => (
            <SuggestionItem key={s.id} suggestion={s} />
          ))}
        </div>
      )}

      {response.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 border-t border-line pt-3">
          {response.actions.map(a => (
            <Button
              key={a.action + a.type}
              variant={ACTION_VARIANTS[a.action] ?? "outline"}
              size="sm"
              onClick={() => onAction(a, response.suggestions)}
            >
              {a.label} ({a.count})
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: FiscalAiSuggestion }) {
  return (
    <div className="p-3 rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold">{suggestion.entityType}:{suggestion.field}</span>
        <Badge className={TYPE_COLORS[suggestion.type]}>{suggestion.type}</Badge>
        <Badge variant="outline">{Math.round(suggestion.confidence * 100)}%</Badge>
      </div>
      <p className="text-xs text-subtle">
        {suggestion.currentValue ?? "(vazio)"} <ChevronRight className="inline h-3 w-3" /> <span className="text-lime-600 font-medium">{suggestion.suggestedValue}</span>
      </p>
      <p className="text-[10px] text-subtle mt-1">
        Regra: {suggestion.ruleReference} | Impacto: {formatCurrency(suggestion.financialImpact)}
      </p>
    </div>
  );
}

export default FiscalAiView;
