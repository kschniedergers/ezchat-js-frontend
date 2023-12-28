// import { createBasicHeaders } from "../../utils";
import { EZ_CHAT_URL } from "./consts";
import { ChatRoomMessagePayload } from "./types";

export function connectToChatRoomWebsocket(roomId: number, authToken?: string) {
    const params = authToken ? "?authToken=" + authToken : "";
    return new WebSocket("ws://" + EZ_CHAT_URL + "/join/" + roomId + params);
}

// don't ask me why i need to do this myself ¯\_(ツ)_/¯
// lol someday will code will fuck up because of this ascii shrug ¯\_(ツ)_/¯
export enum WebsocketState {
    CONNECTING = WebSocket.CONNECTING,
    OPEN = WebSocket.OPEN,
    CLOSING = WebSocket.CLOSING,
    CLOSED = WebSocket.CLOSED,
}

export function createChatRoomConnection(
    roomId: number,
    // authFunction?: () => Promise<string>,
    // authToken?: string,
    messageCallback?: (message: ChatRoomMessagePayload) => void
) {
    // TODO will need to paginate or cursor or something
    // checks auth, etc, and gets past messages
    async function initConnection(
        authFunction?: () => Promise<string>
    ): Promise<{ authToken?: string; messages: ChatRoomMessagePayload[] }> {
        const authToken = await authFunction?.();
        const messagesRet = await fetch("http://" + EZ_CHAT_URL + "/join/" + roomId + "/init", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + authToken
            },
        });
        console.log("but not here");
        if (messagesRet.ok) {
            return { authToken, messages: await messagesRet.json() };
        } else if (messagesRet.status == 419) {
            throw new Error("authToken is out of date");
        } else {
            throw new Error(await messagesRet.text());
        }
    }

    function connectWebsocket(
        authToken?: string,
        socketCallbacks?: { onOpen?: () => void; onError?: (err: Event) => void; onClose?: () => void }
    ) {
        const socket = connectToChatRoomWebsocket(roomId, authToken);

        socket.onopen = () => {
            console.log(`connected to room ${roomId}`);
            socketCallbacks?.onOpen?.();
        };

        socket.onmessage = (event) => {
            const message: ChatRoomMessagePayload = JSON.parse(event.data);
            messageCallback?.(message);
        };

        socket.onclose = () => {
            console.log(`disconnected from room ${roomId}`);
            socketCallbacks?.onClose?.();
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error: ", error);
            socketCallbacks?.onError?.(error);
        };

        function sendMessage(message: string): void {
            if (!socket) {
                throw new Error(`Websocket for room ${roomId} is not connected`);
            }
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            } else {
                throw new Error(`Websocket for room ${roomId} is not connected`);
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

    return {
        connectWebsocket,
        initConnection,
    };
}
