type Verifiers = {
  code_verifier: string;
  code_challenge: string;
};

type GithubAccessTokenEndpointResponse = {
  access_token: string;
  scope: string;
  token_type: string;
};

type GithubUserResponse = {
  login: string;
  id: string;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  gists_url: string;
  starred_url: string;
  hireable: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  notification_email: string;
  email: string;
};

type User = {
  id: string;
  github_id: string;
  username: string;
  email: string;
  avatar_url: string;
  role: UserRoles;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
};

type UserRoles = 'admin' | 'analyst';

type UserAuthToken = {
  access_token: string;
  refresh_token: string;
};

export type {
  Verifiers,
  GithubAccessTokenEndpointResponse,
  GithubUserResponse,
  User,
  UserRoles,
  UserAuthToken,
};
