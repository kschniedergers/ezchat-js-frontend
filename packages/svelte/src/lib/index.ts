// Reexport your entry components here
import {} from "svelte";
import { ChatRoomMessagePayload } from "../core/types";
import { ChatRoomConnection } from "../core/client";

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

// Core state
const messages = $state<ChatRoomMessagePayload["payload"][]>([]);
const connectionStatus = $state<ConnectionStatus>("disconnected");

// Derived state (if you need computed values)
const messageCount = $derived(messages.length);

const chatRoomConnection = new ChatRoomConnection({ roomId: 123 });

// Methods
function sendMessage(text: string, sender: string) {
    const newMessage: Message = {
        id: crypto.randomUUID(),
        text,
        sender,
        timestamp: new Date(),
    };

    messages.push(newMessage);
    // Here you would also implement the actual sending logic
    // e.g., websocket.send(JSON.stringify(newMessage));
}

function connect() {
    connectionStatus = "connecting";
    // Implement your connection logic here
    // On success:
    // connectionStatus = 'connected';
    // On failure:
    // connectionStatus = 'disconnected';
}

function disconnect() {
    connectionStatus = "disconnected";
    // Implement your disconnection logic
}
