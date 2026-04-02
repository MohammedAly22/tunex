'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn, formatTimestamp } from '@/lib/utils';
import { AgentMessage, AgentName, AgentStatus } from '@/lib/types';
import { AGENT_CONFIG } from '@/lib/constants';

interface AgentPanelProps {
  agent: AgentName;
  status: AgentStatus;
  messages: AgentMessage[];
  onAnswer?: (questionId: string, answer: string) => void;
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'idle' && 'bg-text-muted',
          status === 'thinking' && 'bg-secondary animate-breathe',
          status === 'acting' && 'bg-primary animate-breathe',
          status === 'complete' && 'bg-success',
          status === 'error' && 'bg-error'
        )}
      />
      <span className="text-[11px] text-text-muted capitalize">{status}</span>
    </div>
  );
}

export default function AgentPanel({ agent, status, messages, onAnswer }: AgentPanelProps) {
  const config = AGENT_CONFIG[agent];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      className={cn(
        'bg-surface-1 border border-border rounded-lg flex flex-col overflow-hidden h-full',
        status === 'thinking' && 'border-secondary/30',
        status === 'acting' && 'border-primary/30'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b border-border',
          (status === 'thinking' || status === 'acting') && 'bg-surface-2'
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[14px]"
            style={{ backgroundColor: config.bgColor }}
          >
            {config.icon}
          </div>
          <span className="text-[13px] font-medium">{config.name}</span>
        </div>
        <StatusIndicator status={status} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-text-muted">Waiting for instructions...</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="text-[12px]"
            >
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-text-muted font-mono mt-0.5 flex-shrink-0">
                  {formatTimestamp(msg.timestamp)}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'break-words',
                      msg.severity === 'success' && 'text-success',
                      msg.severity === 'warning' && 'text-warning',
                      msg.severity === 'error' && 'text-error',
                      msg.severity === 'info' && 'text-text-primary',
                      msg.type === 'thought' && 'text-text-secondary italic'
                    )}
                  >
                    {msg.type === 'action' && <span className="text-secondary mr-1">{'>'}</span>}
                    {msg.type === 'error' && <span className="text-error mr-1">{'!'}</span>}
                    {msg.content}
                  </span>

                  {/* Question with options */}
                  {msg.type === 'question' && msg.options && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => onAnswer?.(msg.questionId!, opt)}
                          className="px-3 py-1 rounded-md border border-primary/30 text-primary text-[11px] hover:bg-primary/10 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}

        {/* Thinking indicator */}
        {status === 'thinking' && (
          <div className="flex items-center gap-2 text-[11px] text-secondary">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            Thinking...
          </div>
        )}
      </div>
    </div>
  );
}
