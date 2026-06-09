export type SignUpRequest = { email: string; password: string };
export type SignInRequest = { email: string; password: string };

export type AuthSuccessResponse = {
  success: true;
  user: { id: string; email: string };
  profile: { email: string; credits: number };
};

export type AuthErrorResponse = {
  success: false;
  error: string;
  code?: string;
};

export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

export type MeResponse =
  | {
      authenticated: true;
      user: { id: string; email: string };
      profile: { email: string; credits: number };
    }
  | { authenticated: false };
