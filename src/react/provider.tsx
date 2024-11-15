import React, { ReactNode, createContext, useContext } from "react";

export interface EzChatContextProps {
    authFunction: () => Promise<string>;
}

export const EzChatContext = createContext<EzChatContextProps | null>(null);

interface EzChatProviderProps {
    authFunction: () => Promise<string>;
    children?: ReactNode;
}

export const EzChatProvider = ({ children, authFunction }: EzChatProviderProps) => {
    const contextValue: EzChatContextProps = {
        authFunction,
    };

    return <EzChatContext.Provider value={contextValue}>{children}</EzChatContext.Provider>;
};
