import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
	session: string | null;
	isLoading: boolean;
	login: (token: string) => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		setIsLoading(false);
	}, []);

	const login = (token: string) => {
		setSession(token);
	};

	const logout = () => {
		setSession(null);
	};

	return (
		<AuthContext.Provider value={{ session, isLoading, login, logout }}>
		{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
    }
    return context;
}