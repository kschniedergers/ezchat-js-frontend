// import { createBasicHeaders } from "../../utils";
import { EZ_CHAT_URL } from "./consts";
import { ChatRoomMessagePayload } from "./types";

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
}

export class ChatRoomConnection {
    private roomId: number;
    private authToken?: string;
    private messageCallback?: (message: ChatRoomMessagePayload) => void;
    private authFunction?: () => Promise<string>;

    constructor(props: IChatRoomConnectionProps) {
        this.roomId = props.roomId;
        this.authToken = props.authToken;
        this.messageCallback = props.messageCallback;
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

    async initConnection(): Promise<{ messages: ChatRoomMessagePayload[] }> {
        let lastError: Error | undefined;

        for (let i = 0; i < RETRY_COUNT; i++) {
            try {
                this.refreshToken();
                const messagesRet = await fetch("http://" + EZ_CHAT_URL + "/join/" + this.roomId + "/init", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: this.authToken ? "Bearer " + this.authToken : undefined,
                    },
                });

                if (messagesRet.ok) {
                    return { messages: await messagesRet.json() };
                } else if (messagesRet.status == 419) {
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
            const message: ChatRoomMessagePayload = JSON.parse(event.data);
            this.messageCallback?.(message);
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
