// COPIED FROM BACKEND! CAREFUL EDITING WITHOUT CHANGING BOTH

export enum ChatRoomWebsocketEvent {
    JOIN = "join",
    LEAVE = "leave",
    MESSAGE = "message",
    BAN = "ban",
    DELETE_MESSAGE = "delete_message",
}

export interface ChatRoomMessagePayload {
    chatterId: number;
    chatterName: string;
    messageId: number;
    message: string;
    timestamp: number;
}

export interface ChatRoomJoinLeavePayload {
    chatterId: number;
    chatterName: string;
}

export interface ChatRoomDeleteMessagePayload {
    messageId: number;
}

export interface ChatRoomBanPayload {
    chatterId: number;
    chatterName: string;
    bannedBy: string;
}

export interface ChatRoomWebsocketMessage {
    type: ChatRoomWebsocketEvent;
    payload: ChatRoomMessagePayload | ChatRoomJoinLeavePayload | ChatRoomDeleteMessagePayload | ChatRoomBanPayload;
}
