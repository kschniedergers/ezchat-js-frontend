import { useContext, useEffect, useMemo, useState } from "react";
import { EzChatContext } from "./provider";
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
    const configWithDefaults = { ...ezChatRoomConnectionConfigDefaults, ...config };

    const context = useContext(EzChatContext);

    const [messages, setMessages] = useState<ChatRoomMessagePayload["payload"][]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [connected, setConnected] = useState<boolean>(false);

    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState<boolean>(false);
    const [loadMoreMessagesError, setLoadMoreMessagesError] = useState<Error | undefined>(undefined);

    const [sendMessage, setSendMessage] = useState<(message: string) => void>(() => () => {
        setError(new Error("sendMessage called before connecting to websocket"));
    });

    const authFunctionToUse = configWithDefaults?.authFunction || context?.authFunction;

    const chatRoomConnection = useMemo(
        () => new ChatRoomConnection({ roomId, authFunction: authFunctionToUse }),
        [roomId, authFunctionToUse]
    );

    const [cursor, setCursor] = useState<string | undefined>(undefined);

    const hasMoreMessages = cursor !== undefined;

    const fetchMoreMessages = (amount: number = 25) => {
        if (!cursor) {
            setLoadMoreMessagesError(new Error("No more messages to fetch"));
            return;
        }
        if (isLoadingMoreMessages) {
            return;
        }
        setIsLoadingMoreMessages(true);
        chatRoomConnection
            .fetchMessages(cursor, amount)
            // confusing line below!! messages is what is recieved from the fetchMessages call, and prev is the current state of messages
            .then(({ messages, nextCursor }) => {
                setIsLoadingMoreMessages(false);
                setMessages((prev) =>
                    configWithDefaults?.reverseMessages ? [...messages.reverse(), ...prev] : [...prev, ...messages]
                );
                setCursor(nextCursor);
            })
            .catch((err) => {
                setIsLoadingMoreMessages(false);
                setLoadMoreMessagesError(err);
                console.error(err);
            });
    };

    useEffect(() => {
        let disconnect: () => void;
        let cancelConnection = false;

        chatRoomConnection
            .fetchMessages()
            .then(({ messages, nextCursor }) => {
                setMessages(configWithDefaults?.reverseMessages ? messages.reverse() : messages);
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
                                case "join":
                                case "leave":
                                    // will be implemented later
                                    break;
                                case "message":
                                    if (configWithDefaults?.reverseMessages) {
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
            disconnect?.();
        };
    }, []);

    return {
        sendMessage,
        fetchMoreMessages,
        refreshToken: chatRoomConnection.refreshToken,
        hasMoreMessages,
        isLoadingMoreMessages,
        loadMoreMessagesError,
        messages,
        loading,
        error,
        connected,
    };
};
