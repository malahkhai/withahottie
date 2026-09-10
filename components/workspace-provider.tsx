"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { transitionRequest } from "@/lib/requests";
import type { WorkspaceData, ChatMessage, CreatorDraft } from "@/types/creator";
type Context = {
  data: WorkspaceData;
  respond: (id: string, action: string) => Promise<void>;
  send: (id: string, body: string, attachment?: string) => Promise<void>;
  read: (id: string) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
const key = "replypass:workspace:v2";
export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceData;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);
  const router = useRouter();
  useEffect(() => {
    if (!initial.demo) {
      let active = true;
      void Promise.resolve().then(() => {
        if (active) setData(initial);
      });
      return () => {
        active = false;
      };
    }
    let alive = true;
    async function restore() {
      try {
        const raw = await Promise.resolve(localStorage.getItem(key));
        const creator = localStorage.getItem("replypass:creator");
        if (raw && alive) {
          const parsed = JSON.parse(raw) as WorkspaceData;
          setData({
            ...parsed,
            viewer: initial.viewer,
            creator: creator
              ? (JSON.parse(creator) as CreatorDraft)
              : initial.creator,
          });
        } else if (alive && creator)
          setData({ ...initial, creator: JSON.parse(creator) as CreatorDraft });
      } catch {
        /* An invalid or full browser store never prevents exploration. */
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [initial]);
  function update(next: WorkspaceData) {
    setData(next);
    if (next.demo) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        throw Error("Browser storage is full. Changes cannot be saved.");
      }
    }
  }
  async function respond(id: string, action: string) {
    if (data.demo) {
      const r = data.requests.find((r) => r.id === id);
      if (!r) throw Error("Request not found.");
      update({
        ...data,
        requests: data.requests.map((item) =>
          item.id === id ? transitionRequest(r, action) : item,
        ),
      });
      return;
    }
    const response = await fetch(`/api/creator/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    if(result.conversationId)router.push(`/creator/inbox/${result.conversationId}`);
    router.refresh();
  }
  async function send(id: string, body: string, attachment?: string) {
    if (data.demo) {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: data.viewer.id,
        body,
        createdAt: new Date().toISOString(),
        attachment,
      };
      update({
        ...data,
        conversations: data.conversations.map((c) =>
          c.id === id
            ? { ...c, unread: 0, messages: [...c.messages, message] }
            : c,
        ),
      });
      return;
    }
    if (attachment) {
      const blob = await (await fetch(attachment)).blob();
      const form = new FormData();
      form.set("image", blob, "attachment");
      form.set("conversationId", id);
      form.set("body", body);
      const response = await fetch("/api/messages/attachment", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      router.refresh();
      return;
    }
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id, body }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    setData({
      ...data,
      conversations: data.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: result.id,
                  senderId: data.viewer.id,
                  body,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    });
    router.refresh();
  }
  function read(id: string) {
    if (data.demo && data.conversations.some((c) => c.id === id && c.unread)) {
      update({
        ...data,
        conversations: data.conversations.map((c) =>
          c.id === id ? { ...c, unread: 0 } : c,
        ),
      });
    }
  }
  return (
    <WorkspaceContext.Provider value={{ data, respond, send, read }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw Error("Workspace context is unavailable.");
  return c;
}
