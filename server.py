from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List
import logging
import databases
import sqlalchemy
import uvicorn

logging.basicConfig(level=logging.INFO)

DATABASE_URL = "sqlite:///./cognizant.db"
database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

# Define tables
test_results_table = sqlalchemy.Table(
    "test_results",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("type", sqlalchemy.String),
    sqlalchemy.Column("timestamp", sqlalchemy.String),
    sqlalchemy.Column("result", sqlalchemy.JSON),
)

usage_logs_table = sqlalchemy.Table(
    "usage_logs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("domain", sqlalchemy.String),
    sqlalchemy.Column("timestamp", sqlalchemy.String),
    sqlalchemy.Column("duration", sqlalchemy.Integer),
)

engine = sqlalchemy.create_engine(DATABASE_URL)
metadata.create_all(engine)

app = FastAPI()

# Define Pydantic models
class TestResult(BaseModel):
    type: str
    timestamp: str
    result: dict

class UsageLog(BaseModel):
    domain: str
    timestamp: str
    duration: int

# Manage WebSocket connections
active_connections = []

async def connect_websocket(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    logging.info(f"WebSocket client connected: {websocket.client}")

async def disconnect_websocket(websocket: WebSocket):
    active_connections.remove(websocket)
    logging.info(f"WebSocket client disconnected: {websocket.client}")

async def broadcast_message(message: str):
    for connection in active_connections:
        try:
            await connection.send_text(message)
        except Exception as e:
            logging.error(f"Failed to send message to client: {e}")

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.post("/test-results/")
async def add_test_result(result: TestResult):
    query = test_results_table.insert().values(type=result.type, timestamp=result.timestamp, result=result.result)
    await database.execute(query)
    logging.info(f"Received Test Result: {result}")
    await broadcast_message(result.json())
    return {"message": "Test result added successfully"}

@app.get("/test-results/", response_model=List[TestResult])
async def get_test_results():
    query = test_results_table.select()
    results = await database.fetch_all(query)
    return [TestResult(**result) for result in results]

@app.post("/usage-logs/")
async def add_usage_log(log: UsageLog):
    query = usage_logs_table.insert().values(domain=log.domain, timestamp=log.timestamp, duration=log.duration)
    await database.execute(query)
    logging.info(f"Received Usage Log: {log}")
    await broadcast_message(log.json())
    return {"message": "Usage log added successfully"}

@app.get("/usage-logs/", response_model=List[UsageLog])
async def get_usage_logs():
    query = usage_logs_table.select()
    logs = await database.fetch_all(query)
    return [UsageLog(**log) for log in logs]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await connect_websocket(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep the connection open
    except WebSocketDisconnect:
        await disconnect_websocket(websocket)

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
