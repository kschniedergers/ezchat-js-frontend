// COPIED FROM BACKEND! CAREFUL EDITING WITHOUT CHANGING BOTH

export enum ChatterType {
    CLIENT_ADMIN = "client_admin",
    ANONYMOUS = "anonymous",
    LOGGED_IN_CHATTER = "logged_in_chatter",
}

export enum MessageModerationStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    UNMODERATED = "unmoderated",
}

export interface ChatRoomMessagePayload {
    payloadType: "message";
    payload: {
        id: number;
        chatterType: ChatterType;
        messageText: string;
        sentAt: Date;
        moderationStatus: MessageModerationStatus;
        chatter: {
            id?: number;
            name: string;
        };
    };
}

// i know its kinda gross but I want as many similarities to the message payload as possible
// in the case that people don't know about payload types and don't to a switch and can still
// get a basic thing going
export interface ChatRoomJoinLeavePayload {
    payloadType: "join" | "leave";
    payload: {
        messageText: string;
        chatter: {
            id?: number;
            name: string;
        };
    };
}

export interface ChatRoomDeleteMessagePayload {
    payloadType: "delete_message";
    payload: {
        messageId: number;
    };
}

export interface ChatRoomBanPayload {
    payloadType: "ban";
    payload: {
        chatterId: number;
        chatterName: string;
        bannedBy: string;
    };
}

export interface ChatRoomErrorPayload {
    payloadType: "error";
    payload: {
        message: string;
    };
}

export type ChatRoomWebsocketMessage =
    | ChatRoomMessagePayload
    | ChatRoomJoinLeavePayload
    | ChatRoomDeleteMessagePayload
    | ChatRoomBanPayload
    | ChatRoomErrorPayload;

export type CursorPaginatedMessages = {
    messages: ChatRoomMessagePayload["payload"][];
    nextCursor?: string;
    total?: number;
};
