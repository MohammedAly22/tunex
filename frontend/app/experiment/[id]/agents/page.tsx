'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Clock,
  CheckCircle,
  Send,
  Code,
  Maximize2,
  Minimize2,
  FolderOpen,
  FileText,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import AgentPanel from '@/components/agents/AgentPanel';
import { cn, formatDuration, generateId } from '@/lib/utils';
import { AgentMessage, AgentName, AgentStatus } from '@/lib/types';
import { AGENT_CONFIG, WS_BASE_URL, API_BASE_URL } from '@/lib/constants';

const AGENT_ORDER: AgentName[] = ['planner', 'dataset', 'configuration', 'code', 'infrastructure', 'monitoring'];

interface GeneratedFile {
  filename: string;
  content: string;
  description: string;
}

export default function AgentWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // State
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [statuses, setStatuses] = useState<Record<AgentName, AgentStatus>>({
    planner: 'idle', dataset: 'idle', configuration: 'idle',
    code: 'idle', infrastructure: 'idle', monitoring: 'idle',
    evaluation: 'idle', publishing: 'idle',
  });
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'agents' | 'code' | 'comms'>('agents');
  const [expandedAgent, setExpandedAgent] = useState<AgentName | null>(null);
  const [connected, setConnected] = useState(false);
  const [pipelineReady, setPipelineReady] = useState(false);
  const [pipelineError, setPipelineError] = useState('');
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const promptSentRef = useRef(false);

  // Timer
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [paused]);

  // Fetch initial prompt from sessionStorage and connect WebSocket
  useEffect(() => {
    const wsUrl = `${WS_BASE_URL}/ws/experiment/${id}/agents`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);

      // Send the prompt from sessionStorage (set by the new experiment page)
      if (!promptSentRef.current) {
        const savedPrompt = sessionStorage.getItem(`experiment_prompt_${id}`);
        const savedChips = sessionStorage.getItem(`experiment_chips_${id}`);
        if (savedPrompt) {
          ws.send(JSON.stringify({
            type: 'start_pipeline',
            prompt: savedPrompt,
            taskChips: savedChips ? JSON.parse(savedChips) : [],
          }));
          promptSentRef.current = true;
        }
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleWsMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'agent_message':
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            agent: data.agent as AgentName,
            content: data.content as string,
            type: (data.messageType as AgentMessage['type']) || 'action',
            severity: (data.severity as AgentMessage['severity']) || 'info',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case 'agent_status':
        setStatuses((prev) => ({
          ...prev,
          [data.agent as string]: data.status as AgentStatus,
        }));
        break;

      case 'agent_question':
        setWaitingForAnswer(true);
        setPendingQuestion(data.question as string);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            agent: data.agent as AgentName,
            content: data.question as string,
            type: 'question',
            severity: 'warning',
            timestamp: new Date().toISOString(),
            options: (data.options as string[]) || [],
          },
        ]);
        break;

      case 'file_created':
        setFiles((prev) => {
          const existing = prev.findIndex(
            (f) => f.filename === (data.filename as string)
          );
          const newFile: GeneratedFile = {
            filename: data.filename as string,
            content: data.content as string,
            description: data.description as string,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newFile;
            return updated;
          }
          return [...prev, newFile];
        });
        // Auto-switch to code tab on first file
        setActiveTab((prev) => {
          if (prev === 'agents') return 'code';
          return prev;
        });
        break;

      case 'pipeline_complete':
        setPipelineReady(true);
        break;

      case 'pipeline_paused':
        setWaitingForAnswer(true);
        break;

      case 'pipeline_error':
        setPipelineError(data.message as string);
        break;
    }
  }, []);

  const sendAnswer = () => {
    if (!userMessage.trim() || !wsRef.current) return;

    if (waitingForAnswer) {
      wsRef.current.send(JSON.stringify({
        type: 'user_answer',
        answer: userMessage.trim(),
      }));
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          agent: 'planner',
          content: `You: ${userMessage.trim()}`,
          type: 'action',
          severity: 'info',
          timestamp: new Date().toISOString(),
        },
      ]);
      setWaitingForAnswer(false);
      setPendingQuestion('');
    }

    setUserMessage('');
  };

  const getAgentMessages = (agent: AgentName) => messages.filter((m) => m.agent === agent);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-mono font-semibold">Experiment: {id}</h1>
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Clock size={12} />
            {formatDuration(elapsed)}
          </span>
          {connected ? (
            <span className="flex items-center gap-1 text-[11px] text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-breathe" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-error">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              Disconnected
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pipelineError && (
            <span className="flex items-center gap-1 text-[12px] text-error">
              <AlertCircle size={14} />
              {pipelineError}
            </span>
          )}
          <button
            onClick={() => setPaused(!paused)}
            className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-md text-[12px] text-text-secondary transition-colors"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          {pipelineReady && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => router.push(`/experiment/${id}/monitor`)}
              className="cursor-pointer inline-flex items-center gap-2 px-5 py-1.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-medium rounded-md transition-colors"
            >
              <CheckCircle size={14} />
              Approve & Start Training
              <ChevronRight size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border bg-surface-1 px-6 flex-shrink-0">
        {[
          { id: 'agents' as const, label: 'Agent Grid', icon: Code },
          { id: 'code' as const, label: 'Code & Files', icon: FileText, count: files.length },
          { id: 'comms' as const, label: 'Agent Comms', icon: Send },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'cursor-pointer relative px-4 py-2.5 text-[13px] border-b-2 transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count ? (
              <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Agent Grid View */}
        {activeTab === 'agents' && (
          <div className="h-full p-3">
            <AnimatePresence mode="wait">
              {expandedAgent ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium">{AGENT_CONFIG[expandedAgent].name} — Expanded</span>
                    <button
                      onClick={() => setExpandedAgent(null)}
                      className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary bg-surface-2 rounded-md"
                    >
                      <Minimize2 size={12} /> Collapse
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <AgentPanel
                      agent={expandedAgent}
                      status={statuses[expandedAgent]}
                      messages={getAgentMessages(expandedAgent)}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full grid grid-cols-3 grid-rows-2 gap-3"
                >
                  {AGENT_ORDER.map((agent) => (
                    <div key={agent} className="relative group min-h-0">
                      <button
                        onClick={() => setExpandedAgent(agent)}
                        className="cursor-pointer absolute top-2 right-2 z-10 p-1 bg-surface-2/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
                        title="Expand"
                      >
                        <Maximize2 size={12} />
                      </button>
                      <AgentPanel
                        agent={agent}
                        status={statuses[agent]}
                        messages={getAgentMessages(agent)}
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Code & File Explorer */}
        {activeTab === 'code' && (
          <div className="h-full flex">
            {/* File Explorer Sidebar */}
            <div className="w-56 border-r border-border bg-surface-1 flex flex-col flex-shrink-0">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 text-[12px] text-text-secondary font-medium">
                <FolderOpen size={14} />
                Experiment Files
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-text-muted text-[11px] px-4 text-center">
                    <Loader2 size={20} className="animate-spin mb-2 opacity-50" />
                    Waiting for Code Agent to generate files...
                  </div>
                ) : (
                  files.map((file) => (
                    <button
                      key={file.filename}
                      onClick={() => setSelectedFile(file)}
                      className={cn(
                        'cursor-pointer w-full text-left px-3 py-2 rounded-md text-[12px] flex items-center gap-2 transition-colors',
                        selectedFile?.filename === file.filename
                          ? 'bg-primary/10 text-primary'
                          : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                      )}
                    >
                      <FileText size={13} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-mono">{file.filename}</div>
                        <div className="text-[10px] text-text-muted truncate">{file.description}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Code Viewer */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedFile ? (
                <>
                  <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-surface-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Code size={14} className="text-success" />
                      <span className="text-[13px] font-mono font-medium">{selectedFile.filename}</span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {selectedFile.content.split('\n').length} lines — {selectedFile.description}
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto bg-[#0d1117]">
                    <pre className="p-4 font-mono text-[12px] leading-relaxed">
                      {selectedFile.content.split('\n').map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-10 text-right pr-4 text-text-muted/40 select-none flex-shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className={cn(
                              'flex-1',
                              line.startsWith('#') || line.startsWith('"""') || line.startsWith("'''")
                                ? 'text-text-muted'
                                : line.match(/^(import |from )/)
                                  ? 'text-secondary'
                                  : line.match(/^(def |class |if |else|elif |for |while |return |with |try|except|finally)/)
                                    ? 'text-primary'
                                    : line.match(/^\s*(model|trainer|tokenizer|dataset|training_args|lora_config|bnb_config)\b/)
                                      ? 'text-warning'
                                      : line.includes('=') && !line.trim().startsWith('#')
                                        ? 'text-text-primary'
                                        : line.match(/^\s*"[^"]*"/) || line.match(/^\s*'[^']*'/)
                                          ? 'text-success'
                                          : 'text-text-primary'
                            )}
                          >
                            {line || ' '}
                          </span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-muted text-[13px]">
                  <div className="text-center">
                    <FileText size={32} className="mx-auto mb-3 opacity-30" />
                    {files.length > 0
                      ? 'Select a file from the explorer to view its content'
                      : 'Files will appear here as the Code Agent generates them'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent Communication Feed */}
        {activeTab === 'comms' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-muted text-[13px]">
                  Agent messages will appear here once the pipeline starts...
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2 text-[12px]">
                    <span className="text-[10px] text-text-muted font-mono mt-0.5 flex-shrink-0 w-16">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                    <span
                      className="font-medium flex-shrink-0 w-28"
                      style={{ color: AGENT_CONFIG[msg.agent]?.color || '#888' }}
                    >
                      {AGENT_CONFIG[msg.agent]?.name || msg.agent}
                    </span>
                    <span
                      className={cn(
                        'flex-1',
                        msg.severity === 'success' && 'text-success',
                        msg.severity === 'warning' && 'text-warning',
                        msg.severity === 'error' && 'text-error',
                        msg.severity === 'info' && 'text-text-primary',
                        msg.type === 'thought' && 'text-text-secondary italic'
                      )}
                    >
                      {msg.content}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Input bar — visible when waiting for answer or for general messages */}
            <div className="p-3 border-t border-border flex-shrink-0">
              {waitingForAnswer && pendingQuestion && (
                <div className="mb-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-md text-[12px] text-warning">
                  <AlertCircle size={12} className="inline mr-1" />
                  {pendingQuestion}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder={waitingForAnswer ? 'Type your answer...' : 'Message agents...'}
                  className="flex-1 bg-[#0F0F18] border border-border rounded-md px-3 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && userMessage.trim()) {
                      sendAnswer();
                    }
                  }}
                />
                <button
                  onClick={sendAnswer}
                  disabled={!userMessage.trim()}
                  className="cursor-pointer px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-md transition-colors"
                >
                  <Send size={12} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
