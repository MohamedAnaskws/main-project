export interface Env {
  API_BASE_URL?: string;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    // Proxy API requests to backend
    if (url.pathname.startsWith('/api') || 
        url.pathname.startsWith('/uploads') || 
        url.pathname.startsWith('/ws')) {
      
      const backendUrl = env.API_BASE_URL || 'https://stagnant-diner-mundane.ngrok-free.dev';
      const apiUrl = new URL(url.pathname + url.search, backendUrl);
      
      return fetch(apiUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};