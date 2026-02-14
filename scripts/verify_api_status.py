import asyncio
import httpx

async def main():
    target_id = 146122189
    url = f"http://localhost:8000/api/auth/binding-status/{target_id}"
    
    print(f"Calling API: {url}")
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {resp.json()}")
    except Exception as e:
        print(f"Failed to call API: {e}")

if __name__ == "__main__":
    asyncio.run(main())
