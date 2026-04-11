import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.middleware.auth import get_current_user

router = APIRouter()

SERVICE_URLS: dict[str, str] = {
    "auth": "http://auth:8007",
    "crm": "http://crm:8004",
    "analytics": "http://analytics:8006",
    "routing": "http://routing:8005",
    "llm": "http://llm:8003",
}

_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    }
)

_RESPONSE_DROP = frozenset(
    {"content-encoding", "transfer-encoding", "connection"}
)


def _forward_headers(request: Request) -> dict[str, str]:
    out: dict[str, str] = {}
    for name, value in request.headers.items():
        lower = name.lower()
        if lower in _HOP_BY_HOP or lower == "host":
            continue
        out[name] = value
    return out


async def _proxy(
    request: Request,
    client: httpx.AsyncClient,
    base_url: str,
    upstream_path: str,
) -> Response:
    path = upstream_path if upstream_path.startswith("/") else f"/{upstream_path}"
    path = path.rstrip("/") or "/"
    url = f"{base_url.rstrip('/')}{path}"
    query = request.url.query
    if query:
        url = f"{url}?{query}"

    body = await request.body()
    headers = _forward_headers(request)

    try:
        upstream = await client.request(
            request.method,
            url,
            headers=headers,
            content=body if body else None,
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream unreachable: {exc!s}",
        ) from exc

    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in _RESPONSE_DROP
    }
    media_type = upstream.headers.get("content-type")
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=media_type,
    )


def _client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


# --- Auth (no auth required) ---

@router.post("/auth/{path:path}")
async def proxy_auth(path: str, request: Request) -> Response:
    base = SERVICE_URLS["auth"]
    return await _proxy(request, _client(request), base, f"/auth/{path}")


# --- Users ---

@router.api_route("/users", methods=["GET", "POST", "PATCH"])
async def proxy_users_root(
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["auth"]
    return await _proxy(request, _client(request), base, "/users")


@router.api_route("/users/{path:path}", methods=["GET", "POST", "PATCH"])
async def proxy_users(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["auth"]
    return await _proxy(request, _client(request), base, f"/users/{path}")


# --- Appeals ---

@router.api_route("/appeals", methods=["GET", "POST"])
async def proxy_appeals_root(
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["crm"]
    return await _proxy(request, _client(request), base, "/appeals")


@router.api_route("/appeals/{path:path}", methods=["GET", "POST", "PATCH"])
async def proxy_appeals(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["crm"]
    return await _proxy(request, _client(request), base, f"/appeals/{path}")


# --- Analytics ---

@router.api_route("/analytics/{path:path}", methods=["GET"])
async def proxy_analytics(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["analytics"]
    return await _proxy(request, _client(request), base, f"/{path}")


# --- Branches ---

@router.api_route("/branches", methods=["GET", "POST"])
async def proxy_branches_root(
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["routing"]
    return await _proxy(request, _client(request), base, "/branches")


@router.api_route("/branches/{path:path}", methods=["GET", "POST"])
async def proxy_branches(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["routing"]
    return await _proxy(request, _client(request), base, f"/branches/{path}")


# --- Routing ---

@router.api_route("/routing/{path:path}", methods=["GET", "POST"])
async def proxy_routing(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["routing"]
    return await _proxy(request, _client(request), base, f"/routing/{path}")


# --- LLM ---

@router.api_route("/llm/{path:path}", methods=["POST"])
async def proxy_llm(
    path: str,
    request: Request,
    _user: dict = Depends(get_current_user),
) -> Response:
    base = SERVICE_URLS["llm"]
    return await _proxy(request, _client(request), base, f"/llm/{path}")
