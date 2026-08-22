from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .routes import auth, employees, leaves, attendance, payroll, notifications, dashboard, decisions, audit

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dayflow API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(leaves.router)
app.include_router(attendance.router)
app.include_router(payroll.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(decisions.router)
app.include_router(audit.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "dayflow-api"}
