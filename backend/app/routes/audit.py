from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..auth import require_hr
from ..db import get_db
from ..models import AuditLog, User
from ..schemas import AuditOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditOut])
def list_audit(_: User = Depends(require_hr), db: Session = Depends(get_db)):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [{
        "id": entry.id,
        "actor_name": entry.actor.email,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "details": entry.details,
        "created_at": entry.created_at,
    } for entry in entries]