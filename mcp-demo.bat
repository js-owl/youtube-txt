@echo off
setlocal enabledelayedexpansion

cd /d "c:\avk_test\ai\03"

echo === Step 1: Initialize MCP session ===
curl -s -X POST "https://mcp.context7.com/mcp" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -D "headers.txt" ^
  -d @init.json ^
  --max-time 15
echo.
echo.

echo === Step 2: Extract session ID ===
for /f "tokens=2 delims=:" %%a in ('findstr /i "mcp-session-id" headers.txt') do (
    set "RAW_SID=%%a"
)
REM Trim whitespace and CR/LF
for /f "tokens=*" %%b in ("!RAW_SID!") do set "SESSION_ID=%%b"
echo Session ID: [!SESSION_ID!]
echo.

if "!SESSION_ID!"=="" (
    echo ERROR: No session ID extracted
    goto :cleanup
)

echo === Step 3: Send notifications/initialized ===
curl -s -X POST "https://mcp.context7.com/mcp" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -H "Mcp-Session-Id: !SESSION_ID!" ^
  -d @initialized.json ^
  --max-time 10
echo.
echo notifications/initialized sent
echo.

echo === Step 4: List available tools ===
curl -s -X POST "https://mcp.context7.com/mcp" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -H "Mcp-Session-Id: !SESSION_ID!" ^
  -d @toolslist.json ^
  --max-time 15
echo.
echo.

echo === Step 5: Call resolve-library-id tool (demonstrate capability) ===
curl -s -X POST "https://mcp.context7.com/mcp" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -H "Mcp-Session-Id: !SESSION_ID!" ^
  -d @resolve.json ^
  --max-time 25
echo.
echo.

echo === Demo complete ===

:cleanup
del headers.txt 2>nul
endlocal
