import React, { useState } from 'react';
import { FrigateEvent } from '../types';
import { Search, Sparkles, X, Play, Clock, ArrowRight } from 'lucide-react';

interface GeminiSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: FrigateEvent[];
  onSelectEvent: (event: FrigateEvent) => void;
}

export const GeminiSearchModal: React.FC<GeminiSearchModalProps> = ({
  isOpen,
  onClose,
  events,
  onSelectEvent,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [matchedEvents, setMatchedEvents] = useState<FrigateEvent[]>([]);
  const [explanation, setExplanation] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    setExplanation('');

    try {
      const resp = await fetch('/api/gemini/search-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          events: events.map((e) => ({
            id: e.id,
            camera: e.camera,
            label: e.label,
            zones: e.zones,
            startTimeFormatted: new Date(e.startTime).toLocaleTimeString(),
            summary: e.summary || `${e.label} detected in ${e.camera}`,
          })),
        }),
      });

      const data = await resp.json();
      if (data.matchedIds && Array.isArray(data.matchedIds)) {
        const matches = events.filter((e) => data.matchedIds.includes(e.id));
        setMatchedEvents(matches);
        setExplanation(data.explanation || `Identified ${matches.length} matching events.`);
      } else {
        // Fallback local substring match if AI query returns empty
        const lower = searchQuery.toLowerCase();
        const fallback = events.filter(
          (e) =>
            e.label.toLowerCase().includes(lower) ||
            e.camera.toLowerCase().includes(lower) ||
            e.zones.some((z) => z.toLowerCase().includes(lower)) ||
            (e.summary && e.summary.toLowerCase().includes(lower))
        );
        setMatchedEvents(fallback);
        setExplanation(`Filtered ${fallback.length} events matching keyword "${searchQuery}".`);
      }
    } catch (err) {
      console.error('AI search failed', err);
      // Fallback
      const lower = searchQuery.toLowerCase();
      const fallback = events.filter(
        (e) =>
          e.label.toLowerCase().includes(lower) ||
          e.camera.toLowerCase().includes(lower) ||
          (e.summary && e.summary.toLowerCase().includes(lower))
      );
      setMatchedEvents(fallback);
      setExplanation(`Found ${fallback.length} events matching terms.`);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQueries = [
    'Find package deliveries to front porch',
    'Vehicles in the driveway',
    'Any people detected near side gate',
    'Dog playing in backyard',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-slate-300" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                Semantic Archive Retrieval
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                Intelligent Search
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input area */}
        <div className="p-6 space-y-4 text-xs">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask in natural language (e.g. 'Show me packages delivered today')..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-slate-600 transition-colors placeholder:text-slate-500 font-medium"
                autoFocus
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Processing...' : 'Search'}</span>
            </button>
          </div>

          {/* Quick query chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Suggestions:</span>
            {sampleQueries.map((sq) => (
              <button
                key={sq}
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Explanation from Gemini */}
          {explanation && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-xs text-slate-200">{explanation}</p>
            </div>
          )}

          {/* Search results */}
          {hasSearched && (
            <div className="space-y-2 overflow-y-auto max-h-[360px] pt-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <span>Correlated Incidents ({matchedEvents.length})</span>
              </div>

              {matchedEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-slate-800 rounded-xl bg-slate-900/40 text-xs">
                  No video events matched your natural language query. Try adjusting your wording.
                </div>
              ) : (
                matchedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => {
                      onSelectEvent(evt);
                      onClose();
                    }}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-white shrink-0">
                        <Play className="w-3.5 h-3.5 fill-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase tracking-tight text-white text-sm">{evt.label}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(evt.startTime).toLocaleTimeString()}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800 font-mono font-bold">
                            {evt.camera}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                          {evt.summary || `Active in zones: ${evt.zones.join(', ')}`}
                        </p>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0 ml-2" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
