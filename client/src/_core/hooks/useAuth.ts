type GuestCompatibleUser = {
  name?: string | null;
  email?: string | null;
};

function getGuestUser(): GuestCompatibleUser | null {
  return null;
}

export function useAuth() {
  return {
    user: getGuestUser(),
    loading: false,
    error: null,
    isAuthenticated: false,
    logout: async () => undefined,
    startLogin: () => undefined,
  };
}
