import { useContext, useEffect, useState } from "react";
import { EzChatContext } from "./provider";
import { EZ_CHAT_URL } from "../consts";
import { ChatRoomConnection } from "../client";
// import { ChatMessage } from "../../../services/UserManagementApi";
import {
    ChatRoomDeleteMessagePayload,
    ChatRoomJoinLeavePayload,
    ChatRoomMessagePayload,
    ChatRoomWebsocketMessage,
} from "../types";
import { IncludeOnly } from "../utils";

// interface ChatRoomConnectionHook {
//     sendMessage: (message: string) => void;
//     messages: ChatRoomWebsocketMessage[];
//     loading: boolean;
//     error: Error | undefined;
//     connected: boolean;
// }

// take only a couple values from wsmessage type

type MessageTypes = IncludeOnly<ChatRoomWebsocketMessage["payloadType"], "join" | "leave" | "message">;

interface IEzChatRoomConnection {
    roomId: number;
    authFunction?: () => Promise<string>;
    includeLeaveJoinMessages?: boolean;
}

type MessagePayload<T extends IEzChatRoomConnection> = T["includeLeaveJoinMessages"] extends true
    ? ChatRoomMessagePayload | ChatRoomJoinLeavePayload
    : ChatRoomMessagePayload;

export const useEzChatRoomConnection = <T extends IEzChatRoomConnection>(config: T) => {
    const context = useContext(EzChatContext);

    const [messages, setMessages] = useState<MessagePayload<T>[]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [connected, setConnected] = useState<boolean>(false);

    const [sendMessage, setSendMessage] = useState<(message: string) => void>(() => () => {
        setError(new Error("sendMessage called before connecting to websocket"));
    });

    const authFunctionToUse = config?.authFunction || context?.authFunction;

    const chatRoomConnection = new ChatRoomConnection({ roomId: config.roomId, authFunction: authFunctionToUse });

    // const initReturn = await chatRoomConnection.initConnection()

    // const { initConnection, connectWebsocket } = createChatRoomConnection(roomId, (message) => {
    //     setMessages((prev) => [...prev, message]);
    // });

    useEffect(() => {
        let disconnect: () => void;
        let cancelConnection = false;

        chatRoomConnection
            .initConnection()
            .then(({ messages }) => {
                setMessages(messages);
                if (!cancelConnection) {
                    const ret = chatRoomConnection.connectWebsocket({
                        onClose: () => {
                            setConnected(false);
                            setLoading(false);
                        },
                        onError: (err) => {
                            console.error(err);
                            setError(new Error("A websocket error occurred: " + err));
                            setLoading(false);
                        },
                        onOpen: () => {
                            setConnected(true);
                            setLoading(false);
                            setError(undefined);
                        },
                        onMessage: (message) => {
                            switch (message.payloadType) {
                                case "join" || "leave":
                                    if (config.includeLeaveJoinMessages) {
                                        setMessages((prev) => [...prev, message] as MessagePayload<T>[]);
                                    }
                                    break;
                                case "message":
                                    setMessages((prev) => [...prev, message]);
                                    break;

                                case "delete_message":
                                    setMessages((prev) =>
                                        prev.filter(
                                            (m) =>
                                                m.payloadType !== "message" ||
                                                m.payload.id !== message.payload.messageId
                                        )
                                    );
                                    break;

                                case "error":
                                    setError(new Error(message.payload.message));
                            }
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
