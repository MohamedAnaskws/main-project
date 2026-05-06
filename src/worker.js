export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Proxy API requests to your ngrok backend
    if (url.pathname.startsWith("/api")) {
      // Get backend URL from env, with fallback for local development
      const backendUrl = env.API_BASE_URL || "https://stagnant-diner-mundane.ngrok-free.dev";
      
      // Reconstruct the full API URL
      const apiUrl = new URL(url.pathname + url.search, backendUrl);
      
      // Clone headers to modify them if needed
      const headers = new Headers(request.headers);
      
      // Forward the request to your actual backend
      try {
        const response = await fetch(apiUrl.toString(), {
          method: request.method,
          headers: headers,
          body: request.body
        });
        
        // Return the response with CORS headers if needed
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        };
        
        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: corsHeaders });
        }
        
        // Create response with CORS headers
        const modifiedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        
        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          modifiedResponse.headers.set(key, value);
        });
        
        return modifiedResponse;
      } catch (error) {
        return new Response(JSON.stringify({ error: "Proxy error: " + error.message }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // Serve static assets (your Vite build)
    return env.ASSETS.fetch(request);
  }
}