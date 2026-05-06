import Cookies from "js-cookie";

// ================= CHECK IF USING NGROK =================
const isNgrok = (): boolean => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return apiUrl.includes('ngrok');
};

// ================= SET AUTH =================
export const setAuth = (data: { access_token: string; user: any }) => {
  const token = data.access_token;
  const user = data.user;

  // Store in both places for redundancy
  Cookies.set("access_token", token, { expires: 1, sameSite: 'Lax', secure: false });
  Cookies.set("user", JSON.stringify(user), { expires: 1, sameSite: 'Lax', secure: false });
  localStorage.setItem("access_token", token);
  localStorage.setItem("user", JSON.stringify(user));
  
  // Store timestamp for cache validation
  localStorage.setItem("auth_timestamp", Date.now().toString());
  
  // Update memory cache immediately
  cachedToken = token;
  cachedUser = user;
  tokenCacheTime = Date.now();
  userCacheTime = Date.now();
};

// ================= GET TOKEN =================
let cachedToken: string | undefined = undefined;
let tokenCacheTime: number = 0;
const TOKEN_CACHE_DURATION = 5000; // 5 seconds cache

export const getToken = (): string | undefined => {
  // Return cached token if fresh
  const now = Date.now();
  if (cachedToken && (now - tokenCacheTime) < TOKEN_CACHE_DURATION) {
    return cachedToken;
  }
  
  // Get from sources - try localStorage first (faster)
  let token = localStorage.getItem("access_token");
  if (!token) {
    token = Cookies.get("access_token");
  }
  
  // Update cache
  cachedToken = token || undefined;
  tokenCacheTime = now;
  
  return cachedToken;
};

// ================= GET USER =================
let cachedUser: any = null;
let userCacheTime: number = 0;
const USER_CACHE_DURATION = 300000; // 5 MINUTES - increased from 1 second!

export const getUser = (): any | null => {
  // Return cached user if fresh
  const now = Date.now();
  if (cachedUser && (now - userCacheTime) < USER_CACHE_DURATION) {
    console.log('📦 Returning cached user from memory');
    return cachedUser;
  }
  
  try {
    // Try localStorage first (faster)
    let userData = null;
    const lsUser = localStorage.getItem("user");
    if (lsUser) {
      userData = JSON.parse(lsUser);
      console.log('📦 Got user from localStorage');
    } else {
      const cookieUser = Cookies.get("user");
      if (cookieUser) {
        userData = JSON.parse(cookieUser);
        console.log('📦 Got user from cookie');
      }
    }
    
    // Update cache
    if (userData) {
      cachedUser = userData;
      userCacheTime = now;
    }
    
    return userData;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
};

// ================= GET ROLE =================
export const getRoleId = (): number | null => {
  return getUser()?.roleid || null;
};

// ================= CHECK AUTH =================
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// ================= GET AUTH HEADERS =================
export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (isNgrok()) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  return headers;
};

// ================= FORCE REFRESH AUTH CACHE =================
export const refreshAuthCache = (): void => {
  cachedToken = undefined;
  cachedUser = null;
  tokenCacheTime = 0;
  userCacheTime = 0;
};

// ================= LOGOUT =================
export const logout = (): void => {
  Cookies.remove("access_token");
  Cookies.remove("user");
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  localStorage.removeItem("last_conversation_id");
  localStorage.removeItem("cached_conversations");
  localStorage.removeItem("auth_timestamp");
  
  refreshAuthCache();
  
  window.location.href = "/";
};