from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import httpx
from typing import Optional
import os
import argparse
import aiofiles
import pkg_resources

app = FastAPI()

# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

index_html_path = pkg_resources.resource_filename('williamtoolbox', 'web/index.html')
resource_dir = os.path.dirname(index_html_path)
static_dir = os.path.join(resource_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Backend and File Upload URLs
global BACKEND_URL
BACKEND_URL = "http://localhost:8005"  # Default backend URL

# Use a session-wide HTTP client
app.state.client = httpx.AsyncClient()

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.client.aclose()

@app.get("/", response_class=HTMLResponse)
async def read_root():
    index_path = index_html_path
    if os.path.exists(index_path):
        async with aiofiles.open(index_path, "r") as f:
            content = await f.read()
        return HTMLResponse(content=content)
    else:
        return HTMLResponse(content="<h1>Welcome to Proxy Server</h1>")

@app.get("/get_backend_url")
async def get_backend_url():
    return {"backend_url": BACKEND_URL}

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def proxy(request: Request, path: str):
    url = f"{BACKEND_URL}/{path}"

    method = request.method    
    excluded_headers = {'host', 'content-length'}
    headers = {key: value for key, value in request.headers.items() if key.lower() not in excluded_headers}
    params = dict(request.query_params)
    body = await request.body()

    print(f"Request URL: {url}")
    print(f"Request Method: {method}")
    print(f"Request Headers: {headers}")
    print(f"Request Params: {params}")
    print(f"Request Body: {body}")

    try:
        response = await app.state.client.request(
            method,
            url,
            headers=headers,
            params=params,
            content=body, 
            timeout=3000           
        )
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print(f"Response Content: {response.content}")
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except httpx.RequestError as exc:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"error": f"An error occurred while requesting {exc.request.url!r}."}, status_code=500)



def main():
    global BACKEND_URL, FILE_UPLOAD_URL  # Declare as global to modify the global variables
    parser = argparse.ArgumentParser(description="Proxy Server")
    parser.add_argument('--backend_url', type=str, default="http://127.0.0.1:8005",
                        help='Backend service URL (default: http://127.0.0.1:8005)')    
    parser.add_argument('--port', type=int, default=8006,
                        help='Port to run the proxy server on (default: 8006)')
    parser.add_argument('--host', type=str, default="0.0.0.0",
                        help='Host to run the proxy server on (default: 0.0.0.0)')
    args = parser.parse_args()

    BACKEND_URL = args.backend_url    

    print(f"Starting proxy server with backend URL: {BACKEND_URL}")    
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
