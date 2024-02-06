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
import { set, z } from "zod";

// type MessageTypes = IncludeOnly<ChatRoomWebsocketMessage["payloadType"], "join" | "leave" | "message">;

interface IEzChatRoomConnectionConfig {
    authFunction?: () => Promise<string>;
    includeLeaveJoinMessages?: boolean;
    reverseMessages?: boolean;
    maxMessages?: number;
    messagesPerPage?: number;
}

const ezChatRoomConnectionConfigDefaults: IEzChatRoomConnectionConfig = {
    includeLeaveJoinMessages: false,
    reverseMessages: false,
    maxMessages: 200,
    messagesPerPage: 25,
};

// lot of commented code that will be used for adding join/leave messages that changes the type of the messages array to include them
// however, this makes basic setup a little more difficult and I havn't fully figured it out the way I want so it is a todo

// type MessagePayload<T extends IEzChatRoomConnection> = T["includeLeaveJoinMessages"] extends true
//     ? ChatRoomMessagePayload | ChatRoomJoinLeavePayload
//     : ChatRoomMessagePayload;

// export const useEzChatRoomConnection = <T extends IEzChatRoomConnection>(config: T) => {
// type inferredMessagesType = MessagePayload<typeof config.includeLeaveJoinMessages>[];
// const [messages, setMessages] = useState<MessagePayload<T>[]>([]);

export const useEzChatRoomConnection = (roomId: number, config?: IEzChatRoomConnectionConfig) => {
    config = { ...ezChatRoomConnectionConfigDefaults, ...config };

    const context = useContext(EzChatContext);

    const [messages, setMessages] = useState<ChatRoomMessagePayload["payload"][]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [connected, setConnected] = useState<boolean>(false);

    const [fetchingMore, setFetchingMore] = useState<boolean>(false);
    const [fetchingMoreError, setFetchingMoreError] = useState<Error | undefined>(undefined);

    const [sendMessage, setSendMessage] = useState<(message: string) => void>(() => () => {
        setError(new Error("sendMessage called before connecting to websocket"));
    });

    const authFunctionToUse = config?.authFunction || context?.authFunction;

    const chatRoomConnection = new ChatRoomConnection({ roomId, authFunction: authFunctionToUse });

    const [cursor, setCursor] = useState<string | undefined>(undefined);

    const fetchMoreMessages = (amount: number = 25) => {
        setFetchingMore(true);
        chatRoomConnection
            .fetchMessages(cursor, amount)
            .then(({ messages, nextCursor }) => {
                setFetchingMore(false);
                setMessages((prev) =>
                    config?.reverseMessages ? [...messages.reverse(), ...prev] : [...prev, ...messages]
                );
                setCursor(nextCursor);
            })
            .catch((err) => {
                setFetchingMore(false);
                setFetchingMoreError(err);
                console.error(err);
            });
    };

    useEffect(() => {
        let disconnect: () => void;
        let cancelConnection = false;

        chatRoomConnection
            .fetchMessages()
            .then(({ messages, nextCursor }) => {
                setMessages(config?.reverseMessages ? messages.reverse() : messages);
                setCursor(nextCursor);
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
                                    // will be implemented later
                                    break;
                                case "message":
                                    if (config?.reverseMessages) {
                                        setMessages((prev) => [...prev, message.payload]);
                                    } else {
                                        setMessages((prev) => [message.payload, ...prev]);
                                    }
                                    break;

                                case "delete_message":
                                    setMessages((prev) =>
                                        prev.filter(
                                            (m) =>
                                                // m.payloadType !== "message" ||
                                                m.id !== message.payload.messageId
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
        fetchMoreMessages,
        fetchingMore,
        fetchingMoreError,
        messages,
        loading,
        error,
        connected,
    };
};
