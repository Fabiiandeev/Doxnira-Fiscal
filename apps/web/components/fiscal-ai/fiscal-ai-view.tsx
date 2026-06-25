"use client";

import { useState } from "react";
import { Bot, Send, Sparkles, Target, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { askFiscalAI, getQuickQuestions } from "@/lib/services/fiscal/fiscal-ai-service";
import type { FiscalAiResponse, FiscalAiSuggestion, FiscalAiAction } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

export function FiscalAiView() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<FiscalAiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    const res = await askFiscalAI(question);
    setResponse(res);
    setLoading(false);
  };

  const handleQuickQuestion = async (q: string) => {
    setQuestion(q);
    setLoading(true);
    const res = await askFiscalAI(q);
    setResponse(res);
    setLoading(false);
  };

  const handleApply = async (suggestionIds: string[]) => {
    notify({ title: "Aplicando sugestoes", description: suggestionIds.length + " sugestoes aplicadas" });
    setResponse(prev => prev ? { ...prev, suggestions: prev.suggestions.map(s => suggestionIds.includes(s.id) ? { ...s, applied: true } : s) } : null);
  };

  const handleSendToAccountant = async (suggestionIds: string[]) => {
    notify({ title: "Enviado para contador", description: suggestionIds.length + " itens enviados" });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">FiscalAI</h1>
        <p className="text-sm text-subtle">Motor de decisao fiscal - Pergunte, receba sugestoes com regra, confianca e acao</p>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <Bot className="h-10 w-10 text-lime shrink-0" />
          <div className="flex-1">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAsk()}
                placeholder="Pergunte ao FiscalAI... (ex: Por que essa nota rejeitou?)"
                className="flex-1"
                disabled={loading}
              />
              <Button onClick={handleAsk} disabled={loading || !question.trim()}>
                <Send className="h-4 w-4" /> Perguntar
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickQuestions.map((q) => (
                <Button key={q} variant="outline" size="sm" onClick={() => handleQuickQuestion(q)} disabled={loading}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {response && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-lime" />
              <span className="font-bold">Resposta da FiscalAI</span>
              <Badge variant="outline">Confianca: {Math.round(response.confidence * 100)}%</Badge>
            </div>
            <p className="text-sm">{response.answer}</p>
            {response.sources.length > 0 && (
              <p className="mt-2 text-xs text-subtle">Fontes: {response.sources.join(", ")}</p>
            )}
          </Card>

          {response.suggestions.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-3">Sugestoes ({response.suggestions.length})</h3>
              <div className="space-y-3">
                {response.suggestions.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} />
                ))}
              </div>
            </Card>
          )}

          {response.actions.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-3">Acoes disponiveis</h3>
              <div className="flex flex-wrap gap-2">
                {response.actions.map((a) => (
                  <ActionButton key={a.action} action={a} suggestions={response.suggestions} onApply={handleApply} onSendToAccountant={handleSendToAccountant} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: FiscalAiSuggestion }) {
  const typeColors = { AUTO_SAFE: "bg-lime text-ink", AUTO_CONFIRM: "bg-blue-50 text-blue-700", ACCOUNTANT_REVIEW: "bg-purple-50 text-purple-700", MANUAL_GUIDED: "bg-gray-50 text-gray-700" };
  return (
    <div className="p-3 rounded-xl border border-line bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm">{suggestion.entityType}:{suggestion.field}</span>
            <Badge className={typeColors[suggestion.type]}>{suggestion.type}</Badge>
            <Badge variant="outline">Conf: {Math.round(suggestion.confidence * 100)}%</Badge>
          </div>
          <p className="text-xs text-subtle">{suggestion.currentValue || "(vazio)"} \u2192 <span className="font-medium text-lime">{suggestion.suggestedValue}</span></p>
          <p className="text-xs text-subtle mt-1">Regra: {suggestion.ruleReference} | Impacto: {formatCurrency(suggestion.financialImpact)}</p>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ action, suggestions, onApply, onSendToAccountant }: { action: FiscalAiAction; suggestions: FiscalAiSuggestion[]; onApply: (ids: string[]) => void; onSendToAccountant: (ids: string[]) => void }) {
  const applicable = suggestions.filter(s => s.type === action.type).map(s => s.id);
  if (applicable.length === 0) return null;
  
  return (
    <Button 
      variant={action.action === "apply_all" ? "lime" : action.action === "send_to_accountant" ? "outline" : "default"} 
      onClick={() => action.action === "send_to_accountant" ? onSendToAccountant(applicable) : onApply(applicable)}
    >
      {action.label} ({action.count})
    </Button>
  );
}

