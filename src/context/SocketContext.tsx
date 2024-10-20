import React, { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";
import { Message } from "../types__interfaces/interface";
import axios from "axios";
import { getUserIdFromToken } from "../utils/auth";

interface SocketContextProps {
  messages: Message[];
  sendMessage: (content: string, recipientId: string, senderId: string) => void;
  setRecipientId: (id: string) => void;
}

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket doit être utilisé dans un SocketProvider");
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientId, setRecipientId] = useState<string>("");

  useEffect(() => {
    if (!recipientId) return;
    const token = localStorage.getItem("token");
    // Récupérer l'historique des messages
    const fetchMessages = async () => {
      try {
        const response = await axios.get<Message[]>(
          `http://localhost:3000/api/messages/${recipientId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setMessages(response.data);
        console.log(response.data);
      } catch (error) {
        console.error("Erreur lors de la récupération des messages:", error);
      }
    };

    fetchMessages();
  }, [recipientId]);

  useEffect(() => {
    // Écouter les messages entrants
    const token = localStorage.getItem("token");
    if (!token) return;
    socket.on("receiveMessage", (message: Message) => {
      if (
        (message.senderId === recipientId &&
          message.recipientId === getUserIdFromToken(token)) ||
        (message.senderId === getUserIdFromToken(token) &&
          message.recipientId === recipientId)
      ) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    // Optionnel : écouter les confirmations d'envoi de messages
    socket.on("messageSent", (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Gérer les erreurs
    socket.on("errorMessage", (error: { error: string }) => {
      console.error("Erreur Socket.IO:", error.error);
    });

    // Nettoyer les écouteurs lors du démontage
    return () => {
      socket.off("receiveMessage");
      socket.off("messageSent");
      socket.off("errorMessage");
    };
  }, []);

  const sendMessage = (
    content: string,
    recipientId: string,
    senderId: string
  ) => {
    socket.emit("sendMessage", {
      recipientId: recipientId,
      content,
      senderId: senderId,
    });
  };

  return (
    <SocketContext.Provider value={{ messages, sendMessage, setRecipientId }}>
      {children}
    </SocketContext.Provider>
  );
};
