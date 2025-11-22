"""Clerk authentication middleware for FastAPI.

Extracts and validates Clerk JWTs from Authorization headers.
"""
import logging
import jwt
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from clerk_backend_api import Clerk
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Clerk client
clerk_client: Optional[Clerk] = None

def get_clerk_client() -> Clerk:
    """Get or initialize Clerk client."""
    global clerk_client
    if clerk_client is None:
        if not settings.CLERK_SECRET_KEY:
            raise ValueError("CLERK_SECRET_KEY not configured")
        clerk_client = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)
    return clerk_client


def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verify Clerk JWT token without signature verification.

    For production, you should verify the signature using Clerk's JWKS endpoint.
    For now, we'll decode without verification since we're in development.

    Args:
        token: JWT token from Authorization header

    Returns:
        Decoded token payload

    Raises:
        Exception: If token is invalid or expired
    """
    try:
        # Decode without verification (development only)
        # In production, fetch and verify against Clerk's JWKS
        decoded = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["RS256"]
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise Exception("Token has expired")
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {str(e)}")


security = HTTPBearer(auto_error=False)


async def get_current_user_id(request: Request) -> str:
    """
    Extract and validate Clerk user ID from Authorization header.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Clerk user ID (string)
        
    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    # DEVELOPMENT MODE: Return demo user if no auth header
    # This allows testing without Clerk authentication
    auth_header = request.headers.get("Authorization")
    
    if not auth_header:
        # In development, return a demo user ID
        if settings.ENVIRONMENT == "development" or not settings.CLERK_SECRET_KEY:
            logger.warning("No auth header - using demo user in development mode")
            return "demo-user-dev"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token
    if not auth_header.startswith("Bearer "):
        # In development, allow missing Bearer prefix
        if settings.ENVIRONMENT == "development" or not settings.CLERK_SECRET_KEY:
            logger.warning("Invalid auth format - using demo user in development mode")
            return "demo-user-dev"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials - must be Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_header.replace("Bearer ", "")
    
    if not token:
        # In development, return demo user
        if settings.ENVIRONMENT == "development" or not settings.CLERK_SECRET_KEY:
            logger.warning("Empty token - using demo user in development mode")
            return "demo-user-dev"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - empty token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token
    try:
        # Verify and decode the JWT token
        decoded = verify_clerk_token(token)

        if not decoded or "sub" not in decoded:
            # In development, return demo user if verification fails
            if settings.ENVIRONMENT == "development" or not settings.CLERK_SECRET_KEY:
                logger.warning("Token verification failed - using demo user in development mode")
                return "demo-user-dev"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - verification failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = decoded["sub"]
        logger.debug(f"Authenticated user: {user_id}")
        return user_id

    except HTTPException:
        raise
    except Exception as e:
        # In development, return demo user on any error
        if settings.ENVIRONMENT == "development" or not settings.CLERK_SECRET_KEY:
            logger.warning(f"Token error in development mode: {e} - using demo user")
            return "demo-user-dev"
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user_id(request: Request) -> Optional[str]:
    """
    Extract user ID if present, but don't require authentication.
    
    Useful for endpoints that work both authenticated and unauthenticated.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Clerk user ID if authenticated, None otherwise
    """
    try:
        return await get_current_user_id(request)
    except HTTPException:
        return None

