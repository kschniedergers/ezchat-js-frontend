import { useContext, useEffect, useState } from "react";
import { EzChatContext } from "./provider";
import { EZ_CHAT_URL } from "../consts";
import { createChatRoomConnection } from "../client";
// import { ChatMessage } from "../../../services/UserManagementApi";
import { ChatRoomMessagePayload, ChatRoomWebsocketMessage } from "../types";

interface ChatRoomConnectionHook {
    sendMessage: (message: string) => void;
    messages: ChatRoomMessagePayload[];
    loading: boolean;
    error: Error | undefined;
    connected: boolean;
}

export const useEzChatRoomConnection = (roomId: number, authFunction?: () => Promise<string>): ChatRoomConnectionHook => {
    const context = useContext(EzChatContext);

    const [messages, setMessages] = useState<ChatRoomMessagePayload[]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [connected, setConnected] = useState<boolean>(false);

    const [sendMessage, setSendMessage] = useState<(message: string) => void>(() => () => {
        setError(new Error("sendMessage called before connecting to websocket"));
    });

    const authFunctionToUse = authFunction || context?.authFunction;

    const { initConnection, connectWebsocket } = createChatRoomConnection(roomId, (message) => {
        setMessages((prev) => [...prev, message]);
    });

    useEffect(() => {
        let disconnect: () => void;
        let cancelConnection = false;

        initConnection(authFunctionToUse)
            .then(({ authToken, messages }) => {
                setMessages(messages);
                if (!cancelConnection) {
                    const ret = connectWebsocket(authToken, {
                        onClose: () => {
                            setConnected(false);
                            setLoading(false);
                        },
                        onError: (err) => {
                            console.error(err);
                            setError(new Error("A websocket error occurred"));
                            setLoading(false);
                        },
                        onOpen: () => {
                            setConnected(true);
                            setLoading(false);
                            setError(undefined);
                        },
                    });

                    disconnect = ret.disconnect;
                    if (cancelConnection) {
                        ret.disconnect();
                        return;
                    }
                    setSendMessage(() => ret.sendMessage);
                }
            })

            .catch((err) => {
                setLoading(false);
                setError(err);
                console.error(err);
            });

        return () => {
            cancelConnection = true;
            if (disconnect) {
                disconnect();
            }
        };
    }, []);

    return {
        sendMessage,
        messages,
        loading,
        error,
        connected,
    };
};
