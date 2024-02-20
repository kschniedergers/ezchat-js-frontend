import { useContext, useEffect, useMemo, useState } from "react";
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
    // Pretty sure it is generally frowned upon to change the original object as it can cause side effects in the
    // users code.
    // const configWithDefaults = { ...ezChatRoomConnectionConfigDefaults, ...config }
    config = { ...ezChatRoomConnectionConfigDefaults, ...config };

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

    const authFunctionToUse = config?.authFunction || context?.authFunction;

    const chatRoomConnection = useMemo(
        () => new ChatRoomConnection({ roomId, authFunction: authFunctionToUse }),
        [roomId, authFunctionToUse]
    );

    const [cursor, setCursor] = useState<string | undefined>(undefined);

    const hasMoreMessages = cursor !== undefined;

    // Is the idea that users would use this function in conjunction with a
    // setInterval to fetch messages at their chosen interval?
    // Would in the future would you add some sort of like listener for devs
    // to use so they don't have to set the interval and instead can just pass
    // a callback or something?
    // Or is the idea that the dev would use "listen" (via their own useEffect)
    // to changes in the `messages` state?
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
            .then(({ messages, nextCursor }) => {
                setIsLoadingMoreMessages(false);
                setMessages((prev) =>
                    // Reversing a lot of messages could take a lot of time
                    // could this utilize a useMemo function in case new messages
                    // haven't been updated?
                    // Or maybe (down the line) upstream could send a hash of
                    // the messages as well so that you can know if no update
                    // is required (by comparing the hash)?
                    // could also be done by FE I guess but server side is prob
                    // preferable.
                    config?.reverseMessages ? [...messages.reverse(), ...prev] : [...prev, ...messages]
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
                                // Is this a thing? I've never heard of || in a
                                // case and some testing showed it didn't work.
                                case "join":
                                case "leave":
                                    // will be implemented later
                                    break;
                                case "message":
                                    // callback / listener could be implemented
                                    // here right?
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
            // so much cooler you know it
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
