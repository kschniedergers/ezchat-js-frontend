// import { createBasicHeaders } from "../../utils";
import { EZ_CHAT_URL } from "./consts";
import { ChatRoomMessagePayload, ChatRoomWebsocketMessage, CursorPaginatedMessages } from "./types";
import { z } from "zod";

// amount of times to retry init connection
const RETRY_COUNT = 2;

export function connectToChatRoomWebsocket(roomId: number, authToken?: string) {
    const params = authToken ? "?authToken=" + authToken : "";
    return new WebSocket("ws://" + EZ_CHAT_URL + "/join/" + roomId + params);
}

export interface IChatRoomConnectionProps {
    roomId: number;
    authToken?: string;
    messageCallback?: (message: ChatRoomMessagePayload) => void;
    authFunction?: () => Promise<string>;
}

export interface IConnectWebsocketCallbacks {
    onOpen?: () => void;
    onError?: (err: Event) => void;
    onClose?: () => void;
    onMessage?: (message: ChatRoomWebsocketMessage) => void;
}

export class ChatRoomConnection {
    private roomId: number;
    private authToken?: string;
    private authFunction?: () => Promise<string>;

    constructor(props: IChatRoomConnectionProps) {
        this.roomId = props.roomId;
        this.authToken = props.authToken;
        this.authFunction = props.authFunction;

        if (props.authToken && props.authFunction) {
            console.warn("Both authToken and authFunction are provided, authToken will be used");
        }
    }

    async refreshToken() {
        if (!this.authFunction) {
            return;
        }
        this.authToken = await this.authFunction();
    }

    // async initConnection(): Promise<{ messages: ChatRoomMessagePayload["payload"][] }> {
    //     let lastError: Error | undefined;

    //     for (let i = 0; i < RETRY_COUNT; i++) {
    //         try {
    //             this.refreshToken();

    //             const headers = {
    //                 "Content-Type": "application/json",
    //             };

    //             if (this.authToken) {
    //                 headers["Authorization"] = "Bearer " + this.authToken;
    //             }

    //             const messagesRet = await fetch("http://" + EZ_CHAT_URL + "/join/" + this.roomId + "/init", {
    //                 method: "GET",
    //                 headers,
    //             });

    //             if (messagesRet.ok) {
    //                 return { messages: await messagesRet.json() };
    //             } else if (messagesRet.status == 419) {
    //                 throw new Error("authToken is out of date");
    //             } else {
    //                 throw new Error(await messagesRet.text());
    //             }
    //         } catch (error) {
    //             lastError = error;
    //         }
    //     }

    //     if (lastError) {
    //         throw lastError;
    //     }
    // }

    async fetchMessages(cursor?: string, size?: number) {
        let lastError: Error | undefined;

        for (let i = 0; i < RETRY_COUNT; i++) {
            try {
                this.refreshToken();

                const headers = {
                    "Content-Type": "application/json",
                };

                if (this.authToken) {
                    headers["Authorization"] = "Bearer " + this.authToken;
                }

                const url = new URL("http://" + EZ_CHAT_URL + "/c/rooms/" + this.roomId + "/messages");
                if (cursor) url.searchParams.set("cursor", cursor.toString());
                if (size) url.searchParams.set("size", size.toString());

                const messagesRet = await fetch(url.toString(), {
                    method: "GET",
                    headers,
                });

                if (messagesRet.ok) {
                    const zCursorPaginatedMessages = z.custom<CursorPaginatedMessages>();
                    return zCursorPaginatedMessages.parse(await messagesRet.json());
                } else if (messagesRet.status == 419) {
                    this.authToken = await this.authFunction();
                    throw new Error("authToken is out of date");
                } else {
                    throw new Error(await messagesRet.text());
                }
            } catch (error) {
                lastError = error;
            }
        }

        if (lastError) {
            throw lastError;
        }
    }

    // I should reeeeealy maybe refresh the token here
    connectWebsocket(socketCallbacks?: IConnectWebsocketCallbacks) {
        const socket = connectToChatRoomWebsocket(this.roomId, this.authToken);

        socket.onopen = () => {
            console.log(`connected to room ${this.roomId}`);
            socketCallbacks?.onOpen?.();
        };

        socket.onmessage = (event) => {
            // TODO maybe add some validation or something
            const message: ChatRoomMessagePayload = JSON.parse(event.data);
            socketCallbacks?.onMessage(message);
        };

        socket.onclose = () => {
            console.log(`disconnected from room ${this.roomId}`);
            socketCallbacks?.onClose?.();
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error: ", error);
            socketCallbacks?.onError?.(error);
        };

        function sendMessage(message: string): void {
            if (!socket) {
                throw new Error(`Websocket for room ${this.roomId} is not connected`);
            }
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            } else {
                throw new Error(`Websocket for room ${this.roomId} is not connected`);
            }
        }

        function disconnect(): void {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        }

        return {
            sendMessage,
            disconnect,
        };
    }
}
