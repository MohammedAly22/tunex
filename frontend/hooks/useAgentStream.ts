'use client';

import { useState, useCallback } from 'react';
import { AgentMessage, AgentName, AgentStatus, WSEvent } from '@/lib/types';
import { useWebSocket } from './useWebSocket';
import { generateId } from '@/lib/utils';

export function useAgentStream(experimentId: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentName, AgentStatus>>({
    planner: 'idle',
    dataset: 'idle',
    configuration: 'idle',
    code: 'idle',
    infrastructure: 'idle',
    monitoring: 'idle',
    evaluation: 'idle',
    publishing: 'idle',
  });

  const handleMessage = useCallback((event: WSEvent) => {
    if (event.type === 'agent_message') {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          agent: event.agent,
          content: event.content,
          type: event.messageType || 'action',
          severity: event.severity,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else if (event.type === 'agent_status') {
      setAgentStatuses((prev) => ({ ...prev, [event.agent]: event.status }));
    } else if (event.type === 'agent_question') {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          agent: event.agent,
          content: event.question,
          type: 'question',
          severity: 'info',
          timestamp: new Date().toISOString(),
          options: event.options,
          questionId: event.questionId,
        },
      ]);
    }
  }, []);

  const { connected, send } = useWebSocket({
    path: `/ws/experiment/${experimentId}/agents`,
    onMessage: handleMessage,
  });

  const sendUserMessage = useCallback(
    (message: string, targetAgent?: AgentName) => {
      send({ type: 'user_message', content: message, target_agent: targetAgent });
    },
    [send]
  );

  const answerQuestion = useCallback(
    (questionId: string, answer: string) => {
      send({ type: 'user_answer', question_id: questionId, answer });
    },
    [send]
  );

  const getAgentMessages = useCallback(
    (agent: AgentName) => messages.filter((m) => m.agent === agent),
    [messages]
  );

  return {
    messages,
    agentStatuses,
    connected,
    sendUserMessage,
    answerQuestion,
    getAgentMessages,
  };
}
